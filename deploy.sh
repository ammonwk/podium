#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

DOMAIN="hackathon.plaibook.tech"
DEPLOY_DIR="/opt/podium"
APP_PORT=8000
SSH_USER="ubuntu"
SSH_KEY="$HOME/.ssh/chatterbox-key.pem"
SSH_OPTS="-o StrictHostKeyChecking=no -i $SSH_KEY"

# AWS
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.xlarge}"
KEY_NAME="${KEY_NAME:-chatterbox-key}"
AMI_ID="${AMI_ID:-ami-0071174ad8cbb9e17}"  # Ubuntu 24.04 us-east-1

# ─── Helpers ──────────────────────────────────────────────────────────────────

log()  { echo -e "\033[1;34m►\033[0m $*"; }
ok()   { echo -e "\033[1;32m✓\033[0m $*"; }
fail() { echo -e "\033[1;31m✗\033[0m $*" >&2; exit 1; }

ssh_cmd() { ssh $SSH_OPTS "$SSH_USER@$HOST" "$@"; }

usage() {
  cat <<EOF
Usage: $0 <command> [args]

Commands:
  provision        Launch EC2 instance (auto-terminates in 12h)
  setup <host>     First-time server provisioning (Node 20, nginx, pm2, certbot)
  deploy <host>    Build locally, push code, restart app
  dns <ip>         Update Route 53 A record for $DOMAIN
  full <host>      setup + deploy + dns (all-in-one)

Environment:
  HOSTED_ZONE_ID   Route 53 hosted zone ID (auto-detected if unset)
  KEY_NAME         EC2 key pair name (default: aun-key)
  INSTANCE_TYPE    EC2 instance type (default: t3.large)
  SSH_USER         SSH user (default: ubuntu)
EOF
  exit 1
}

# ─── Provision ────────────────────────────────────────────────────────────────

provision() {
  log "Provisioning EC2 instance ($INSTANCE_TYPE)..."

  # Create or reuse security group
  local sg_name="podium-hackathon-sg"
  local sg_id

  sg_id=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$sg_name" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo "None")

  if [[ "$sg_id" == "None" || -z "$sg_id" ]]; then
    log "Creating security group: $sg_name"
    sg_id=$(aws ec2 create-security-group \
      --group-name "$sg_name" \
      --description "Podium hackathon - SSH, HTTP, HTTPS" \
      --query 'GroupId' --output text)

    aws ec2 authorize-security-group-ingress --group-id "$sg_id" \
      --ip-permissions \
        IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0}]' \
        IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=0.0.0.0/0}]' \
        IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges='[{CidrIp=0.0.0.0/0}]'
    ok "Security group created: $sg_id"
  else
    log "Reusing security group: $sg_id"
  fi

  # User data script: schedule self-termination in 12 hours
  local user_data
  user_data=$(cat <<'USERDATA'
#!/bin/bash
# Auto-terminate this instance in 12 hours
echo "sudo shutdown -h now" | at now + 12 hours
# Install at daemon if not present
apt-get update -qq && apt-get install -y -qq at
echo "sudo shutdown -h now" | at now + 12 hours
# Tag the expiry time for visibility
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
EXPIRY=$(date -u -d '+12 hours' '+%Y-%m-%dT%H:%M:%SZ')
aws ec2 create-tags --region "$REGION" --resources "$INSTANCE_ID" \
  --tags "Key=ExpiresAt,Value=$EXPIRY" 2>/dev/null || true
USERDATA
)

  # Launch instance
  local instance_id
  instance_id=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$sg_id" \
    --instance-initiated-shutdown-behavior terminate \
    --user-data "$user_data" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=podium-hackathon},{Key=Project,Value=podium},{Key=AutoExpire,Value=12h}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

  log "Instance launched: $instance_id"
  log "Waiting for instance to be running..."

  aws ec2 wait instance-running --instance-ids "$instance_id"

  # Get public IP
  local public_ip
  public_ip=$(aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

  ok "Instance ready!"
  echo ""
  echo "   Instance ID:  $instance_id"
  echo "   Public IP:    $public_ip"
  echo "   Type:         $INSTANCE_TYPE"
  echo "   Auto-expires: $(date -u -d '+12 hours' '+%Y-%m-%d %H:%M UTC')"
  echo ""
  echo "   Next steps:"
  echo "     ./deploy.sh full $public_ip"
  echo ""
  echo "   Or to terminate early:"
  echo "     aws ec2 terminate-instances --instance-ids $instance_id"
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

  # Wait for SSH to be available (fresh instances take a moment)
  log "Waiting for SSH..."
  local retries=0
  while ! ssh $SSH_OPTS -o ConnectTimeout=5 "$SSH_USER@$HOST" "echo ok" &>/dev/null; do
    retries=$((retries + 1))
    if [[ $retries -gt 30 ]]; then
      fail "SSH not available after 150s"
    fi
    sleep 5
  done
  ok "SSH connected"

  log "Waiting for cloud-init to finish..."
  ssh_cmd "cloud-init status --wait 2>/dev/null || true"

  ssh_cmd "sudo bash -s" <<'SETUP_EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Wait for cloud-init / unattended-upgrades to release all apt/dpkg locks
echo ">>> Waiting for apt/dpkg locks..."
while fuser /var/lib/apt/lists/lock /var/lib/dpkg/lock /var/lib/dpkg/lock-frontend /var/cache/apt/archives/lock &>/dev/null 2>&1; do
  sleep 3
done
# Extra wait — cloud-init can re-acquire locks between operations
sleep 10
while fuser /var/lib/apt/lists/lock /var/lib/dpkg/lock /var/lib/dpkg/lock-frontend /var/cache/apt/archives/lock &>/dev/null 2>&1; do
  sleep 3
done

echo ">>> Installing Node.js 20 via NodeSource..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
apt-get update -y
apt-get install -y nodejs

echo ">>> Node $(node -v), npm $(npm -v)"

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
    -e "ssh $SSH_OPTS" \
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
  provision)
    provision
    ;;
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
    PUBLIC_IP=$(ssh $SSH_OPTS -o ConnectTimeout=10 "$SSH_USER@$HOST" "curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s ifconfig.me")
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
