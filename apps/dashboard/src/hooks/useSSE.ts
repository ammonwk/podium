import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DEMO_EVENTS,
  AGENT_CONFIG,
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

export interface EventState {
  name: string;
  source: 'human' | 'system' | 'self-scheduled';
  status: 'queued' | 'active' | 'done';
  thinkingText: string;
  toolCalls: ToolCallData[];
  startedAt?: string;
  completedAt?: string;
}

export interface ToolCallData {
  id: string;
  tool_name: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  event_name: string;
  timestamp: string;
}

export interface ActivityItem {
  id: string;
  type: 'sms_in' | 'sms_out' | 'price_change' | 'work_order' | 'schedule_change' | 'scheduled_task' | 'decision';
  timestamp: string;
  data: Record<string, unknown>;
  eventName: string;
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
  },
];

function createInitialState(): DashboardState {
  return {
    events: [],
    activeEventIndex: -1,
    activities: [],
    properties: INITIAL_PROPERTIES.map(p => ({ ...p, schedule: [...p.schedule], activeIssues: [...p.activeIssues] })),
    financials: { revenue: 0, costs: 0, decisions: 0 },
    upcomingTasks: [],
    isProcessing: false,
    demoPhase: 'idle',
    error: null,
    providerConfig: { provider: 'anthropic', model: 'claude-opus-4-6' },
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
      const payload: EventStartPayload = JSON.parse(e.data);
      setState(prev => {
        const newEvent: EventState = {
          name: payload.event_name,
          source: payload.source,
          status: 'active',
          thinkingText: '',
          toolCalls: [],
          startedAt: new Date().toISOString(),
        };
        // Check if this event was already queued
        const existingIdx = prev.events.findIndex(
          ev => ev.name === payload.event_name && ev.status === 'queued'
        );
        let newEvents: EventState[];
        let newIndex: number;
        if (existingIdx >= 0) {
          newEvents = prev.events.map((ev, i) =>
            i === existingIdx ? { ...ev, status: 'active' as const, startedAt: new Date().toISOString() } : ev
          );
          newIndex = existingIdx;
        } else {
          newEvents = [...prev.events, newEvent];
          newIndex = newEvents.length - 1;
        }

        // Mark upcoming tasks as fired if this matches
        const newTasks = prev.upcomingTasks.map(t =>
          payload.event_name.includes(t.description.substring(0, 20)) ||
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
      const payload: EventDonePayload = JSON.parse(e.data);
      setState(prev => {
        const newEvents = prev.events.map(ev =>
          ev.name === payload.event_name && ev.status === 'active'
            ? { ...ev, status: 'done' as const, completedAt: new Date().toISOString() }
            : ev
        );
        return {
          ...prev,
          events: newEvents,
          isProcessing: false,
        };
      });
    });

    es.addEventListener(SSE_EVENTS.EVENT_QUEUED, (e: MessageEvent) => {
      const payload: EventQueuedPayload = JSON.parse(e.data);
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
        };
        return {
          ...prev,
          events: [...prev.events, newEvent],
        };
      });
    });

    es.addEventListener(SSE_EVENTS.THINKING, (e: MessageEvent) => {
      const payload: ThinkingPayload = JSON.parse(e.data);
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
      const payload: ToolCallPayload = JSON.parse(e.data);
      const toolCall: ToolCallData = {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tool_name: payload.tool_name,
        input: payload.input,
        result: payload.result,
        event_name: payload.event_name,
        timestamp: new Date().toISOString(),
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
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [connect]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const runDemo = useCallback(async () => {
    setState(prev => ({ ...prev, demoPhase: 'running', demoEventIndex: 0 }));
    const serverUrl = getServerUrl();

    for (let i = 0; i < DEMO_EVENTS.length; i++) {
      setState(prev => ({ ...prev, demoEventIndex: i }));

      // Add inbound SMS activity for guest_message events
      if (DEMO_EVENTS[i].type === 'guest_message' && DEMO_EVENTS[i].body) {
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
      }

      try {
        await fetch(`${serverUrl}/api/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(DEMO_EVENTS[i]),
        });
      } catch (err) {
        console.error('Failed to send demo event:', err);
      }

      // Wait between events (except after last)
      if (i < DEMO_EVENTS.length - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, AGENT_CONFIG.DEMO_EVENT_PAUSE_MS)
        );
        // Also wait for current event to finish processing
        await waitForProcessingDone(setState);
      }
    }

    // After all 4 events, wait for final processing then go self-managing
    await waitForProcessingDone(setState);
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
        const config = data.provider || data;
        setState(prev => ({
          ...prev,
          providerConfig: { provider: config.provider, model: config.model },
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

// Helper to wait for processing to be done
function waitForProcessingDone(
  setState: React.Dispatch<React.SetStateAction<DashboardState>>
): Promise<void> {
  return new Promise(resolve => {
    const check = () => {
      setState(prev => {
        if (!prev.isProcessing) {
          setTimeout(resolve, 500);
          return prev;
        }
        setTimeout(check, 300);
        return prev;
      });
    };
    // Start checking after a short delay to ensure event_start has fired
    setTimeout(check, 1000);
  });
}
