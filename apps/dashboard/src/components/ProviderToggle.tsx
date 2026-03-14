import React, { useState } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION } from '../styles/theme';

interface Props {
  providerConfig: { provider: string; model: string };
  onSwitch: () => void;
}

function formatModel(model: string): string {
  // Make model name more readable
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

export const ProviderToggle: React.FC<Props> = ({ providerConfig, onSwitch }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      style={{
        ...styles.button,
        backgroundColor: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        borderColor: hovered ? THEME.bg.borderLight : THEME.bg.border,
      }}
      onClick={onSwitch}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Click to switch provider"
    >
      <span style={styles.provider}>{formatProvider(providerConfig.provider)}</span>
      <span style={styles.separator}>·</span>
      <span style={styles.model}>{formatModel(providerConfig.model)}</span>
    </button>
  );
};

const styles: Record<string, React.CSSProperties> = {
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${THEME.bg.border}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    fontFamily: THEME.font.sans,
    whiteSpace: 'nowrap',
  },
  provider: {
    fontSize: '12px',
    fontWeight: 600,
    color: THEME.text.secondary,
  },
  separator: {
    fontSize: '12px',
    color: THEME.text.muted,
  },
  model: {
    fontSize: '11px',
    fontWeight: 400,
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
  },
};
