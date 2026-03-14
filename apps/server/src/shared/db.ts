import mongoose, { Schema, type Model } from 'mongoose';
import type {
  Property,
  Booking,
  ScheduleEvent,
  Vendor,
  WorkOrder,
  Decision,
  ScheduledTask,
  SSEEventType,
  LLMMessage,
  ChatRole,
  ChatMessage,
} from '@apm/shared';
import { PROPERTY_IDS, VENDOR_IDS, PHONE_NUMBERS, BOOKING_TIMES } from '@apm/shared';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const propertySchema = new Schema<Property>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  base_price: { type: Number, required: true },
  current_price: { type: Number, required: true },
  rating: { type: Number, required: true },
  review_count: { type: Number, required: true },
  auto_approve_threshold: { type: Number, required: true },
  wifi_name: { type: String, required: true },
  wifi_password: { type: String, required: true },
  door_code: { type: String, required: true },
  parking_info: { type: String, required: true },
  zip_code: { type: String, required: true },
});

const bookingSchema = new Schema<Booking>({
  id: { type: String, required: true, unique: true },
  property_id: { type: String, required: true },
  guest_name: { type: String, required: true },
  guest_phone: { type: String, required: true },
  check_in: { type: String, required: true },
  check_out: { type: String, required: true },
  status: { type: String, enum: ['active', 'upcoming', 'completed'], required: true },
  payment_status: { type: String, enum: ['pending', 'paid', 'none'], default: 'none' },
  payment_link: { type: String },
});

const scheduleEventSchema = new Schema<ScheduleEvent>({
  property_id: { type: String, required: true },
  event_type: {
    type: String,
    enum: ['checkout', 'cleaning', 'checkin', 'maintenance'],
    required: true,
  },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  notes: { type: String },
});

const vendorAvailabilityWindowSchema = new Schema(
  { day: { type: Number, required: true }, start_hour: { type: Number, required: true }, end_hour: { type: Number, required: true } },
  { _id: false },
);

const vendorSchema = new Schema<Vendor>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  rating: { type: Number, required: true },
  hourly_rate: { type: Number, required: true },
  status: { type: String, enum: ['available', 'busy', 'on_call'], required: true },
  schedule: { type: [vendorAvailabilityWindowSchema], required: true },
});

const workOrderSchema = new Schema<WorkOrder>({
  id: { type: String, required: true, unique: true },
  property_id: { type: String, required: true },
  vendor_id: { type: String, required: true },
  issue_description: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'emergency'], required: true },
  estimated_cost: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'dispatched', 'in_progress', 'completed', 'cancelled'],
    required: true,
  },
  created_at: { type: String, required: true },
});

const decisionSchema = new Schema<Decision>({
  id: { type: String, required: true, unique: true },
  timestamp: { type: String, required: true },
  tool: { type: String, required: true },
  input: { type: Schema.Types.Mixed, required: true },
  result: { type: Schema.Types.Mixed, required: true },
  reasoning: { type: String },
  confidence: { type: String, enum: ['high', 'medium', 'low'] },
  category: { type: String },
});

const scheduledTaskSchema = new Schema<ScheduledTask>({
  task_id: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  fires_at: { type: String, required: true },
  delay_minutes: { type: Number, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], required: true },
  status: { type: String, enum: ['pending', 'fired', 'cancelled'], required: true },
});

// ─── Persistence Schemas ──────────────────────────────────────────────────────

export interface SSEEventLogRecord {
  seq: number;
  type: SSEEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

const sseEventLogSchema = new Schema<SSEEventLogRecord>({
  seq: { type: Number, required: true, unique: true },
  type: { type: String, required: true },
  timestamp: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
});

export interface ConversationRecord {
  lane_id: string;
  lane_type: 'demo' | 'caller' | 'proactive';
  history: LLMMessage[];
  created_at: string;
  updated_at: string;
}

const conversationSchema = new Schema<ConversationRecord>({
  lane_id: { type: String, required: true, unique: true },
  lane_type: { type: String, enum: ['demo', 'caller', 'proactive'], required: true },
  history: { type: Schema.Types.Mixed, required: true },
  created_at: { type: String, required: true },
  updated_at: { type: String, required: true },
});

export interface ChatSessionRecord {
  session_id: string;
  role: ChatRole;
  phone_number?: string;
  messages: ChatMessage[];
  history: LLMMessage[];
  created_at: string;
  updated_at: string;
}

const chatSessionSchema = new Schema<ChatSessionRecord>({
  session_id: { type: String, required: true, unique: true },
  role: { type: String, enum: ['property_owner', 'current_occupant', 'interested_person'], required: true },
  phone_number: { type: String },
  messages: { type: Schema.Types.Mixed, required: true },
  history: { type: Schema.Types.Mixed, required: true },
  created_at: { type: String, required: true },
  updated_at: { type: String, required: true },
});

export interface OwnerSettingsRecord {
  name: string;
  phone: string;
}

const ownerSettingsSchema = new Schema<OwnerSettingsRecord>({
  name: { type: String, required: true },
  phone: { type: String, required: true },
});

// ─── Counter Schema (atomic booking IDs) ─────────────────────────────────────

interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String },
  seq: { type: Number, required: true, default: 0 },
});

