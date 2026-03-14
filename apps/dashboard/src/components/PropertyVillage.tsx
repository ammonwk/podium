import React, { useState } from 'react';
import { THEME } from '@apm/shared';
import { SHADOW, ANIMATION, RADIUS } from '../styles/theme';
import type { PropertyState } from '../hooks/useSSE';

interface Props {
  properties: PropertyState[];
  onPropertyClick: (property: PropertyState) => void;
}

const HOUSE_STYLES: Array<{ roof: string; walls: string; door: string; accent: string }> = [
  { roof: '#86EFAC', walls: '#F0FDF4', door: '#059669', accent: '#059669' },  // Green cottage
  { roof: '#93C5FD', walls: '#EFF6FF', door: '#2563EB', accent: '#3B82F6' },  // Blue loft
  { roof: '#FCD34D', walls: '#FFFBEB', door: '#D97706', accent: '#D97706' },  // Amber house
];

const STATUS_OVERLAYS: Record<string, { roof: string; glow: string }> = {
  attention: { roof: '#FCD34D', glow: 'rgba(217, 119, 6, 0.15)' },
  emergency: { roof: '#FCA5A5', glow: 'rgba(220, 38, 38, 0.15)' },
};

export const PropertyVillage: React.FC<Props> = ({ properties, onPropertyClick }) => {
  return (
    <div style={styles.container}>
      <div style={styles.village}>
        {properties.map((property, i) => (
          <IsometricHouse
            key={property.id}
            property={property}
            index={i}
            houseStyle={HOUSE_STYLES[i % HOUSE_STYLES.length]}
            onClick={() => onPropertyClick(property)}
          />
        ))}
      </div>
    </div>
  );
};

