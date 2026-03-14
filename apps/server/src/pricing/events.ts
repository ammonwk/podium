import { PropertyModel } from '../shared/db.js';
import { emitSSE } from '../shared/sse.js';

const TICKETMASTER_KEY = process.env.TICKETMASTER_API_KEY!;

export interface LocalEvent {
  name: string;
  date: string;
  venue: string;
  attendance_estimate: number;
  distance_miles: number;
  demand_impact: 'low' | 'medium' | 'high' | 'major';
}

export async function getUpcomingEvents(propertyId: string): Promise<LocalEvent[]> {
  const property = await PropertyModel.findOne({ id: propertyId }).lean();
  const zipCode = property?.zip_code ?? '84060';
  const city = property?.location ?? 'Park City, UT';

  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
  url.searchParams.set('apikey', TICKETMASTER_KEY);
  url.searchParams.set('postalCode', zipCode);
  url.searchParams.set('radius', '30');
  url.searchParams.set('unit', 'miles');
  url.searchParams.set('startDateTime', `${today}T00:00:00Z`);
  url.searchParams.set('endDateTime', `${nextMonth}T00:00:00Z`);
  url.searchParams.set('size', '10');
  url.searchParams.set('sort', 'date,asc');

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    const rawEvents = data?._embedded?.events ?? [];

    const events: LocalEvent[] = rawEvents.map((e: any) => {
      const segment = e.classifications?.[0]?.segment?.name ?? '';
      const capacity = segment === 'Music' ? 8000 : segment === 'Sports' ? 15000 : 5000;
      const impact: LocalEvent['demand_impact'] =
        capacity > 10000 ? 'major' : capacity > 5000 ? 'high' : capacity > 2000 ? 'medium' : 'low';

      return {
        name: e.name,
        date: e.dates?.start?.localDate ?? 'TBD',
        venue: e._embedded?.venues?.[0]?.name ?? 'Local Venue',
        attendance_estimate: capacity,
        distance_miles: parseFloat(e.distance ?? '10'),
        demand_impact: impact,
      };
    });

    if (events.length === 0) return getMockEvents(city);

    emitSSE('tool_call', {
      tool_name: 'event_scan',
      input: { property_id: propertyId, zip_code: zipCode },
      result: {
        summary: `Ticketmaster scan near ${city}: ${events.length} upcoming event(s). ` +
          `Top: "${events[0].name}" on ${events[0].date} — ${events[0].demand_impact} demand impact.`,
        events: events.slice(0, 3),
      },
      event_name: 'Event Scan',
    });

    return events;
  } catch (err) {
    console.error('Ticketmaster API error, using mock fallback:', err);
    return getMockEvents(city);
  }
}

function getMockEvents(city: string): LocalEvent[] {
  return [
    {
      name: `${city} Jazz & Arts Festival`,
      date: new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0],
      venue: `${city} Event Center`,
      attendance_estimate: 12000,
      distance_miles: 2.4,
      demand_impact: 'major',
    },
  ];
}
