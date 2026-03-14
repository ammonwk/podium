import type { UpdateScheduleInput, UpdateScheduleResult } from '@apm/shared';
import { PROPERTY_IDS } from '@apm/shared';
import { PropertyModel, ScheduleEventModel } from '../shared/db.js';

export async function executeUpdateSchedule(
  input: UpdateScheduleInput,
): Promise<UpdateScheduleResult> {
  const { property_id, event_type, original_time, new_time, reason } = input;

  // Look up property
  const property = await PropertyModel.findOne({ id: property_id }).lean();
  if (!property) {
    throw new Error(`Property not found: ${property_id}`);
  }

  // Find the schedule event
  const scheduleEvent = await ScheduleEventModel.findOne({
    property_id,
    event_type,
    start_time: original_time,
  });

  if (!scheduleEvent) {
    // Try a fuzzy match — the agent might provide a slightly different ISO string
    const allEvents = await ScheduleEventModel.find({
      property_id,
      event_type,
    }).lean();

    if (allEvents.length === 0) {
      throw new Error(
        `No ${event_type} event found for ${property.name}. Available events: none.`,
      );
    }

    // If there's exactly one event of this type for this property, use it
    if (allEvents.length === 1) {
      const evt = allEvents[0];
      const origStart = evt.start_time;
      const origEnd = evt.end_time;

      // Calculate duration from original event
      const durationMs =
        new Date(origEnd).getTime() - new Date(origStart).getTime();
      const newEndTime = new Date(
        new Date(new_time).getTime() + durationMs,
      ).toISOString();

      await ScheduleEventModel.updateOne(
        { _id: evt._id },
        { start_time: new_time, end_time: newEndTime },
      );

      const downstream = await computeDownstream(property_id, event_type, new_time, newEndTime);

      console.log(
        `[TOOL:update_schedule] ${property.name} ${event_type}: ${origStart} → ${new_time} (fuzzy match)`,
      );

      return {
        property_id,
        property_name: property.name,
        event_type,
        old_time: origStart,
        new_time,
        downstream,
      };
    }

    throw new Error(
      `No ${event_type} event found at ${original_time} for ${property.name}. ` +
        `Found ${allEvents.length} ${event_type} events. Provide the exact original_time.`,
    );
  }

  // Calculate duration and new end time
  const durationMs =
    new Date(scheduleEvent.end_time).getTime() -
    new Date(scheduleEvent.start_time).getTime();
  const newEndTime = new Date(
    new Date(new_time).getTime() + durationMs,
  ).toISOString();

  const oldTime = scheduleEvent.start_time;

  await ScheduleEventModel.updateOne(
    { _id: scheduleEvent._id },
    { start_time: new_time, end_time: newEndTime },
  );

  const downstream = await computeDownstream(property_id, event_type, new_time, newEndTime);

  console.log(
    `[TOOL:update_schedule] ${property.name} ${event_type}: ${oldTime} → ${new_time} — ${reason}`,
  );

  const result: UpdateScheduleResult = {
    property_id,
    property_name: property.name,
    event_type,
    old_time: oldTime,
    new_time,
    downstream,
  };

  return result;
}

async function computeDownstream(
  propertyId: string,
  eventType: string,
  newStartTime: string,
  newEndTime: string,
): Promise<string> {
  const property = await PropertyModel.findOne({ id: propertyId }).lean();
  if (!property) return 'No downstream impact data available.';

  const isParkCity = property.location.includes('Park City');

  if (!isParkCity) {
    // Non-Park City properties: just report the change
    return `Schedule updated. No cascading impacts for ${property.location} properties.`;
  }

  // Park City cascading logic:
  // Crew does PROP_002 first, then drives 30 min to PROP_001
  // PROP_002 cleaning end → +30 min drive → PROP_001 cleaning start → +2 hr cleaning → PROP_001 check-in

  try {
    // Get current cleaning schedules for both Park City properties
    const prop002Cleaning = await ScheduleEventModel.findOne({
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      event_type: 'cleaning',
    }).lean();

    const prop001Cleaning = await ScheduleEventModel.findOne({
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      event_type: 'cleaning',
    }).lean();

    const prop001Checkin = await ScheduleEventModel.findOne({
      property_id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
      event_type: 'checkin',
    }).lean();

    const prop002Checkin = await ScheduleEventModel.findOne({
      property_id: PROPERTY_IDS.MOUNTAIN_LOFT,
      event_type: 'checkin',
    }).lean();

    if (!prop002Cleaning || !prop001Cleaning) {
      return 'Warning: Could not find cleaning schedules for both Park City properties to trace cascade.';
    }

    const fmt = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', {
        timeZone: 'America/Denver',
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    const prop002CleanEnd = new Date(prop002Cleaning.end_time);
    const driveArrival = new Date(prop002CleanEnd.getTime() + 30 * 60 * 1000); // +30 min
    const prop001CleanEnd = new Date(driveArrival.getTime() + 2 * 60 * 60 * 1000); // +2 hr

    const lines: string[] = [
      `CASCADING IMPACT ANALYSIS (Park City cleaning crew chain):`,
      `• PROP_002 (Mountain Loft) cleaning ends: ${fmt(prop002Cleaning.end_time)}`,
      `• + 30 min drive → arrives at PROP_001: ${fmt(driveArrival.toISOString())}`,
      `• + 2 hr cleaning → PROP_001 ready: ${fmt(prop001CleanEnd.toISOString())}`,
    ];

    if (prop001Checkin) {
      const checkinTime = new Date(prop001Checkin.start_time);
      if (prop001CleanEnd > checkinTime) {
        const overlapMin = Math.ceil(
          (prop001CleanEnd.getTime() - checkinTime.getTime()) / 60000,
        );
        lines.push(
          `• ⚠ CONFLICT: PROP_001 check-in at ${fmt(prop001Checkin.start_time)} — cleaning runs ${overlapMin} min past check-in!`,
        );
      } else {
        const bufferMin = Math.floor(
          (checkinTime.getTime() - prop001CleanEnd.getTime()) / 60000,
        );
        lines.push(
          `• PROP_001 check-in at ${fmt(prop001Checkin.start_time)} — ${bufferMin} min buffer. OK.`,
        );
      }
    }

    if (prop002Checkin) {
      const prop002CheckinTime = new Date(prop002Checkin.start_time);
      if (prop002CleanEnd > prop002CheckinTime) {
        const overlapMin = Math.ceil(
          (prop002CleanEnd.getTime() - prop002CheckinTime.getTime()) / 60000,
        );
        lines.push(
          `• ⚠ CONFLICT: PROP_002 check-in at ${fmt(prop002Checkin.start_time)} — cleaning runs ${overlapMin} min past check-in!`,
        );
      } else {
        const bufferMin = Math.floor(
          (prop002CheckinTime.getTime() - prop002CleanEnd.getTime()) / 60000,
        );
        lines.push(
          `• PROP_002 check-in at ${fmt(prop002Checkin.start_time)} — ${bufferMin} min buffer. OK.`,
        );
      }
    }

    return lines.join('\n');
  } catch (err) {
    console.error('[TOOL:update_schedule] Error computing downstream:', err);
    return 'Error computing cascading schedule impacts.';
  }
}
