// ─── Property IDs ────────────────────────────────────────────────────────────

export const PROPERTY_IDS = {
  OCEANVIEW_COTTAGE: 'PROP_001',
  MOUNTAIN_LOFT: 'PROP_002',
  CANYON_HOUSE: 'PROP_003',
} as const;

// ─── Vendor IDs ──────────────────────────────────────────────────────────────

export const VENDOR_IDS = {
  MIKES_PLUMBING: 'VENDOR_001',
  JOES_PLUMBING: 'VENDOR_002',
  BRIGHT_ELECTRICAL: 'VENDOR_003',
  SPOTLESS_CLEANING: 'VENDOR_004',
  ALLFIX_MAINTENANCE: 'VENDOR_005',
  PEAK_HVAC: 'VENDOR_006',
} as const;

// ─── Phone Numbers ───────────────────────────────────────────────────────────

export const PHONE_NUMBERS = {
  OWNER_DAVID: '+18015550000',
  SARAH_CHEN: '+18015550001',
  JAMES_WRIGHT: '+18015550002',
  LISA_KIM: '+18015550003',
  MIKE_TORRES: '+18015550004',
  ANNA_PARK: '+18015550005',
} as const;

// ─── Tool Names ──────────────────────────────────────────────────────────────

export const TOOL_NAMES = {
  SEND_SMS: 'send_sms',
  CREATE_WORK_ORDER: 'create_work_order',
  ADJUST_PRICE: 'adjust_price',
  LOG_DECISION: 'log_decision',
  GET_MARKET_DATA: 'get_market_data',
  UPDATE_SCHEDULE: 'update_schedule',
  SCHEDULE_TASK: 'schedule_task',
} as const;

// ─── SSE Event Names ─────────────────────────────────────────────────────────

export const SSE_EVENTS = {
  THINKING: 'thinking',
  TOOL_CALL: 'tool_call',
  EVENT_START: 'event_start',
  EVENT_DONE: 'event_done',
  SCHEDULED_TASK: 'scheduled_task',
  EVENT_QUEUED: 'event_queued',
  ERROR: 'error',
  RESET: 'reset',
} as const;

// ─── Provider Defaults ───────────────────────────────────────────────────────

export const PROVIDERS = {
  ANTHROPIC: {
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-5-20251001',
  },
  CEREBRAS: {
    provider: 'cerebras' as const,
    model: 'llama-4-scout-17b-16e-instruct',
  },
};

export const DEFAULT_PROVIDER = PROVIDERS.ANTHROPIC;

// ─── Tool Card Colors (for dashboard) ────────────────────────────────────────

export const TOOL_COLORS: Record<string, string> = {
  send_sms: '#3b82f6',
  create_work_order: '#f59e0b',
  adjust_price: '#22c55e',
  log_decision: '#6b7280',
  get_market_data: '#22c55e',
  update_schedule: '#8b5cf6',
  schedule_task: '#14b8a6',
};

// ─── Dashboard Theme ─────────────────────────────────────────────────────────

export const THEME = {
  bg: {
    primary: '#0a0a0f',
    card: '#12121a',
    cardHover: '#1a1a28',
    border: '#1e1e2e',
    borderLight: '#2a2a3e',
  },
  text: {
    primary: '#e4e4e7',
    secondary: '#a1a1aa',
    muted: '#71717a',
    accent: '#f4f4f5',
  },
  status: {
    normal: '#22c55e',
    attention: '#f59e0b',
    emergency: '#ef4444',
    selfInitiated: '#14b8a6',
  },
  tool: {
    sms: '#3b82f6',
    maintenance: '#f59e0b',
    pricing: '#22c55e',
    scheduling: '#8b5cf6',
    decision: '#6b7280',
    task: '#14b8a6',
  },
  font: {
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    sans: "'Inter', system-ui, -apple-system, sans-serif",
  },
} as const;

// ─── Demo Events ─────────────────────────────────────────────────────────────

export const DEMO_EVENTS = [
  {
    type: 'guest_message' as const,
    name: 'Late Checkout Request',
    from: PHONE_NUMBERS.SARAH_CHEN,
    body: 'Hey! Any chance I could check out at 1PM instead of 11AM tomorrow?',
  },
  {
    type: 'guest_message' as const,
    name: 'Emergency Maintenance',
    from: PHONE_NUMBERS.JAMES_WRIGHT,
    body: 'HELP there\'s water pouring from the bathroom ceiling!!',
  },
  {
    type: 'market_alert' as const,
    name: 'Market Pricing Alert',
    alert_type: 'festival_demand',
    message: 'Park City Jazz Festival announced for this weekend. Competitor average nightly rate: $310.',
  },
  {
    type: 'guest_message' as const,
    name: 'Guest Complaint',
    from: PHONE_NUMBERS.LISA_KIM,
    body: 'The place could honestly be a bit cleaner.',
  },
];

// ─── Agent Config ────────────────────────────────────────────────────────────

export const AGENT_CONFIG = {
  MAX_ITERATIONS: 10,
  MAX_TOKENS: 8192,
  SCHEDULE_DELAY_MULTIPLIER: 500,   // ms per delay_minute (30 min → 15 sec)
  MAX_PENDING_TASKS: 10,
  MAX_SCHEDULE_DELAY_MINUTES: 60,
  SMS_RATE_LIMIT_MS: 30_000,
  DEMO_EVENT_PAUSE_MS: 3000,
} as const;
