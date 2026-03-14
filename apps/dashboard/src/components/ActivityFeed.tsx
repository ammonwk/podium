import React, { useEffect, useRef, useState } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION, SHADOW } from '../styles/theme';
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
        <div style={styles.headerTitle}>Activity Log</div>
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
      return <div style={{ fontSize: '14px', color: THEME.text.muted }}>Unknown activity</div>;
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
      <div style={{ ...styles.accentBar, backgroundColor: THEME.status.normal }} />
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
    medium: THEME.status.attention,
    low: THEME.text.secondary,
  };

  return (
    <div style={styles.accentRow}>
      <div style={{ ...styles.accentBar, backgroundColor: THEME.status.attention }} />
      <div style={styles.accentContent}>
        <div style={styles.activityPrimary}>
          {propertyName}: {vendorName}
        </div>
        <div style={styles.activitySecondary}>
          ${cost.toLocaleString()}
          {' · '}
          <span style={{ color: severityColors[severity] || THEME.text.secondary, fontWeight: 600 }}>
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
      <div style={{ ...styles.accentBar, backgroundColor: THEME.accent.violet }} />
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
      <div style={{ ...styles.accentBar, backgroundColor: THEME.status.selfInitiated }} />
      <div style={styles.accentContent}>
        <div style={{ ...styles.activityPrimary, display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>⏱</span> {description}
        </div>
        {firesIn && (
          <div style={{ fontSize: '14px', color: THEME.status.selfInitiated, fontFamily: THEME.font.mono }}>
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
      <div style={{ ...styles.accentBar, backgroundColor: THEME.text.muted }} />
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
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: THEME.bg.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    boxShadow: SHADOW.sm,
    border: `1px solid ${THEME.bg.border}`,
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
    fontSize: '14px',
    fontWeight: 700,
    color: THEME.text.primary,
    letterSpacing: '0.01em',
  },
  headerCount: {
    fontSize: '12px',
    color: THEME.accent.violet,
    fontFamily: THEME.font.mono,
    fontWeight: 600,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    padding: '2px 10px',
    borderRadius: RADIUS.full,
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
    fontSize: '15px',
    color: THEME.text.muted,
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
    gap: '5px',
  },
  smsInLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: THEME.text.secondary,
  },
  smsInBubble: {
    backgroundColor: THEME.bg.cardHover,
    borderRadius: `${RADIUS.md} ${RADIUS.md} ${RADIUS.md} 2px`,
    padding: '8px 12px',
    fontSize: '14px',
    color: THEME.text.primary,
    lineHeight: '1.4',
    maxWidth: '90%',
  },
  smsOutLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: THEME.tool.sms,
    textAlign: 'right' as const,
  },
  smsOutBubble: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: `${RADIUS.md} ${RADIUS.md} 2px ${RADIUS.md}`,
    padding: '8px 12px',
    fontSize: '14px',
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
    gap: '3px',
    minWidth: 0,
  },
  activityPrimary: {
    fontSize: '14px',
    fontWeight: 500,
    color: THEME.text.primary,
    lineHeight: '1.3',
  },
  activitySecondary: {
    fontSize: '14px',
    color: THEME.text.secondary,
    lineHeight: '1.3',
  },
};
