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
    model: 'claude-opus-4-6',
  },
  CEREBRAS: {
    provider: 'cerebras' as const,
    model: 'llama-4-scout-17b-16e-instruct',
  },
};

export const DEFAULT_PROVIDER = PROVIDERS.ANTHROPIC;

// ─── Tool Card Colors (for dashboard) ────────────────────────────────────────

export const TOOL_COLORS: Record<string, string> = {
  send_sms: '#3B82F6',
  create_work_order: '#F59E0B',
  adjust_price: '#059669',
  log_decision: '#6B7280',
  get_market_data: '#059669',
  update_schedule: '#7C3AED',
  schedule_task: '#0D9488',
};

// ─── Dashboard Theme ─────────────────────────────────────────────────────────

export const THEME = {
  bg: {
    primary: '#F8F7F4',
    card: '#FFFFFF',
    cardHover: '#F3F2EE',
    border: '#E8E5DE',
    borderLight: '#F0EDE6',
    sidebar: '#FAFAF7',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#6B7280',
    muted: '#9CA3AF',
    accent: '#111827',
  },
  status: {
    normal: '#059669',
    attention: '#D97706',
    emergency: '#DC2626',
    selfInitiated: '#0D9488',
  },
  tool: {
    sms: '#3B82F6',
    maintenance: '#F59E0B',
    pricing: '#059669',
    scheduling: '#7C3AED',
    decision: '#6B7280',
    task: '#0D9488',
  },
  accent: {
    gradient: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    violet: '#7C3AED',
    purple: '#764BA2',
  },
  font: {
    mono: "'JetBrains Mono', monospace",
    sans: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
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
  MAX_TOKENS: 16000,
  SCHEDULE_DELAY_MULTIPLIER: 500,   // ms per delay_minute (30 min → 15 sec)
  MAX_PENDING_TASKS: 10,
  MAX_SCHEDULE_DELAY_MINUTES: 60,
  SMS_RATE_LIMIT_MS: 30_000,
  DEMO_EVENT_PAUSE_MS: 3000,
} as const;