// ─── Models ───────────────────────────────────────────────────────────────────

export const PropertyModel: Model<Property> =
  mongoose.models.Property || mongoose.model<Property>('Property', propertySchema);
export const BookingModel: Model<Booking> =
  mongoose.models.Booking || mongoose.model<Booking>('Booking', bookingSchema);
export const ScheduleEventModel: Model<ScheduleEvent> =
  mongoose.models.ScheduleEvent ||
  mongoose.model<ScheduleEvent>('ScheduleEvent', scheduleEventSchema);
export const VendorModel: Model<Vendor> =
  mongoose.models.Vendor || mongoose.model<Vendor>('Vendor', vendorSchema);
export const WorkOrderModel: Model<WorkOrder> =
  mongoose.models.WorkOrder || mongoose.model<WorkOrder>('WorkOrder', workOrderSchema);
export const DecisionModel: Model<Decision> =
  mongoose.models.Decision || mongoose.model<Decision>('Decision', decisionSchema);
export const ScheduledTaskModel: Model<ScheduledTask> =
  mongoose.models.ScheduledTask ||
  mongoose.model<ScheduledTask>('ScheduledTask', scheduledTaskSchema);

export const SSEEventLogModel: Model<SSEEventLogRecord> =
  mongoose.models.SSEEventLog ||
  mongoose.model<SSEEventLogRecord>('SSEEventLog', sseEventLogSchema);
export const ConversationModel: Model<ConversationRecord> =
  mongoose.models.Conversation ||
  mongoose.model<ConversationRecord>('Conversation', conversationSchema);
export const ChatSessionModel: Model<ChatSessionRecord> =
  mongoose.models.ChatSession ||
  mongoose.model<ChatSessionRecord>('ChatSession', chatSessionSchema);
export const OwnerSettingsModel: Model<OwnerSettingsRecord> =
  mongoose.models.OwnerSettings ||
  mongoose.model<OwnerSettingsRecord>('OwnerSettings', ownerSettingsSchema);
export const CounterModel: Model<CounterDoc> =
  mongoose.models.Counter || mongoose.model<CounterDoc>('Counter', counterSchema);

export async function nextBookingId(): Promise<string> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: 'booking' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return `BOOK_${String(counter!.seq).padStart(3, '0')}`;
}

// ─── Connection ───────────────────────────────────────────────────────────────

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apm';
  console.log(`[DB] Connecting to MongoDB at ${uri}`);
  await mongoose.connect(uri, { maxPoolSize: 50 });
  console.log('[DB] Connected to MongoDB (pool: 50)');
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

