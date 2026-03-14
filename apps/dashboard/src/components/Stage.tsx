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
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes slideInFromBelow {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes waitingPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes thinkingDotBounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-4px); }
}
`;

let keyframesInjected = false;
function injectKeyframes(): void {
  if (keyframesInjected) return;
  keyframesInjected = true;
  const style = document.createElement('style');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  events: EventState[];
  activeEventIndex: number;
  isProcessing: boolean;
  upcomingTasks: TaskState[];
  onToolCardClick: (toolCall: ToolCallData) => void;
  onEventClick: (event: EventState) => void;
  onSelectEvent: (index: number) => void;
}

// ─── Tool Metadata ──────────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: string; label: string; color: string }> = {
  send_sms: { icon: 'SMS', label: 'Sent Message', color: TOOL_COLORS.send_sms || '#3B82F6' },
  create_work_order: { icon: 'WO', label: 'Work Order', color: TOOL_COLORS.create_work_order || '#F59E0B' },
  adjust_price: { icon: '$', label: 'Price Change', color: TOOL_COLORS.adjust_price || '#059669' },
  update_schedule: { icon: 'CAL', label: 'Schedule', color: TOOL_COLORS.update_schedule || '#7C3AED' },
  log_decision: { icon: 'AI', label: 'Decision', color: TOOL_COLORS.log_decision || '#6B7280' },
  schedule_task: { icon: 'TSK', label: 'Scheduled', color: TOOL_COLORS.schedule_task || '#0D9488' },
  get_market_data: { icon: 'MKT', label: 'Market Data', color: TOOL_COLORS.get_market_data || '#059669' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function getCountdown(firesAt: string): string {
  const diff = new Date(firesAt).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

function getCompactSummary(tc: ToolCallData): string {
  const input = tc.input as Record<string, unknown>;
  const result = tc.result as Record<string, unknown>;
  switch (tc.tool_name) {
    case 'send_sms':
      return `\u2192 ${(result.recipient_name as string) || 'guest'}`;
    case 'create_work_order':
      return `${(result.vendor_name as string) || 'vendor'}`;
    case 'adjust_price':
      return `$${(input.new_price as number) || 0}`;
    case 'update_schedule':
      return `${(input.event_type as string) || 'event'}`;
    case 'log_decision':
      return `${((input.category as string) || 'logged').slice(0, 16)}`;
    case 'schedule_task':
      return `${((input.task_description as string) || '').slice(0, 16)}`;
    case 'get_market_data':
      return `${(input.location as string) || 'area'}`;
    default:
      return tc.tool_name;
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
        parts.push(`Dispatched ${(result.vendor_name as string) || 'vendor'} for ${(input.severity as string) || ''} issue ($${(input.estimated_cost as number) || 0})`);
        break;
      case 'adjust_price':
        parts.push(`Adjusted ${(result.property_name as string) || 'property'} pricing to $${(input.new_price as number) || 0}`);
        break;
      case 'update_schedule':
        parts.push(`Rescheduled ${(input.event_type as string) || 'event'}: ${(result.old_time as string) || ''} \u2192 ${(result.new_time as string) || (input.new_time as string) || ''}`);
        break;
      case 'log_decision': {
        const summary = (input.summary as string) || '';
        parts.push(summary.length > 60 ? `Decision: ${summary.slice(0, 60)}...` : `Decision: ${summary}`);
        break;
      }
      case 'schedule_task':
        parts.push(`Scheduled follow-up: ${(input.task_description as string) || ''}`);
        break;
      case 'get_market_data':
        parts.push(`Retrieved market data for ${(input.location as string) || 'area'}`);
        break;
    }
  }
  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}

// ─── Component ──────────────────────────────────────────────────────────────

export const Stage: React.FC<Props> = ({
  events,
  activeEventIndex,
  isProcessing,
  upcomingTasks,
  onToolCardClick,
  onEventClick,
  onSelectEvent,
}) => {
  const feedRef = useRef<HTMLDivElement>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});
  const [reasoningAutoScroll, setReasoningAutoScroll] = useState(true);
  const reasoningRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Auto-scroll feed to active event when it changes
  useEffect(() => {
    if (feedRef.current && activeEventIndex >= 0) {
      const cards = feedRef.current.querySelectorAll('[data-event-card]');
      const target = cards[activeEventIndex];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeEventIndex]);

  // Auto-scroll reasoning when streaming
  const activeEvent = activeEventIndex >= 0 ? events[activeEventIndex] : null;
  useEffect(() => {
    if (activeEvent && expandedReasoning[activeEventIndex] && reasoningAutoScroll) {
      const el = reasoningRefs.current[activeEventIndex];
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [activeEvent?.thinkingText, activeEventIndex, expandedReasoning, reasoningAutoScroll]);

  // Reset reasoning expanded state when active event changes
  const prevActiveRef = useRef<number>(-1);
  useEffect(() => {
    if (activeEventIndex !== prevActiveRef.current) {
      prevActiveRef.current = activeEventIndex;
      setReasoningAutoScroll(true);
    }
  }, [activeEventIndex]);

  // Countdown ticker for upcoming tasks
  const [, setTick] = useState(0);
  const pendingTasks = useMemo(
    () => upcomingTasks.filter(t => t.status === 'pending'),
    [upcomingTasks],
  );
  useEffect(() => {
    if (pendingTasks.length === 0) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [pendingTasks.length]);

  // Derived
  const doneCount = events.filter(e => e.status === 'done').length;
  const eventCountLabel =
    events.length === 0
      ? 'No events yet'
      : `${doneCount} of ${events.length} handled`;

  const toggleReasoning = useCallback((idx: number) => {
    setExpandedReasoning(prev => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const handleReasoningScroll = useCallback((idx: number) => {
    const el = reasoningRefs.current[idx];
    if (el) {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setReasoningAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    }
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={headerStyle}>
        <div style={headerRowStyle}>
          <div style={headerLeftStyle}>
            {isProcessing && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: THEME.accent.violet,
                  flexShrink: 0,
                  animation: 'breathe 2s ease-in-out infinite',
                }}
              />
            )}
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: THEME.text.accent,
                fontFamily: THEME.font.sans,
                letterSpacing: '-0.01em',
              }}
            >
              AI Activity
            </span>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: THEME.text.muted,
              backgroundColor: THEME.bg.primary,
              padding: '4px 12px',
              borderRadius: RADIUS.full,
              whiteSpace: 'nowrap' as const,
              fontFamily: THEME.font.sans,
            }}
          >
            {eventCountLabel}
          </span>
        </div>
      </div>

      {/* ── Scrollable Feed ────────────────────────────────────────────── */}
      <div ref={feedRef} style={feedStyle}>
        {events.length === 0 ? (
          /* ── Empty State ────────────────────────────────────────────── */
          <div style={emptyStateStyle}>
            <div style={{ fontSize: 40, lineHeight: '1', marginBottom: 8, animation: 'fadeIn 0.6s ease-out both' }}>
              {'🏠'}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: THEME.text.primary,
                fontFamily: THEME.font.sans,
                animation: 'fadeIn 0.6s ease-out 0.1s both',
              }}
            >
              Your AI assistant is ready
            </div>
            <div
              style={{
                fontSize: 14,
                color: THEME.text.muted,
                fontFamily: THEME.font.sans,
                animation: 'fadeIn 0.6s ease-out 0.2s both',
              }}
            >
              Run the demo to see it in action
            </div>
          </div>
        ) : (
          <>
            {events.map((ev, idx) => {
              const isDone = ev.status === 'done';
              const isActive = ev.status === 'active';
              const isQueued = ev.status === 'queued';
              const isReasoningExpanded = expandedReasoning[idx] || false;
              const elapsed = isDone
                ? getElapsedSeconds(ev.startedAt, ev.completedAt)
                : 0;
              const summary = isDone ? generateSummary(ev.toolCalls) : '';
              const trigger = ev.triggerMessage;

              // ── QUEUED ──
              if (isQueued) {
                return (
                  <div
                    key={`${ev.name}-${idx}`}
                    data-event-card
                    onClick={() => onSelectEvent(idx)}
                    style={{
                      ...cardBaseStyle,
                      padding: '14px 20px',
                      cursor: 'pointer',
                      animation: `slideInFromBelow 0.3s ${ANIMATION.easeOut} both`,
                      animationDelay: `${idx * 60}ms`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            border: `2px solid ${THEME.text.muted}`,
                            backgroundColor: 'transparent',
                            flexShrink: 0,
                            boxSizing: 'border-box' as const,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: THEME.text.muted,
                            fontFamily: THEME.font.sans,
                          }}
                        >
                          {ev.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: THEME.text.muted,
                          fontFamily: THEME.font.sans,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.04em',
                        }}
                      >
                        Queued
                      </span>
                    </div>
                  </div>
                );
              }

              // ── ACTIVE or DONE ──
              return (
                <div
                  key={`${ev.name}-${idx}`}
                  data-event-card
                  style={{
                    ...cardBaseStyle,
                    animation: `slideInFromBelow 0.3s ${ANIMATION.easeOut} both`,
                    animationDelay: `${idx * 60}ms`,
                    ...(isActive
                      ? { borderColor: `rgba(124, 58, 237, 0.25)` }
                      : {}),
                  }}
                >
                  {/* ── Card Header Row ── */}
                  <div
                    onClick={() => onEventClick(ev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px 0',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      {isDone ? (
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: THEME.status.normal,
                            flexShrink: 0,
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(5, 150, 105, 0.1)',
                          }}
                        >
                          {'\u2713'}
                        </span>
                      ) : (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: THEME.accent.violet,
                            flexShrink: 0,
                            animation: 'breathe 2s ease-in-out infinite',
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: THEME.text.accent,
                          fontFamily: THEME.font.sans,
                          letterSpacing: '-0.01em',
                          flex: 1,
                        }}
                      >
                        {ev.name}
                      </span>
                      {/* Source indicator */}
                      {ev.source === 'system' && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: THEME.status.attention,
                            backgroundColor: 'rgba(217, 119, 6, 0.08)',
                            padding: '2px 8px',
                            borderRadius: RADIUS.full,
                            flexShrink: 0,
                            fontFamily: THEME.font.sans,
                          }}
                        >
                          System
                        </span>
                      )}
                      {ev.source === 'self-scheduled' && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: THEME.status.selfInitiated,
                            backgroundColor: 'rgba(13, 148, 136, 0.08)',
                            padding: '2px 8px',
                            borderRadius: RADIUS.full,
                            flexShrink: 0,
                            fontFamily: THEME.font.sans,
                          }}
                        >
                          Self-Initiated
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: isActive ? THEME.accent.violet : THEME.text.muted,
                        fontFamily: THEME.font.sans,
                        flexShrink: 0,
                        marginLeft: 12,
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {isActive
                        ? 'Processing'
                        : `${formatElapsed(elapsed)} \u00B7 ${ev.toolCalls.length} act${ev.toolCalls.length !== 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* ── Trigger Message ── */}
                  {trigger && (
                    <div style={{ padding: '12px 20px 0' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          backgroundColor: THEME.bg.primary,
                          border: `1px solid ${THEME.bg.border}`,
                          borderRadius: '12px 12px 12px 4px',
                          padding: '10px 14px',
                          maxWidth: '85%',
                        }}
                      >
                        <span style={{ fontSize: 13, flexShrink: 0, color: THEME.tool.sms, fontWeight: 700 }}>SMS</span>
                        <div style={{ minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: THEME.text.secondary,
                              fontFamily: THEME.font.sans,
                            }}
                          >
                            {trigger.name || trigger.from}:
                          </span>
                          <span
                            style={{
                              fontSize: 14,
                              color: THEME.text.primary,
                              fontFamily: THEME.font.sans,
                              lineHeight: '1.5',
                              marginLeft: 4,
                            }}
                          >
                            &ldquo;{trigger.body}&rdquo;
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* System alert trigger (no triggerMessage, source is system) */}
                  {!trigger && ev.source === 'system' && (
                    <div style={{ padding: '12px 20px 0' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: 'rgba(217, 119, 6, 0.06)',
                          border: '1px solid rgba(217, 119, 6, 0.15)',
                          borderRadius: RADIUS.sm,
                          padding: '8px 12px',
                        }}
                      >
                        <span style={{ fontSize: 13, flexShrink: 0, color: THEME.status.attention, fontWeight: 700 }}>⚠</span>
                        <span
                          style={{
                            fontSize: 13,
                            color: THEME.status.attention,
                            fontWeight: 600,
                            fontFamily: THEME.font.sans,
                          }}
                        >
                          System alert triggered
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Self-scheduled trigger (no triggerMessage, source is self-scheduled) */}
                  {!trigger && ev.source === 'self-scheduled' && (
                    <div style={{ padding: '12px 20px 0' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: 'rgba(13, 148, 136, 0.06)',
                          border: '1px solid rgba(13, 148, 136, 0.15)',
                          borderRadius: RADIUS.sm,
                          padding: '8px 12px',
                        }}
                      >
                        <span style={{ fontSize: 13, flexShrink: 0, color: THEME.status.selfInitiated, fontWeight: 700 }}>↻</span>
                        <span
                          style={{
                            fontSize: 13,
                            color: THEME.status.selfInitiated,
                            fontWeight: 600,
                            fontFamily: THEME.font.sans,
                          }}
                        >
                          Self-initiated task
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ── AI Summary (done events only) ── */}
                  {isDone && summary && (
                    <div
                      style={{
                        padding: '12px 20px 0',
                        fontSize: 14,
                        color: THEME.text.secondary,
                        fontFamily: THEME.font.sans,
                        lineHeight: '1.6',
                      }}
                    >
                      {summary}
                    </div>
                  )}

                  {/* ── Compact Action Cards ── */}
                  {ev.toolCalls.length > 0 && (
                    <div
                      style={{
                        padding: '12px 20px 0',
                        display: 'flex',
                        flexWrap: 'wrap' as const,
                        gap: 8,
                      }}
                    >
                      {ev.toolCalls.map((tc, tcIdx) => {
                        const meta = TOOL_META[tc.tool_name] || {
                          icon: '?',
                          label: tc.tool_name,
                          color: '#6B7280',
                        };
                        const compactSummary = getCompactSummary(tc);

                        return (
                          <CompactActionCard
                            key={tc.id}
                            icon={meta.icon}
                            label={meta.label}
                            summary={compactSummary}
                            color={meta.color}
                            index={tcIdx}
                            isActive={isActive}
                            onClick={() => onToolCardClick(tc)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* ── Thinking Dots (active, no tool calls yet, no thinking text) ── */}
                  {isActive &&
                    !ev.thinkingText &&
                    ev.toolCalls.length === 0 && (
                      <div
                        style={{
                          padding: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '14px 20px',
                            border: `1px dashed ${THEME.bg.border}`,
                            borderRadius: RADIUS.md,
                            backgroundColor: THEME.bg.primary,
                          }}
                        >
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[0, 1, 2].map(i => (
                              <span
                                key={i}
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: THEME.accent.violet,
                                  animation: 'waitingPulse 1s ease-in-out infinite',
                                  animationDelay: `${i * 200}ms`,
                                }}
                              />
                            ))}
                          </div>
                          <span
                            style={{
                              fontSize: 14,
                              color: THEME.text.muted,
                              fontWeight: 500,
                              fontFamily: THEME.font.sans,
                            }}
                          >
                            Agent is thinking
                          </span>
                        </div>
                      </div>
                    )}

                  {/* ── Reasoning Expander ── */}
                  {ev.thinkingText && (
                    <div style={{ padding: '8px 20px 0' }}>
                      <button
                        onClick={() => toggleReasoning(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'none',
                          border: 'none',
                          padding: '4px 0',
                          cursor: 'pointer',
                          fontFamily: THEME.font.sans,
                          fontSize: 14,
                          fontWeight: 500,
                          color: THEME.text.muted,
                          outline: 'none',
                          marginLeft: 'auto',
                        }}
                      >
                        <span style={{ fontSize: 12 }}>
                          {isReasoningExpanded ? '\u25BE' : '\u25B8'}
                        </span>
                        {isReasoningExpanded ? 'Hide reasoning' : 'Show reasoning'}
                      </button>
                      {isReasoningExpanded && (
                        <div
                          ref={(el) => { reasoningRefs.current[idx] = el; }}
                          onScroll={() => handleReasoningScroll(idx)}
                          style={{
                            maxHeight: 200,
                            overflow: 'auto',
                            padding: 12,
                            borderTop: `1px solid ${THEME.bg.border}`,
                            marginTop: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: THEME.font.sans,
                              fontSize: 13,
                              lineHeight: '1.6',
                              color: THEME.text.secondary,
                              whiteSpace: 'pre-wrap' as const,
                              wordBreak: 'break-word' as const,
                            }}
                          >
                            {ev.thinkingText}
                          </span>
                          {isActive && isProcessing && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: 2,
                                height: 14,
                                backgroundColor: THEME.accent.violet,
                                marginLeft: 2,
                                verticalAlign: 'text-bottom',
                                animation: 'cursorBlink 1s step-end infinite',
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card bottom padding */}
                  <div style={{ height: 16 }} />
                </div>
              );
            })}

            {/* ── Upcoming Tasks ── */}
            {pendingTasks.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 10,
                    padding: '0 4px',
                  }}
                >
                  <div style={{ flex: 1, height: 1, backgroundColor: THEME.bg.border }} />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: THEME.text.muted,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.06em',
                      fontFamily: THEME.font.sans,
                    }}
                  >
                    Upcoming
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: THEME.bg.border }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                  {pendingTasks.map(task => (
                    <div
                      key={task.task_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 16px',
                        backgroundColor: THEME.bg.card,
                        borderRadius: RADIUS.md,
                        border: `1px solid ${THEME.bg.border}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          color: THEME.text.secondary,
                          fontFamily: THEME.font.sans,
                          lineHeight: '1.4',
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis' as const,
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        {task.description}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: THEME.status.selfInitiated,
                          fontFamily: THEME.font.mono,
                          flexShrink: 0,
                        }}
                      >
                        {getCountdown(task.fires_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Compact Action Card Sub-Component ──────────────────────────────────────

const CompactActionCard: React.FC<{
  icon: string;
  label: string;
  summary: string;
  color: string;
  index: number;
  isActive: boolean;
  onClick: () => void;
}> = React.memo(({ icon, label, summary, color, index, isActive, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        backgroundColor: hovered
          ? `rgba(${hexToRgbValues(color)}, 0.12)`
          : `rgba(${hexToRgbValues(color)}, 0.06)`,
        border: `1px solid rgba(${hexToRgbValues(color)}, 0.15)`,
        borderRadius: RADIUS.sm,
        cursor: 'pointer',
        transition: `background-color ${ANIMATION.fast} ${ANIMATION.easeOut}`,
        ...(isActive
          ? {
              animation: `slideInFromBelow 0.3s ${ANIMATION.easeOut} both`,
              animationDelay: `${index * 80}ms`,
            }
          : {}),
      }}
    >
      <span style={{
        fontSize: 10,
        fontWeight: 800,
        color: color,
        backgroundColor: `rgba(${hexToRgbValues(color)}, 0.12)`,
        padding: '2px 5px',
        borderRadius: '4px',
        flexShrink: 0,
        fontFamily: THEME.font.mono,
        letterSpacing: '0.02em',
        lineHeight: '1.2',
      }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 1 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: THEME.text.accent,
            fontFamily: THEME.font.sans,
            lineHeight: '1.2',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: THEME.text.muted,
            fontFamily: THEME.font.sans,
            lineHeight: '1.2',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {summary}
        </span>
      </div>
    </div>
  );
});

CompactActionCard.displayName = 'CompactActionCard';

// ─── Helper: hex to RGB values ──────────────────────────────────────────────

function hexToRgbValues(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '107,114,128';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

// ─── Container Styles ───────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  maxWidth: 900,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '12px 0',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const headerLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const feedStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0 0 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const emptyStateStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '60px 20px',
};

const cardBaseStyle: React.CSSProperties = {
  backgroundColor: THEME.bg.card,
  borderRadius: RADIUS.lg,
  boxShadow: SHADOW.sm,
  border: `1px solid ${THEME.bg.border}`,
  overflow: 'hidden',
};

// ─── Backward Compatibility Export ──────────────────────────────────────────

export const AIPanel = Stage;
