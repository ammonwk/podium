import React, { useEffect, useRef, useState, useMemo } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION, SHADOW } from '../styles/theme';
import { ToolCard } from './ToolCard';
import type { EventState, ToolCallData, TaskState } from '../hooks/useSSE';

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
@keyframes toolCardSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pillPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes waitingPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
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

// ─── Source Badge Config ────────────────────────────────────────────────────

const SOURCE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  human: { label: 'Inbound SMS', bg: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' },
  system: { label: 'System', bg: 'rgba(107, 114, 128, 0.1)', color: THEME.text.secondary },
  'self-scheduled': { label: 'Self-Initiated', bg: 'rgba(13, 148, 136, 0.1)', color: THEME.status.selfInitiated },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getElapsedSeconds(startedAt?: string, completedAt?: string): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  return Math.round((end - start) / 1000);
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

// ─── Component ──────────────────────────────────────────────────────────────

export const AIPanel: React.FC<Props> = ({
  events,
  activeEventIndex,
  isProcessing,
  upcomingTasks,
  onToolCardClick,
  onEventClick,
  onSelectEvent,
}) => {
  const activeEvent = activeEventIndex >= 0 ? events[activeEventIndex] : null;

  const reasoningRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [reasoningAutoScroll, setReasoningAutoScroll] = useState(true);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  // Reset reasoning collapsed state when active event changes
  const prevEventNameRef = useRef<string | null>(null);
  useEffect(() => {
    const name = activeEvent?.name ?? null;
    if (name !== prevEventNameRef.current) {
      prevEventNameRef.current = name;
      setReasoningExpanded(false);
      setReasoningAutoScroll(true);
    }
  }, [activeEvent?.name]);

  // Inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Auto-scroll reasoning area when expanded and streaming
  useEffect(() => {
    if (reasoningAutoScroll && reasoningExpanded && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [activeEvent?.thinkingText, reasoningAutoScroll, reasoningExpanded]);

  // Auto-scroll to latest tool card
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [activeEvent?.toolCalls.length]);

  // Handle manual scroll in reasoning area
  const handleReasoningScroll = () => {
    if (reasoningRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = reasoningRef.current;
      setReasoningAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    }
  };

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

  return (
    <div style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.headerTitleRow}>
            <span
              style={{
                ...styles.breathingDot,
                backgroundColor: isProcessing ? THEME.accent.violet : THEME.text.muted,
                ...(isProcessing
                  ? { animation: 'breathe 2s ease-in-out infinite' }
                  : {}),
              }}
            />
            <span style={styles.headerTitle}>AI Assistant</span>
          </div>
          <span style={styles.eventCountBadge}>{eventCountLabel}</span>
        </div>

        {/* ── Event Pills ──────────────────────────────────────────────── */}
        {events.length > 0 && (
          <div style={styles.pillsScroller}>
            <div style={styles.pillsRow}>
              {events.map((ev, idx) => {
                const isActive = idx === activeEventIndex;
                const isDone = ev.status === 'done';
                const isQueued = ev.status === 'queued';
                const isSelf = ev.source === 'self-scheduled';

                let pillBg: string;
                let pillBorder: string;
                let dotColor: string;
                let textColor: string;
                let fontWeight: number;
                let dotAnimation: string | undefined;

                if (isDone) {
                  pillBg = isSelf ? 'rgba(13, 148, 136, 0.08)' : 'rgba(5, 150, 105, 0.08)';
                  pillBorder = 'transparent';
                  dotColor = isSelf ? THEME.status.selfInitiated : THEME.status.normal;
                  textColor = THEME.text.secondary;
                  fontWeight = 500;
                } else if (isActive) {
                  pillBg = isSelf ? 'rgba(13, 148, 136, 0.1)' : 'rgba(124, 58, 237, 0.1)';
                  pillBorder = 'transparent';
                  dotColor = isSelf ? THEME.status.selfInitiated : THEME.accent.violet;
                  textColor = THEME.text.accent;
                  fontWeight = 700;
                  dotAnimation = 'pillPulse 1.5s ease-in-out infinite';
                } else {
                  // queued
                  pillBg = 'transparent';
                  pillBorder = THEME.bg.border;
                  dotColor = THEME.text.muted;
                  textColor = THEME.text.muted;
                  fontWeight = 500;
                }

                return (
                  <button
                    key={`${ev.name}-${idx}`}
                    onClick={() => onSelectEvent(idx)}
                    style={{
                      ...styles.pill,
                      backgroundColor: pillBg,
                      border: `1px solid ${pillBorder}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        ...styles.pillDot,
                        backgroundColor: isQueued ? 'transparent' : dotColor,
                        border: isQueued ? `2px solid ${dotColor}` : 'none',
                        ...(dotAnimation ? { animation: dotAnimation } : {}),
                      }}
                    />
                    <span
                      style={{
                        ...styles.pillText,
                        color: textColor,
                        fontWeight,
                      }}
                    >
                      {ev.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Content Area ───────────────────────────────────────────────── */}
      <div ref={contentRef} style={styles.content}>
        {!activeEvent ? (
          /* ── Empty State ─────────────────────────────────────────────── */
          <div style={styles.emptyState}>
            <div style={styles.emptyEmoji}>&#127968;</div>
            <div style={styles.emptyTitle}>Your AI assistant is ready</div>
            <div style={styles.emptySubtitle}>
              Run the demo to see it in action
            </div>
          </div>
        ) : (
          <>
            {/* ── Event Header ──────────────────────────────────────────── */}
            <div
              style={styles.eventHeader}
              onClick={() => onEventClick(activeEvent)}
            >
              <span style={styles.eventName}>{activeEvent.name}</span>
              {(() => {
                const badge =
                  SOURCE_BADGES[activeEvent.source] || SOURCE_BADGES.system;
                return (
                  <span
                    style={{
                      ...styles.sourceBadge,
                      backgroundColor: badge.bg,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                );
              })()}
            </div>

            {/* ── Thinking / Reasoning Section ──────────────────────────── */}
            {activeEvent.thinkingText && (
              <div style={styles.reasoningSection}>
                <button
                  style={styles.reasoningToggle}
                  onClick={() => setReasoningExpanded(prev => !prev)}
                >
                  <span style={styles.reasoningChevron}>
                    {reasoningExpanded ? '\u25BE' : '\u25B8'}
                  </span>
                  <span style={styles.reasoningLabel}>Reasoning</span>
                </button>
                {reasoningExpanded && (
                  <div
                    ref={reasoningRef}
                    style={styles.reasoningContent}
                    onScroll={handleReasoningScroll}
                  >
                    <span style={styles.reasoningText}>
                      {activeEvent.thinkingText}
                    </span>
                    {activeEvent.status === 'active' && isProcessing && (
                      <span style={styles.cursor} />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Tool Cards ────────────────────────────────────────────── */}
            {activeEvent.toolCalls.length > 0 && (
              <div ref={toolsRef} style={styles.toolCards}>
                {activeEvent.toolCalls.map((tc, i) => (
                  <ToolCard
                    key={tc.id}
                    toolCall={tc}
                    index={i}
                    onClick={() => onToolCardClick(tc)}
                  />
                ))}
              </div>
            )}

            {/* ── Waiting State (active, no content yet) ────────────────── */}
            {activeEvent.status === 'active' &&
              !activeEvent.thinkingText &&
              activeEvent.toolCalls.length === 0 && (
                <div style={styles.waitingState}>
                  <div style={styles.waitingDots}>
                    <span
                      style={{
                        ...styles.waitingDot,
                        animation: 'waitingPulse 1s ease-in-out infinite',
                        animationDelay: '0ms',
                      }}
                    />
                    <span
                      style={{
                        ...styles.waitingDot,
                        animation: 'waitingPulse 1s ease-in-out infinite',
                        animationDelay: '200ms',
                      }}
                    />
                    <span
                      style={{
                        ...styles.waitingDot,
                        animation: 'waitingPulse 1s ease-in-out infinite',
                        animationDelay: '400ms',
                      }}
                    />
                  </div>
                  <div style={styles.waitingText}>Thinking...</div>
                </div>
              )}

            {/* ── Done Footer ───────────────────────────────────────────── */}
            {activeEvent.status === 'done' && (
              <div style={styles.doneFooter}>
                <span style={styles.doneCheck}>&#10003;</span>
                Handled in {getElapsedSeconds(activeEvent.startedAt, activeEvent.completedAt)}s
                {' \u00B7 '}
                {activeEvent.toolCalls.length} action
                {activeEvent.toolCalls.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Upcoming Tasks ───────────────────────────────────────────── */}
      {pendingTasks.length > 0 && (
        <div style={styles.upcomingSection}>
          <div style={styles.upcomingDivider}>
            <div style={styles.upcomingDividerLine} />
            <span style={styles.upcomingDividerLabel}>Upcoming</span>
            <div style={styles.upcomingDividerLine} />
          </div>
          <div style={styles.upcomingList}>
            {pendingTasks.map(task => (
              <div key={task.task_id} style={styles.upcomingTask}>
                <span style={styles.upcomingTaskDesc}>
                  {task.description}
                </span>
                <span style={styles.upcomingTaskCountdown}>
                  {getCountdown(task.fires_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Keep backward-compat export
export const Stage = AIPanel;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  // Container
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: THEME.bg.card,
    borderRadius: RADIUS.lg,
    boxShadow: SHADOW.lg,
    overflow: 'hidden',
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexShrink: 0,
    borderBottom: `1px solid ${THEME.bg.border}`,
    padding: '16px 20px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  breathingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.sans,
    letterSpacing: '-0.01em',
  },
  eventCountBadge: {
    fontSize: '13px',
    fontWeight: 600,
    color: THEME.text.secondary,
    backgroundColor: THEME.bg.primary,
    padding: '4px 12px',
    borderRadius: RADIUS.full,
    whiteSpace: 'nowrap' as const,
  },

  // ── Event Pills ───────────────────────────────────────────────────────────
  pillsScroller: {
    overflowX: 'auto',
    overflowY: 'hidden',
    marginLeft: '-20px',
    marginRight: '-20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingBottom: '12px',
    scrollbarWidth: 'none' as const,
  },
  pillsRow: {
    display: 'flex',
    gap: '8px',
    whiteSpace: 'nowrap' as const,
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: RADIUS.full,
    fontSize: '13px',
    fontFamily: THEME.font.sans,
    lineHeight: '1',
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    outline: 'none',
    flexShrink: 0,
  },
  pillDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
    boxSizing: 'border-box' as const,
  },
  pillText: {
    fontSize: '13px',
    fontFamily: THEME.font.sans,
    whiteSpace: 'nowrap' as const,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    minHeight: 0,
  },

  // ── Empty State ───────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '40px 20px',
  },
  emptyEmoji: {
    fontSize: '48px',
    lineHeight: '1',
    marginBottom: '8px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: THEME.text.primary,
    fontFamily: THEME.font.sans,
  },
  emptySubtitle: {
    fontSize: '15px',
    color: THEME.text.muted,
    fontFamily: THEME.font.sans,
  },

  // ── Event Header ──────────────────────────────────────────────────────────
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    cursor: 'pointer',
    flexShrink: 0,
    transition: `background-color ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  eventName: {
    fontSize: '20px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.sans,
    letterSpacing: '-0.01em',
  },
  sourceBadge: {
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: RADIUS.full,
    fontFamily: THEME.font.sans,
    whiteSpace: 'nowrap' as const,
  },

  // ── Reasoning ─────────────────────────────────────────────────────────────
  reasoningSection: {
    flexShrink: 0,
    padding: '0 20px',
    marginBottom: '4px',
  },
  reasoningToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    padding: '6px 0',
    cursor: 'pointer',
    fontFamily: THEME.font.sans,
    outline: 'none',
  },
  reasoningChevron: {
    fontSize: '12px',
    color: THEME.text.muted,
    width: '14px',
    textAlign: 'center' as const,
  },
  reasoningLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: THEME.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  reasoningContent: {
    maxHeight: '200px',
    overflow: 'auto',
    borderLeft: `2px solid ${THEME.accent.violet}`,
    paddingLeft: '14px',
    paddingTop: '4px',
    paddingBottom: '8px',
    marginLeft: '6px',
    marginTop: '4px',
  },
  reasoningText: {
    fontFamily: THEME.font.sans,
    fontSize: '14px',
    lineHeight: '1.65',
    color: THEME.text.secondary,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  cursor: {
    display: 'inline-block',
    width: '2px',
    height: '16px',
    backgroundColor: THEME.accent.violet,
    marginLeft: '2px',
    verticalAlign: 'text-bottom',
    animation: 'cursorBlink 1s step-end infinite',
  },

  // ── Tool Cards ────────────────────────────────────────────────────────────
  toolCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px 20px 20px',
  },

  // ── Waiting State ─────────────────────────────────────────────────────────
  waitingState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px 20px',
  },
  waitingDots: {
    display: 'flex',
    gap: '6px',
  },
  waitingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: THEME.accent.violet,
  },
  waitingText: {
    fontSize: '15px',
    color: THEME.text.muted,
    fontWeight: 500,
    fontFamily: THEME.font.sans,
  },

  // ── Done Footer ───────────────────────────────────────────────────────────
  doneFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    margin: '8px 20px 16px',
    padding: '10px 16px',
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    color: THEME.status.normal,
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: THEME.font.sans,
    flexShrink: 0,
  },
  doneCheck: {
    fontSize: '14px',
    fontWeight: 700,
  },

  // ── Upcoming Tasks ────────────────────────────────────────────────────────
  upcomingSection: {
    flexShrink: 0,
    borderTop: `1px solid ${THEME.bg.border}`,
    padding: '12px 20px 16px',
  },
  upcomingDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px',
  },
  upcomingDividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: THEME.bg.border,
  },
  upcomingDividerLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: THEME.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontFamily: THEME.font.sans,
  },
  upcomingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  upcomingTask: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  upcomingTaskDesc: {
    fontSize: '14px',
    color: THEME.text.secondary,
    fontFamily: THEME.font.sans,
    lineHeight: '1.4',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  upcomingTaskCountdown: {
    fontSize: '13px',
    fontWeight: 700,
    color: THEME.status.selfInitiated,
    fontFamily: THEME.font.mono,
    flexShrink: 0,
  },
};
