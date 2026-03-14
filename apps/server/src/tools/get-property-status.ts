import type { GetPropertyStatusInput, PropertyStatusResult, PropertyStatusEntry } from '@apm/shared';
import { PropertyModel, BookingModel, ScheduleEventModel } from '../shared/db.js';

export async function executeGetPropertyStatus(
  input: GetPropertyStatusInput,
): Promise<PropertyStatusResult> {
  const { property_id, check_availability_start, check_availability_end } = input;

  // Defaults: today → 30 days out
  const now = new Date();
  const windowStart = check_availability_start ? new Date(check_availability_start) : now;
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 30);
  const windowEnd = check_availability_end ? new Date(check_availability_end) : defaultEnd;

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
      status: { $in: ['active', 'upcoming'] },
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
        const gapEnd = range.start < windowEnd ? range.start : windowEnd;
        const days = Math.floor(
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
      if (range.end > cursor) {
        cursor = new Date(range.end);
      }
    }

    // Gap after the last booking
    if (cursor < windowEnd) {
      const days = Math.floor(
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
