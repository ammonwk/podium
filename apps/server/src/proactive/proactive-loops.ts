import type { IncomingEvent } from '@apm/shared';
import { AGENT_CONFIG } from '@apm/shared';
import { BookingModel, PropertyModel } from '../shared/db.js';
import { getUpcomingEvents } from '../pricing/events.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type EnqueueFn = (event: IncomingEvent, laneId: string, laneType: 'proactive') => void;

const PROACTIVE_LANE = 'proactive';
const executedActions = new Set<string>();

// ─── Feature 1: Ticketmaster Poll → Autonomous Price Adjustments ────────────

async function pollTicketmasterForAlerts(enqueueFn: EnqueueFn): Promise<void> {
  console.log('[PROACTIVE] Running Ticketmaster poll...');

  const properties = await PropertyModel.find({}).lean();

  for (const property of properties) {
    const events = await getUpcomingEvents(property.id);
    const notable = events.filter(
      (e) => e.demand_impact === 'high' || e.demand_impact === 'major',
    );

    if (notable.length === 0) continue;

    // Dedup by property + first notable event name + date
    const dedupKey = `market_poll_${property.id}_${notable[0].name}_${notable[0].date}`;
    if (executedActions.has(dedupKey)) continue;
    executedActions.add(dedupKey);

    const eventSummary = notable
      .map(
        (e) =>
          `"${e.name}" on ${e.date} at ${e.venue} (${e.demand_impact} impact, ~${e.attendance_estimate} attendees)`,
      )
      .join('\n- ');

    enqueueFn(
      {
        type: 'market_alert',
        source: 'system',
        name: `Market Scan: ${notable.length} event(s) near ${property.name}`,
        payload: {
          alert_type: 'ticketmaster_scan',
          message:
            `Automated Ticketmaster scan found ${notable.length} high-impact event(s) near ${property.name} (${property.location}):\n- ${eventSummary}\n\n` +
            `Current price: $${property.current_price}/night (base: $${property.base_price}). ` +
            `Review whether a price adjustment is warranted. Use get_market_data and adjust_price tools as needed.`,
        },
      },
      PROACTIVE_LANE,
      'proactive',
    );
  }
}

// ─── Feature 2: Morning Routine on Startup ──────────────────────────────────

async function runMorningRoutine(enqueueFn: EnqueueFn): Promise<void> {
  const todayKey = new Date().toISOString().split('T')[0];
  const dedupKey = `morning_briefing_${todayKey}`;
  if (executedActions.has(dedupKey)) return;
  executedActions.add(dedupKey);

  console.log('[PROACTIVE] Running morning routine...');

  const today = todayKey;
  const checkIns = await BookingModel.find({
    status: 'upcoming',
    check_in: { $regex: `^${today}` },
  }).lean();

  const checkOuts = await BookingModel.find({
    status: 'active',
    check_out: { $regex: `^${today}` },
  }).lean();

  const allBookings = await BookingModel.find({
    status: { $in: ['active', 'upcoming', 'pending_payment'] },
  }).lean();

  let briefing = `MORNING BRIEFING for ${today}:\n\n`;

  if (checkIns.length > 0) {
    briefing += `CHECK-INS TODAY (${checkIns.length}):\n`;
    for (const b of checkIns) {
      briefing += `- ${b.guest_name} (${b.guest_phone}) checking into ${b.property_id} at ${b.check_in}\n`;
    }
    briefing +=
      '\nFor each check-in guest, send them check-in instructions including WiFi credentials, door code, and parking info. Use get_property_status to look up the property details, then send_sms to each guest.\n\n';
  } else {
    briefing += 'CHECK-INS TODAY: None\n\n';
  }

  if (checkOuts.length > 0) {
    briefing += `CHECK-OUTS TODAY (${checkOuts.length}):\n`;
    for (const b of checkOuts) {
      briefing += `- ${b.guest_name} (${b.guest_phone}) checking out of ${b.property_id} at ${b.check_out}\n`;
    }
    briefing += '\n';
  } else {
    briefing += 'CHECK-OUTS TODAY: None\n\n';
  }

  briefing += `TOTAL ACTIVE/UPCOMING BOOKINGS: ${allBookings.length}\n`;
  briefing += '\nReview the day\'s schedule for any conflicts. Take proactive action on check-ins and log your decisions.';

  enqueueFn(
    {
      type: 'system',
      source: 'system',
      name: 'Morning Briefing: Check-ins & Schedule Review',
      payload: {
        message: briefing,
      },
    },
    PROACTIVE_LANE,
    'proactive',
  );
}

