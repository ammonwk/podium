// ─── Chat Types ──────────────────────────────────────────────────────────────

export type ChatRole = 'property_owner' | 'current_occupant' | 'interested_person';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  role: ChatRole;
  sessionId: string;
  phoneNumber?: string;
}

// ─── Database Models ─────────────────────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  location: string;
  base_price: number;
  current_price: number;
  rating: number;
  review_count: number;
  auto_approve_threshold: number;
  wifi_name: string;
  wifi_password: string;
  door_code: string;
  parking_info: string;
  zip_code: string;
}

export interface Booking {
  id: string;
  property_id: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  status: 'active' | 'upcoming' | 'completed';
}

export interface ScheduleEvent {
  property_id: string;
  event_type: 'checkout' | 'cleaning' | 'checkin' | 'maintenance';
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  hourly_rate: number;
  status: 'available' | 'busy' | 'on_call';
}

export interface WorkOrder {
  id: string;
  property_id: string;
  vendor_id: string;
  issue_description: string;
  severity: 'low' | 'medium' | 'high' | 'emergency';
  estimated_cost: number;
  status: 'pending' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Decision {
  id: string;
  timestamp: string;
  tool: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  reasoning?: string;
  confidence?: 'high' | 'medium' | 'low';
  category?: string;
}

export interface ScheduledTask {
  task_id: string;
  description: string;
  fires_at: string;
  delay_minutes: number;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'fired' | 'cancelled';
}

// ─── Tool Inputs ─────────────────────────────────────────────────────────────

export interface SendSmsInput {
  to: string;
  body: string;
}

export interface CreateWorkOrderInput {
  property_id: string;
  vendor_id: string;
  issue_description: string;
  severity: 'low' | 'medium' | 'high' | 'emergency';
  estimated_cost: number;
}

export interface AdjustPriceInput {
  property_id: string;
  new_price: number;
  reason: string;
}

export interface LogDecisionInput {
  category: 'communications' | 'operations' | 'pricing' | 'escalation';
  summary: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  confidence_caveat: string;
  property_id?: string;
}

export interface GetMarketDataInput {
  location: string;
}

export interface UpdateScheduleInput {
  property_id: string;
  event_type: 'checkout' | 'cleaning' | 'checkin' | 'maintenance';
  original_time: string;
  new_time: string;
  reason: string;
}

export interface ScheduleTaskInput {
  delay_minutes: number;
  task_description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface CreateBookingInput {
  property_id: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
}

export interface GetPropertyStatusInput {
  property_id?: string;
  check_availability_start?: string;
  check_availability_end?: string;
}

export interface EditBookingInput {
  guest_phone: string;
  property_id?: string;
  new_check_in?: string;
  new_check_out?: string;
  new_property_id?: string;
}

export interface QueryDatabaseInput {
  collection: 'bookings' | 'properties' | 'workorders' | 'scheduleevents' | 'decisions' | 'vendors' | 'scheduledtasks';
  operation: 'find' | 'aggregate';
  filter?: Record<string, unknown>;
  pipeline?: Record<string, unknown>[];
  sort?: Record<string, unknown>;
  limit?: number;
}

export interface ReportMaintenanceIssueInput {
  property_id: string;
  issue_description: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'cleaning' | 'general';
  severity: 'low' | 'medium' | 'high' | 'emergency';
}

export interface ReportMaintenanceIssueResult {
  work_order_id: string;
  property_name: string;
  severity: string;
  status: string;
  message: string;
}

export interface QueryDatabaseResult {
  collection: string;
  operation: string;
  count: number;
  results: Record<string, unknown>[];
}

// ─── Tool Results ────────────────────────────────────────────────────────────

export interface SendSmsResult {
  status: 'delivered' | 'queued' | 'failed';
  recipient_name: string;
  to: string;
  timestamp: string;
  message_preview: string;
}

export interface CreateWorkOrderResult {
  work_order_id: string;
  vendor_name: string;
  vendor_rating: number;
  estimated_cost: number;
  severity: string;
  status: string;
  property_name: string;
}

export interface AdjustPriceResult {
  property_id: string;
  property_name: string;
  previous_price: number;
  new_price: number;
  percent_change: string;
}

export interface LogDecisionResult {
  decision_id: string;
  timestamp: string;
  category: string;
  summary: string;
}

export interface GetMarketDataResult {
  location: string;
  avg_competitor_rate: number;
  occupancy_percent: number;
  local_events: string;
  your_properties: Array<{
    id: string;
    name: string;
    current_price: number;
    gap: string;
  }>;
}

export interface UpdateScheduleResult {
  property_id: string;
  property_name: string;
  event_type: string;
  old_time: string;
  new_time: string;
  downstream: string;
}

export interface ScheduleTaskResult {
  task_id: string;
  scheduled_time: string;
  description: string;
  fires_in: string;
}

export interface CreateBookingResult {
  booking_id: string;
  property_name: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  nights: number;
  nightly_rate: number;
  total_estimate: number;
}

export interface EditBookingResult {
  booking_id: string;
  property_name: string;
  changes: string;
  check_in: string;
  check_out: string;
  nights: number;
}

export interface PropertyStatusResult {
  properties: PropertyStatusEntry[];
}

export interface PropertyStatusEntry {
  property_id: string;
  property_name: string;
  location: string;
  current_price: number;
  rating: number;
  bookings: Array<{
    id: string;
    guest_name: string;
    status: string;
    check_in: string;
    check_out: string;
  }>;
  schedule_events: Array<{
    event_type: string;
    start_time: string;
    end_time: string;
    notes?: string;
  }>;
  available_windows: Array<{
    start: string;
    end: string;
    max_nights: number;
  }>;
}

// ─── SSE Events ──────────────────────────────────────────────────────────────

export type SSEEventType =
  | 'thinking'
  | 'tool_call'
  | 'event_start'
  | 'event_done'
  | 'scheduled_task'
  | 'event_queued'
  | 'error'
  | 'reset';

export interface SSEEvent {
  id: string;
  type: SSEEventType;
  timestamp: string;
  payload: unknown;
}

export interface ThinkingPayload {
  text: string;
  event_name: string;
}

export interface ToolCallPayload {
  tool_name: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  event_name: string;
}

export interface EventStartPayload {
  event_name: string;
  source: 'human' | 'system' | 'self-scheduled';
  description: string;
}

export interface EventDonePayload {
  event_name: string;
}

export interface ScheduledTaskPayload {
  task_id: string;
  description: string;
  fires_at: string;
}

export interface EventQueuedPayload {
  event_name: string;
  source: 'human' | 'system' | 'self-scheduled';
  position: number;
}

export interface ErrorPayload {
  message: string;
}

// ─── Event Types ─────────────────────────────────────────────────────────────

export interface IncomingEvent {
  type: 'guest_message' | 'market_alert' | 'system' | 'scheduled_task';
  source: 'human' | 'system' | 'self-scheduled';
  name: string;
  payload: {
    from?: string;
    body?: string;
    alert_type?: string;
    message?: string;
    task_id?: string;
    task_description?: string;
  };
}

// ─── LLM Client Interface ───────────────────────────────────────────────────

export interface LLMStreamEvent {
  type: 'text' | 'thinking_delta' | 'thinking_done' | 'tool_use_start' | 'tool_use_done' | 'done';
  text?: string;
  thinking_block?: { thinking: string; signature: string };
  tool_call?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  stop_reason?: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export type LLMContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMClient {
  stream(
    system: string,
    messages: LLMMessage[],
    tools: LLMToolDefinition[]
  ): AsyncIterable<LLMStreamEvent>;

  readonly provider: string;
  readonly model: string;
}

// ─── Provider Config ─────────────────────────────────────────────────────────

export interface ProviderConfig {
  provider: 'anthropic' | 'cerebras';
  model: string;
}

// ─── API Types ───────────────────────────────────────────────────────────────

export interface DemoEvent {
  type: 'guest_message' | 'market_alert';
  name: string;
  from?: string;
  body?: string;
  alert_type?: string;
  message?: string;
}

export interface SurgeWebhookPayload {
  from: string;
  to: string;
  body: string;
  message_id?: string;
}
