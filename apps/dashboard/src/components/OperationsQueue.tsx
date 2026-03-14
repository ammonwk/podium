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

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
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

function deriveDisplayName(event: EventState): string {
  const name = event.name;
  const colonIdx = name.indexOf(':');
  if (colonIdx > 0 && colonIdx < 20) {
    return name.substring(0, colonIdx);
  }
  if (name.startsWith('Inbound SMS from ')) {
    return name.substring(17);
  }
  return name;
}

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

    if (ev.status === 'active') {
      lane.status = 'active';
      lane.currentEvent = ev;
    } else if (ev.status === 'queued' && lane.status !== 'active') {
      lane.status = 'queued';
    }

    if (!lane.triggerPreview && ev.triggerMessage) {
      lane.triggerPreview = ev.triggerMessage.body;
      lane.triggerFrom = ev.triggerMessage.name || ev.triggerMessage.from;
    }

    if (ev.startedAt && (!lane.startedAt || ev.startedAt < lane.startedAt)) {
      lane.startedAt = ev.startedAt;
    }
    const lastTime = ev.completedAt || ev.startedAt;
    if (lastTime && (!lane.lastActivityAt || lastTime > lane.lastActivityAt)) {
      lane.lastActivityAt = lastTime;
    }
  }

  for (const lane of laneMap.values()) {
    if (lane.events.every(ev => ev.status === 'done')) {
      lane.status = 'done';
    }
    const lastEvent = lane.events[lane.events.length - 1];
    lane.elapsedSeconds = getElapsedSeconds(lane.startedAt, lastEvent?.completedAt);
  }

  const lanes = Array.from(laneMap.values());
  lanes.sort((a, b) => {
    const order = { active: 0, queued: 1, done: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    // Within each status group, most recent activity first
    return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
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
  const lastManualSelectRef = useRef<{ laneId: string; time: number } | null>(null);
  const prevActiveLaneIdsRef = useRef<Set<string>>(new Set());
  const expandedLaneIdRef = useRef<string | null>(null);
  expandedLaneIdRef.current = expandedLaneId;

  useEffect(() => { injectKeyframes(); }, []);

  const lanes = useMemo(() => deriveLanes(events), [events]);

  // Tick for active lane elapsed times
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

  const hasActiveOrQueued = activeLanes.length > 0 || queuedLanes.length > 0;

  const pendingTasks = useMemo(
    () => upcomingTasks.filter(t => t.status === 'pending'),
    [upcomingTasks],
  );

  const selectLane = useCallback((laneId: string) => {
    setExpandedLaneId(prev => {
      const next = prev === laneId ? null : laneId;
      if (next) {
        lastManualSelectRef.current = { laneId: next, time: Date.now() };
      }
      return next;
    });
  }, []);

  // Auto-open side panel when a new lane becomes active
  useEffect(() => {
    const currentActiveIds = new Set(activeLanes.map(l => l.id));
    const prevActiveIds = prevActiveLaneIdsRef.current;

    const newActiveLanes = activeLanes.filter(l => !prevActiveIds.has(l.id));
    prevActiveLaneIdsRef.current = currentActiveIds;

    if (newActiveLanes.length === 0) return;

    // Pick the most recent new active lane (first in sorted order)
    const newestLane = newActiveLanes[0];

    // Don't interrupt if user manually selected a different lane within the last 60s
    // and that lane's panel is still open
    const manual = lastManualSelectRef.current;
    if (manual) {
      const stillViewing = expandedLaneIdRef.current === manual.laneId;
      const withinCooldown = (Date.now() - manual.time) < 60_000;
      const isDifferent = manual.laneId !== newestLane.id;

      if (isDifferent && stillViewing && withinCooldown) {
        return;
      }
    }

    setExpandedLaneId(newestLane.id);
  }, [activeLanes]);

  // Count badge
  const countParts: string[] = [];
  if (activeLanes.length > 0) countParts.push(`${activeLanes.length} active`);
  if (queuedLanes.length > 0) countParts.push(`${queuedLanes.length} queued`);
  if (doneLanes.length > 0) countParts.push(`${doneLanes.length} done`);
  const countLabel = countParts.length > 0 ? countParts.join(' \u00B7 ') : 'No activity';

  const selectedLane = expandedLaneId ? lanes.find(l => l.id === expandedLaneId) || null : null;

  return (
    <div style={containerStyle}>
      {/* Left: Lane List */}
      <div style={listColumnStyle}>
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
            <span style={countBadgeStyle}>
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
              {activeLanes.map((lane, idx) => (
                <ActiveLaneRow
                  key={lane.id}
                  lane={lane}
                  index={idx}
                  isSelected={expandedLaneId === lane.id}
                  onSelect={() => selectLane(lane.id)}
                  onToolCardClick={onToolCardClick}
                  onEventClick={onEventClick}
                />
              ))}

              {/* Queued Lanes */}
              {queuedLanes.length > 0 && (
                <>
                  {activeLanes.length > 0 && <SectionDivider label={`queued (${queuedLanes.length})`} />}
                  {queuedLanes.map((lane, idx) => (
                    <QueuedLaneRow key={lane.id} lane={lane} index={idx} />
                  ))}
                </>
              )}

              {/* Done Lanes */}
              {doneLanes.length > 0 && (
                <>
                  {hasActiveOrQueued && <SectionDivider label={`completed (${doneLanes.length})`} />}
                  {doneLanes.map((lane, idx) => (
                    <DoneLaneRow
                      key={lane.id}
                      lane={lane}
                      index={idx}
                      isSelected={expandedLaneId === lane.id}
                      onSelect={() => selectLane(lane.id)}
                      onToolCardClick={onToolCardClick}
                      onEventClick={onEventClick}
                    />
                  ))}
                </>
              )}

            </>
          )}
        </div>

        {/* Upcoming Tasks — sticky bottom */}
        {pendingTasks.length > 0 && (
          <div style={upcomingStickyStyle}>
            <SectionDivider label="upcoming" />
            {pendingTasks.map(task => (
              <div key={task.task_id} style={taskRowStyle}>
                <span style={taskDescStyle}>{task.description}</span>
                <span style={taskTimeStyle}>{getCountdown(task.fires_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Detail Panel (always rendered, width transitions) */}
      <div style={{
        ...detailWrapperBase,
        width: selectedLane ? DETAIL_WIDTH : 0,
        marginLeft: selectedLane ? DETAIL_GAP : 0,
        opacity: selectedLane ? 1 : 0,
      }}>
        <div style={detailPanelInnerStyle}>
          {selectedLane && (
            <>
              <div style={detailPanelHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedLane.status === 'active' && <span style={activeDotStyle} />}
                  {selectedLane.status === 'done' && <span style={checkmarkStyle}>{'\u2713'}</span>}
                  <span style={{ fontSize: 15, fontWeight: 700, color: THEME.text.accent, fontFamily: THEME.font.sans }}>
                    {selectedLane.displayName}
                  </span>
                  {selectedLane.type === 'caller' && <span style={smsBadgeStyle}>SMS</span>}
                </div>
                <button style={detailCloseStyle} onClick={() => setExpandedLaneId(null)}>&times;</button>
              </div>
              <div style={detailPanelBodyStyle}>
                <ExpandedDetail
                  lane={selectedLane}
                  isActive={selectedLane.status === 'active'}
                  onToolCardClick={onToolCardClick}
                />
              </div>
            </>
          )}
        </div>
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

// ─── Active Lane Row (2-line: name+preview, with action chain) ───────────────

const ActiveLaneRow: React.FC<{
  lane: LaneState;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onToolCardClick: (toolCall: ToolCallData) => void;
  onEventClick: (event: EventState) => void;
}> = React.memo(({ lane, index, isSelected, onSelect }) => {
  const elapsed = getElapsedSeconds(lane.startedAt);
  const description = lane.events.length > 0 ? deriveDescription(lane.events[0]) : '';

  return (
    <div
      style={{
        ...cardStyle,
        borderLeft: `3px solid ${THEME.accent.violet}`,
        animation: `slideInFromBelow 0.25s ${ANIMATION.easeOut} both`,
        animationDelay: `${Math.min(index, 15) * 40}ms`,
        ...(isSelected ? selectedCardStyle : {}),
      }}
      onClick={onSelect}
    >
      {/* Row 1: status + name + chain + time */}
      <div style={rowStyle}>
        <span style={activeDotStyle} />
        <span style={nameStyle}>{lane.displayName}</span>
        {lane.type === 'caller' && <span style={smsBadgeStyle}>SMS</span>}
        {lane.events[0]?.source === 'system' && <span style={systemBadgeStyle}>System</span>}
        <div style={{ flex: 1 }} />
        <ActionChain toolCalls={lane.allToolCalls} isActive currentEvent={lane.currentEvent} />
        <span style={{ ...metaStyle, color: THEME.accent.violet }}>{formatElapsed(elapsed)}</span>
      </div>

      {/* Row 2: trigger preview */}
      {lane.triggerPreview && (
        <div style={previewRowStyle}>
          &ldquo;{lane.triggerPreview.length > 80 ? lane.triggerPreview.slice(0, 80) + '...' : lane.triggerPreview}&rdquo;
        </div>
      )}
      {!lane.triggerPreview && description && (
        <div style={previewRowStyle}>{description}</div>
      )}
    </div>
  );
});
ActiveLaneRow.displayName = 'ActiveLaneRow';

// ─── Queued Lane Row (single line, muted) ────────────────────────────────────

const QueuedLaneRow: React.FC<{
  lane: LaneState;
  index: number;
}> = React.memo(({ lane, index }) => (
  <div
    style={{
      ...cardStyle,
      borderLeft: `3px solid ${THEME.bg.border}`,
      opacity: 0.65,
      padding: '7px 14px',
      animation: `slideInFromBelow 0.25s ${ANIMATION.easeOut} both`,
      animationDelay: `${Math.min(index, 15) * 40}ms`,
    }}
  >
    <div style={rowStyle}>
      <span style={queuedDotStyle} />
      <span style={{ ...nameStyle, color: THEME.text.muted }}>{lane.displayName}</span>
      {lane.type === 'caller' && <span style={smsBadgeStyle}>SMS</span>}
      <div style={{ flex: 1 }} />
      <span style={queuedLabelStyle}>queued</span>
    </div>
  </div>
));
QueuedLaneRow.displayName = 'QueuedLaneRow';

// ─── Done Lane Row (single line, compact, with action chain) ─────────────────

const DoneLaneRow: React.FC<{
  lane: LaneState;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onToolCardClick: (toolCall: ToolCallData) => void;
  onEventClick: (event: EventState) => void;
}> = React.memo(({ lane, index, isSelected, onSelect }) => {
  const summary = generateSummary(lane.allToolCalls);

  return (
    <div
      style={{
        ...cardStyle,
        padding: '8px 14px',
        animation: `slideInFromBelow 0.2s ${ANIMATION.easeOut} both`,
        animationDelay: `${Math.min(index, 20) * 30}ms`,
        ...(isSelected ? selectedCardStyle : {}),
      }}
      onClick={onSelect}
    >
      {/* Row: ✓ Name SMS  ●━●━●  8s · 3 acts */}
      <div style={rowStyle}>
        <span style={checkmarkStyle}>{'\u2713'}</span>
        <span style={nameStyle}>{lane.displayName}</span>
        {lane.type === 'caller' && <span style={smsBadgeStyle}>SMS</span>}
        {lane.events[0]?.source === 'system' && <span style={systemBadgeStyle}>System</span>}

        {/* Summary fills the middle */}
        <span style={doneSummaryInlineStyle}>
          {summary}
        </span>

        <ActionChain toolCalls={lane.allToolCalls} isActive={false} currentEvent={null} />
        <span style={metaStyle}>{formatElapsed(lane.elapsedSeconds)}</span>
        {lane.allToolCalls.length > 0 && (
          <span style={actCountStyle}>
            {lane.allToolCalls.length} act{lane.allToolCalls.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
});
DoneLaneRow.displayName = 'DoneLaneRow';

// ─── Expanded Detail (shared by active + done) ──────────────────────────────

const ExpandedDetail: React.FC<{
  lane: LaneState;
  isActive: boolean;
  onToolCardClick: (toolCall: ToolCallData) => void;
}> = ({ lane, isActive, onToolCardClick }) => {
  // Build a unified conversation timeline
  type TimelineItem =
    | { kind: 'inbound_sms'; from: string; body: string; ts: number }
    | { kind: 'outbound_sms'; to: string; body: string; status: string; timestamp: string; tc: ToolCallData; idx: number }
    | { kind: 'tool'; tc: ToolCallData; idx: number }
    | { kind: 'reasoning' };

  const items: TimelineItem[] = [];

  // 1. Incoming SMS trigger is always first
  if (lane.triggerPreview) {
    items.push({ kind: 'inbound_sms', from: lane.triggerFrom || 'Guest', body: lane.triggerPreview, ts: 0 });
  }

  // 2. Reasoning (if active and has thinking text)
  if (lane.currentEvent?.thinkingText) {
    items.push({ kind: 'reasoning' });
  }

  // 3. Tool calls in order, splitting SMS out as chat bubbles
  lane.allToolCalls.forEach((tc, i) => {
    if (tc.tool_name === 'send_sms') {
      const input = tc.input as Record<string, unknown>;
      const result = tc.result as Record<string, unknown>;
      items.push({
        kind: 'outbound_sms',
        to: (result.recipient_name as string) || (input.to as string) || 'Guest',
        body: (input.body as string) || '',
        status: (result.status as string) || 'queued',
        timestamp: (result.timestamp as string) || '',
        tc,
        idx: i,
      });
    } else {
      items.push({ kind: 'tool', tc, idx: i });
    }
  });

  return (
    <div style={expandedStyle} onClick={(e) => e.stopPropagation()}>
      <div style={conversationStyle}>
        {items.map((item, i) => {
          switch (item.kind) {
            case 'inbound_sms':
              return (
                <div key={`in-${i}`} style={inboundRowStyle}>
                  <div style={inboundBubbleStyle}>
                    <div style={inboundSenderStyle}>{item.from}</div>
                    <div style={inboundBodyStyle}>{item.body}</div>
                  </div>
                </div>
              );

            case 'reasoning':
              return (
                <div key={`reason-${i}`} style={{ margin: '4px 0' }}>
                  <ReasoningExpander text={lane.currentEvent!.thinkingText} isStreaming={isActive} />
                </div>
              );

            case 'tool':
              return (
                <div key={item.tc.id} style={eventCardRowStyle}>
                  <ToolCard
                    toolCall={item.tc}
                    index={item.idx}
                    onClick={() => onToolCardClick(item.tc)}
                  />
                </div>
              );

            case 'outbound_sms':
              return (
                <div key={item.tc.id} style={outboundRowStyle}>
                  <div style={outboundRecipientStyle}>To {item.to}</div>
                  <div style={outboundBubbleStyle}>
                    {item.body}
                  </div>
                  <div style={outboundMetaStyle}>
                    <span style={{
                      color: item.status === 'delivered' ? THEME.status.normal
                           : item.status === 'queued' ? THEME.text.muted
                           : THEME.status.emergency,
                      fontWeight: 500,
                    }}>
                      {item.status === 'delivered' ? '✓ Delivered' : item.status === 'queued' ? '● Queued' : '✗ Failed'}
                    </span>
                    {item.timestamp && (
                      <span style={{ color: THEME.text.muted, fontFamily: THEME.font.mono }}>
                        {formatTimestamp(item.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};

// ─── Action Chain ────────────────────────────────────────────────────────────

const ActionChain: React.FC<{
  toolCalls: ToolCallData[];
  isActive: boolean;
  currentEvent: EventState | null;
}> = React.memo(({ toolCalls, isActive, currentEvent }) => {
  if (toolCalls.length === 0 && !isActive) return null;

  const isThinking = isActive && currentEvent &&
    !currentEvent.thinkingText && currentEvent.toolCalls.length === 0;
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
              title={meta?.label || tc.tool_name}
              style={{
                ...chainDotStyle,
                backgroundColor: color,
                animation: isActive ? `chainDotAppear 0.2s ${ANIMATION.spring} both` : undefined,
                animationDelay: isActive ? `${i * 60}ms` : undefined,
              }}
            />
          </React.Fragment>
        );
      })}
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
          <span style={reasoningTextStyle}>{text}</span>
          {isStreaming && <span style={cursorStyle} />}
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

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const DETAIL_WIDTH = 420;
const DETAIL_GAP = 16;

const containerStyle: React.CSSProperties = {
  flex: 1, width: '100%', display: 'flex',
  flexDirection: 'row', justifyContent: 'center',
  minHeight: 0,
};

const listColumnStyle: React.CSSProperties = {
  width: 900, maxWidth: '100%', flexShrink: 1,
  display: 'flex', flexDirection: 'column', minHeight: 0,
};

const detailWrapperBase: React.CSSProperties = {
  flexShrink: 0, overflow: 'hidden', display: 'flex',
  transition: `width 0.35s ${ANIMATION.easeOut}, margin-left 0.35s ${ANIMATION.easeOut}, opacity 0.25s ${ANIMATION.easeOut}`,
};

const detailPanelInnerStyle: React.CSSProperties = {
  width: DETAIL_WIDTH, minWidth: DETAIL_WIDTH,
  height: '100%', display: 'flex',
  flexDirection: 'column',
  backgroundColor: THEME.bg.card,
  borderRadius: RADIUS.md,
  border: `1px solid ${THEME.bg.border}`,
  boxShadow: SHADOW.md,
  overflow: 'hidden',
};

const detailPanelHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', borderBottom: `1px solid ${THEME.bg.border}`,
  flexShrink: 0,
};

const detailPanelBodyStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '12px 16px',
};

const detailCloseStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 18, color: THEME.text.muted, padding: '0 4px',
  fontFamily: THEME.font.sans, lineHeight: 1,
};

const headerStyle: React.CSSProperties = {
  flexShrink: 0, padding: 'clamp(4px, 1vh, 10px) 0',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const headerLeftStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
};

const countBadgeStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: THEME.text.muted,
  backgroundColor: THEME.bg.primary, padding: '4px 12px',
  borderRadius: RADIUS.full, whiteSpace: 'nowrap' as const,
  fontFamily: THEME.font.sans,
};

const feedStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '0 0 12px',
  display: 'flex', flexDirection: 'column', gap: 6,
};

const emptyStateStyle: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  gap: 8, padding: 'clamp(20px, 5vh, 60px) 20px',
};

// ─── Shared card base ────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  backgroundColor: THEME.bg.card,
  borderRadius: RADIUS.md,
  boxShadow: SHADOW.sm,
  border: `1px solid ${THEME.bg.border}`,
  overflow: 'hidden',
  flexShrink: 0,
  cursor: 'pointer',
  transition: `background-color ${ANIMATION.fast} ${ANIMATION.easeOut}, border-color ${ANIMATION.fast}, opacity ${ANIMATION.fast}`,
  padding: '12px 16px',
};

const selectedCardStyle: React.CSSProperties = {
  backgroundColor: THEME.bg.primary,
  borderColor: THEME.accent.violet,
};

// ─── Row layout (single line flex) ───────────────────────────────────────────

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 28,
};

// ─── Status indicators ──────────────────────────────────────────────────────

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

const checkmarkStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: THEME.status.normal,
  flexShrink: 0, width: 16, height: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '50%', backgroundColor: 'rgba(5, 150, 105, 0.1)',
};

// ─── Name and badges ─────────────────────────────────────────────────────────

const nameStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, fontFamily: THEME.font.sans,
  color: THEME.text.accent, letterSpacing: '-0.01em',
  whiteSpace: 'nowrap' as const, flexShrink: 0,
};

const smsBadgeStyle: React.CSSProperties = {
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

// ─── Preview row (active lanes only, second line) ────────────────────────────

const previewRowStyle: React.CSSProperties = {
  fontSize: 12, color: THEME.text.muted,
  fontFamily: THEME.font.sans, lineHeight: '1.4',
  paddingLeft: 26, paddingTop: 2,
  overflow: 'hidden', textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
};

// ─── Meta (right side) ──────────────────────────────────────────────────────

const metaStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, fontFamily: THEME.font.mono,
  color: THEME.text.muted, whiteSpace: 'nowrap' as const, flexShrink: 0,
};

const actCountStyle: React.CSSProperties = {
  fontSize: 11, color: THEME.text.muted, fontFamily: THEME.font.sans,
  whiteSpace: 'nowrap' as const, flexShrink: 0,
};

const queuedLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: THEME.text.muted,
  fontFamily: THEME.font.sans, textTransform: 'uppercase' as const,
  letterSpacing: '0.04em', flexShrink: 0,
};

// ─── Done summary (shows on hover, inline in the flexible space) ─────────────

const doneSummaryInlineStyle: React.CSSProperties = {
  flex: 1, minWidth: 0,
  fontSize: 12, color: THEME.text.secondary,
  fontFamily: THEME.font.sans,
  overflow: 'hidden', textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
};

// ─── Action chain ────────────────────────────────────────────────────────────

const chainContainerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 2,
  flexShrink: 0, marginLeft: 4, marginRight: 4,
};

const chainDotStyle: React.CSSProperties = {
  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
};

const chainLineStyle: React.CSSProperties = {
  width: 6, height: 2, backgroundColor: THEME.bg.border, flexShrink: 0,
};

const thinkingDotStyle: React.CSSProperties = {
  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
  border: `2px solid ${THEME.accent.violet}`,
  backgroundColor: 'transparent',
  boxSizing: 'border-box' as const,
  animation: 'thinkingPulse 1.2s ease-in-out infinite',
};

// ─── Expanded area ───────────────────────────────────────────────────────────

const expandedStyle: React.CSSProperties = {
};

const conversationStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10,
};

// Inbound SMS (left-aligned, like received iMessage)
const inboundRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-start',
};
const inboundBubbleStyle: React.CSSProperties = {
  backgroundColor: THEME.bg.primary,
  border: `1px solid ${THEME.bg.border}`,
  borderRadius: '4px 14px 14px 14px',
  padding: '10px 14px', maxWidth: '85%',
};
const inboundSenderStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: THEME.text.secondary,
  fontFamily: THEME.font.sans, marginBottom: 3,
};
const inboundBodyStyle: React.CSSProperties = {
  fontSize: 15, color: THEME.text.primary,
  fontFamily: THEME.font.sans, lineHeight: '1.5',
};

// Outbound SMS (right-aligned, like sent iMessage)
const outboundRowStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
};
const outboundRecipientStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: THEME.text.muted,
  fontFamily: THEME.font.sans, marginBottom: 3, marginRight: 4,
};
const outboundBubbleStyle: React.CSSProperties = {
  backgroundColor: 'rgba(59, 130, 246, 0.08)',
  border: '1px solid rgba(59, 130, 246, 0.12)',
  borderRadius: '14px 14px 4px 14px',
  padding: '10px 14px', maxWidth: '85%',
  fontSize: 15, color: THEME.text.primary,
  fontFamily: THEME.font.sans, lineHeight: '1.5',
};
const outboundMetaStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 13, marginTop: 4, marginRight: 4,
};

// Tool call event cards (full width, inline between messages)
const eventCardRowStyle: React.CSSProperties = {
  margin: '2px 0',
};

// ─── Reasoning ───────────────────────────────────────────────────────────────

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

// ─── Divider ─────────────────────────────────────────────────────────────────

const dividerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  margin: '4px 0', padding: '0 4px',
};

const dividerLineStyle: React.CSSProperties = {
  flex: 1, height: 1, backgroundColor: THEME.bg.border,
};

const dividerLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: THEME.text.muted,
  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  fontFamily: THEME.font.sans,
};

const upcomingStickyStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex', flexDirection: 'column', gap: 4,
  paddingTop: 4,
  borderTop: `1px solid ${THEME.bg.border}`,
};

// ─── Task rows ───────────────────────────────────────────────────────────────

const taskRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 12, padding: '7px 14px', backgroundColor: THEME.bg.card,
  borderRadius: RADIUS.md, border: `1px solid ${THEME.bg.border}`,
};

const taskDescStyle: React.CSSProperties = {
  fontSize: 12, color: THEME.text.secondary, fontFamily: THEME.font.sans,
  lineHeight: '1.4', flex: 1, minWidth: 0, overflow: 'hidden',
  textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const,
};

const taskTimeStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: THEME.status.selfInitiated,
  fontFamily: THEME.font.mono, flexShrink: 0,
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export { deriveLanes };
export type { LaneState as LaneStateType };
