import type { CreateBookingInput, CreateBookingResult } from '@apm/shared';
import { PropertyModel, BookingModel, ScheduleEventModel } from '../shared/db.js';

let bookingCounter = 100;

export async function executeCreateBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const { property_id, guest_name, guest_phone, check_in, check_out } = input;

  // Validate property exists
  const property = await PropertyModel.findOne({ id: property_id }).lean();
  if (!property) {
    throw new Error(`Property not found: ${property_id}`);
  }

  // Validate stay length (max 7 nights)
  const checkInDate = new Date(check_in);
  const checkOutDate = new Date(check_out);
  const nights = Math.round(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (nights <= 0) {
    throw new Error('Check-out must be after check-in');
  }
  if (nights > 7) {
    throw new Error(`Maximum stay is 7 nights. Requested: ${nights} nights.`);
  }

  // Check for overlapping bookings on same property
  const overlap = await BookingModel.findOne({
    property_id,
    status: { $in: ['active', 'upcoming'] },
    check_in: { $lt: check_out },
    check_out: { $gt: check_in },
  }).lean();

  if (overlap) {
    throw new Error(
      `Dates overlap an existing booking on ${property.name} (${overlap.check_in} to ${overlap.check_out}). Please choose different dates.`,
    );
  }

  // Generate booking ID
  bookingCounter++;
  const bookingId = `BOOK_${String(bookingCounter).padStart(3, '0')}`;

  // Insert booking
  await BookingModel.create({
    id: bookingId,
    property_id,
    guest_name,
    guest_phone,
    check_in,
    check_out,
    status: 'upcoming',
  });

  // Create schedule events for checkin and checkout
  await ScheduleEventModel.insertMany([
    {
      property_id,
      event_type: 'checkin',
      start_time: check_in,
      end_time: check_in,
      notes: `${guest_name} check-in`,
    },
    {
      property_id,
      event_type: 'checkout',
      start_time: check_out,
      end_time: check_out,
      notes: `${guest_name} checkout`,
    },
  ]);

  const totalEstimate = nights * property.current_price;

  return {
    booking_id: bookingId,
    property_name: property.name,
    guest_name,
    guest_phone,
    check_in,
    check_out,
    nights,
    nightly_rate: property.current_price,
    total_estimate: totalEstimate,
  };
}
