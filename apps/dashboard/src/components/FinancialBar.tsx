import React, { useEffect, useRef, useState } from 'react';
import { THEME } from '@apm/shared';

interface Props {
  financials: { revenue: number; costs: number; decisions: number };
}

// Animated number component
const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  color: string;
  label: string;
  isCurrency?: boolean;
}> = ({ value, prefix = '', color, label, isCurrency = false }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevValueRef.current;
    const diff = value - prev;
    if (diff === 0) return;

    const startTime = performance.now();
    const duration = 500;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = prev + diff * eased;
      setDisplayValue(Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = value;
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
      <div style={styles.metricLabel}>{label}</div>
      <div
        style={{
          ...styles.metricValue,
          color,
        }}
      >
        {formatted}
      </div>
    </div>
  );
};

export const FinancialBar: React.FC<Props> = ({ financials }) => {
  const net = financials.revenue - financials.costs;
  const netColor = net >= 0 ? THEME.text.accent : THEME.status.emergency;

  return (
    <div style={styles.container}>
      <AnimatedNumber
        value={financials.revenue}
        color={THEME.status.normal}
        label="Revenue Impact"
        isCurrency
        prefix="+"
      />

      <div style={styles.divider} />

      <AnimatedNumber
        value={financials.costs}
        color={THEME.status.emergency}
        label="Costs"
        isCurrency
        prefix="-"
      />

      <div style={styles.divider} />

      <AnimatedNumber
        value={net}
        color={netColor}
        label="Net Impact"
        isCurrency
        prefix={net >= 0 ? '+' : '-'}
      />

      <div style={styles.divider} />

      <AnimatedNumber
        value={financials.decisions}
        color={THEME.text.secondary}
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
    gap: '40px',
    padding: '12px 32px',
    borderTop: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.primary,
    flexShrink: 0,
    minHeight: '68px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  metricLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: THEME.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  metricValue: {
    fontSize: '26px',
    fontWeight: 700,
    fontFamily: THEME.font.mono,
    letterSpacing: '-0.02em',
    lineHeight: '1.1',
  },
  divider: {
    width: '1px',
    height: '36px',
    backgroundColor: THEME.bg.border,
  },
};
