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
  RACHEL_GOMEZ: '+13105550006',
  TOM_NGUYEN: '+12125550007',
  KAREN_PATEL: '+14155550008',
  DEREK_BROWN: '+17205550009',
  EMILY_RUSSO: '+15035550010',
  JASON_LEE: '+16175550011',
  MARIA_SANTOS: '+13125550012',
  BEN_HARPER: '+14045550013',
  OLIVIA_CHANG: '+12065550014',
  CHRIS_MILLER: '+15125550015',
  PRIYA_DESAI: '+19715550016',
  ALEX_KOWALSKI: '+16025550017',
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
  CREATE_BOOKING: 'create_booking',
  EDIT_BOOKING: 'edit_booking',
  GET_PROPERTY_STATUS: 'get_property_status',
  LOOKUP_GUEST: 'lookup_guest',
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
    model: 'gpt-oss-120b',
  },
};

export const DEFAULT_PROVIDER = PROVIDERS.CEREBRAS;

// ─── Tool Card Colors (for dashboard) ────────────────────────────────────────

export const TOOL_COLORS: Record<string, string> = {
  send_sms: '#3B82F6',
  create_work_order: '#F59E0B',
  adjust_price: '#059669',
  log_decision: '#6B7280',
  get_market_data: '#059669',
  update_schedule: '#7C3AED',
  schedule_task: '#0D9488',
  create_booking: '#2563EB',
  edit_booking: '#7C3AED',
  get_property_status: '#10B981',
  lookup_guest: '#8B5CF6',
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
  // ── Booking requests ──
  {
    type: 'guest_message' as const,
    name: 'Rachel: Booking Request',
    from: PHONE_NUMBERS.RACHEL_GOMEZ,
    body: 'Hi! Can I book March 20-22? Two adults, no pets. Whats the rate?',
  },
  {
    type: 'guest_message' as const,
    name: 'Tom: Weekend Availability',
    from: PHONE_NUMBERS.TOM_NGUYEN,
    body: 'Is next weekend available? Looking for a last minute getaway',
  },

  // ── Late checkout / early checkin ──
  {
    type: 'guest_message' as const,
    name: 'Sarah: Late Checkout',
    from: PHONE_NUMBERS.SARAH_CHEN,
    body: 'Hey! Any chance I could check out at 1PM instead of 11AM tomorrow?',
  },
  {
    type: 'guest_message' as const,
    name: 'Karen: Early Checkin',
    from: PHONE_NUMBERS.KAREN_PATEL,
    body: 'Our flight lands at 10am, any way we could check in early around noon? Happy to pay extra if needed',
  },

  // ── Maintenance issues ──
  {
    type: 'guest_message' as const,
    name: 'James: Plumbing Emergency',
    from: PHONE_NUMBERS.JAMES_WRIGHT,
    body: 'HELP there\'s water pouring from the bathroom ceiling!!',
  },
  {
    type: 'guest_message' as const,
    name: 'Derek: AC Broken',
    from: PHONE_NUMBERS.DEREK_BROWN,
    body: 'ac isnt working and its like 90 degrees in here. can someone come look at it asap?',
  },
  {
    type: 'guest_message' as const,
    name: 'Emily: Wifi Down',
    from: PHONE_NUMBERS.EMILY_RUSSO,
    body: 'The wifi keeps dropping every few minutes. I\'m trying to work remotely and its really frustrating',
  },
  {
    type: 'guest_message' as const,
    name: 'Jason: Lockout',
    from: PHONE_NUMBERS.JASON_LEE,
    body: 'Im locked out!!! The keypad code isnt working and its raining. Please help',
  },

  // ── Amenity questions ──
  {
    type: 'guest_message' as const,
    name: 'Maria: Pet Policy',
    from: PHONE_NUMBERS.MARIA_SANTOS,
    body: 'Do you allow dogs? I have a 30lb golden retriever, very well behaved',
  },
  {
    type: 'guest_message' as const,
    name: 'Ben: Parking Question',
    from: PHONE_NUMBERS.BEN_HARPER,
    body: 'Is there parking at the property? We\'re driving up from Phoenix and have a full size SUV',
  },
  {
    type: 'guest_message' as const,
    name: 'Olivia: Wifi Password',
    from: PHONE_NUMBERS.OLIVIA_CHANG,
    body: 'Whats the wifi password? I cant find it anywhere in the welcome book',
  },

  // ── Complaints ──
  {
    type: 'guest_message' as const,
    name: 'Lisa: Cleanliness Complaint',
    from: PHONE_NUMBERS.LISA_KIM,
    body: 'The place could honestly be a bit cleaner.',
  },
  {
    type: 'guest_message' as const,
    name: 'Chris: Noisy Neighbors',
    from: PHONE_NUMBERS.CHRIS_MILLER,
    body: 'The neighbors have been blasting music since 11pm. Its almost 1am now and we cant sleep. This is unacceptable',
  },
  {
    type: 'guest_message' as const,
    name: 'Priya: Pool Issue',
    from: PHONE_NUMBERS.PRIYA_DESAI,
    body: 'The pool isnt heated at all, its freezing cold. The listing said heated pool...',
  },

  // ── Compliment / rebook ──
  {
    type: 'guest_message' as const,
    name: 'Anna: Rebook Request',
    from: PHONE_NUMBERS.ANNA_PARK,
    body: 'Amazing place!! We absolutely loved it. Can we rebook for the first week of July?',
  },

  // ── Price inquiry ──
  {
    type: 'guest_message' as const,
    name: 'Mike: Price Inquiry',
    from: PHONE_NUMBERS.MIKE_TORRES,
    body: 'Hey, I saw the listing at $285/night but is there a weekly discount if we stay 7 nights?',
  },

  // ── Cancellation ──
  {
    type: 'guest_message' as const,
    name: 'Alex: Cancellation',
    from: PHONE_NUMBERS.ALEX_KOWALSKI,
    body: 'Hi, I need to cancel my reservation for next week. Family emergency came up. What is the cancellation policy?',
  },

  // ── Market alert ──
  {
    type: 'market_alert' as const,
    name: 'Market: Festival Surge',
    alert_type: 'festival_demand',
    message: 'Park City Jazz Festival announced for this weekend. Competitor average nightly rate: $310.',
  },
];

// ─── Agent Config ────────────────────────────────────────────────────────────

// ─── Booking Times ──────────────────────────────────────────────────────────

export const BOOKING_TIMES = {
  CHECK_IN_HOUR: 15,   // 3 PM
  CHECK_OUT_HOUR: 11,  // 11 AM
} as const;

// ─── Agent Config ────────────────────────────────────────────────────────────

export const AGENT_CONFIG = {
  MAX_ITERATIONS: 10,
  CHAT_MAX_ITERATIONS: 5,
  MAX_TOKENS: 16000,
  SCHEDULE_DELAY_MULTIPLIER: 500,   // ms per delay_minute (30 min → 15 sec)
  MAX_PENDING_TASKS: 10,
  MAX_SCHEDULE_DELAY_MINUTES: 60,
  SMS_RATE_LIMIT_MS: 30_000,
  DEMO_EVENT_PAUSE_MS: 3000,
} as const;
