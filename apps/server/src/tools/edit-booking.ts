import type { EditBookingInput, EditBookingResult } from '@apm/shared';
import { PropertyModel, BookingModel, ScheduleEventModel } from '../shared/db.js';
import { normalizePhone } from '../shared/phone-utils.js';
import { normalizeCheckIn, normalizeCheckOut } from '../shared/booking-dates.js';

export async function executeEditBooking(
  input: EditBookingInput,
): Promise<EditBookingResult> {
  const { property_id, new_property_id } = input;
  const new_check_in = input.new_check_in ? normalizeCheckIn(input.new_check_in) : undefined;
  const new_check_out = input.new_check_out ? normalizeCheckOut(input.new_check_out) : undefined;
  const guest_phone = normalizePhone(input.guest_phone) || input.guest_phone;

  // Find booking(s) by phone
  const query: Record<string, unknown> = {
    guest_phone,
    status: { $in: ['active', 'upcoming'] },
  };
  if (property_id) {
    query.property_id = property_id;
  }

  const bookings = await BookingModel.find(query);

  if (bookings.length === 0) {
    throw new Error(
      `No active or upcoming booking found for phone ${guest_phone}${property_id ? ` at property ${property_id}` : ''}`,
    );
  }
  if (bookings.length > 1) {
    const props = bookings.map((b) => b.property_id).join(', ');
    throw new Error(
      `Multiple bookings found for ${guest_phone} (properties: ${props}). Please provide property_id to disambiguate.`,
    );
  }

  const booking = bookings[0];
  const changes: string[] = [];

  // Determine final dates
  const finalCheckIn = new_check_in || booking.check_in;
  const finalCheckOut = new_check_out || booking.check_out;
  const targetPropertyId = new_property_id || booking.property_id;

  // Validate stay length
  const checkInDate = new Date(finalCheckIn);
  const checkOutDate = new Date(finalCheckOut);
  const nights = Math.round(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (nights <= 0) {
    throw new Error('Check-out must be after check-in');
  }
  if (nights > 7) {
    throw new Error(`Maximum stay is 7 nights. Requested: ${nights} nights.`);
  }

  // If changing property, validate target exists
  if (new_property_id && new_property_id !== booking.property_id) {
    const targetProperty = await PropertyModel.findOne({ id: new_property_id }).lean();
    if (!targetProperty) {
      throw new Error(`Target property not found: ${new_property_id}`);
    }
  }

  // Check for overlapping bookings (excluding this booking)
  const overlap = await BookingModel.findOne({
    property_id: targetPropertyId,
    status: { $in: ['active', 'upcoming'] },
    _id: { $ne: booking._id },
    check_in: { $lt: finalCheckOut },
    check_out: { $gt: finalCheckIn },
  }).lean();

  if (overlap) {
    throw new Error(
      `New dates overlap an existing booking (${overlap.check_in} to ${overlap.check_out}). Please choose different dates.`,
    );
  }

  // Track changes
  if (new_check_in && new_check_in !== booking.check_in) {
    changes.push(`check-in: ${booking.check_in} → ${new_check_in}`);
  }
  if (new_check_out && new_check_out !== booking.check_out) {
    changes.push(`check-out: ${booking.check_out} → ${new_check_out}`);
  }
  if (new_property_id && new_property_id !== booking.property_id) {
    changes.push(`property: ${booking.property_id} → ${new_property_id}`);
  }

  if (changes.length === 0) {
    throw new Error('No changes specified — provide at least one of new_check_in, new_check_out, or new_property_id');
  }

  // Remove old schedule events for this booking
  await ScheduleEventModel.deleteMany({
    property_id: booking.property_id,
    event_type: { $in: ['checkin', 'checkout'] },
    notes: { $regex: booking.guest_name },
  });

  // Update booking
  booking.check_in = finalCheckIn;
  booking.check_out = finalCheckOut;
  booking.property_id = targetPropertyId;
  await booking.save();

  // Create new schedule events
  await ScheduleEventModel.insertMany([
    {
      property_id: targetPropertyId,
      event_type: 'checkin',
      start_time: finalCheckIn,
      end_time: finalCheckIn,
      notes: `${booking.guest_name} check-in`,
    },
    {
      property_id: targetPropertyId,
      event_type: 'checkout',
      start_time: finalCheckOut,
      end_time: finalCheckOut,
      notes: `${booking.guest_name} checkout`,
    },
  ]);

  // Get property name for result
  const property = await PropertyModel.findOne({ id: targetPropertyId }).lean();

  return {
    booking_id: booking.id,
    property_name: property?.name || targetPropertyId,
    changes: changes.join('; '),
    check_in: finalCheckIn,
    check_out: finalCheckOut,
    nights,
  };
}
