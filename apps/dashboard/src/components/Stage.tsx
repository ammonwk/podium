import React, { useEffect, useRef, useState } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION } from '../styles/theme';
import { ToolCard } from './ToolCard';
import type { EventState, ToolCallData } from '../hooks/useSSE';

interface Props {
  events: EventState[];
  activeEventIndex: number;
  isProcessing: boolean;
  onToolCardClick: (toolCall: ToolCallData) => void;
  onEventClick: (event: EventState) => void;
}

const SOURCE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  human: { label: 'INBOUND SMS', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
  system: { label: 'SYSTEM', bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af' },
  'self-scheduled': { label: 'SELF-INITIATED', bg: 'rgba(20, 184, 166, 0.2)', color: '#14b8a6' },
};

export const Stage: React.FC<Props> = ({
  events,
  activeEventIndex,
  isProcessing,
  onToolCardClick,
  onEventClick,
}) => {
  const activeEvent = activeEventIndex >= 0 ? events[activeEventIndex] : null;
  const reasoningRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevEventNameRef = useRef<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Auto-scroll reasoning area
  useEffect(() => {
    if (autoScroll && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [activeEvent?.thinkingText, autoScroll]);

  // Auto-scroll tools area
  useEffect(() => {
    if (toolsRef.current) {
      toolsRef.current.scrollTop = toolsRef.current.scrollHeight;
    }
  }, [activeEvent?.toolCalls.length]);

  // Handle manual scroll
  const handleReasoningScroll = () => {
    if (reasoningRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = reasoningRef.current;
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    }
  };

  // Transition effect on event change
  useEffect(() => {
    if (activeEvent && activeEvent.name !== prevEventNameRef.current) {
      if (prevEventNameRef.current !== null) {
        setTransitioning(true);
        const t = setTimeout(() => {
          setTransitioning(false);
          prevEventNameRef.current = activeEvent.name;
        }, 350);
        return () => clearTimeout(t);
      }
      prevEventNameRef.current = activeEvent.name;
    }
  }, [activeEvent?.name]);

  // Empty state
  if (!activeEvent) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyLogo}>◈</div>
          <div style={styles.emptyTitle}>Mission Control</div>
          <div style={styles.emptySubtitle}>Agentic Property Manager</div>
          <div style={styles.emptyHint}>Run the demo to see the agent in action</div>
        </div>
      </div>
    );
  }

  const badge = SOURCE_BADGES[activeEvent.source] || SOURCE_BADGES.system;
  const isDone = activeEvent.status === 'done';

  return (
    <div
      style={{
        ...styles.container,
        opacity: transitioning ? 0 : 1,
        transition: `opacity ${ANIMATION.slow} ${ANIMATION.easeInOut}`,
      }}
    >
      {/* Header */}
      <div style={styles.header} onClick={() => onEventClick(activeEvent)}>
        <div style={styles.headerLeft}>
          <div style={styles.eventName}>{activeEvent.name}</div>
          <span
            style={{
              ...styles.sourceBadge,
              backgroundColor: badge.bg,
              color: badge.color,
              ...(activeEvent.source === 'self-scheduled'
                ? { boxShadow: '0 0 10px rgba(20, 184, 166, 0.2)' }
                : {}),
            }}
          >
            {badge.label}
          </span>
        </div>
        {isDone && (
          <div style={styles.doneIndicator}>
            <span style={styles.doneCheck}>✓</span> Complete
          </div>
        )}
        {isProcessing && activeEvent.status === 'active' && (
          <div style={styles.processingIndicator}>
            <span style={styles.processingDot} />
            Processing
          </div>
        )}
      </div>

      {/* Content area - scrollable */}
      <div style={styles.content}>
        {/* Reasoning area */}
        {activeEvent.thinkingText && (
          <div style={styles.reasoningWrapper}>
            <div
              ref={reasoningRef}
              style={{
                ...styles.reasoningArea,
                opacity: isDone ? 0.7 : 1,
              }}
              onScroll={handleReasoningScroll}
            >
              <ReasoningText
                text={activeEvent.thinkingText}
                isActive={activeEvent.status === 'active' && isProcessing}
              />
            </div>
          </div>
        )}

        {/* Tool cards */}
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

        {/* Active but no content yet */}
        {activeEvent.status === 'active' && !activeEvent.thinkingText && activeEvent.toolCalls.length === 0 && (
          <div style={styles.waitingState}>
            <div style={styles.waitingDots}>
              <span style={{ ...styles.waitingDot, animationDelay: '0ms' }}>·</span>
              <span style={{ ...styles.waitingDot, animationDelay: '200ms' }}>·</span>
              <span style={{ ...styles.waitingDot, animationDelay: '400ms' }}>·</span>
            </div>
            <div style={styles.waitingText}>Agent is thinking...</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Reasoning Text with Cursor ──────────────────────────────────────────────

const ReasoningText: React.FC<{ text: string; isActive: boolean }> = ({ text, isActive }) => {
  return (
    <div style={styles.reasoningText}>
      {text}
      {isActive && <span style={styles.cursor} />}
    </div>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },

  // Empty state
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    opacity: 0.6,
  },
  emptyLogo: {
    fontSize: '48px',
    color: THEME.text.muted,
    marginBottom: '8px',
    animation: 'pulse 3s ease-in-out infinite',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: THEME.text.primary,
    letterSpacing: '-0.02em',
  },
  emptySubtitle: {
    fontSize: '14px',
    color: THEME.text.secondary,
    fontWeight: 500,
  },
  emptyHint: {
    fontSize: '13px',
    color: THEME.text.muted,
    marginTop: '8px',
  },

  // Header
  header: {
    padding: '16px 20px',
    borderBottom: `1px solid ${THEME.bg.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    cursor: 'pointer',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },
  eventName: {
    fontSize: '20px',
    fontWeight: 700,
    color: THEME.text.accent,
    letterSpacing: '-0.01em',
  },
  sourceBadge: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '4px',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap' as const,
  },
  doneIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    color: THEME.status.normal,
    fontWeight: 500,
  },
  doneCheck: {
    fontSize: '14px',
  },
  processingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#3b82f6',
    fontWeight: 500,
  },
  processingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    animation: 'pulseDot 1.2s ease-in-out infinite',
  },

  // Content
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    overflow: 'auto',
    padding: '0',
  },

  // Reasoning
  reasoningWrapper: {
    flexShrink: 0,
    minHeight: '120px',
    maxHeight: '45%',
    display: 'flex',
    flexDirection: 'column',
  },
  reasoningArea: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
    borderLeft: `2px solid ${THEME.bg.borderLight}`,
    marginLeft: '20px',
    marginTop: '12px',
    marginBottom: '8px',
    transition: `opacity ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },
  reasoningText: {
    fontFamily: THEME.font.mono,
    fontSize: '14px',
    lineHeight: '1.65',
    color: THEME.text.primary,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  cursor: {
    display: 'inline-block',
    width: '2px',
    height: '16px',
    backgroundColor: '#3b82f6',
    marginLeft: '2px',
    verticalAlign: 'text-bottom',
    animation: 'cursorBlink 1s step-end infinite',
  },

  // Tool cards
  toolCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 20px 20px',
    overflow: 'auto',
  },

  // Waiting state
  waitingState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  },
  waitingDots: {
    display: 'flex',
    gap: '4px',
  },
  waitingDot: {
    fontSize: '32px',
    color: '#3b82f6',
    animation: 'pulse 1s ease-in-out infinite',
  },
  waitingText: {
    fontSize: '14px',
    color: THEME.text.muted,
    fontWeight: 500,
  },
};
