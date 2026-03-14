import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DEMO_EVENTS,
  SSE_EVENTS,
  PROPERTY_IDS,
} from '@apm/shared';
import type {
  ThinkingPayload,
  ToolCallPayload,
  EventStartPayload,
  EventDonePayload,
  ScheduledTaskPayload,
  EventQueuedPayload,
  ErrorPayload,
} from '@apm/shared';

// ─── State Types ────────────────────────────────────────────────────────────

export interface TriggerMessage {
  from: string;
  body: string;
  name: string;
}

export interface EventState {
  name: string;
  source: 'human' | 'system' | 'self-scheduled';
  status: 'queued' | 'active' | 'done';
  thinkingText: string;
  toolCalls: ToolCallData[];
  startedAt?: string;
  completedAt?: string;
  triggerMessage?: TriggerMessage;
  conversationId?: string;
  conversationType?: 'demo' | 'caller';
}

export interface ToolCallData {
  id: string;
  tool_name: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  event_name: string;
  timestamp: string;
  conversationId?: string;
}

export interface ActivityItem {
  id: string;
  type: 'sms_in' | 'sms_out' | 'price_change' | 'work_order' | 'schedule_change' | 'scheduled_task' | 'decision';
  timestamp: string;
  data: Record<string, unknown>;
  eventName: string;
}

export interface BookingRange {
  guestName: string;
  checkIn: string;
  checkOut: string;
}

export interface PropertyState {
  id: string;
  name: string;
  location: string;
  current_price: number;
  base_price: number;
  rating: number;
  review_count: number;
  status: 'normal' | 'attention' | 'emergency';
  activeIssues: string[];
  schedule: ScheduleSegment[];
  guestFlow: string;
  bookings: BookingRange[];
}

export interface ScheduleSegment {
  type: 'checkout' | 'cleaning' | 'checkin' | 'maintenance';
  start: number;
  end: number;
}

export interface TaskState {
  task_id: string;
  description: string;
  fires_at: string;
  status: 'pending' | 'fired';
}

export interface DashboardState {
  events: EventState[];
  activeEventIndex: number;
  activities: ActivityItem[];
  properties: PropertyState[];
  financials: { revenue: number; costs: number; decisions: number };
  upcomingTasks: TaskState[];
  isProcessing: boolean;
  demoPhase: 'idle' | 'running' | 'self-managing';
  error: string | null;
  providerConfig: { provider: string; model: string };
  demoEventIndex: number;
}

// ─── Initial State ──────────────────────────────────────────────────────────

function bookingDate(daysOffset: number, hours: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
}

const INITIAL_PROPERTIES: PropertyState[] = [
  {
    id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
    name: 'Oceanview Cottage',
    location: 'Park City, UT',
    current_price: 195,
    base_price: 195,
    rating: 4.6,
    review_count: 127,
    status: 'normal',
    activeIssues: [],
    schedule: [
      { type: 'checkout', start: 0, end: 25 },
      { type: 'cleaning', start: 25, end: 45 },
      { type: 'checkin', start: 60, end: 80 },
    ],
    guestFlow: 'Sarah → Mike',
    bookings: [
      { guestName: 'Sarah Chen', checkIn: bookingDate(-3, 15), checkOut: bookingDate(1, 11) },
      { guestName: 'Mike Torres', checkIn: bookingDate(1, 15), checkOut: bookingDate(6, 11) },
    ],
  },
  {
    id: PROPERTY_IDS.MOUNTAIN_LOFT,
    name: 'Mountain Loft',
    location: 'Park City, UT',
    current_price: 145,
    base_price: 145,
    rating: 4.8,
    review_count: 89,
    status: 'normal',
    activeIssues: [],
    schedule: [
      { type: 'checkout', start: 0, end: 20 },
      { type: 'cleaning', start: 20, end: 42 },
      { type: 'checkin', start: 60, end: 80 },
    ],
    guestFlow: 'James → Anna',
    bookings: [
      { guestName: 'James Wright', checkIn: bookingDate(-3, 15), checkOut: bookingDate(1, 10) },
      { guestName: 'Anna Park', checkIn: bookingDate(1, 15), checkOut: bookingDate(6, 11) },
    ],
  },
  {
    id: PROPERTY_IDS.CANYON_HOUSE,
    name: 'Canyon House',
    location: 'Moab, UT',
    current_price: 285,
    base_price: 285,
    rating: 4.4,
    review_count: 52,
    status: 'normal',
    activeIssues: [],
    schedule: [],
    guestFlow: 'Lisa (mid-stay)',
    bookings: [
      { guestName: 'Lisa Kim', checkIn: bookingDate(0, 15), checkOut: bookingDate(3, 11) },
    ],
  },
];

