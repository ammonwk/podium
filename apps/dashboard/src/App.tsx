import React, { useState, useCallback, useEffect, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { THEME } from '@apm/shared';
import { RADIUS, SHADOW, ANIMATION } from './styles/theme';
import { useSSE } from './hooks/useSSE';
import type { PropertyState, ToolCallData, EventState, ActivityItem } from './hooks/useSSE';
import { PropertyVillage } from './components/PropertyVillage';
import { PropertyDetail } from './components/PropertyDetail';
import { DemoControls } from './components/DemoControls';
import { ProviderToggle } from './components/ProviderToggle';
import { OperationsQueue } from './components/OperationsQueue';
import { FinancialBar } from './components/FinancialBar';
import { DrilldownModal } from './components/DrilldownModal';
import type { DrilldownData } from './components/DrilldownModal';
import { ChatWidget } from './components/ChatWidget';

// ─── Error Boundary ─────────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
          backgroundColor: THEME.bg.primary,
          fontFamily: THEME.font.sans,
        }}>
          <div style={{ fontSize: '32px' }}>🏠</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: THEME.text.accent }}>
            Something went wrong
          </div>
          <div style={{ fontSize: '14px', color: THEME.text.muted, maxWidth: '400px', textAlign: 'center' as const }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px',
              borderRadius: RADIUS.full,
              border: `1px solid ${THEME.bg.border}`,
              backgroundColor: THEME.bg.card,
              color: THEME.text.primary,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: THEME.font.sans,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── App ────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const state = useSSE();
  const [drilldown, setDrilldown] = useState<DrilldownData>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const closeDrilldown = useCallback(() => setDrilldown(null), []);

  const openPropertyView = useCallback((property: PropertyState) => {
    setSelectedPropertyId(property.id);
  }, []);

  const closePropertyView = useCallback(() => {
    setSelectedPropertyId(null);
  }, []);

  const openToolCallDrilldown = useCallback((toolCall: ToolCallData) => {
    setDrilldown({ type: 'tool_call', data: toolCall });
  }, []);

  const openEventDrilldown = useCallback((event: EventState) => {
    setDrilldown({ type: 'event', data: event });
  }, []);

  const selectedProperty = selectedPropertyId
    ? state.properties.find(p => p.id === selectedPropertyId) || null
    : null;

  // AI status text — now lane-aware
  const activeCount = state.events.filter(e => e.status === 'active').length;
  const doneCount = state.events.filter(e => e.status === 'done').length;

  // Track time since last action for self-managing phase
  const [lastActionAgo, setLastActionAgo] = useState('');
  useEffect(() => {
    if (state.demoPhase !== 'self-managing' || state.isProcessing) return;
    const getLastActionTime = () => {
      let latest = 0;
      for (const ev of state.events) {
        if (ev.completedAt) latest = Math.max(latest, new Date(ev.completedAt).getTime());
        if (ev.startedAt) latest = Math.max(latest, new Date(ev.startedAt).getTime());
        for (const tc of ev.toolCalls) {
          if (tc.timestamp) latest = Math.max(latest, new Date(tc.timestamp).getTime());
        }
      }
      return latest;
    };
    const tick = () => {
      const t = getLastActionTime();
      if (t > 0) {
        const secs = (Date.now() - t) / 1000;
        setLastActionAgo(secs < 60 ? `${secs.toFixed(1)}s` : `${Math.floor(secs / 60)}m ${Math.floor(secs % 60)}s`);
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [state.demoPhase, state.isProcessing, state.events]);

  const aiStatusText = state.isProcessing
    ? activeCount > 1
      ? `Handling ${activeCount} conversations...`
      : `Handling: ${state.events[state.activeEventIndex]?.name || 'event'}...`
    : state.demoPhase === 'self-managing'
    ? lastActionAgo ? `Last action ${lastActionAgo} ago` : 'AI active'
    : state.events.length > 0
    ? `${doneCount} conversation${doneCount !== 1 ? 's' : ''} handled`
    : 'Watching 3 properties';

  return (
    <ErrorBoundary>
      <div style={styles.root}>
        {/* ─── Top Navigation ─────────────────────────────────────────── */}
        <div style={styles.topNav}>
          <div style={styles.navLeft}>
            <span style={styles.logoIcon}>🏠</span>
            <span style={styles.logoText}>Homebase</span>
          </div>

          <div style={styles.navCenter}>
            <div style={styles.aiStatus}>
              <div
                style={{
                  ...styles.aiStatusDot,
                  backgroundColor: state.isProcessing
                    ? THEME.accent.violet
                    : state.demoPhase === 'self-managing'
                    ? THEME.status.selfInitiated
                    : THEME.status.normal,
                  animation: state.isProcessing
                    ? 'breathe 2s ease-in-out infinite'
                    : undefined,
                }}
              />
              <span style={styles.aiStatusText}>{aiStatusText}</span>
            </div>
          </div>

          <div style={styles.navRight}>
            <button
              style={styles.settingsButton}
              onClick={() => setShowSettings(true)}
              title="Owner Settings"
            >
              ⚙
            </button>
            <ProviderToggle
              providerConfig={state.providerConfig}
              onSwitch={state.switchProvider}
            />
            <DemoControls
              demoPhase={state.demoPhase}
              demoEventIndex={state.demoEventIndex}
              onRunDemo={state.runDemo}
              onEmptyDay={state.runEmptyDay}
              onResetDemo={state.resetDemo}
            />
          </div>
        </div>

        {/* ─── Main Content ───────────────────────────────────────────── */}
        <div style={styles.mainContent}>
          {selectedProperty ? (
            <PropertyDetail
              property={selectedProperty}
              activities={state.activities}
              onBack={closePropertyView}
              onResolveIssue={state.resolveIssue}
            />
          ) : (
            <>
              <PropertyVillage
                properties={state.properties}
                onPropertyClick={openPropertyView}
              />

              {/* Full-width AI Feed (operations queue) */}
              <div style={styles.aiFeedContainer}>
                <OperationsQueue
                  events={state.events}
                  isProcessing={state.isProcessing}
                  upcomingTasks={state.upcomingTasks}
                  onToolCardClick={openToolCallDrilldown}
                  onEventClick={openEventDrilldown}
                />
              </div>
            </>
          )}
        </div>

        {/* ─── Bottom Bar ─────────────────────────────────────────────── */}
        <FinancialBar financials={state.financials} />

        {/* ─── Settings Modal ──────────────────────────────────────────── */}
        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />

        {/* ─── Error Banner ───────────────────────────────────────────── */}
        {state.error && (
          <div style={styles.errorBanner}>
            <span>⚠</span>
            {state.error}
            <button
              style={styles.errorDismiss}
              onClick={() => state.clearError()}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="2" y1="2" x2="8" y2="8" />
                <line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </button>
          </div>
        )}

        {/* ─── Drilldown Modal ────────────────────────────────────────── */}
        <DrilldownModal data={drilldown} onClose={closeDrilldown} />

        {/* ─── Chat Widget ──────────────────────────────────────────────── */}
        <ChatWidget />
      </div>
    </ErrorBoundary>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: THEME.bg.primary,
    overflow: 'hidden',
    position: 'relative',
  },

  // Top navigation
  topNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 24px',
    flexShrink: 0,
    borderBottom: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.card,
    boxShadow: SHADOW.sm,
    zIndex: 10,
    position: 'relative',
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoIcon: {
    fontSize: '22px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 800,
    color: THEME.text.accent,
    letterSpacing: '-0.03em',
  },
  navCenter: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 14px',
    borderRadius: '9999px',
    backgroundColor: THEME.bg.primary,
    border: `1px solid ${THEME.bg.border}`,
  },
  aiStatusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    transition: `all ${ANIMATION.slow} ${ANIMATION.easeOut}`,
  },
  aiStatusText: {
    fontSize: '13px',
    fontWeight: 500,
    color: THEME.text.secondary,
    whiteSpace: 'nowrap' as const,
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  settingsButton: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.sm,
    color: THEME.text.secondary,
    fontSize: '18px',
    cursor: 'pointer',
    fontFamily: THEME.font.sans,
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },

  // Main content — single column, centered
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },

  // AI feed container — centered, full width
  aiFeedContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    padding: '0 24px',
  },

  // Error
  errorBanner: {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    border: '1px solid rgba(220, 38, 38, 0.2)',
    borderRadius: RADIUS.md,
    padding: '10px 18px',
    fontSize: '14px',
    color: THEME.status.emergency,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    zIndex: 500,
    animation: 'slideInFromBelow 0.2s ease-out',
    backdropFilter: 'blur(8px)',
    boxShadow: SHADOW.lg,
  },
  errorDismiss: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'transparent',
    border: '1px solid rgba(220, 38, 38, 0.25)',
    color: THEME.status.emergency,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: 1,
    marginLeft: '4px',
    fontFamily: THEME.font.sans,
    transition: 'background-color 0.15s ease',
  },
};

export default App;
