import React, { useState, useRef, useEffect } from 'react';
import { THEME, DEMO_EVENTS } from '@apm/shared';
import { RADIUS, ANIMATION, SHADOW } from '../styles/theme';

interface Props {
  demoPhase: 'idle' | 'running' | 'self-managing';
  demoEventIndex: number;
  onRunDemo: () => void;
  onEmptyDay: () => void;
  onResetDemo: () => void;
}

const TOTAL_EVENTS = DEMO_EVENTS.length;

const ProgressBar: React.FC<{ currentIndex: number }> = ({ currentIndex }) => {
  const sent = Math.min(currentIndex + 1, TOTAL_EVENTS);
  const pct = (sent / TOTAL_EVENTS) * 100;

  return (
    <div style={styles.progressContainer}>
      <span style={styles.progressLabel}>{sent}/{TOTAL_EVENTS} sent</span>
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${pct}%`,
          }}
        />
      </div>
    </div>
  );
};

export const DemoControls: React.FC<Props> = ({
  demoPhase,
  demoEventIndex,
  onRunDemo,
  onEmptyDay,
  onResetDemo,
}) => {
  const [runHovered, setRunHovered] = useState(false);
  const [resetHovered, setResetHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isIdle = demoPhase === 'idle';
  const isRunning = demoPhase === 'running';
  const isSelfManaging = demoPhase === 'self-managing';

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const getRunButtonStyle = (): React.CSSProperties => {
    if (isSelfManaging) {
      return {
        ...styles.runButton,
        background: 'none',
        backgroundColor: 'transparent',
        border: `1px solid ${THEME.status.normal}`,
        color: THEME.status.normal,
        cursor: 'default',
        opacity: 1,
      };
    }
    if (isRunning) {
      return {
        ...styles.runButton,
        background: THEME.accent.gradient,
        opacity: 0.7,
        cursor: 'not-allowed',
      };
    }
    // idle
    return {
      ...styles.runButton,
      background: THEME.accent.gradient,
      transform: runHovered ? 'scale(1.03)' : 'scale(1)',
      boxShadow: runHovered
        ? '0 6px 20px rgba(102, 126, 234, 0.35)'
        : SHADOW.sm,
    };
  };

  const handleButtonClick = () => {
    if (isIdle) {
      setDropdownOpen((prev) => !prev);
    }
  };

  const handleSelectDemoEvents = () => {
    setDropdownOpen(false);
    onRunDemo();
  };

  const handleSelectEmptyDay = () => {
    setDropdownOpen(false);
    onEmptyDay();
  };

  return (
    <div style={styles.container}>
      {isSelfManaging && (
        <div style={styles.selfManagingBadge}>
          <div style={styles.selfManagingDot} />
          AI Managing
        </div>
      )}

      {isRunning && <ProgressBar currentIndex={demoEventIndex} />}

      <div style={styles.dropdownWrapper} ref={dropdownRef}>
        <button
          style={getRunButtonStyle()}
          onClick={handleButtonClick}
          onMouseEnter={() => setRunHovered(true)}
          onMouseLeave={() => setRunHovered(false)}
          disabled={!isIdle}
        >
          {isIdle && (
            <span style={styles.buttonContent}>
              See AI in Action
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: '6px' }}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          {isRunning && (
            <span style={styles.runningContent}>
              <span style={styles.spinner} />
              Running...
            </span>
          )}
          {isSelfManaging && (
            <span style={{ color: THEME.status.normal }}>&#10003; Complete</span>
          )}
        </button>

        {dropdownOpen && (
          <div style={styles.dropdownMenu}>
            <button
              style={{
                ...styles.dropdownItem,
                backgroundColor: hoveredOption === 'demo' ? THEME.bg.cardHover : 'transparent',
              }}
              onClick={handleSelectDemoEvents}
              onMouseEnter={() => setHoveredOption('demo')}
              onMouseLeave={() => setHoveredOption(null)}
            >
              <span style={styles.dropdownItemTitle}>Demo Events</span>
              <span style={styles.dropdownItemDesc}>Fire {TOTAL_EVENTS} scripted events</span>
            </button>
            <button
              style={{
                ...styles.dropdownItem,
                backgroundColor: hoveredOption === 'empty' ? THEME.bg.cardHover : 'transparent',
              }}
              onClick={handleSelectEmptyDay}
              onMouseEnter={() => setHoveredOption('empty')}
              onMouseLeave={() => setHoveredOption(null)}
            >
              <span style={styles.dropdownItemTitle}>Empty Day</span>
              <span style={styles.dropdownItemDesc}>AI handles live events</span>
            </button>
          </div>
        )}
      </div>

      <button
        style={{
          ...styles.resetButton,
          backgroundColor: resetHovered ? THEME.bg.cardHover : 'transparent',
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
    gap: '10px',
    flexShrink: 0,
  },
  dropdownWrapper: {
    position: 'relative',
  },
  runButton: {
    padding: '10px 24px',
    borderRadius: RADIUS.full,
    border: 'none',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: THEME.font.sans,
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    boxShadow: SHADOW.sm,
  },
  buttonContent: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  runningContent: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#FFFFFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  resetButton: {
    padding: '6px 14px',
    borderRadius: RADIUS.md,
    border: `1px solid ${THEME.bg.border}`,
    backgroundColor: 'transparent',
    color: THEME.text.muted,
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: THEME.font.sans,
    cursor: 'pointer',
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    whiteSpace: 'nowrap',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: '200px',
    backgroundColor: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.lg,
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: THEME.font.sans,
    transition: `background-color ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  dropdownItemTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: THEME.text.primary,
  },
  dropdownItemDesc: {
    fontSize: '11px',
    color: THEME.text.muted,
    marginTop: '2px',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  progressLabel: {
    fontSize: '12px',
    color: THEME.text.secondary,
    fontWeight: 600,
    fontFamily: THEME.font.mono,
    whiteSpace: 'nowrap',
    minWidth: '56px',
  },
  progressTrack: {
    width: '80px',
    height: '6px',
    borderRadius: '3px',
    backgroundColor: THEME.bg.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    background: THEME.accent.gradient,
    transition: `width ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  selfManagingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: THEME.status.selfInitiated,
    padding: '6px 14px',
    borderRadius: RADIUS.full,
    border: `1px solid rgba(13, 148, 136, 0.2)`,
    backgroundColor: 'rgba(13, 148, 136, 0.06)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
  },
  selfManagingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: THEME.status.selfInitiated,
    animation: 'pulseDot 1.5s ease-in-out infinite',
  },
};
