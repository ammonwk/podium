import React, { useState } from 'react';
import { THEME } from '@apm/shared';
import { SHADOW, ANIMATION } from '../styles/theme';
import type { PropertyState } from '../hooks/useSSE';

interface Props {
  properties: PropertyState[];
  onPropertyClick: (property: PropertyState) => void;
}

const STATUS_COLORS: Record<string, { roof: string; walls: string; accent: string }> = {
  normal: { roof: '#86EFAC', walls: '#F0FDF4', accent: '#059669' },
  attention: { roof: '#FCD34D', walls: '#FFFBEB', accent: '#D97706' },
  emergency: { roof: '#FCA5A5', walls: '#FEF2F2', accent: '#DC2626' },
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
  onClick: () => void;
}> = ({ property, index, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const colors = STATUS_COLORS[property.status] || STATUS_COLORS.normal;
  const hasIssue = property.status !== 'normal';
  const priceDelta = property.current_price - property.base_price;

  return (
    <div
      style={{
        ...styles.houseWrapper,
        animation: `houseEntrance 0.6s ${ANIMATION.easeOut} both`,
        animationDelay: `${index * 150}ms`,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 3D House */}
      <div
        style={{
          ...styles.houseContainer,
          transform: hovered
            ? 'rotateX(-20deg) rotateY(45deg) translateY(-10px) scale(1.05)'
            : 'rotateX(-20deg) rotateY(45deg)',
          ...(hasIssue && property.status === 'emergency'
            ? { animation: 'gentleShake 2s ease-in-out infinite' }
            : {}),
        }}
      >
        {/* Chimney smoke */}
        <div style={styles.chimneyContainer}>
          <div style={{
            ...styles.chimney,
            backgroundColor: colors.accent,
          }} />
          <div style={styles.smokeParticle} />
          <div style={{ ...styles.smokeParticle, animationDelay: '0.5s', left: '4px' }} />
        </div>

        {/* Roof - two angled planes */}
        <div style={{
          ...styles.roofLeft,
          background: `linear-gradient(135deg, ${colors.roof}, ${colors.roof}dd)`,
          boxShadow: hovered ? '0 -4px 20px rgba(0,0,0,0.1)' : '0 -2px 8px rgba(0,0,0,0.05)',
        }} />
        <div style={{
          ...styles.roofRight,
          background: `linear-gradient(225deg, ${colors.roof}cc, ${colors.roof}99)`,
        }} />

        {/* Front face */}
        <div style={{
          ...styles.wallFront,
          background: colors.walls,
          borderColor: hovered ? colors.accent + '40' : '#E8E5DE',
        }}>
          {/* Door */}
          <div style={{
            ...styles.door,
            backgroundColor: colors.accent + '30',
            borderColor: colors.accent + '50',
          }} />
          {/* Windows */}
          <div style={styles.windowRow}>
            <div style={{
              ...styles.window,
              backgroundColor: property.status === 'emergency' ? '#FCA5A5' : '#BFDBFE',
              ...(property.status === 'emergency'
                ? { animation: 'windowFlicker 1s ease-in-out infinite' }
                : {}),
            }} />
            <div style={{
              ...styles.window,
              backgroundColor: property.status === 'emergency' ? '#FCA5A5' : '#BFDBFE',
              ...(property.status === 'emergency'
                ? { animation: 'windowFlicker 1s ease-in-out infinite 0.3s' }
                : {}),
            }} />
          </div>
        </div>

        {/* Right face */}
        <div style={{
          ...styles.wallRight,
          background: `linear-gradient(180deg, ${colors.walls}ee, ${colors.walls}cc)`,
        }}>
          <div style={{
            ...styles.sideWindow,
            backgroundColor: property.status === 'emergency' ? '#FCA5A5' : '#BFDBFE',
          }} />
        </div>

        {/* Shadow beneath house */}
        <div style={{
          ...styles.houseShadow,
          opacity: hovered ? 0.15 : 0.08,
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
        }} />
      </div>

      {/* Property info below house */}
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
              : 'rgba(107, 114, 128, 0.08)',
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
              ? 'rgba(220, 38, 38, 0.1)'
              : 'rgba(217, 119, 6, 0.1)',
            color: property.status === 'emergency'
              ? THEME.status.emergency
              : THEME.status.attention,
          }}>
            {property.status === 'emergency' ? '⚠ Emergency' : '● Attention needed'}
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
    gap: '80px',
    alignItems: 'flex-end',
    perspective: '1200px',
  },
  houseWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },
  houseContainer: {
    position: 'relative',
    width: '120px',
    height: '120px',
    transformStyle: 'preserve-3d',
    transform: 'rotateX(-20deg) rotateY(45deg)',
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },

  // Chimney
  chimneyContainer: {
    position: 'absolute',
    top: '-28px',
    left: '20px',
    zIndex: 10,
  },
  chimney: {
    width: '12px',
    height: '18px',
    borderRadius: '2px 2px 0 0',
  },
  smokeParticle: {
    position: 'absolute',
    top: '-6px',
    left: '2px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'rgba(156, 163, 175, 0.4)',
    animation: 'chimneySmoke 2s ease-out infinite',
  },

  // Roof
  roofLeft: {
    position: 'absolute',
    width: '100%',
    height: '40px',
    top: '-20px',
    left: '-10px',
    transform: 'rotateZ(-8deg)',
    borderRadius: '4px 4px 0 0',
    zIndex: 5,
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },
  roofRight: {
    position: 'absolute',
    width: '60%',
    height: '40px',
    top: '-18px',
    right: '-5px',
    transform: 'rotateZ(4deg) skewX(-10deg)',
    borderRadius: '0 4px 0 0',
    zIndex: 4,
  },

  // Walls
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
    justifyContent: 'flex-end',
    padding: '8px',
    gap: '6px',
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
    zIndex: 3,
  },
  wallRight: {
    position: 'absolute',
    width: '40px',
    height: '80px',
    bottom: '0',
    right: '-20px',
    transform: 'skewY(-10deg)',
    borderRadius: '0 4px 4px 0',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Door & windows
  door: {
    width: '22px',
    height: '30px',
    borderRadius: '10px 10px 0 0',
    border: '1.5px solid',
  },
  windowRow: {
    position: 'absolute',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '12px',
  },
  window: {
    width: '18px',
    height: '18px',
    borderRadius: '3px',
    border: '1.5px solid rgba(0,0,0,0.08)',
  },
  sideWindow: {
    width: '14px',
    height: '14px',
    borderRadius: '2px',
    border: '1px solid rgba(0,0,0,0.06)',
  },

  // Shadow
  houseShadow: {
    position: 'absolute',
    bottom: '-15px',
    left: '10%',
    width: '80%',
    height: '20px',
    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, transparent 70%)',
    borderRadius: '50%',
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },

  // Info
  infoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    marginTop: '8px',
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
    padding: '2px 8px',
    borderRadius: '10px',
    marginTop: '4px',
  },
};
