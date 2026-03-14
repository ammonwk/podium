#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

DOMAIN="hackathon.plaibook.tech"
DEPLOY_DIR="/opt/podium"
APP_PORT=8000
SSH_USER="ubuntu"
SSH_OPTS="-o StrictHostKeyChecking=no"

# AWS — set HOSTED_ZONE_ID for Route 53 DNS updates
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"

# ─── Helpers ──────────────────────────────────────────────────────────────────

log()  { echo -e "\033[1;34m►\033[0m $*"; }
ok()   { echo -e "\033[1;32m✓\033[0m $*"; }
fail() { echo -e "\033[1;31m✗\033[0m $*" >&2; exit 1; }

ssh_cmd() { ssh $SSH_OPTS "$SSH_USER@$HOST" "$@"; }

usage() {
  cat <<EOF
Usage: $0 <command> [host]

Commands:
  setup <host>     First-time server provisioning (Node 20, nginx, pm2, certbot)
  deploy <host>    Build locally, push code, restart app
  dns <ip>         Update Route 53 A record for $DOMAIN
  full <host>      setup + deploy + dns (all-in-one)

Environment:
  HOSTED_ZONE_ID   Route 53 hosted zone ID (required for dns command)
  SSH_USER         SSH user (default: ubuntu)
  AUTH_PASSWORD     Override the login password on the server
EOF
  exit 1
}

# ─── Build ────────────────────────────────────────────────────────────────────

build() {
  log "Building dashboard..."
  npm run build
  ok "Build complete"
}

# ─── Setup (first-time server provisioning) ───────────────────────────────────

setup() {
  log "Setting up server at $HOST..."

  ssh_cmd "sudo bash -s" <<'SETUP_EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo ">>> Installing Node.js 20..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo ">>> Installing nginx..."
apt-get install -y nginx

echo ">>> Installing pm2..."
npm install -g pm2

echo ">>> Installing certbot..."
apt-get install -y certbot python3-certbot-nginx

echo ">>> Creating deploy directory..."
mkdir -p /opt/podium
chown ubuntu:ubuntu /opt/podium

echo ">>> Setup complete"
SETUP_EOF

  log "Writing nginx config..."
  ssh_cmd "sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null" <<NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
NGINX_EOF

  ssh_cmd "sudo bash -s" <<ENABLE_EOF
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ENABLE_EOF

  log "Requesting SSL certificate..."
  ssh_cmd "sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || echo 'Certbot failed — DNS may not be pointing here yet. Run certbot manually after DNS propagates.'"

  log "Configuring pm2 startup..."
  ssh_cmd "pm2 startup systemd -u $SSH_USER --hp /home/$SSH_USER 2>/dev/null | grep 'sudo' | bash || true"

  ok "Server setup complete"
}

# ─── Deploy ───────────────────────────────────────────────────────────────────

deploy() {
  build

  log "Syncing files to $HOST:$DEPLOY_DIR..."
  rsync -az --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env' \
    ./ "$SSH_USER@$HOST:$DEPLOY_DIR/"

  log "Copying .env..."
  if [[ -f .env ]]; then
    scp $SSH_OPTS .env "$SSH_USER@$HOST:$DEPLOY_DIR/.env"
  else
    fail "No .env file found. Create one from .env.example"
  fi

  log "Installing dependencies on server..."
  ssh_cmd "cd $DEPLOY_DIR && npm ci"

  log "Restarting application..."
  ssh_cmd "cd $DEPLOY_DIR && pm2 delete podium 2>/dev/null || true && NODE_ENV=production pm2 start node_modules/.bin/tsx --name podium -- apps/server/src/main.ts && pm2 save"

  ok "Deployed to https://$DOMAIN"
}

# ─── DNS (Route 53) ──────────────────────────────────────────────────────────

update_dns() {
  local ip="$1"

  if [[ -z "$HOSTED_ZONE_ID" ]]; then
    # Try to auto-detect the hosted zone from the domain
    local base_domain
    base_domain=$(echo "$DOMAIN" | awk -F. '{print $(NF-1)"."$NF}')
    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
      --dns-name "$base_domain" \
      --query "HostedZones[0].Id" \
      --output text 2>/dev/null | sed 's|/hostedzone/||')

    if [[ -z "$HOSTED_ZONE_ID" || "$HOSTED_ZONE_ID" == "None" ]]; then
      fail "Could not detect Route 53 hosted zone. Set HOSTED_ZONE_ID env var."
    fi
    log "Auto-detected hosted zone: $HOSTED_ZONE_ID"
  fi

  log "Updating DNS: $DOMAIN → $ip"
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"$DOMAIN\",
          \"Type\": \"A\",
          \"TTL\": 60,
          \"ResourceRecords\": [{\"Value\": \"$ip\"}]
        }
      }]
    }"

  ok "DNS updated: $DOMAIN → $ip (TTL 60s)"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

COMMAND="${1:-}"
HOST="${2:-}"

case "$COMMAND" in
  setup)
    [[ -z "$HOST" ]] && fail "Usage: $0 setup <host>"
    setup
    ;;
  deploy)
    [[ -z "$HOST" ]] && fail "Usage: $0 deploy <host>"
    deploy
    ;;
  dns)
    [[ -z "$HOST" ]] && fail "Usage: $0 dns <ip>"
    update_dns "$HOST"
    ;;
  full)
    [[ -z "$HOST" ]] && fail "Usage: $0 full <host>"
    # Get the public IP of the host
    PUBLIC_IP=$(ssh $SSH_OPTS "$SSH_USER@$HOST" "curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s ifconfig.me")
    log "Server public IP: $PUBLIC_IP"
    setup
    deploy
    update_dns "$PUBLIC_IP"
    log "Requesting SSL certificate (now that DNS is set)..."
    ssh_cmd "sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || echo 'Certbot may need DNS to propagate. Retry: sudo certbot --nginx -d $DOMAIN'"
    echo ""
    ok "Full deployment complete!"
    echo "   https://$DOMAIN"
    echo "   Password: (set in .env as AUTH_PASSWORD, default: 'secret demo password')"
    ;;
  *)
    usage
    ;;
esac