function createInitialState(): DashboardState {
  return {
    events: [],
    activeEventIndex: -1,
    activities: [],
    properties: INITIAL_PROPERTIES.map(p => ({ ...p, schedule: [...p.schedule], activeIssues: [...p.activeIssues], bookings: [...p.bookings] })),
    financials: { revenue: 0, costs: 0, decisions: 0 },
    upcomingTasks: [],
    isProcessing: false,
    demoPhase: 'idle',
    error: null,
    providerConfig: (() => {
      try {
        const saved = localStorage.getItem('providerConfig');
        if (saved) return JSON.parse(saved);
      } catch {}
      return { provider: 'anthropic', model: 'claude-opus-4-6' };
    })(),
    demoEventIndex: 0,
  };
}

// ─── Server URL ─────────────────────────────────────────────────────────────

function getServerUrl(): string {
  // In dev mode, Vite proxy handles /events/stream and /api routes
  return '';
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useSSE(): DashboardState & {
  runDemo: () => void;
  resetDemo: () => void;
  switchProvider: () => void;
  selectEvent: (index: number) => void;
} {
  const [state, setState] = useState<DashboardState>(createInitialState);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const activityCounterRef = useRef(0);
  const pendingTriggersRef = useRef<Map<string, TriggerMessage>>(new Map());

  // ─── SSE Connection ──────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const serverUrl = getServerUrl();
    const es = new EventSource(`${serverUrl}/events/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState(prev => ({ ...prev, error: null }));
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      // Retry after 2 seconds
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = window.setTimeout(() => {
        connect();
      }, 2000);
    };

    // Listen for each SSE event type
    es.addEventListener(SSE_EVENTS.EVENT_START, (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as EventStartPayload & { conversation_id?: string; conversation_type?: 'demo' | 'caller' };
      setState(prev => {
        // Attach trigger message if we stored one for this event
        const trigger = pendingTriggersRef.current.get(payload.event_name);
        if (trigger) {
          pendingTriggersRef.current.delete(payload.event_name);
        }

        const newEvent: EventState = {
          name: payload.event_name,
          source: payload.source,
          status: 'active',
          thinkingText: '',
          toolCalls: [],
          startedAt: new Date().toISOString(),
          triggerMessage: trigger,
          conversationId: payload.conversation_id,
          conversationType: payload.conversation_type,
        };
        // Check if this event was already queued
        const existingIdx = prev.events.findIndex(
          ev => ev.name === payload.event_name && ev.status === 'queued'
        );
        let newEvents: EventState[];
        let newIndex: number;
        if (existingIdx >= 0) {
          newEvents = prev.events.map((ev, i) =>
            i === existingIdx ? {
              ...ev,
              status: 'active' as const,
              startedAt: new Date().toISOString(),
              triggerMessage: trigger || ev.triggerMessage,
              conversationId: payload.conversation_id || ev.conversationId,
              conversationType: payload.conversation_type || ev.conversationType,
            } : ev
          );
          newIndex = existingIdx;
        } else {
          newEvents = [...prev.events, newEvent];
          newIndex = newEvents.length - 1;
        }

        // Mark upcoming tasks as fired if this matches
        const newTasks = prev.upcomingTasks.map(t =>
          (t.description && payload.event_name.includes(t.description.substring(0, 20))) ||
          payload.source === 'self-scheduled'
            ? { ...t, status: 'fired' as const }
            : t
        );

        return {
          ...prev,
          events: newEvents,
          activeEventIndex: newIndex,
          isProcessing: true,
          upcomingTasks: newTasks,
        };
      });
    });

    es.addEventListener(SSE_EVENTS.EVENT_DONE, (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as EventDonePayload & { conversation_id?: string };
      setState(prev => {
        const newEvents = prev.events.map(ev =>
          ev.name === payload.event_name && ev.status === 'active'
            ? { ...ev, status: 'done' as const, completedAt: new Date().toISOString() }
            : ev
        );
        // isProcessing is true as long as ANY event is still active
        const stillProcessing = newEvents.some(ev => ev.status === 'active');
        return {
          ...prev,
          events: newEvents,
          isProcessing: stillProcessing,
        };
      });
    });

    es.addEventListener(SSE_EVENTS.EVENT_QUEUED, (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as EventQueuedPayload & { conversation_id?: string; conversation_type?: 'demo' | 'caller' };
      setState(prev => {
        // Don't add if already exists
        if (prev.events.some(ev => ev.name === payload.event_name)) {
          return prev;
        }
        const newEvent: EventState = {
          name: payload.event_name,
          source: payload.source,
          status: 'queued',
          thinkingText: '',
          toolCalls: [],
          conversationId: payload.conversation_id,
          conversationType: payload.conversation_type,
        };
        return {
          ...prev,
          events: [...prev.events, newEvent],
        };
      });
    });

    es.addEventListener(SSE_EVENTS.THINKING, (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as ThinkingPayload & { conversation_id?: string };
      setState(prev => {
        const newEvents = prev.events.map(ev =>
          ev.name === payload.event_name && ev.status === 'active'
            ? { ...ev, thinkingText: ev.thinkingText + payload.text }
            : ev
        );
        return { ...prev, events: newEvents };
      });
    });

    es.addEventListener(SSE_EVENTS.TOOL_CALL, (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as ToolCallPayload & { conversation_id?: string };
      const toolCall: ToolCallData = {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tool_name: payload.tool_name,
        input: payload.input,
        result: payload.result,
        event_name: payload.event_name,
        timestamp: new Date().toISOString(),
        conversationId: payload.conversation_id,
      };

      setState(prev => {
        // Add tool call to active event
        const newEvents = prev.events.map(ev =>
          ev.name === payload.event_name && ev.status === 'active'
            ? { ...ev, toolCalls: [...ev.toolCalls, toolCall] }
            : ev
        );

        // Create activity item
        const newActivities = [...prev.activities];
        const actId = `act_${++activityCounterRef.current}`;

        // Update properties and financials
        let newProperties = prev.properties;
        let newFinancials = { ...prev.financials };

        switch (payload.tool_name) {
          case 'send_sms': {
            const result = payload.result as Record<string, unknown>;
            const input = payload.input as Record<string, unknown>;
            // Outbound SMS from the agent
            newActivities.unshift({
              id: actId,
              type: 'sms_out',
              timestamp: new Date().toISOString(),
              data: { ...input, ...result },
              eventName: payload.event_name,
            });
            break;
          }

          case 'create_work_order': {
            const result = payload.result as Record<string, unknown>;
            const input = payload.input as Record<string, unknown>;
            newActivities.unshift({
              id: actId,
              type: 'work_order',
              timestamp: new Date().toISOString(),
              data: { ...input, ...result },
              eventName: payload.event_name,
            });
            // Update property status
            const propId = input.property_id as string;
            const severity = input.severity as string;
            newProperties = prev.properties.map(p =>
              p.id === propId
                ? {
                    ...p,
                    status: severity === 'emergency' ? 'emergency' as const : 'attention' as const,
                    activeIssues: [...p.activeIssues, input.issue_description as string],
                  }
                : p
            );
            // Update costs
            const cost = (input.estimated_cost as number) || 0;
            newFinancials.costs += cost;
            break;
          }

          case 'adjust_price': {
            const result = payload.result as Record<string, unknown>;
            const input = payload.input as Record<string, unknown>;
            newActivities.unshift({
              id: actId,
              type: 'price_change',
              timestamp: new Date().toISOString(),
              data: { ...input, ...result },
              eventName: payload.event_name,
            });
            // Update property price
            const propId = input.property_id as string;
            const newPrice = input.new_price as number;
            newProperties = prev.properties.map(p =>
              p.id === propId
                ? { ...p, current_price: newPrice }
                : p
            );
            // Update revenue (difference from base)
            const prop = prev.properties.find(p => p.id === propId);
            if (prop) {
              const prevDelta = prop.current_price - prop.base_price;
              const newDelta = newPrice - prop.base_price;
              newFinancials.revenue += (newDelta - prevDelta);
            }
            break;
          }

          case 'log_decision': {
            const result = payload.result as Record<string, unknown>;
            const input = payload.input as Record<string, unknown>;
            newActivities.unshift({
              id: actId,
              type: 'decision',
              timestamp: new Date().toISOString(),
              data: { ...input, ...result },
              eventName: payload.event_name,
            });
            newFinancials.decisions += 1;
            break;
          }

          case 'get_market_data': {
            // No activity feed item for market data - it just shows in the stage
            break;
          }

          case 'update_schedule': {
            const result = payload.result as Record<string, unknown>;
            const input = payload.input as Record<string, unknown>;
            newActivities.unshift({
              id: actId,
              type: 'schedule_change',
              timestamp: new Date().toISOString(),
              data: { ...input, ...result },
              eventName: payload.event_name,
            });
            break;
          }

          case 'schedule_task': {
            const result = payload.result as Record<string, unknown>;
            const input = payload.input as Record<string, unknown>;
            newActivities.unshift({
              id: actId,
              type: 'scheduled_task',
              timestamp: new Date().toISOString(),
              data: { ...input, ...result },
              eventName: payload.event_name,
            });
            break;
          }
        }

        return {
          ...prev,
          events: newEvents,
          activities: newActivities,
          properties: newProperties,
          financials: newFinancials,
        };
      });
    });

    es.addEventListener(SSE_EVENTS.SCHEDULED_TASK, (e: MessageEvent) => {
      const payload: ScheduledTaskPayload = JSON.parse(e.data);
      setState(prev => {
        const newTask: TaskState = {
          task_id: payload.task_id,
          description: payload.description,
          fires_at: payload.fires_at,
          status: 'pending',
        };
        return {
          ...prev,
          upcomingTasks: [...prev.upcomingTasks, newTask],
        };
      });
    });

    es.addEventListener(SSE_EVENTS.RESET, () => {
      setState(createInitialState());
    });

    es.addEventListener(SSE_EVENTS.ERROR, (e: MessageEvent) => {
      const payload: ErrorPayload = JSON.parse(e.data);
      setState(prev => ({ ...prev, error: payload.message }));
    });
  }, []);

  useEffect(() => {
    connect();

    // Sync server with saved provider preference
    const saved = localStorage.getItem('providerConfig');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        fetch(`${getServerUrl()}/api/provider`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: saved,
        }).then(resp => {
          if (resp.ok) {
            setState(prev => ({ ...prev, providerConfig: config }));
          }
        }).catch(() => {});
      } catch {}
    }

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [connect]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const runDemo = useCallback(async () => {
    setState(prev => ({ ...prev, demoPhase: 'running', demoEventIndex: 0 }));
    const serverUrl = getServerUrl();
    const BURST_DELAY_MS = 250; // stagger events by 250ms for a rapid burst

    // Fire all events rapidly — each goes to its own lane via phone number,
    // so they process concurrently on the server
    for (let i = 0; i < DEMO_EVENTS.length; i++) {
      setState(prev => ({ ...prev, demoEventIndex: i }));

      // Add inbound SMS activity + store trigger for event card
      if (DEMO_EVENTS[i].type === 'guest_message' && DEMO_EVENTS[i].body) {
        const triggerMsg: TriggerMessage = {
          from: DEMO_EVENTS[i].from || '',
          body: DEMO_EVENTS[i].body || '',
          name: DEMO_EVENTS[i].name,
        };
        pendingTriggersRef.current.set(DEMO_EVENTS[i].name, triggerMsg);

        const actId = `act_inbound_${++activityCounterRef.current}`;
        setState(prev => ({
          ...prev,
          activities: [
            {
              id: actId,
              type: 'sms_in' as const,
              timestamp: new Date().toISOString(),
              data: {
                from: DEMO_EVENTS[i].from,
                body: DEMO_EVENTS[i].body,
                name: DEMO_EVENTS[i].name,
              },
              eventName: DEMO_EVENTS[i].name,
            },
            ...prev.activities,
          ],
        }));
      } else if (DEMO_EVENTS[i].type === 'market_alert') {
        // Store market alert as trigger message too
        const triggerMsg: TriggerMessage = {
          from: 'Market Alert',
          body: (DEMO_EVENTS[i] as { message?: string }).message || '',
          name: DEMO_EVENTS[i].name,
        };
        pendingTriggersRef.current.set(DEMO_EVENTS[i].name, triggerMsg);
      }

      // Fire-and-forget — don't await the server response before sending the next
      fetch(`${serverUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEMO_EVENTS[i]),
      }).catch(err => console.error('Failed to send demo event:', err));

      // Short stagger between sends so the dashboard can show them arriving
      if (i < DEMO_EVENTS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BURST_DELAY_MS));
      }
    }

    // All events sent — wait for everything to finish processing, then go self-managing
    await waitForAllEventsDone(setState);
    setState(prev => ({ ...prev, demoPhase: 'self-managing' }));
  }, []);

  const resetDemo = useCallback(async () => {
    const serverUrl = getServerUrl();
    try {
      await fetch(`${serverUrl}/api/reset`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to reset:', err);
    }
    setState(createInitialState());
  }, []);

  const switchProvider = useCallback(async () => {
    const serverUrl = getServerUrl();
    try {
      // Toggle between Anthropic and Cerebras
      const nextConfig = state.providerConfig.provider === 'anthropic'
        ? { provider: 'cerebras', model: 'zai-glm-4.7' }
        : { provider: 'anthropic', model: 'claude-opus-4-6' };

      const resp = await fetch(`${serverUrl}/api/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig),
      });
      if (resp.ok) {
        const data = await resp.json();
        const providerConfig = { provider: data.provider, model: data.model };
        localStorage.setItem('providerConfig', JSON.stringify(providerConfig));
        setState(prev => ({
          ...prev,
          providerConfig,
        }));
      }
    } catch (err) {
      console.error('Failed to switch provider:', err);
    }
  }, [state.providerConfig.provider]);

  const selectEvent = useCallback((index: number) => {
    setState(prev => ({ ...prev, activeEventIndex: index }));
  }, []);

  return {
    ...state,
    runDemo,
    resetDemo,
    switchProvider,
    selectEvent,
  };
}

// Helper to wait until all demo events have finished processing.
// With concurrent lanes, isProcessing can toggle rapidly, so instead
// we check that every known event has reached 'done' status.
function waitForAllEventsDone(
  setState: React.Dispatch<React.SetStateAction<DashboardState>>
): Promise<void> {
  return new Promise(resolve => {
    const totalExpected = DEMO_EVENTS.length;
    const check = () => {
      setState(prev => {
        const doneCount = prev.events.filter(ev => ev.status === 'done').length;
        if (doneCount >= totalExpected) {
          setTimeout(resolve, 500);
          return prev;
        }
        setTimeout(check, 500);
        return prev;
      });
    };
    // Start checking after a delay to let the first events get queued
    setTimeout(check, 2000);
  });
}
