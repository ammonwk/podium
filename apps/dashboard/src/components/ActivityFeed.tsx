import React, { useEffect, useRef, useState } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION } from '../styles/theme';
import type { ActivityItem } from '../hooks/useSSE';

interface Props {
  activities: ActivityItem[];
  onActivityClick: (activity: ActivityItem) => void;
}

export const ActivityFeed: React.FC<Props> = ({ activities, onActivityClick }) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest (top)
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [activities.length]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>Activity</div>
        {activities.length > 0 && (
          <div style={styles.headerCount}>{activities.length}</div>
        )}
      </div>

      {/* Feed */}
      <div style={styles.feed} ref={listRef}>
        {activities.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyText}>No activity yet</div>
          </div>
        )}

        {activities.map((activity, index) => (
          <FeedItem
            key={activity.id}
            activity={activity}
            index={index}
            onClick={() => onActivityClick(activity)}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Feed Item ───────────────────────────────────────────────────────────────

const FeedItem: React.FC<{
  activity: ActivityItem;
  index: number;
  onClick: () => void;
}> = ({ activity, index, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.feedItem,
        backgroundColor: hovered ? THEME.bg.cardHover : 'transparent',
        animation: index < 5 ? `slideInFromAbove ${ANIMATION.normal} ${ANIMATION.easeOut} both` : undefined,
        animationDelay: index < 5 ? `${index * 30}ms` : undefined,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {renderActivity(activity)}
    </div>
  );
};

function renderActivity(activity: ActivityItem): React.ReactNode {
  switch (activity.type) {
    case 'sms_in':
      return <SmsInActivity data={activity.data} />;
    case 'sms_out':
      return <SmsOutActivity data={activity.data} />;
    case 'price_change':
      return <PriceChangeActivity data={activity.data} />;
    case 'work_order':
      return <WorkOrderActivity data={activity.data} />;
    case 'schedule_change':
      return <ScheduleChangeActivity data={activity.data} />;
    case 'scheduled_task':
      return <ScheduledTaskActivity data={activity.data} />;
    case 'decision':
      return <DecisionActivity data={activity.data} />;
    default:
      return <div style={{ fontSize: '12px', color: THEME.text.muted }}>Unknown activity</div>;
  }
}

// ─── Activity Renderers ──────────────────────────────────────────────────────

const SmsInActivity: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const name = (data.name as string) || 'Guest';
  const body = (data.body as string) || '';
  const truncated = body.length > 100 ? body.substring(0, 100) + '...' : body;

  return (
    <div style={styles.smsContainer}>
      <div style={styles.smsInLabel}>{name}</div>
      <div style={styles.smsInBubble}>
        {truncated}
      </div>
    </div>
  );
};

const SmsOutActivity: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const recipientName = (data.recipient_name as string) || '';
  const body = (data.body as string) || (data.message_preview as string) || '';
  const truncated = body.length > 100 ? body.substring(0, 100) + '...' : body;

  return (
    <div style={styles.smsContainer}>
      <div style={styles.smsOutLabel}>Agent → {recipientName}</div>
      <div style={styles.smsOutBubble}>
        {truncated}
      </div>
    </div>
  );
};

const PriceChangeActivity: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const propertyId = (data.property_id as string) || '';
  const propertyName = (data.property_name as string) || propertyId;
  const prevPrice = (data.previous_price as number) || 0;
  const newPrice = (data.new_price as number) || 0;
  const percentChange = (data.percent_change as string) || '';
  const isIncrease = newPrice > prevPrice;

  return (
    <div style={styles.accentRow}>
      <div style={{ ...styles.accentBar, backgroundColor: '#22c55e' }} />
      <div style={styles.accentContent}>
        <div style={styles.activityPrimary}>
          {propertyName}
        </div>
        <div style={styles.activitySecondary}>
          <span style={{ fontFamily: THEME.font.mono }}>${prevPrice} → ${newPrice}</span>
          {' '}
          <span style={{ color: isIncrease ? THEME.status.normal : THEME.status.emergency, fontWeight: 600 }}>
            {isIncrease ? '▲' : '▼'}{percentChange}
          </span>
        </div>
      </div>
    </div>
  );
};

