import React, { useState } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION } from '../styles/theme';

interface Props {
  demoPhase: 'idle' | 'running' | 'self-managing';
  demoEventIndex: number;
  onRunDemo: () => void;
  onResetDemo: () => void;
}

export const DemoControls: React.FC<Props> = ({
  demoPhase,
  demoEventIndex,
  onRunDemo,
  onResetDemo,
}) => {
  const [runHovered, setRunHovered] = useState(false);
  const [resetHovered, setResetHovered] = useState(false);

  return (
    <div style={styles.container}>
      {demoPhase === 'self-managing' && (
        <div style={styles.selfManagingBadge}>
          <div style={styles.selfManagingDot} />
          Agent is self-managing
        </div>
      )}

      {demoPhase === 'running' && (
        <div style={styles.progress}>
          Event {demoEventIndex + 1} of 4
        </div>
      )}

      <button
        style={{
          ...styles.runButton,
          opacity: demoPhase === 'self-managing' ? 0.3 : 1,
          backgroundColor: runHovered && demoPhase === 'idle'
            ? 'rgba(34, 197, 94, 0.25)'
            : 'rgba(34, 197, 94, 0.12)',
          cursor: demoPhase !== 'idle' ? 'not-allowed' : 'pointer',
        }}
        onClick={demoPhase === 'idle' ? onRunDemo : undefined}
        onMouseEnter={() => setRunHovered(true)}
        onMouseLeave={() => setRunHovered(false)}
        disabled={demoPhase !== 'idle'}
      >
        {demoPhase === 'idle' && '▶ Run Demo'}
        {demoPhase === 'running' && '● Running...'}
        {demoPhase === 'self-managing' && '✓ Complete'}
      </button>

      <button
        style={{
          ...styles.resetButton,
          backgroundColor: resetHovered
            ? 'rgba(239, 68, 68, 0.15)'
            : 'transparent',
        }}
        onClick={onResetDemo}
        onMouseEnter={() => setResetHovered(true)}
        onMouseLeave={() => setResetHovered(false)}
      >
        Reset
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  runButton: {
    padding: '7px 16px',
    borderRadius: RADIUS.sm,
    border: '1px solid rgba(34, 197, 94, 0.25)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    color: THEME.status.normal,
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: THEME.font.sans,
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    whiteSpace: 'nowrap',
  },
  resetButton: {
    padding: '7px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid rgba(239, 68, 68, 0.25)`,
    backgroundColor: 'transparent',
    color: THEME.status.emergency,
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: THEME.font.sans,
    cursor: 'pointer',
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    whiteSpace: 'nowrap',
  },
  progress: {
    fontSize: '12px',
    color: THEME.text.secondary,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  selfManagingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: THEME.status.selfInitiated,
    animation: 'tealPulse 2s ease-in-out infinite',
    whiteSpace: 'nowrap',
  },
  selfManagingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: THEME.status.selfInitiated,
    animation: 'pulseDot 1.5s ease-in-out infinite',
  },
};
