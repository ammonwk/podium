import React, { useEffect, useRef, useState } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION } from '../styles/theme';
import type { EventState, TaskState } from '../hooks/useSSE';

interface Props {
  events: EventState[];
  activeEventIndex: number;
  upcomingTasks: TaskState[];
  onSelectEvent: (index: number) => void;
}

const SOURCE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  human: { label: 'INBOUND', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
  system: { label: 'SYSTEM', bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af' },
  'self-scheduled': { label: 'SELF-INITIATED', bg: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6' },
};

export const EventTimeline: React.FC<Props> = ({
  events,
  activeEventIndex,
  upcomingTasks,
  onSelectEvent,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active event
  useEffect(() => {
    if (listRef.current && activeEventIndex >= 0) {
      const el = listRef.current.querySelector(`[data-event-index="${activeEventIndex}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeEventIndex]);

  const pendingTasks = upcomingTasks.filter(t => t.status === 'pending');

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>Events</div>
        {events.length > 0 && (
          <div style={styles.headerCount}>{events.filter(e => e.status === 'done').length}/{events.length}</div>
        )}
      </div>

      {/* Event list */}
      <div style={styles.eventList} ref={listRef}>
        {events.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>○</div>
            <div style={styles.emptyText}>No events yet</div>
            <div style={styles.emptyHint}>Run the demo to begin</div>
          </div>
        )}

        {events.map((event, index) => (
          <EventItem
            key={`${event.name}-${index}`}
            event={event}
            index={index}
            isActive={index === activeEventIndex}
            onClick={() => onSelectEvent(index)}
          />
        ))}
      </div>

      {/* Upcoming tasks */}
      {pendingTasks.length > 0 && (
        <div style={styles.upcomingSection}>
          <div style={styles.upcomingHeader}>
            <div style={styles.upcomingDivider} />
            <span style={styles.upcomingLabel}>Upcoming</span>
            <div style={styles.upcomingDivider} />
          </div>
          {pendingTasks.map(task => (
            <UpcomingTask key={task.task_id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Event Item ──────────────────────────────────────────────────────────────

const EventItem: React.FC<{
  event: EventState;
  index: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ event, index, isActive, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const badge = SOURCE_BADGES[event.source] || SOURCE_BADGES.system;

  const statusIcon = event.status === 'done'
    ? { text: '●', color: THEME.status.normal, animation: undefined }
    : event.status === 'active'
    ? { text: '◉', color: '#3b82f6', animation: 'activePulseRing 1.5s ease-in-out infinite' }
    : event.status === 'queued'
    ? { text: '⏳', color: THEME.text.muted, animation: undefined }
    : { text: '○', color: THEME.text.muted, animation: undefined };

  return (
    <div
      data-event-index={index}
      style={{
        ...styles.eventItem,
        backgroundColor: isActive
          ? 'rgba(59, 130, 246, 0.06)'
          : hovered
          ? THEME.bg.cardHover
          : 'transparent',
        borderLeftColor: isActive ? '#3b82f6' : 'transparent',
        animation: `slideInFromLeft ${ANIMATION.normal} ${ANIMATION.easeOut} both`,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.eventItemRow}>
        <span
          style={{
            ...styles.statusIcon,
            color: statusIcon.color,
            animation: statusIcon.animation,
          }}
        >
          {statusIcon.text}
        </span>
        <div style={styles.eventItemContent}>
          <div
            style={{
              ...styles.eventName,
              fontWeight: isActive || event.status === 'active' ? 600 : 400,
              color: event.status === 'done'
                ? THEME.text.secondary
                : THEME.text.primary,
            }}
          >
            {event.name}
          </div>
          <span
            style={{
              ...styles.sourceBadge,
              backgroundColor: badge.bg,
              color: badge.color,
              ...(event.source === 'self-scheduled'
                ? {
                    boxShadow: `0 0 8px rgba(20, 184, 166, 0.2)`,
                    fontWeight: 700,
                  }
                : {}),
            }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Expanded thinking preview for active events */}
      {event.status === 'active' && event.thinkingText && (
        <div style={styles.thinkingPreview}>
          {event.thinkingText.substring(0, 100)}
          {event.thinkingText.length > 100 ? '...' : ''}
        </div>
      )}

      {/* Tool call count for completed events */}
      {event.status === 'done' && event.toolCalls.length > 0 && (
        <div style={styles.toolCount}>
          {event.toolCalls.length} tool{event.toolCalls.length !== 1 ? 's' : ''} used
        </div>
      )}
    </div>
  );
};

// ─── Upcoming Task ───────────────────────────────────────────────────────────

const UpcomingTask: React.FC<{ task: TaskState }> = ({ task }) => {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const fires = new Date(task.fires_at).getTime();
      const diff = Math.max(0, Math.floor((fires - now) / 1000));
      if (diff <= 0) {
        setCountdown('firing now');
      } else if (diff < 60) {
        setCountdown(`${diff}s`);
      } else {
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        setCountdown(`${mins}m ${secs}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [task.fires_at]);

  const isFiring = countdown === 'firing now';

  return (
    <div
      style={{
        ...styles.upcomingTask,
        ...(isFiring ? { animation: 'moveToTimeline 0.6s ease-in-out forwards' } : {}),
      }}
    >
      <span style={styles.taskClock}>⏱</span>
      <div style={styles.taskContent}>
        <div style={styles.taskDescription}>{task.description}</div>
        <div
          style={{
            ...styles.taskCountdown,
            color: isFiring ? THEME.status.selfInitiated : THEME.text.muted,
          }}
        >
          {isFiring ? 'Firing now...' : `fires in ${countdown}`}
        </div>
      </div>
    </div>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '280px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: THEME.bg.card,
    borderRight: `1px solid ${THEME.bg.border}`,
    borderRadius: `${RADIUS.lg} 0 0 ${RADIUS.lg}`,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: `1px solid ${THEME.bg.border}`,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: THEME.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  headerCount: {
    fontSize: '12px',
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
  },
  eventList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: '8px',
  },
  emptyIcon: {
    fontSize: '24px',
    color: THEME.text.muted,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '14px',
    color: THEME.text.muted,
    fontWeight: 500,
  },
  emptyHint: {
    fontSize: '12px',
    color: THEME.text.muted,
    opacity: 0.6,
  },
  eventItem: {
    padding: '10px 16px',
    borderLeft: '3px solid transparent',
    cursor: 'pointer',
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  eventItemRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  statusIcon: {
    fontSize: '14px',
    lineHeight: '1.4',
    flexShrink: 0,
    marginTop: '1px',
  },
  eventItemContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  eventName: {
    fontSize: '14px',
    lineHeight: '1.3',
    color: THEME.text.primary,
    wordBreak: 'break-word' as const,
  },
  sourceBadge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    fontSize: '9px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '3px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  thinkingPreview: {
    fontSize: '12px',
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
    lineHeight: '1.4',
    marginLeft: '24px',
    borderLeft: `2px solid ${THEME.bg.borderLight}`,
    paddingLeft: '8px',
    opacity: 0.8,
  },
  toolCount: {
    fontSize: '11px',
    color: THEME.text.muted,
    marginLeft: '24px',
  },

  // Upcoming section
  upcomingSection: {
    borderTop: `1px solid ${THEME.bg.border}`,
    padding: '8px 0',
    flexShrink: 0,
  },
  upcomingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 16px 8px',
  },
  upcomingDivider: {
    flex: 1,
    height: '1px',
    backgroundColor: THEME.bg.border,
  },
  upcomingLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: THEME.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap' as const,
  },
  upcomingTask: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 16px',
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },
  taskClock: {
    fontSize: '14px',
    flexShrink: 0,
    marginTop: '1px',
  },
  taskContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  taskDescription: {
    fontSize: '13px',
    color: THEME.text.secondary,
    lineHeight: '1.3',
  },
  taskCountdown: {
    fontSize: '11px',
    fontFamily: THEME.font.mono,
    fontWeight: 500,
  },
};
