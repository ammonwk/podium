import React, { useState } from 'react';
import { THEME } from '@apm/shared';
import { ANIMATION } from '../styles/theme';

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
        backgroundColor: hovered ? THEME.bg.cardHover : THEME.bg.primary,
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
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '9999px',
    border: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.primary,
    cursor: 'pointer',
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    fontFamily: THEME.font.sans,
    whiteSpace: 'nowrap',
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
