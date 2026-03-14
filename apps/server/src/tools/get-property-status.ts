import type { GetPropertyStatusInput, PropertyStatusResult, PropertyStatusEntry } from '@apm/shared';
import { BOOKING_TIMES } from '@apm/shared';
import { PropertyModel, BookingModel, ScheduleEventModel } from '../shared/db.js';
import { normalizeCheckIn, normalizeCheckOut } from '../shared/booking-dates.js';

export async function executeGetPropertyStatus(
  input: GetPropertyStatusInput,
): Promise<PropertyStatusResult> {
  const { property_id, check_availability_start, check_availability_end } = input;

  // Defaults: today → 30 days out, aligned to check-in/check-out times
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const defaultEndDate = new Date(now);
  defaultEndDate.setDate(defaultEndDate.getDate() + 30);
  const endStr = defaultEndDate.toISOString().slice(0, 10);

  const windowStart = new Date(normalizeCheckIn(check_availability_start || todayStr));
  const windowEnd = new Date(normalizeCheckOut(check_availability_end || endStr));

  // Query properties
  const filter = property_id ? { id: property_id } : {};
  const properties = await PropertyModel.find(filter).lean();

  if (property_id && properties.length === 0) {
    throw new Error(`Property not found: ${property_id}`);
  }

  const entries: PropertyStatusEntry[] = [];

  for (const prop of properties) {
    // Active/upcoming bookings sorted by check_in
    const bookings = await BookingModel.find({
      property_id: prop.id,
      status: { $in: ['active', 'upcoming', 'pending_payment'] },
    })
      .sort({ check_in: 1 })
      .lean();

    // Schedule events sorted by start_time
    const scheduleEvents = await ScheduleEventModel.find({
      property_id: prop.id,
    })
      .sort({ start_time: 1 })
      .lean();

    // Compute available windows within [windowStart, windowEnd]
    const bookedRanges = bookings
      .map((b) => ({
        start: new Date(b.check_in),
        end: new Date(b.check_out),
      }))
      .filter((r) => r.end > windowStart && r.start < windowEnd)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const availableWindows: PropertyStatusEntry['available_windows'] = [];
    let cursor = new Date(windowStart);

    for (const range of bookedRanges) {
      if (cursor < range.start) {
        // Window starts at check-in time (cursor) and ends at the booking's check-in (which is check-in time)
        const gapEnd = range.start < windowEnd ? range.start : windowEnd;
        const days = Math.round(
          (gapEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (days > 0) {
          availableWindows.push({
            start: cursor.toISOString(),
            end: gapEnd.toISOString(),
            max_nights: Math.min(days, 7),
          });
        }
      }
      // After a booking ends (check-out time), next available is check-in time same day
      if (range.end > cursor) {
        // Align cursor to check-in time on the checkout date
        const checkoutDate = range.end.toISOString().slice(0, 10);
        cursor = new Date(normalizeCheckIn(checkoutDate));
      }
    }

    // Gap after the last booking
    if (cursor < windowEnd) {
      const days = Math.round(
        (windowEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days > 0) {
        availableWindows.push({
          start: cursor.toISOString(),
          end: windowEnd.toISOString(),
          max_nights: Math.min(days, 7),
        });
      }
    }

    entries.push({
      property_id: prop.id,
      property_name: prop.name,
      location: prop.location,
      current_price: prop.current_price,
      rating: prop.rating,
      bookings: bookings.map((b) => ({
        id: b.id,
        guest_name: b.guest_name,
        status: b.status,
        check_in: b.check_in,
        check_out: b.check_out,
      })),
      schedule_events: scheduleEvents.map((e) => ({
        event_type: e.event_type,
        start_time: e.start_time,
        end_time: e.end_time,
        notes: e.notes,
      })),
      available_windows: availableWindows,
    });
  }

  return { properties: entries };
}
