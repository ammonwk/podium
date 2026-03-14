import mongoose, { Schema, type Model } from 'mongoose';
import type {
  Property,
  Booking,
  ScheduleEvent,
  Vendor,
  WorkOrder,
  Decision,
  ScheduledTask,
} from '@apm/shared';
import { PROPERTY_IDS, VENDOR_IDS, PHONE_NUMBERS } from '@apm/shared';

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
  property_id: { type: String, required: true },
  guest_name: { type: String, required: true },
  guest_phone: { type: String, required: true },
  check_in: { type: String, required: true },
  check_out: { type: String, required: true },
  status: { type: String, enum: ['active', 'upcoming', 'completed'], required: true },
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

const vendorSchema = new Schema<Vendor>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  rating: { type: Number, required: true },
  hourly_rate: { type: Number, required: true },
  status: { type: String, enum: ['available', 'busy', 'on_call'], required: true },
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
    enum: ['dispatched', 'in_progress', 'completed', 'cancelled'],
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

// ─── Connection ───────────────────────────────────────────────────────────────

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apm';
  console.log(`[DB] Connecting to MongoDB at ${uri}`);
  await mongoose.connect(uri);
  console.log('[DB] Connected to MongoDB');
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
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      guest_name: 'Sarah Chen',
      guest_phone: PHONE_NUMBERS.SARAH_CHEN,
      check_in: timeStr(threeDaysAgo, 15),
      check_out: timeStr(tomorrow, 11),
      status: 'active',
    },
    {
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      guest_name: 'James Wright',
      guest_phone: PHONE_NUMBERS.JAMES_WRIGHT,
      check_in: timeStr(threeDaysAgo, 15),
      check_out: timeStr(tomorrow, 10),
      status: 'active',
    },
    {
      property_id: PROPERTY_IDS.CANYON_HOUSE,
      guest_name: 'Lisa Kim',
      guest_phone: PHONE_NUMBERS.LISA_KIM,
      check_in: timeStr(today, 15),
      check_out: timeStr(threeDaysFromNow, 11),
      status: 'active',
    },
    {
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      guest_name: 'Mike Torres',
      guest_phone: PHONE_NUMBERS.MIKE_TORRES,
      check_in: timeStr(tomorrow, 15),
      check_out: timeStr(sixDaysFromNow, 11),
      status: 'upcoming',
    },
    {
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      guest_name: 'Anna Park',
      guest_phone: PHONE_NUMBERS.ANNA_PARK,
      check_in: timeStr(tomorrow, 15),
      check_out: timeStr(sixDaysFromNow, 11),
      status: 'upcoming',
    },
  ]);

  // ── Schedules ─────────────────────────────────────────────────────────────
  await ScheduleEventModel.insertMany([
    // PROP_001 — Oceanview Cottage
    {
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      event_type: 'checkout',
      start_time: timeStr(tomorrow, 11),
      end_time: timeStr(tomorrow, 11),
      notes: 'Sarah Chen checkout',
    },
    {
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      event_type: 'cleaning',
      start_time: timeStr(tomorrow, 11),
      end_time: timeStr(tomorrow, 13),
      notes: 'Turnover cleaning — crew arrives after PROP_002',
    },
    {
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      event_type: 'checkin',
      start_time: timeStr(tomorrow, 15),
      end_time: timeStr(tomorrow, 15),
      notes: 'Mike Torres check-in',
    },
    // PROP_002 — Mountain Loft
    {
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      event_type: 'checkout',
      start_time: timeStr(tomorrow, 10),
      end_time: timeStr(tomorrow, 10),
      notes: 'James Wright checkout',
    },
    {
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      event_type: 'cleaning',
      start_time: timeStr(tomorrow, 10),
      end_time: timeStr(tomorrow, 12),
      notes: 'Turnover cleaning — crew does PROP_002 first, then drives to PROP_001',
    },
    {
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      event_type: 'checkin',
      start_time: timeStr(tomorrow, 15),
      end_time: timeStr(tomorrow, 15),
      notes: 'Anna Park check-in',
    },
  ]);

  // ── Vendors ───────────────────────────────────────────────────────────────
  await VendorModel.insertMany([
    {
      id: VENDOR_IDS.MIKES_PLUMBING,
      name: "Mike's Plumbing",
      specialty: 'plumbing',
      rating: 4.8,
      hourly_rate: 95,
      status: 'available',
    },
    {
      id: VENDOR_IDS.JOES_PLUMBING,
      name: "Joe's Plumbing",
      specialty: 'plumbing',
      rating: 4.2,
      hourly_rate: 75,
      status: 'busy',
    },
    {
      id: VENDOR_IDS.BRIGHT_ELECTRICAL,
      name: 'Bright Electrical',
      specialty: 'electrical',
      rating: 4.7,
      hourly_rate: 110,
      status: 'available',
    },
    {
      id: VENDOR_IDS.SPOTLESS_CLEANING,
      name: 'Spotless Cleaning Co',
      specialty: 'cleaning',
      rating: 4.9,
      hourly_rate: 45,
      status: 'available',
    },
    {
      id: VENDOR_IDS.ALLFIX_MAINTENANCE,
      name: 'All-Fix Maintenance',
      specialty: 'general',
      rating: 4.5,
      hourly_rate: 85,
      status: 'available',
    },
    {
      id: VENDOR_IDS.PEAK_HVAC,
      name: 'Peak HVAC',
      specialty: 'hvac',
      rating: 4.6,
      hourly_rate: 125,
      status: 'on_call',
    },
  ]);

  console.log('[DB] Seed complete');
}
