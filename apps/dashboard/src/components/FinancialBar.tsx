import React, { useEffect, useRef, useState } from 'react';
import { THEME } from '@apm/shared';
import { SHADOW } from '../styles/theme';

interface Props {
  financials: { revenue: number; costs: number; decisions: number };
}

// Animated number component with smooth roll-up
const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  icon: string;
  color: string;
  label: string;
  isCurrency?: boolean;
}> = ({ value, prefix = '', icon, color, label, isCurrency = false }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevValueRef.current;
    const diff = value - prev;
    if (diff === 0) return;

    setIsAnimating(true);
    const startTime = performance.now();
    const duration = 600;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for a more satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = prev + diff * eased;
      setDisplayValue(Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = value;
        setIsAnimating(false);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  const absValue = Math.abs(displayValue);
  const formatted = isCurrency
    ? `${prefix}$${absValue.toLocaleString()}`
    : `${displayValue.toLocaleString()}`;

  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>
        <span style={styles.metricIcon}>{icon}</span>
        {label}
      </div>
      <div
        style={{
          ...styles.metricValue,
          color,
          transition: 'color 0.3s ease',
          ...(isAnimating ? { textShadow: `0 0 12px ${color}20` } : {}),
        }}
      >
        {formatted}
      </div>
    </div>
  );
};

export const FinancialBar: React.FC<Props> = ({ financials }) => {
  const net = financials.revenue - financials.costs;
  const netColor = net >= 0 ? THEME.status.normal : THEME.status.emergency;

  return (
    <div style={styles.container}>
      <AnimatedNumber
        value={financials.revenue}
        color={THEME.status.normal}
        icon="↑"
        label="Revenue"
        isCurrency
        prefix="+"
      />

      <div style={styles.divider} />

      <AnimatedNumber
        value={financials.costs}
        color={THEME.status.emergency}
        icon="↓"
        label="Costs"
        isCurrency
        prefix="-"
      />

      <div style={styles.divider} />

      <AnimatedNumber
        value={net}
        color={netColor}
        icon="="
        label="Net Impact"
        isCurrency
        prefix={net >= 0 ? '+' : '-'}
      />

      <div style={styles.divider} />

      <AnimatedNumber
        value={financials.decisions}
        color={THEME.text.secondary}
        icon="◆"
        label="Decisions"
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '48px',
    padding: '16px 32px',
    backgroundColor: THEME.bg.card,
    boxShadow: SHADOW.sm,
    flexShrink: 0,
    minHeight: '72px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
  },
  metricLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: THEME.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  metricIcon: {
    fontSize: '11px',
  },
  metricValue: {
    fontSize: '22px',
    fontWeight: 700,
    fontFamily: THEME.font.mono,
    letterSpacing: '-0.02em',
    lineHeight: '1.1',
  },
  divider: {
    width: '1px',
    height: '32px',
    backgroundColor: THEME.bg.border,
  },
};