const WorkOrderActivity: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const propertyName = (data.property_name as string) || (data.property_id as string) || '';
  const vendorName = (data.vendor_name as string) || '';
  const cost = (data.estimated_cost as number) || 0;
  const severity = (data.severity as string) || 'medium';

  const severityColors: Record<string, string> = {
    emergency: THEME.status.emergency,
    high: '#f97316',
    medium: '#eab308',
    low: '#9ca3af',
  };

  return (
    <div style={styles.accentRow}>
      <div style={{ ...styles.accentBar, backgroundColor: '#f59e0b' }} />
      <div style={styles.accentContent}>
        <div style={styles.activityPrimary}>
          {propertyName}: {vendorName}
        </div>
        <div style={styles.activitySecondary}>
          ${cost.toLocaleString()}
          {' · '}
          <span style={{ color: severityColors[severity] || '#9ca3af', fontWeight: 600 }}>
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

const ScheduleChangeActivity: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const propertyName = (data.property_name as string) || (data.property_id as string) || '';
  const eventType = (data.event_type as string) || '';
  const oldTime = (data.old_time as string) || (data.original_time as string) || '';
  const newTime = (data.new_time as string) || '';

  return (
    <div style={styles.accentRow}>
      <div style={{ ...styles.accentBar, backgroundColor: '#8b5cf6' }} />
      <div style={styles.accentContent}>
        <div style={styles.activityPrimary}>
          {propertyName} {eventType}
        </div>
        <div style={styles.activitySecondary}>
          <span style={{ fontFamily: THEME.font.mono }}>{oldTime} → {newTime}</span>
        </div>
      </div>
    </div>
  );
};

const ScheduledTaskActivity: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const description = (data.description as string) || (data.task_description as string) || '';
  const firesIn = (data.fires_in as string) || '';

  return (
    <div style={styles.accentRow}>
      <div style={{ ...styles.accentBar, backgroundColor: '#14b8a6' }} />
      <div style={styles.accentContent}>
        <div style={{ ...styles.activityPrimary, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>⏱</span> {description}
        </div>
        {firesIn && (
          <div style={{ fontSize: '11px', color: '#14b8a6', fontFamily: THEME.font.mono }}>
            in {firesIn}
          </div>
        )}
      </div>
    </div>
  );
};

const DecisionActivity: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const category = (data.category as string) || '';
  const summary = (data.summary as string) || '';
  const truncated = summary.length > 80 ? summary.substring(0, 80) + '...' : summary;

  return (
    <div style={styles.accentRow}>
      <div style={{ ...styles.accentBar, backgroundColor: '#6b7280' }} />
      <div style={styles.accentContent}>
        <div style={{ ...styles.activityPrimary, fontSize: '11px', color: THEME.text.muted, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          Decision · {category}
        </div>
        <div style={styles.activitySecondary}>
          {truncated}
        </div>
      </div>
    </div>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '320px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: THEME.bg.card,
    borderLeft: `1px solid ${THEME.bg.border}`,
    borderRadius: `0 ${RADIUS.lg} ${RADIUS.lg} 0`,
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
    backgroundColor: THEME.bg.cardHover,
    padding: '1px 7px',
    borderRadius: '10px',
  },
  feed: {
    flex: 1,
    overflowY: 'auto',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  emptyText: {
    fontSize: '13px',
    color: THEME.text.muted,
    opacity: 0.6,
  },
  feedItem: {
    padding: '10px 14px',
    borderBottom: `1px solid ${THEME.bg.border}`,
    cursor: 'pointer',
    transition: `background-color ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },

  // SMS styles
  smsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  smsInLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: THEME.text.muted,
  },
  smsInBubble: {
    backgroundColor: THEME.bg.cardHover,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: '10px 10px 10px 2px',
    padding: '7px 10px',
    fontSize: '13px',
    color: THEME.text.primary,
    lineHeight: '1.4',
    maxWidth: '90%',
  },
  smsOutLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#3b82f6',
    textAlign: 'right' as const,
  },
  smsOutBubble: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.15)',
    borderRadius: '10px 10px 2px 10px',
    padding: '7px 10px',
    fontSize: '13px',
    color: THEME.text.primary,
    lineHeight: '1.4',
    maxWidth: '90%',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
  },

  // Accent row styles
  accentRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'stretch',
  },
  accentBar: {
    width: '3px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  accentContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  activityPrimary: {
    fontSize: '13px',
    fontWeight: 500,
    color: THEME.text.primary,
    lineHeight: '1.3',
  },
  activitySecondary: {
    fontSize: '12px',
    color: THEME.text.secondary,
    lineHeight: '1.3',
  },
};
