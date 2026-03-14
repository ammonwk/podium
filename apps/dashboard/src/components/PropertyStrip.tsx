import React, { useState } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, SHADOW, ANIMATION } from '../styles/theme';
import type { PropertyState } from '../hooks/useSSE';

interface Props {
  properties: PropertyState[];
  onPropertyClick: (property: PropertyState) => void;
}

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

export const PropertyStrip: React.FC<Props> = ({ properties, onPropertyClick }) => {
  return (
    <div style={styles.container}>
      {properties.map(property => (
        <PropertyCard
          key={property.id}
          property={property}
          onClick={() => onPropertyClick(property)}
        />
      ))}
    </div>
  );
};

const PropertyCard: React.FC<{
  property: PropertyState;
  onClick: () => void;
}> = ({ property, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const statusColor = STATUS_COLORS[property.status] || THEME.status.normal;
  const hasIssue = property.status !== 'normal';
  const priceDelta = property.current_price - property.base_price;
  const priceDeltaPercent = property.base_price > 0
    ? Math.round((priceDelta / property.base_price) * 100)
    : 0;

  const cardStyle: React.CSSProperties = {
    ...styles.card,
    borderColor: hovered ? THEME.bg.borderLight : THEME.bg.border,
    borderLeftColor: statusColor,
    transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: hovered ? SHADOW.md : SHADOW.sm,
    ...(hasIssue
      ? {
          animation: property.status === 'emergency'
            ? 'emergencyPulse 2s ease-in-out infinite'
            : 'attentionPulse 2.5s ease-in-out infinite',
        }
      : {}),
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div style={styles.headerRow}>
        <div style={styles.nameBlock}>
          <div style={styles.propertyName}>{property.name}</div>
          <div style={styles.location}>{property.location}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              ...styles.statusDot,
              backgroundColor: statusColor,
              ...(hasIssue ? { animation: 'pulseDot 1.5s ease-in-out infinite' } : {}),
            }}
          />
        </div>
      </div>

      {/* Metrics row */}
      <div style={styles.metricsRow}>
        {/* Price */}
        <div style={styles.metric}>
          <span style={styles.priceValue}>${property.current_price}</span>
          <span style={styles.priceUnit}>/night</span>
          {priceDelta !== 0 && (
            <span
              style={{
                ...styles.priceDelta,
                color: priceDelta > 0 ? THEME.status.normal : THEME.status.emergency,
              }}
            >
              {priceDelta > 0 ? ' ▲' : ' ▼'} {priceDelta > 0 ? '+' : ''}{priceDeltaPercent}%
            </span>
          )}
          {priceDelta === 0 && (
            <span style={styles.priceDash}> —</span>
          )}
        </div>

        {/* Rating */}
        <div style={styles.metric}>
          <span style={styles.star}>★</span>
          <span style={styles.ratingValue}>{property.rating}</span>
          <span style={styles.reviewCount}>({property.review_count})</span>
        </div>

        {/* Guest flow */}
        <div style={styles.guestFlow}>
          {property.guestFlow}
        </div>
      </div>

      {/* Schedule bar */}
      <div style={styles.scheduleBar}>
        {property.schedule.map((seg, i) => (
          <div
            key={`${seg.type}-${seg.start}`}
            style={{
              position: 'absolute' as const,
              left: `${seg.start}%`,
              width: `${seg.end - seg.start}%`,
              height: '100%',
              backgroundColor: SEGMENT_COLORS[seg.type] || '#666',
              borderRadius: '2px',
              transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    gap: '12px',
    flex: 1,
  },
  card: {
    flex: 1,
    background: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderLeft: `3px solid ${THEME.status.normal}`,
    borderRadius: RADIUS.lg,
    padding: '14px 18px',
    cursor: 'pointer',
    transition: `all ${ANIMATION.normal} ${ANIMATION.easeOut}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: 0,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  propertyName: {
    fontSize: '16px',
    fontWeight: 600,
    color: THEME.text.primary,
    lineHeight: '1.2',
  },
  location: {
    fontSize: '14px',
    color: THEME.text.muted,
    lineHeight: '1.3',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  metricsRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '14px',
    flexWrap: 'wrap' as const,
  },
  metric: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
  },
  priceValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
  },
  priceUnit: {
    fontSize: '14px',
    color: THEME.text.muted,
  },
  priceDelta: {
    fontSize: '14px',
    fontWeight: 600,
    marginLeft: '2px',
  },
  priceDash: {
    fontSize: '14px',
    color: THEME.text.muted,
  },
  star: {
    color: THEME.status.attention,
    fontSize: '15px',
    marginRight: '2px',
  },
  ratingValue: {
    fontSize: '16px',
    fontWeight: 500,
    color: THEME.text.primary,
  },
  reviewCount: {
    fontSize: '14px',
    color: THEME.text.muted,
    marginLeft: '2px',
  },
  guestFlow: {
    fontSize: '14px',
    color: THEME.text.secondary,
    fontWeight: 500,
  },
  scheduleBar: {
    position: 'relative',
    height: '4px',
    backgroundColor: 'rgba(30, 30, 46, 0.5)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
};