const IsometricHouse: React.FC<{
  property: PropertyState;
  index: number;
  houseStyle: typeof HOUSE_STYLES[0];
  onClick: () => void;
}> = ({ property, index, houseStyle, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const hasIssue = property.status !== 'normal';
  const statusOverlay = STATUS_OVERLAYS[property.status];
  const roofColor = statusOverlay?.roof || houseStyle.roof;
  const priceDelta = property.current_price - property.base_price;

  return (
    <div
      style={{
        ...styles.houseWrapper,
        animationDelay: `${index * 120}ms`,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 3D House — perspective is scoped HERE so text below stays flat */}
      <div style={styles.perspectiveBox}>
        <div
          style={{
            ...styles.houseBody,
            transform: hovered
              ? 'rotateX(-20deg) rotateY(45deg) translateY(-8px) scale(1.06)'
              : 'rotateX(-20deg) rotateY(45deg)',
            filter: hovered ? 'drop-shadow(0 16px 24px rgba(0,0,0,0.12))' : 'drop-shadow(0 8px 16px rgba(0,0,0,0.06))',
            ...(hasIssue && property.status === 'emergency'
              ? { animation: 'gentleShake 3s ease-in-out infinite' }
              : {}),
          }}
        >
          {/* Roof */}
          <div style={{
            ...styles.roofLeft,
            background: `linear-gradient(135deg, ${roofColor}, ${roofColor}dd)`,
          }} />
          <div style={{
            ...styles.roofRight,
            background: `linear-gradient(225deg, ${roofColor}cc, ${roofColor}88)`,
          }} />

          {/* Front face */}
          <div style={{
            ...styles.wallFront,
            backgroundColor: houseStyle.walls,
            borderColor: hovered ? houseStyle.accent + '40' : '#E8E5DE',
          }}>
            <div style={styles.windowRow}>
              <div style={{
                ...styles.windowBox,
                backgroundColor: property.status === 'emergency' ? '#FCA5A5' : '#BFDBFE',
                ...(property.status === 'emergency' ? { animation: 'windowFlicker 1s ease-in-out infinite' } : {}),
              }} />
              <div style={{
                ...styles.windowBox,
                backgroundColor: property.status === 'emergency' ? '#FCA5A5' : '#BFDBFE',
                ...(property.status === 'emergency' ? { animation: 'windowFlicker 1s ease-in-out infinite 0.3s' } : {}),
              }} />
            </div>
            <div style={{
              ...styles.door,
              backgroundColor: houseStyle.door + '25',
              borderColor: houseStyle.door + '50',
            }} />
          </div>

          {/* Right side face */}
          <div style={{
            ...styles.wallRight,
            backgroundColor: houseStyle.walls + 'dd',
          }}>
            <div style={{
              ...styles.sideWindow,
              backgroundColor: '#BFDBFE',
            }} />
          </div>
        </div>
      </div>

      {/* Info below house — FLAT, no perspective */}
      <div style={styles.infoContainer}>
        <div style={styles.propertyName}>{property.name}</div>
        <div style={styles.location}>{property.location}</div>
        <div style={styles.metricsRow}>
          <span style={{
            ...styles.priceBadge,
            backgroundColor: priceDelta > 0
              ? 'rgba(5, 150, 105, 0.1)'
              : priceDelta < 0
              ? 'rgba(220, 38, 38, 0.1)'
              : 'rgba(0, 0, 0, 0.04)',
            color: priceDelta > 0
              ? THEME.status.normal
              : priceDelta < 0
              ? THEME.status.emergency
              : THEME.text.accent,
          }}>
            ${property.current_price}/n
          </span>
          <span style={styles.rating}>
            <span style={styles.star}>★</span> {property.rating}
          </span>
        </div>
        <div style={styles.guestFlow}>{property.guestFlow}</div>
        {hasIssue && (
          <div style={{
            ...styles.statusBadge,
            backgroundColor: property.status === 'emergency'
              ? 'rgba(220, 38, 38, 0.08)'
              : 'rgba(217, 119, 6, 0.08)',
            color: property.status === 'emergency'
              ? THEME.status.emergency
              : THEME.status.attention,
            borderColor: property.status === 'emergency'
              ? 'rgba(220, 38, 38, 0.2)'
              : 'rgba(217, 119, 6, 0.2)',
          }}>
            {property.status === 'emergency' ? '⚠ Emergency' : '● Attention'}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px 24px 8px',
    flexShrink: 0,
  },
  village: {
    display: 'flex',
    gap: '72px',
    alignItems: 'flex-end',
  },
  houseWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    animation: `fadeIn 0.5s ${ANIMATION.easeOut} both`,
  },

  // Perspective scoped to just the 3D house
  perspectiveBox: {
    perspective: '800px',
    perspectiveOrigin: '50% 50%',
  },
  houseBody: {
    position: 'relative',
    width: '110px',
    height: '110px',
    transformStyle: 'preserve-3d',
    transform: 'rotateX(-20deg) rotateY(45deg)',
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },

  // Roof
  roofLeft: {
    position: 'absolute',
    width: '115%',
    height: '36px',
    top: '-16px',
    left: '-8%',
    borderRadius: '4px 4px 0 0',
    zIndex: 5,
  },
  roofRight: {
    position: 'absolute',
    width: '55%',
    height: '36px',
    top: '-14px',
    right: '-8px',
    transform: 'skewX(-8deg)',
    borderRadius: '0 4px 0 0',
    zIndex: 4,
  },

  // Front wall
  wallFront: {
    position: 'absolute',
    width: '100%',
    height: '80px',
    bottom: '0',
    borderRadius: '4px',
    border: '2px solid #E8E5DE',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px 8px',
    zIndex: 3,
    transition: `border-color ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },
  windowRow: {
    display: 'flex',
    gap: '14px',
    width: '100%',
    justifyContent: 'center',
  },
  windowBox: {
    width: '20px',
    height: '20px',
    borderRadius: '3px',
    border: '1.5px solid rgba(0,0,0,0.06)',
    transition: `background-color ${ANIMATION.fast}`,
  },
  door: {
    width: '20px',
    height: '26px',
    borderRadius: '10px 10px 0 0',
    border: '1.5px solid',
  },

  // Right side wall
  wallRight: {
    position: 'absolute',
    width: '35px',
    height: '80px',
    bottom: '0',
    right: '-18px',
    transform: 'skewY(-12deg)',
    borderRadius: '0 4px 4px 0',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideWindow: {
    width: '14px',
    height: '14px',
    borderRadius: '2px',
    border: '1px solid rgba(0,0,0,0.06)',
  },

  // Info below house (completely flat — no 3D transform inheritance)
  infoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    paddingTop: '4px',
  },
  propertyName: {
    fontSize: '15px',
    fontWeight: 700,
    color: THEME.text.accent,
    textAlign: 'center',
    lineHeight: '1.2',
  },
  location: {
    fontSize: '12px',
    color: THEME.text.muted,
  },
  metricsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  priceBadge: {
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: THEME.font.mono,
    padding: '2px 8px',
    borderRadius: '6px',
  },
  rating: {
    fontSize: '13px',
    fontWeight: 600,
    color: THEME.text.secondary,
  },
  star: {
    color: '#FBBF24',
  },
  guestFlow: {
    fontSize: '12px',
    color: THEME.text.muted,
    fontWeight: 500,
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 10px',
    borderRadius: '10px',
    marginTop: '4px',
    border: '1px solid',
  },
};
