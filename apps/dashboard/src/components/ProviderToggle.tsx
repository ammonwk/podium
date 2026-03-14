import React, { useState, useRef, useEffect } from 'react';
import { THEME } from '@apm/shared';
import { ANIMATION } from '../styles/theme';

interface Props {
  providerConfig: { provider: string; model: string };
  onSwitch: () => void;
}

function formatModel(model: string): string {
  if (model.includes('claude')) {
    return model.replace(/-\d{8}$/, '').replace('claude-', 'Claude ');
  }
  if (model.includes('llama')) {
    return model.replace(/-instruct$/, '');
  }
  return model;
}

function formatProvider(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'anthropic') {
    return (
      <svg width="14" height="14" viewBox="0 0 46 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32.73 0H26.2l13.27 32h6.53L32.73 0ZM13.27 0 0 32h6.53l2.72-6.57h14.02l2.72 6.57h6.53L19.25 0h-5.98Zm-1.3 20.05 4.28-10.33 4.28 10.33H11.97Z" fill={THEME.text.muted} />
      </svg>
    );
  }
  // Cerebras — concentric arc segments
  const c = THEME.text.muted;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-10, 11, 12)">
        <circle cx="11" cy="12" r="1.2" fill={c} />
        <circle cx="11" cy="12" r="2.5" stroke={c} strokeWidth="1.1" fill="none" strokeDasharray="12.22 3.49" />
        <circle cx="11" cy="12" r="5" stroke={c} strokeWidth="1.1" fill="none" strokeDasharray="24.44 6.98" />
        <circle cx="11" cy="12" r="7.5" stroke={c} strokeWidth="1.1" fill="none" strokeDasharray="36.66 10.47" />
        <circle cx="11" cy="12" r="10" stroke={c} strokeWidth="1.1" fill="none" strokeDasharray="48.88 13.95" />
      </g>
    </svg>
  );
}

export const ProviderToggle: React.FC<Props> = ({ providerConfig, onSwitch }) => {
  const [hovered, setHovered] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (textRef.current) {
      setTextWidth(textRef.current.scrollWidth);
    }
  }, [providerConfig]);

  // The full expanded width: icon (14) + padding (6*2) + text + border (2)
  const expandedWidth = 14 + 12 + textWidth + 2;
  const collapsedWidth = 14 + 12 + 2; // icon + padding + border

  return (
    <div
      style={styles.wrapper}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        style={{
          ...styles.button,
          width: hovered ? expandedWidth : collapsedWidth,
          backgroundColor: hovered ? THEME.bg.cardHover : THEME.bg.primary,
        }}
        onClick={onSwitch}
        title="Click to switch provider"
      >
        <ProviderIcon provider={providerConfig.provider} />
        <span
          style={{
            ...styles.textContainer,
            width: hovered ? textWidth : 0,
            opacity: hovered ? 1 : 0,
          }}
        >
          <span ref={textRef} style={styles.textInner}>
            <span style={styles.provider}>{formatProvider(providerConfig.provider)}</span>
            <span style={styles.separator}>·</span>
            <span style={styles.model}>{formatModel(providerConfig.model)}</span>
          </span>
        </span>
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    width: '28px', // collapsed size: 14 icon + 12 padding + 2 border
    height: '28px',
    flexShrink: 0,
  },
  button: {
    position: 'absolute',
    right: 0,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '6px',
    borderRadius: '9999px',
    border: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.primary,
    cursor: 'pointer',
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
    fontFamily: THEME.font.sans,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    height: '28px',
    boxSizing: 'border-box',
  },
  textContainer: {
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    transition: `width ${ANIMATION.slow} ${ANIMATION.easeOut}, opacity ${ANIMATION.normal} ${ANIMATION.easeOut}`,
  },
  textInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: '6px',
    paddingRight: '6px',
  },
  provider: {
    fontSize: '12px',
    fontWeight: 500,
    color: THEME.text.muted,
  },
  separator: {
    fontSize: '12px',
    color: THEME.text.muted,
  },
  model: {
    fontSize: '12px',
    fontWeight: 500,
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
  },
};
