import React, { useState } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, SHADOW, ANIMATION, SPACING } from '../styles/theme';
import type { PropertyState, ActivityItem } from '../hooks/useSSE';
import { MiniCalendar } from './MiniCalendar';

interface Props {
  property: PropertyState;
  activities: ActivityItem[];
  onBack: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  normal: 'All Good',
  attention: 'Needs Attention',
  emergency: 'Emergency',
};

const STATUS_COLORS: Record<string, string> = {
  normal: THEME.status.normal,
  attention: THEME.status.attention,
  emergency: THEME.status.emergency,
};

const SEGMENT_COLORS: Record<string, string> = {
  checkout: THEME.tool.sms,
  cleaning: THEME.status.attention,
  checkin: THEME.status.normal,
  maintenance: THEME.status.emergency,
};

const SEGMENT_LABELS: Record<string, string> = {
  checkout: 'Checkout',
  cleaning: 'Cleaning',
  checkin: 'Check-in',
  maintenance: 'Maintenance',
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

function activityMatchesProperty(activity: ActivityItem, property: PropertyState): boolean {
  const data = activity.data;
  if ((data.property_name as string) === property.name) return true;
  if ((data.property_id as string) === property.id) return true;
  // Check if the eventName contains a recognizable part of the property name
  const nameLower = property.name.toLowerCase();
  const eventLower = activity.eventName.toLowerCase();
  // Match by keywords from property name (e.g. "Oceanview" in "Late Checkout Request" won't match,
  // but we still try partial matching on individual words)
  const words = nameLower.split(/\s+/);
  for (const word of words) {
    if (word.length > 3 && eventLower.includes(word)) return true;
  }
  return false;
}

function getActivityIcon(type: string): string {
  switch (type) {
    case 'sms_in': return '\u2709';      // envelope
    case 'sms_out': return '\u2709';
    case 'price_change': return '$';
    case 'work_order': return '\u26A0';   // warning
    case 'schedule_change': return '\u23F0'; // clock
    case 'scheduled_task': return '\u23F1'; // stopwatch
    case 'decision': return '\u2714';     // checkmark
    default: return '\u2022';
  }
}

function getActivityAccentColor(type: string): string {
  switch (type) {
    case 'sms_in':
    case 'sms_out':
      return THEME.tool.sms;
    case 'price_change':
      return THEME.tool.pricing;
    case 'work_order':
      return THEME.tool.maintenance;
    case 'schedule_change':
      return THEME.tool.scheduling;
    case 'scheduled_task':
      return THEME.status.selfInitiated;
    case 'decision':
      return THEME.tool.decision;
    default:
      return THEME.text.muted;
  }
}

function getActivitySummary(activity: ActivityItem): string {
  const data = activity.data;
  switch (activity.type) {
    case 'sms_in': {
      const name = (data.name as string) || (data.from as string) || 'Guest';
      const body = (data.body as string) || '';
      return `${name}: ${body}`;
    }
    case 'sms_out': {
      const recipient = (data.recipient_name as string) || '';
      const body = (data.body as string) || (data.message_preview as string) || '';
      return `Agent \u2192 ${recipient}: ${body}`;
    }
    case 'price_change': {
      const prev = (data.previous_price as number) || 0;
      const next = (data.new_price as number) || 0;
      return `$${prev} \u2192 $${next}/night`;
    }
    case 'work_order': {
      const desc = (data.issue_description as string) || (data.vendor_name as string) || 'Work order created';
      return desc;
    }
    case 'schedule_change': {
      const eventType = (data.event_type as string) || 'Schedule';
      const oldTime = (data.old_time as string) || (data.original_time as string) || '';
      const newTime = (data.new_time as string) || '';
      return `${eventType}: ${oldTime} \u2192 ${newTime}`;
    }
    case 'scheduled_task': {
      const desc = (data.description as string) || (data.task_description as string) || '';
      return desc;
    }
    case 'decision': {
      const summary = (data.summary as string) || '';
      return summary;
    }
    default:
      return activity.eventName;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PropertyDetail: React.FC<Props> = ({ property, activities, onBack }) => {
  const statusColor = STATUS_COLORS[property.status] || THEME.status.normal;
  const statusLabel = STATUS_LABELS[property.status] || 'Unknown';

  const priceDelta = property.current_price - property.base_price;
  const priceDeltaPercent = property.base_price > 0
    ? Math.round((priceDelta / property.base_price) * 100)
    : 0;

  // Filter activities for this property
  const relatedActivities = activities.filter(a => activityMatchesProperty(a, property));

  // Find the latest SMS activity for the guest card
  const latestSms = relatedActivities.find(
    a => a.type === 'sms_in' || a.type === 'sms_out'
  );

  // Find the most recent price_change for "last adjusted"
  const latestPriceChange = relatedActivities.find(a => a.type === 'price_change');

  // Parse guest names from guestFlow
  const guestNames = property.guestFlow
    .split(/\u2192|→/)
    .map(s => s.trim())
    .filter(Boolean);

  // Show at most 10 related activities
  const displayActivities = relatedActivities.slice(0, 10);

  return (
    <div style={styles.container}>
      {/* Back button */}
      <BackButton onBack={onBack} />

      {/* Property header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.propertyName}>{property.name}</div>
          <div style={styles.propertyLocation}>{property.location}</div>
        </div>
        <div
          style={{
            ...styles.statusBadge,
            backgroundColor: `${statusColor}15`,
            color: statusColor,
            borderColor: `${statusColor}30`,
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              flexShrink: 0,
            }}
          />
          {statusLabel}
        </div>
      </div>

      {/* Three-column card grid */}
      <div style={styles.cardGrid}>
        {/* Guest Card */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Current Guests</div>
          <div style={styles.guestNames}>
            {guestNames.map((name, i) => (
              <span key={name} style={styles.guestNameItem}>
                {i > 0 && <span style={styles.guestArrow}>{'\u2192'}</span>}
                {name}
              </span>
            ))}
          </div>
          {latestSms ? (
            <div style={styles.chatPreview}>
              {latestSms.type === 'sms_in' ? (
                <div style={styles.chatBubbleIn}>
                  <div style={styles.chatSender}>
                    {(latestSms.data.name as string) || 'Guest'}
                  </div>
                  <div style={styles.chatText}>
                    {truncate((latestSms.data.body as string) || '', 120)}
                  </div>
                </div>
              ) : (
                <div style={styles.chatBubbleOut}>
                  <div style={styles.chatSenderOut}>
                    Agent {'\u2192'} {(latestSms.data.recipient_name as string) || ''}
                  </div>
                  <div style={styles.chatText}>
                    {truncate(
                      (latestSms.data.body as string) ||
                      (latestSms.data.message_preview as string) || '',
                      120
                    )}
                  </div>
                </div>
              )}
              <div style={styles.chatTimestamp}>
                {formatTimestamp(latestSms.timestamp)}
              </div>
            </div>
          ) : (
            <div style={styles.noDataText}>No messages yet</div>
          )}
        </div>

        {/* Pricing Card */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Pricing</div>
          <div style={styles.priceRow}>
            <span style={styles.currentPrice}>
              ${property.current_price}
            </span>
            <span style={styles.priceUnit}>/night</span>
          </div>
          <div style={styles.basePriceRow}>
            <span style={styles.basePriceLabel}>Base: </span>
            <span style={styles.basePriceValue}>${property.base_price}</span>
            {priceDelta !== 0 && (
              <span
                style={{
                  ...styles.priceDeltaBadge,
                  color: priceDelta > 0 ? THEME.status.normal : THEME.status.emergency,
                  backgroundColor: priceDelta > 0
                    ? `${THEME.status.normal}12`
                    : `${THEME.status.emergency}12`,
                }}
              >
                {priceDelta > 0 ? '\u25B2' : '\u25BC'}{' '}
                {priceDelta > 0 ? '+' : ''}{priceDeltaPercent}%
              </span>
            )}
          </div>
          {latestPriceChange ? (
            <div style={styles.lastAdjusted}>
              Last adjusted {formatTimestamp(latestPriceChange.timestamp)}
            </div>
          ) : (
            <div style={styles.lastAdjusted}>No recent adjustments</div>
          )}
        </div>

        {/* Schedule Card */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Today's Schedule</div>
          <div style={styles.scheduleBarContainer}>
            <div style={styles.scheduleBarTrack}>
              {property.schedule.map((seg) => (
                <div
                  key={`${seg.type}-${seg.start}`}
                  style={{
                    position: 'absolute' as const,
                    left: `${seg.start}%`,
                    width: `${seg.end - seg.start}%`,
                    height: '100%',
                    backgroundColor: SEGMENT_COLORS[seg.type] || '#999',
                    borderRadius: '6px',
                    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
                  }}
                />
              ))}
            </div>
          </div>
          <div style={styles.legendRow}>
            {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
              <div key={key} style={styles.legendItem}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: SEGMENT_COLORS[key],
                    flexShrink: 0,
                  }}
                />
                <span style={styles.legendLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar Card */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Monthly Calendar</div>
          <MiniCalendar bookings={property.bookings} />
        </div>
      </div>

      {/* Active Issues */}
      {property.activeIssues.length > 0 && (
        <div style={styles.issuesCard}>
          <div style={styles.issuesHeader}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: THEME.status.emergency,
                flexShrink: 0,
                animation: 'pulseDot 1.5s ease-in-out infinite',
              }}
            />
            <span style={styles.issuesTitle}>Active Issues</span>
          </div>
          <div style={styles.issuesList}>
            {property.activeIssues.map((issue, i) => {
              const borderColor =
                property.status === 'emergency'
                  ? THEME.status.emergency
                  : THEME.status.attention;
              return (
                <div
                  key={`issue-${i}`}
                  style={{
                    ...styles.issueRow,
                    borderLeftColor: borderColor,
                  }}
                >
                  <div style={styles.issueText}>{issue}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Related Activity */}
      <div style={styles.activitySection}>
        <div style={styles.activitySectionHeader}>
          <span style={styles.activitySectionTitle}>Related Activity</span>
          {displayActivities.length > 0 && (
            <span style={styles.activityCount}>{displayActivities.length}</span>
          )}
        </div>

        {displayActivities.length === 0 ? (
          <div style={styles.emptyActivity}>
            No activity for this property yet
          </div>
        ) : (
          <div style={styles.activityList}>
            {displayActivities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const BackButton: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      style={{
        ...styles.backButton,
        color: hovered ? THEME.text.primary : THEME.text.secondary,
      }}
      onClick={onBack}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {'\u2190'} Back to properties
    </button>
  );
};

const ActivityRow: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
  const [hovered, setHovered] = useState(false);
  const accentColor = getActivityAccentColor(activity.type);
  const icon = getActivityIcon(activity.type);
  const summary = getActivitySummary(activity);
  const truncatedSummary = truncate(summary, 100);

  return (
    <div
      style={{
        ...styles.activityRow,
        backgroundColor: hovered ? THEME.bg.cardHover : THEME.bg.card,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          ...styles.activityAccentBar,
          backgroundColor: accentColor,
        }}
      />
      <div style={styles.activityRowContent}>
        <div style={styles.activityRowTop}>
          <span style={{ ...styles.activityIcon, color: accentColor }}>{icon}</span>
          <span style={styles.activityType}>
            {activity.type.replace(/_/g, ' ')}
          </span>
          <span style={styles.activityTimestamp}>
            {formatTimestamp(activity.timestamp)}
          </span>
        </div>
        <div style={styles.activitySummary}>{truncatedSummary}</div>
        <div style={styles.activityEventName}>{activity.eventName}</div>
      </div>
    </div>
  );
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.substring(0, max) + '...';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.xl,
    padding: SPACING.xxl,
    animation: `scaleIn 0.3s ${ANIMATION.easeOut}`,
    maxHeight: '100%',
    overflowY: 'auto',
  },

  // ── Back button ──────────────────────────────
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: THEME.font.sans,
    color: THEME.text.secondary,
    padding: 0,
    alignSelf: 'flex-start',
    transition: `color ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },

  // ── Header ───────────────────────────────────
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.lg,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  propertyName: {
    fontSize: '24px',
    fontWeight: 800,
    color: THEME.text.primary,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  propertyLocation: {
    fontSize: '14px',
    color: THEME.text.muted,
    lineHeight: 1.4,
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: RADIUS.full,
    fontSize: '13px',
    fontWeight: 600,
    border: '1px solid',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },

  // ── Card Grid ────────────────────────────────
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
  },
  card: {
    background: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    boxShadow: SHADOW.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.md,
  },
  cardLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: THEME.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },

  // ── Guest Card ───────────────────────────────
  guestNames: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap' as const,
  },
  guestNameItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '15px',
    fontWeight: 600,
    color: THEME.text.primary,
  },
  guestArrow: {
    color: THEME.text.muted,
    fontSize: '13px',
    fontWeight: 400,
  },
  chatPreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '4px',
  },
  chatBubbleIn: {
    backgroundColor: THEME.bg.cardHover,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: '10px 10px 10px 2px',
    padding: '8px 12px',
    maxWidth: '100%',
  },
  chatBubbleOut: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.12)',
    borderRadius: '10px 10px 2px 10px',
    padding: '8px 12px',
    maxWidth: '100%',
  },
  chatSender: {
    fontSize: '11px',
    fontWeight: 600,
    color: THEME.text.muted,
    marginBottom: '2px',
  },
  chatSenderOut: {
    fontSize: '11px',
    fontWeight: 600,
    color: THEME.tool.sms,
    marginBottom: '2px',
  },
  chatText: {
    fontSize: '13px',
    color: THEME.text.primary,
    lineHeight: 1.4,
  },
  chatTimestamp: {
    fontSize: '11px',
    color: THEME.text.muted,
    alignSelf: 'flex-end',
  },
  noDataText: {
    fontSize: '13px',
    color: THEME.text.muted,
    fontStyle: 'italic',
  },

  // ── Pricing Card ─────────────────────────────
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
  },
  currentPrice: {
    fontSize: '28px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
    lineHeight: 1.1,
  },
  priceUnit: {
    fontSize: '14px',
    color: THEME.text.muted,
    fontWeight: 400,
  },
  basePriceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  basePriceLabel: {
    fontSize: '13px',
    color: THEME.text.muted,
  },
  basePriceValue: {
    fontSize: '13px',
    color: THEME.text.secondary,
    fontFamily: THEME.font.mono,
  },
  priceDeltaBadge: {
    fontSize: '12px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: RADIUS.full,
  },
  lastAdjusted: {
    fontSize: '12px',
    color: THEME.text.muted,
    marginTop: 'auto',
  },

  // ── Schedule Card ────────────────────────────
  scheduleBarContainer: {
    padding: '4px 0',
  },
  scheduleBarTrack: {
    position: 'relative',
    height: '12px',
    backgroundColor: THEME.bg.cardHover,
    borderRadius: '6px',
    overflow: 'hidden',
    width: '100%',
  },
  legendRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '12px',
    marginTop: '4px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  legendLabel: {
    fontSize: '11px',
    color: THEME.text.muted,
    fontWeight: 500,
  },

  // ── Active Issues ────────────────────────────
  issuesCard: {
    background: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    boxShadow: SHADOW.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.md,
  },
  issuesHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  issuesTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: THEME.text.primary,
  },
  issuesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  issueRow: {
    borderLeft: '3px solid',
    borderLeftColor: THEME.status.attention,
    padding: '10px 14px',
    backgroundColor: THEME.bg.primary,
    borderRadius: `0 ${RADIUS.sm} ${RADIUS.sm} 0`,
  },
  issueText: {
    fontSize: '14px',
    color: THEME.text.primary,
    lineHeight: 1.4,
  },

  // ── Related Activity ─────────────────────────
  activitySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.md,
  },
  activitySectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  activitySectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: THEME.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  activityCount: {
    fontSize: '12px',
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
    backgroundColor: THEME.bg.cardHover,
    padding: '2px 8px',
    borderRadius: '10px',
  },
  emptyActivity: {
    background: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.md,
    padding: '24px',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: THEME.text.muted,
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  activityRow: {
    display: 'flex',
    gap: '0',
    background: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    cursor: 'default',
    transition: `background-color ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  activityAccentBar: {
    width: '3px',
    flexShrink: 0,
  },
  activityRowContent: {
    flex: 1,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  activityRowTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  activityIcon: {
    fontSize: '13px',
    flexShrink: 0,
  },
  activityType: {
    fontSize: '12px',
    fontWeight: 600,
    color: THEME.text.secondary,
    textTransform: 'capitalize' as const,
  },
  activityTimestamp: {
    fontSize: '11px',
    color: THEME.text.muted,
    marginLeft: 'auto',
    fontFamily: THEME.font.mono,
    flexShrink: 0,
  },
  activitySummary: {
    fontSize: '13px',
    color: THEME.text.primary,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  activityEventName: {
    fontSize: '11px',
    color: THEME.text.muted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
};