function getTomorrow(): Date {
  const now = new Date();
  // Use Mountain Time offset (UTC-7 for MDT)
  const mt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  const tomorrow = new Date(mt);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function timeStr(date: Date, hours: number, minutes = 0): string {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export async function seed(): Promise<void> {
  console.log('[DB] Seeding database...');
  const tomorrow = getTomorrow();
  const today = new Date(tomorrow);
  today.setDate(today.getDate() - 1);

  // Clear all collections and drop stale indexes
  await Promise.all([
    BookingModel.collection.dropIndexes().catch(() => {}),
    PropertyModel.deleteMany({}),
    BookingModel.deleteMany({}),
    ScheduleEventModel.deleteMany({}),
    VendorModel.deleteMany({}),
    WorkOrderModel.deleteMany({}),
    DecisionModel.deleteMany({}),
    ScheduledTaskModel.deleteMany({}),
    SSEEventLogModel.deleteMany({}),
    ConversationModel.deleteMany({}),
    ChatSessionModel.deleteMany({}),
    OwnerSettingsModel.deleteMany({}),
    CounterModel.deleteMany({}),
  ]);

  // ── Properties ────────────────────────────────────────────────────────────
  await PropertyModel.insertMany([
    {
      id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      name: 'Oceanview Cottage',
      location: 'Park City, UT',
      base_price: 195,
      current_price: 195,
      rating: 4.6,
      review_count: 127,
      auto_approve_threshold: 500,
      wifi_name: 'OceanviewGuest',
      wifi_password: 'paradise2024',
      door_code: '4829',
      parking_info: 'driveway, 2 spots',
      zip_code: '84060',
    },
    {
      id: PROPERTY_IDS.MOUNTAIN_LOFT,
      name: 'Mountain Loft',
      location: 'Park City, UT',
      base_price: 145,
      current_price: 145,
      rating: 4.8,
      review_count: 89,
      auto_approve_threshold: 300,
      wifi_name: 'MountainLoft5G',
      wifi_password: 'alpine2024',
      door_code: '7156',
      parking_info: 'street parking, permit provided at check-in',
      zip_code: '84098',
    },
    {
      id: PROPERTY_IDS.CANYON_HOUSE,
      name: 'Canyon House',
      location: 'Moab, UT',
      base_price: 285,
      current_price: 285,
      rating: 4.4,
      review_count: 52,
      auto_approve_threshold: 750,
      wifi_name: 'CanyonHouse',
      wifi_password: 'redrock2024',
      door_code: '3391',
      parking_info: 'private lot, 3 spots',
      zip_code: '84532',
    },
  ]);

  // ── Bookings ──────────────────────────────────────────────────────────────
  // Compute check-in/check-out dates for 3-day stays
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const sixDaysFromNow = new Date(today);
  sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);

  await BookingModel.insertMany([
    {
      id: 'BOOK_001',
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      guest_name: 'Sarah Chen',
      guest_phone: PHONE_NUMBERS.SARAH_CHEN,
      check_in: timeStr(threeDaysAgo, BOOKING_TIMES.CHECK_IN_HOUR),
      check_out: timeStr(tomorrow, BOOKING_TIMES.CHECK_OUT_HOUR),
      status: 'active',
    },
    {
      id: 'BOOK_002',
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      guest_name: 'James Wright',
      guest_phone: PHONE_NUMBERS.JAMES_WRIGHT,
      check_in: timeStr(threeDaysAgo, BOOKING_TIMES.CHECK_IN_HOUR),
      check_out: timeStr(tomorrow, BOOKING_TIMES.CHECK_OUT_HOUR),
      status: 'active',
    },
    {
      id: 'BOOK_003',
      property_id: PROPERTY_IDS.CANYON_HOUSE,
      guest_name: 'Lisa Kim',
      guest_phone: PHONE_NUMBERS.LISA_KIM,
      check_in: timeStr(today, BOOKING_TIMES.CHECK_IN_HOUR),
      check_out: timeStr(threeDaysFromNow, BOOKING_TIMES.CHECK_OUT_HOUR),
      status: 'active',
    },
    {
      id: 'BOOK_004',
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      guest_name: 'Mike Torres',
      guest_phone: PHONE_NUMBERS.MIKE_TORRES,
      check_in: timeStr(tomorrow, BOOKING_TIMES.CHECK_IN_HOUR),
      check_out: timeStr(sixDaysFromNow, BOOKING_TIMES.CHECK_OUT_HOUR),
      status: 'upcoming',
    },
    {
      id: 'BOOK_005',
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      guest_name: 'Anna Park',
      guest_phone: PHONE_NUMBERS.ANNA_PARK,
      check_in: timeStr(tomorrow, BOOKING_TIMES.CHECK_IN_HOUR),
      check_out: timeStr(sixDaysFromNow, BOOKING_TIMES.CHECK_OUT_HOUR),
      status: 'upcoming',
    },
  ]);

  // ── Schedules ─────────────────────────────────────────────────────────────
  await ScheduleEventModel.insertMany([
    // PROP_001 — Oceanview Cottage
    {
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      event_type: 'checkout',
      start_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_OUT_HOUR),
      end_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_OUT_HOUR),
      notes: 'Sarah Chen checkout',
    },
    {
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      event_type: 'cleaning',
      start_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_OUT_HOUR),
      end_time: timeStr(tomorrow, 13),
      notes: 'Turnover cleaning — crew arrives after PROP_002',
    },
    {
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      event_type: 'checkin',
      start_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_IN_HOUR),
      end_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_IN_HOUR),
      notes: 'Mike Torres check-in',
    },
    // PROP_002 — Mountain Loft
    {
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      event_type: 'checkout',
      start_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_OUT_HOUR),
      end_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_OUT_HOUR),
      notes: 'James Wright checkout',
    },
    {
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      event_type: 'cleaning',
      start_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_OUT_HOUR),
      end_time: timeStr(tomorrow, 13),
      notes: 'Turnover cleaning — crew does PROP_002 first, then drives to PROP_001',
    },
    {
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      event_type: 'checkin',
      start_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_IN_HOUR),
      end_time: timeStr(tomorrow, BOOKING_TIMES.CHECK_IN_HOUR),
      notes: 'Anna Park check-in',
    },
  ]);

  // ── Vendors ───────────────────────────────────────────────────────────────
  // Schedule helpers
  const weekdays = (start: number, end: number) =>
    [1, 2, 3, 4, 5].map((day) => ({ day, start_hour: start, end_hour: end }));
  const weekends = (start: number, end: number) =>
    [0, 6].map((day) => ({ day, start_hour: start, end_hour: end }));
  const allDays = (start: number, end: number) =>
    [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start_hour: start, end_hour: end }));

  await VendorModel.insertMany([
    {
      id: VENDOR_IDS.MIKES_PLUMBING,
      name: "Mike's Plumbing",
      specialty: 'plumbing',
      rating: 4.8,
      hourly_rate: 95,
      status: 'available',
      schedule: weekdays(8, 17),
    },
    {
      id: VENDOR_IDS.JOES_PLUMBING,
      name: "Joe's Plumbing",
      specialty: 'plumbing',
      rating: 4.2,
      hourly_rate: 120,
      status: 'on_call',
      schedule: allDays(0, 24),
    },
    {
      id: VENDOR_IDS.BRIGHT_ELECTRICAL,
      name: 'Bright Electrical',
      specialty: 'electrical',
      rating: 4.7,
      hourly_rate: 110,
      status: 'available',
      schedule: weekdays(7, 18),
    },
    {
      id: VENDOR_IDS.SPARKS_ELECTRIC,
      name: 'Sparks Electric',
      specialty: 'electrical',
      rating: 4.3,
      hourly_rate: 90,
      status: 'available',
      schedule: weekends(9, 17),
    },
    {
      id: VENDOR_IDS.SPOTLESS_CLEANING,
      name: 'Spotless Cleaning',
      specialty: 'cleaning',
      rating: 4.9,
      hourly_rate: 45,
      status: 'available',
      schedule: weekdays(8, 16),
    },
    {
      id: VENDOR_IDS.FRESH_START_CLEANING,
      name: 'Fresh Start Cleaning',
      specialty: 'cleaning',
      rating: 4.4,
      hourly_rate: 55,
      status: 'available',
      schedule: allDays(6, 22),
    },
    {
      id: VENDOR_IDS.ALLFIX_MAINTENANCE,
      name: 'All-Fix Maintenance',
      specialty: 'general',
      rating: 4.5,
      hourly_rate: 85,
      status: 'available',
      schedule: weekdays(8, 17),
    },
    {
      id: VENDOR_IDS.HANDY_PROS,
      name: 'Handy Pros',
      specialty: 'general',
      rating: 4.1,
      hourly_rate: 70,
      status: 'available',
      schedule: weekends(10, 16),
    },
    {
      id: VENDOR_IDS.PEAK_HVAC,
      name: 'Peak HVAC',
      specialty: 'hvac',
      rating: 4.6,
      hourly_rate: 125,
      status: 'available',
      schedule: weekdays(8, 17),
    },
    {
      id: VENDOR_IDS.SUMMIT_HVAC,
      name: 'Summit HVAC',
      specialty: 'hvac',
      rating: 4.3,
      hourly_rate: 150,
      status: 'on_call',
      schedule: allDays(0, 24),
    },
  ]);

  // Initialize booking counter past seeded bookings (BOOK_001–BOOK_005)
  await CounterModel.create({ _id: 'booking', seq: 100 });

  // Reset SSE sequence counter
  resetSSESequence();

  console.log('[DB] Seed complete');
}

// Returns true if the database is empty and needs seeding
export async function shouldSeed(): Promise<boolean> {
  const count = await PropertyModel.countDocuments();
  return count === 0;
}

// ─── SSE Sequence Counter ─────────────────────────────────────────────────────

let sseSeq = 0;

export function nextSSESeq(): number {
  return ++sseSeq;
}

export function resetSSESequence(): void {
  sseSeq = 0;
}

export async function initSSESequence(): Promise<void> {
  const last = await SSEEventLogModel.findOne().sort({ seq: -1 }).lean();
  sseSeq = last ? last.seq : 0;
  console.log(`[DB] SSE sequence initialized at ${sseSeq}`);
}