// ─── Feature 3: Post-Checkout Follow-up ─────────────────────────────────────

async function checkForCompletedCheckouts(enqueueFn: EnqueueFn): Promise<void> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Find active bookings whose checkout is today
  const checkouts = await BookingModel.find({
    status: 'active',
    check_out: { $regex: `^${todayStr}` },
  }).lean();

  for (const booking of checkouts) {
    const checkoutTime = new Date(booking.check_out);
    // Only trigger if checkout time has passed (or is within 30 min)
    if (now.getTime() < checkoutTime.getTime() - 30 * 60 * 1000) continue;

    const dedupKey = `checkout_followup_${booking.id}`;
    if (executedActions.has(dedupKey)) continue;
    executedActions.add(dedupKey);

    console.log(`[PROACTIVE] Triggering post-checkout follow-up for ${booking.guest_name}`);

    enqueueFn(
      {
        type: 'system',
        source: 'system',
        name: `Post-Checkout Follow-up: ${booking.guest_name}`,
        payload: {
          message:
            `Guest ${booking.guest_name} (${booking.guest_phone}) has checked out (or is about to) from ${booking.property_id}.\n\n` +
            `Send them a warm thank-you SMS and request a review. Mention the property by name. ` +
            `Use send_sms to reach them at ${booking.guest_phone}.`,
        },
      },
      PROACTIVE_LANE,
      'proactive',
    );
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

export function startProactiveLoops(enqueueFn: EnqueueFn): { stopAll: () => void } {
  const timers: (ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>)[] = [];
  const INTERVAL = AGENT_CONFIG.PROACTIVE_POLL_INTERVAL_MS;
  const STARTUP_DELAY = AGENT_CONFIG.PROACTIVE_STARTUP_DELAY_MS;

  // Morning routine: runs once on startup after a short delay
  const startupTimer = setTimeout(() => {
    runMorningRoutine(enqueueFn).catch((err) =>
      console.error('[PROACTIVE] Morning routine error:', err),
    );
  }, STARTUP_DELAY);
  timers.push(startupTimer);

  // First Ticketmaster poll shortly after morning routine
  const tmStartup = setTimeout(() => {
    pollTicketmasterForAlerts(enqueueFn).catch((err) =>
      console.error('[PROACTIVE] Initial Ticketmaster poll error:', err),
    );
  }, STARTUP_DELAY + 3000);
  timers.push(tmStartup);

  // Recurring Ticketmaster poll
  const tmTimer = setInterval(() => {
    pollTicketmasterForAlerts(enqueueFn).catch((err) =>
      console.error('[PROACTIVE] Ticketmaster poll error:', err),
    );
  }, INTERVAL);
  timers.push(tmTimer);

  // Recurring checkout follow-up check
  const coTimer = setInterval(() => {
    checkForCompletedCheckouts(enqueueFn).catch((err) =>
      console.error('[PROACTIVE] Checkout follow-up error:', err),
    );
  }, INTERVAL);
  timers.push(coTimer);

  console.log(
    `[PROACTIVE] Started proactive loops (interval: ${INTERVAL}ms, startup delay: ${STARTUP_DELAY}ms)`,
  );

  return {
    stopAll() {
      for (const t of timers) {
        clearInterval(t as ReturnType<typeof setInterval>);
        clearTimeout(t as ReturnType<typeof setTimeout>);
      }
      console.log('[PROACTIVE] All proactive loops stopped');
    },
  };
}

export function resetProactiveState(): void {
  executedActions.clear();
}
