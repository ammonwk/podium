import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { THEME, TOOL_COLORS } from '@apm/shared';
import { RADIUS, ANIMATION, SHADOW } from '../styles/theme';
import { ToolCard } from './ToolCard';
import type { EventState, ToolCallData, TaskState, TriggerMessage } from '../hooks/useSSE';

// ─── Keyframe Injection ─────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes breathe {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
@keyframes slideInFromBelow {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes chainDotAppear {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes thinkingPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`;

let injected = false;
function injectKeyframes(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LaneState {
  id: string;
  type: 'demo' | 'caller';
  status: 'active' | 'queued' | 'done';
  events: EventState[];
  currentEvent: EventState | null;
  allToolCalls: ToolCallData[];
  triggerPreview?: string;
  triggerFrom?: string;
  displayName: string;
  startedAt?: string;
  lastActivityAt?: string;
  elapsedSeconds: number;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  events: EventState[];
  isProcessing: boolean;
  upcomingTasks: TaskState[];
  onToolCardClick: (toolCall: ToolCallData) => void;
  onEventClick: (event: EventState) => void;
}

// ─── Tool Metadata ───────────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: string; label: string; color: string }> = {
  send_sms: { icon: 'SMS', label: 'Sent Message', color: TOOL_COLORS.send_sms || '#3B82F6' },
  create_work_order: { icon: 'WO', label: 'Work Order', color: TOOL_COLORS.create_work_order || '#F59E0B' },
  adjust_price: { icon: '$', label: 'Price Change', color: TOOL_COLORS.adjust_price || '#059669' },
  update_schedule: { icon: 'CAL', label: 'Schedule', color: TOOL_COLORS.update_schedule || '#7C3AED' },
  log_decision: { icon: 'AI', label: 'Decision', color: TOOL_COLORS.log_decision || '#6B7280' },
  schedule_task: { icon: 'TSK', label: 'Scheduled', color: TOOL_COLORS.schedule_task || '#0D9488' },
  get_market_data: { icon: 'MKT', label: 'Market Data', color: TOOL_COLORS.get_market_data || '#059669' },
  create_booking: { icon: 'BK', label: 'Booking', color: '#3B82F6' },
  edit_booking: { icon: 'BK', label: 'Edit Booking', color: '#7C3AED' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getElapsedSeconds(startedAt?: string, completedAt?: string): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  return Math.round((end - start) / 1000);
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function hexToRgbValues(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '107,114,128';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

function generateSummary(toolCalls: ToolCallData[]): string {
  const parts: string[] = [];
  for (const tc of toolCalls) {
    const input = tc.input as Record<string, unknown>;
    const result = tc.result as Record<string, unknown>;
    switch (tc.tool_name) {
      case 'send_sms':
        parts.push(`Sent message to ${(result.recipient_name as string) || 'guest'}`);
        break;
      case 'create_work_order':
        parts.push(`Dispatched ${(result.vendor_name as string) || 'vendor'} ($${(input.estimated_cost as number) || 0})`);
        break;
      case 'adjust_price':
        parts.push(`Adjusted pricing to $${(input.new_price as number) || 0}`);
        break;
      case 'create_booking':
        parts.push(`Created booking`);
        break;
      case 'edit_booking':
        parts.push(`Modified booking`);
        break;
      case 'update_schedule':
        parts.push(`Updated schedule`);
        break;
      case 'log_decision':
        parts.push(`Logged decision`);
        break;
      case 'schedule_task':
        parts.push(`Scheduled follow-up`);
        break;
    }
  }
  if (parts.length === 0) return '';
  if (parts.length <= 2) return parts.join('. ') + '.';
  return `${parts[0]}. ${parts[1]}. +${parts.length - 2} more.`;
}

/** Derive display name from event name — strip "Inbound SMS from" prefix, use name part */
function deriveDisplayName(event: EventState): string {
  const name = event.name;
  // Pattern: "Name: Description" (e.g., "Sarah: Late Checkout")
  const colonIdx = name.indexOf(':');
  if (colonIdx > 0 && colonIdx < 20) {
    return name.substring(0, colonIdx);
  }
  // Pattern: "Inbound SMS from +1..."
  if (name.startsWith('Inbound SMS from ')) {
    return name.substring(17);
  }
  return name;
}

/** Derive a short description from the event */
function deriveDescription(event: EventState): string {
  const name = event.name;
  const colonIdx = name.indexOf(':');
  if (colonIdx > 0 && colonIdx < 20) {
    return name.substring(colonIdx + 2);
  }
  return name;
}

// ─── Derive Lanes from Events ────────────────────────────────────────────────

function deriveLanes(events: EventState[]): LaneState[] {
  const laneMap = new Map<string, LaneState>();

  for (const ev of events) {
    // Group by conversationId if available, otherwise by event name
    const laneId = ev.conversationId || ev.name;

    let lane = laneMap.get(laneId);
    if (!lane) {
      const firstTrigger = ev.triggerMessage;
      lane = {
        id: laneId,
        type: ev.conversationType || 'demo',
        status: ev.status,
        events: [],
        currentEvent: null,
        allToolCalls: [],
        triggerPreview: firstTrigger?.body,
        triggerFrom: firstTrigger?.name || firstTrigger?.from,
        displayName: deriveDisplayName(ev),
        startedAt: ev.startedAt,
        lastActivityAt: ev.startedAt,
        elapsedSeconds: 0,
      };
      laneMap.set(laneId, lane);
    }

    lane.events.push(ev);
    lane.allToolCalls.push(...ev.toolCalls);

    // Update lane status: active > queued > done
    if (ev.status === 'active') {
      lane.status = 'active';
      lane.currentEvent = ev;
    } else if (ev.status === 'queued' && lane.status !== 'active') {
      lane.status = 'queued';
    }
    // Done only if all events in lane are done (default stays from init)

    // Track trigger from first event if not set
    if (!lane.triggerPreview && ev.triggerMessage) {
      lane.triggerPreview = ev.triggerMessage.body;
      lane.triggerFrom = ev.triggerMessage.name || ev.triggerMessage.from;
    }

    // Track timing
    if (ev.startedAt && (!lane.startedAt || ev.startedAt < lane.startedAt)) {
      lane.startedAt = ev.startedAt;
    }
    const lastTime = ev.completedAt || ev.startedAt;
    if (lastTime && (!lane.lastActivityAt || lastTime > lane.lastActivityAt)) {
      lane.lastActivityAt = lastTime;
    }
  }

  // Finalize: compute elapsed, confirm done status
  for (const lane of laneMap.values()) {
    if (lane.events.every(ev => ev.status === 'done')) {
      lane.status = 'done';
    }
    const lastEvent = lane.events[lane.events.length - 1];
    lane.elapsedSeconds = getElapsedSeconds(lane.startedAt, lastEvent?.completedAt);
  }

  // Sort: active first, then queued, then done (most recent first within done)
  const lanes = Array.from(laneMap.values());
  lanes.sort((a, b) => {
    const order = { active: 0, queued: 1, done: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    // Within same status, sort by startedAt (newer active on top for visibility)
    if (a.status === 'active') {
      return (b.startedAt || '').localeCompare(a.startedAt || '');
    }
    // Done: most recent first
    if (a.status === 'done') {
      return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
    }
    return 0;
  });

  return lanes;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const OperationsQueue: React.FC<Props> = ({
  events,
  isProcessing,
  upcomingTasks,
  onToolCardClick,
  onEventClick,
}) => {
  const feedRef = useRef<HTMLDivElement>(null);
  const [expandedLaneId, setExpandedLaneId] = useState<string | null>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(true);

  useEffect(() => { injectKeyframes(); }, []);

  // Derive lanes from events
  const lanes = useMemo(() => deriveLanes(events), [events]);

  // Tick for elapsed time on active lanes
  const [, setTick] = useState(0);
  const hasActive = lanes.some(l => l.status === 'active');
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasActive]);

  const activeLanes = useMemo(() => lanes.filter(l => l.status === 'active'), [lanes]);
  const queuedLanes = useMemo(() => lanes.filter(l => l.status === 'queued'), [lanes]);
  const doneLanes = useMemo(() => lanes.filter(l => l.status === 'done'), [lanes]);
  const visibleDone = doneCollapsed ? doneLanes.slice(0, 5) : doneLanes;
  const hiddenDoneCount = doneLanes.length - visibleDone.length;

  const pendingTasks = useMemo(
    () => upcomingTasks.filter(t => t.status === 'pending'),
    [upcomingTasks],
  );

  const toggleExpand = useCallback((laneId: string) => {
    setExpandedLaneId(prev => prev === laneId ? null : laneId);
  }, []);

  // ─── Count badge text ──────────────────────────────────────────────────────

  const countParts: string[] = [];
  if (activeLanes.length > 0) countParts.push(`${activeLanes.length} active`);
  if (queuedLanes.length > 0) countParts.push(`${queuedLanes.length} queued`);
  if (doneLanes.length > 0) countParts.push(`${doneLanes.length} done`);
  const countLabel = countParts.length > 0 ? countParts.join(' \u00B7 ') : 'No activity';

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerRowStyle}>
          <div style={headerLeftStyle}>
            {isProcessing && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: THEME.accent.violet,
                flexShrink: 0, animation: 'breathe 2s ease-in-out infinite',
              }} />
            )}
            <span style={{
              fontSize: 18, fontWeight: 700, color: THEME.text.accent,
              fontFamily: THEME.font.sans, letterSpacing: '-0.01em',
            }}>
              Live Activity
            </span>
          </div>
          <span style={{
            fontSize: 13, fontWeight: 600, color: THEME.text.muted,
            backgroundColor: THEME.bg.primary, padding: '4px 12px',
            borderRadius: RADIUS.full, whiteSpace: 'nowrap' as const,
            fontFamily: THEME.font.sans,
          }}>
            {countLabel}
          </span>
        </div>
      </div>

      {/* Scrollable Feed */}
      <div ref={feedRef} style={feedStyle}>
        {lanes.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: 40, lineHeight: '1', marginBottom: 8, animation: 'fadeIn 0.6s ease-out both' }}>
              {'🏠'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text.primary, fontFamily: THEME.font.sans, animation: 'fadeIn 0.6s ease-out 0.1s both' }}>
              Your AI assistant is ready
            </div>
            <div style={{ fontSize: 14, color: THEME.text.muted, fontFamily: THEME.font.sans, animation: 'fadeIn 0.6s ease-out 0.2s both' }}>
              Run the demo to see it in action
            </div>
          </div>
        ) : (
          <>
            {/* Active Lanes */}
            {activeLanes.length > 0 && (
              <>
                {activeLanes.map((lane, idx) => (
                  <LaneRow
                    key={lane.id}
                    lane={lane}
                    index={idx}
                    isExpanded={expandedLaneId === lane.id}
                    onToggleExpand={() => toggleExpand(lane.id)}
                    onToolCardClick={onToolCardClick}
                    onEventClick={onEventClick}
                  />
                ))}
              </>
            )}

            {/* Queued Lanes */}
            {queuedLanes.length > 0 && (
              <>
                {activeLanes.length > 0 && <SectionDivider label={`queued (${queuedLanes.length})`} />}
                {queuedLanes.map((lane, idx) => (
                  <LaneRow
                    key={lane.id}
                    lane={lane}
                    index={idx}
                    isExpanded={expandedLaneId === lane.id}
                    onToggleExpand={() => toggleExpand(lane.id)}
                    onToolCardClick={onToolCardClick}
                    onEventClick={onEventClick}
                  />
                ))}
              </>
            )}

            {/* Done Lanes */}
            {doneLanes.length > 0 && (
              <>
                <SectionDivider label={`completed (${doneLanes.length})`} />
                {visibleDone.map((lane, idx) => (
                  <LaneRow
                    key={lane.id}
                    lane={lane}
                    index={idx}
                    isExpanded={expandedLaneId === lane.id}
                    onToggleExpand={() => toggleExpand(lane.id)}
                    onToolCardClick={onToolCardClick}
                    onEventClick={onEventClick}
                  />
                ))}
                {hiddenDoneCount > 0 && (
                  <button
                    onClick={() => setDoneCollapsed(prev => !prev)}
                    style={showMoreStyle}
                  >
                    {doneCollapsed ? `Show ${hiddenDoneCount} more` : 'Show less'}
                  </button>
                )}
              </>
            )}

            {/* Upcoming Tasks */}
            {pendingTasks.length > 0 && (
              <>
                <SectionDivider label="upcoming" />
                {pendingTasks.map(task => (
                  <div key={task.task_id} style={taskRowStyle}>
                    <span style={taskDescStyle}>{task.description}</span>
                    <span style={taskTimeStyle}>
                      {getCountdown(task.fires_at)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Section Divider ─────────────────────────────────────────────────────────

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div style={dividerStyle}>
    <div style={dividerLineStyle} />
    <span style={dividerLabelStyle}>{label}</span>
    <div style={dividerLineStyle} />
  </div>
);

// ─── Lane Row ────────────────────────────────────────────────────────────────

const LaneRow: React.FC<{
  lane: LaneState;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToolCardClick: (toolCall: ToolCallData) => void;
  onEventClick: (event: EventState) => void;
}> = React.memo(({ lane, index, isExpanded, onToggleExpand, onToolCardClick, onEventClick }) => {
  const [hovered, setHovered] = useState(false);
  const isActive = lane.status === 'active';
  const isDone = lane.status === 'done';
  const isQueued = lane.status === 'queued';

  const elapsed = isActive
    ? getElapsedSeconds(lane.startedAt)
    : lane.elapsedSeconds;

  const summary = isDone ? generateSummary(lane.allToolCalls) : '';
  const description = lane.events.length > 0 ? deriveDescription(lane.events[0]) : '';

  return (
    <div
      style={{
        ...laneBaseStyle,
        animation: `slideInFromBelow 0.25s ${ANIMATION.easeOut} both`,
        animationDelay: `${Math.min(index, 15) * 40}ms`,
        ...(isActive ? {
          borderLeft: `3px solid ${THEME.accent.violet}`,
        } : isDone ? {
          borderLeft: '3px solid transparent',
          opacity: hovered ? 1 : 0.8,
        } : {
          borderLeft: `3px solid ${THEME.bg.border}`,
          opacity: 0.7,
        }),
        ...(hovered && !isQueued ? {
          backgroundColor: THEME.bg.cardHover,
        } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggleExpand}
    >
      {/* ── Compact Row ── */}
      <div style={laneCompactStyle}>
        {/* Left: status + name */}
        <div style={laneLeftStyle}>
          {isDone ? (
            <span style={checkmarkStyle}>{'\u2713'}</span>
          ) : isActive ? (
            <span style={activeDotStyle} />
          ) : (
            <span style={queuedDotStyle} />
          )}
          <div style={laneNameBlockStyle}>
            <div style={laneNameRowStyle}>
              <span style={{
                ...laneNameStyle,
                color: isQueued ? THEME.text.muted : THEME.text.accent,
              }}>
                {lane.displayName}
              </span>
              {lane.type === 'caller' && (
                <span style={callerBadgeStyle}>SMS</span>
              )}
              {lane.events[0]?.source === 'system' && (
                <span style={systemBadgeStyle}>System</span>
              )}
              {lane.events[0]?.source === 'self-scheduled' && (
                <span style={selfBadgeStyle}>Self</span>
              )}
            </div>
            {/* Trigger preview or description */}
            <span style={lanePreviewStyle}>
              {lane.triggerPreview
                ? `"${lane.triggerPreview.length > 60 ? lane.triggerPreview.slice(0, 60) + '...' : lane.triggerPreview}"`
                : description}
            </span>
          </div>
        </div>

        {/* Center: action chain */}
        <div style={laneCenterStyle}>
          <ActionChain
            toolCalls={lane.allToolCalls}
            isActive={isActive}
            currentEvent={lane.currentEvent}
          />
        </div>

        {/* Right: meta */}
        <div style={laneRightStyle}>
          {isQueued ? (
            <span style={queuedLabelStyle}>queued</span>
          ) : (
            <>
              <span style={{
                ...elapsedStyle,
                color: isActive ? THEME.accent.violet : THEME.text.muted,
              }}>
                {formatElapsed(elapsed)}
              </span>
              {isDone && lane.allToolCalls.length > 0 && (
                <span style={actCountStyle}>
                  {lane.allToolCalls.length} act{lane.allToolCalls.length !== 1 ? 's' : ''}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Done summary (inline, not expanded) ── */}
      {isDone && summary && !isExpanded && (
        <div style={doneSummaryStyle}>{summary}</div>
      )}

      {/* ── Expanded Detail ── */}
      {isExpanded && (
        <div style={expandedStyle} onClick={(e) => e.stopPropagation()}>
          {/* Trigger message */}
          {lane.triggerPreview && (
            <div style={triggerBubbleStyle}>
              <span style={{ fontSize: 13, flexShrink: 0, color: TOOL_COLORS.send_sms || '#3B82F6', fontWeight: 700 }}>
                SMS
              </span>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: THEME.text.secondary, fontFamily: THEME.font.sans }}>
                  {lane.triggerFrom || 'Guest'}:
                </span>
                <span style={{ fontSize: 14, color: THEME.text.primary, fontFamily: THEME.font.sans, lineHeight: '1.5', marginLeft: 4 }}>
                  &ldquo;{lane.triggerPreview}&rdquo;
                </span>
              </div>
            </div>
          )}

          {/* Reasoning */}
          {lane.currentEvent?.thinkingText && (
            <ReasoningExpander
              text={lane.currentEvent.thinkingText}
              isStreaming={isActive}
            />
          )}

          {/* Tool cards */}
          {lane.allToolCalls.length > 0 && (
            <div style={toolCardsStyle}>
              {lane.allToolCalls.map((tc, i) => (
                <ToolCard
                  key={tc.id}
                  toolCall={tc}
                  index={i}
                  onClick={() => onToolCardClick(tc)}
                />
              ))}
            </div>
          )}

          {/* Summary for done lanes */}
          {isDone && summary && (
            <div style={{ ...doneSummaryStyle, paddingLeft: 0 }}>
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

LaneRow.displayName = 'LaneRow';

// ─── Action Chain ────────────────────────────────────────────────────────────

const ActionChain: React.FC<{
  toolCalls: ToolCallData[];
  isActive: boolean;
  currentEvent: EventState | null;
}> = React.memo(({ toolCalls, isActive, currentEvent }) => {
  if (toolCalls.length === 0 && !isActive) return null;

  const isThinking = isActive && currentEvent && !currentEvent.thinkingText && currentEvent.toolCalls.length === 0;
  const hasThinkingText = isActive && currentEvent && currentEvent.thinkingText;

  return (
    <div style={chainContainerStyle}>
      {toolCalls.map((tc, i) => {
        const meta = TOOL_META[tc.tool_name];
        const color = meta?.color || '#6B7280';
        return (
          <React.Fragment key={tc.id}>
            {i > 0 && <span style={chainLineStyle} />}
            <span
              title={`${meta?.label || tc.tool_name}`}
              style={{
                ...chainDotStyle,
                backgroundColor: color,
                animation: `chainDotAppear 0.2s ${ANIMATION.spring} both`,
                animationDelay: `${i * 60}ms`,
              }}
            />
          </React.Fragment>
        );
      })}
      {/* Thinking indicator at end of chain */}
      {(isThinking || hasThinkingText) && (
        <>
          {toolCalls.length > 0 && <span style={chainLineStyle} />}
          <span style={thinkingDotStyle} />
        </>
      )}
    </div>
  );
});

ActionChain.displayName = 'ActionChain';

// ─── Reasoning Expander ──────────────────────────────────────────────────────

const ReasoningExpander: React.FC<{
  text: string;
  isStreaming: boolean;
}> = ({ text, isStreaming }) => {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && isStreaming && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [text, expanded, isStreaming]);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
        style={reasoningBtnStyle}
      >
        <span style={{ fontSize: 12 }}>{expanded ? '\u25BE' : '\u25B8'}</span>
        {expanded ? 'Hide reasoning' : 'Show reasoning'}
      </button>
      {expanded && (
        <div ref={ref} style={reasoningBoxStyle}>
          <span style={reasoningTextStyle}>
            {text}
          </span>
          {isStreaming && (
            <span style={cursorStyle} />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Countdown Helper ────────────────────────────────────────────────────────

function getCountdown(firesAt: string): string {
  const diff = new Date(firesAt).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  flex: 1, width: '100%', maxWidth: 900,
  margin: '0 auto', display: 'flex',
  flexDirection: 'column', overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  flexShrink: 0, padding: '12px 0',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const headerLeftStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
};

const feedStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '0 0 16px',
  display: 'flex', flexDirection: 'column', gap: 6,
};

const emptyStateStyle: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  gap: 8, padding: '60px 20px',
};

// Lane row
const laneBaseStyle: React.CSSProperties = {
  backgroundColor: THEME.bg.card,
  borderRadius: RADIUS.md,
  boxShadow: SHADOW.sm,
  border: `1px solid ${THEME.bg.border}`,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: `background-color ${ANIMATION.fast} ${ANIMATION.easeOut}, opacity ${ANIMATION.fast}`,
  padding: '10px 14px',
};

const laneCompactStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: 28,
};

const laneLeftStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  flex: 1, minWidth: 0,
};

const checkmarkStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: THEME.status.normal,
  flexShrink: 0, width: 18, height: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '50%', backgroundColor: 'rgba(5, 150, 105, 0.1)',
};

const activeDotStyle: React.CSSProperties = {
  width: 10, height: 10, borderRadius: '50%',
  backgroundColor: THEME.accent.violet, flexShrink: 0,
  animation: 'breathe 2s ease-in-out infinite',
};

const queuedDotStyle: React.CSSProperties = {
  width: 10, height: 10, borderRadius: '50%',
  border: `2px solid ${THEME.text.muted}`,
  backgroundColor: 'transparent', flexShrink: 0,
  boxSizing: 'border-box' as const,
};

const laneNameBlockStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 1,
  minWidth: 0, flex: 1,
};

const laneNameRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
};

const laneNameStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, fontFamily: THEME.font.sans,
  letterSpacing: '-0.01em',
  overflow: 'hidden', textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
};

const callerBadgeStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, flexShrink: 0,
  color: TOOL_COLORS.send_sms || '#3B82F6',
  backgroundColor: 'rgba(59,130,246,0.08)',
  padding: '1px 5px', borderRadius: RADIUS.sm,
  fontFamily: THEME.font.mono,
};

const systemBadgeStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, flexShrink: 0,
  color: THEME.status.attention,
  backgroundColor: 'rgba(217,119,6,0.08)',
  padding: '1px 5px', borderRadius: RADIUS.full,
  fontFamily: THEME.font.sans,
};

const selfBadgeStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, flexShrink: 0,
  color: THEME.status.selfInitiated,
  backgroundColor: 'rgba(13,148,136,0.08)',
  padding: '1px 5px', borderRadius: RADIUS.full,
  fontFamily: THEME.font.sans,
};

const lanePreviewStyle: React.CSSProperties = {
  fontSize: 12, color: THEME.text.muted,
  fontFamily: THEME.font.sans, lineHeight: '1.3',
  overflow: 'hidden', textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
};

const laneCenterStyle: React.CSSProperties = {
  flexShrink: 0, display: 'flex', alignItems: 'center',
};

const laneRightStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
  gap: 2, flexShrink: 0, minWidth: 50,
};

const queuedLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: THEME.text.muted,
  fontFamily: THEME.font.sans, textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
};

const elapsedStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, fontFamily: THEME.font.mono,
  whiteSpace: 'nowrap' as const,
};

const actCountStyle: React.CSSProperties = {
  fontSize: 11, color: THEME.text.muted, fontFamily: THEME.font.sans,
  whiteSpace: 'nowrap' as const,
};

const doneSummaryStyle: React.CSSProperties = {
  fontSize: 12, color: THEME.text.secondary,
  fontFamily: THEME.font.sans, lineHeight: '1.5',
  paddingLeft: 28, paddingTop: 4,
  overflow: 'hidden', textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
};

// Action chain
const chainContainerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 3,
};

const chainDotStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
};

const chainLineStyle: React.CSSProperties = {
  width: 8, height: 2, backgroundColor: THEME.bg.border, flexShrink: 0,
};

const thinkingDotStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  border: `2px solid ${THEME.accent.violet}`,
  backgroundColor: 'transparent',
  boxSizing: 'border-box' as const,
  animation: 'thinkingPulse 1.2s ease-in-out infinite',
};

// Expanded area
const expandedStyle: React.CSSProperties = {
  paddingTop: 12, borderTop: `1px solid ${THEME.bg.border}`,
  marginTop: 10,
};

const triggerBubbleStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  backgroundColor: THEME.bg.primary,
  border: `1px solid ${THEME.bg.border}`,
  borderRadius: '12px 12px 12px 4px',
  padding: '10px 14px', maxWidth: '85%',
};

const toolCardsStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  marginTop: 10,
};

// Reasoning
const reasoningBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  background: 'none', border: 'none', padding: '4px 0',
  cursor: 'pointer', fontFamily: THEME.font.sans,
  fontSize: 13, fontWeight: 500, color: THEME.text.muted, outline: 'none',
};

const reasoningBoxStyle: React.CSSProperties = {
  maxHeight: 180, overflow: 'auto', padding: 12,
  borderTop: `1px solid ${THEME.bg.border}`, marginTop: 4,
};

const reasoningTextStyle: React.CSSProperties = {
  fontFamily: THEME.font.sans, fontSize: 13, lineHeight: '1.6',
  color: THEME.text.secondary, whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
};

const cursorStyle: React.CSSProperties = {
  display: 'inline-block', width: 2, height: 14,
  backgroundColor: THEME.accent.violet, marginLeft: 2,
  verticalAlign: 'text-bottom',
  animation: 'cursorBlink 1s step-end infinite',
};

// Divider
const dividerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  margin: '6px 0', padding: '0 4px',
};

const dividerLineStyle: React.CSSProperties = {
  flex: 1, height: 1, backgroundColor: THEME.bg.border,
};

const dividerLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: THEME.text.muted,
  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  fontFamily: THEME.font.sans,
};

// Show more button
const showMoreStyle: React.CSSProperties = {
  background: 'none', border: `1px solid ${THEME.bg.border}`,
  borderRadius: RADIUS.md, padding: '6px 16px',
  fontSize: 12, fontWeight: 600, color: THEME.text.muted,
  cursor: 'pointer', fontFamily: THEME.font.sans,
  textAlign: 'center' as const, width: '100%',
  transition: `background-color ${ANIMATION.fast}`,
};

// Task rows
const taskRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 12, padding: '8px 14px', backgroundColor: THEME.bg.card,
  borderRadius: RADIUS.md, border: `1px solid ${THEME.bg.border}`,
};

const taskDescStyle: React.CSSProperties = {
  fontSize: 13, color: THEME.text.secondary, fontFamily: THEME.font.sans,
  lineHeight: '1.4', flex: 1, minWidth: 0, overflow: 'hidden',
  textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const,
};

const taskTimeStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: THEME.status.selfInitiated,
  fontFamily: THEME.font.mono, flexShrink: 0,
};

// ─── Backward Compatibility ──────────────────────────────────────────────────

export { deriveLanes };
export type { LaneState as LaneStateType };
