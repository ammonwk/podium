import React, { useState, useCallback, Component } from 'react';
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
import { Stage } from './components/Stage';
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

  // AI status text
  const aiStatusText = state.isProcessing
    ? `Handling: ${state.events[state.activeEventIndex]?.name || 'event'}...`
    : state.demoPhase === 'self-managing'
    ? 'AI is self-managing your properties'
    : state.events.length > 0
    ? `${state.events.filter(e => e.status === 'done').length} events handled`
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
            />
          ) : (
            <>
              {/* Compact Property Strip */}
              <PropertyVillage
                properties={state.properties}
                onPropertyClick={openPropertyView}
              />

              {/* Full-width AI Feed (center stage) */}
              <div style={styles.aiFeedContainer}>
                <Stage
                  events={state.events}
                  activeEventIndex={state.activeEventIndex}
                  isProcessing={state.isProcessing}
                  upcomingTasks={state.upcomingTasks}
                  onToolCardClick={openToolCallDrilldown}
                  onEventClick={openEventDrilldown}
                  onSelectEvent={state.selectEvent}
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
              onClick={() => {/* Error auto-clears on reconnect */}}
            >
              ×
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
    overflow: 'hidden',
  },

  // AI feed container — centered, full width
  aiFeedContainer: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    padding: '0 24px',
    marginTop: '24px',
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
    background: 'none',
    border: 'none',
    color: THEME.status.emergency,
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0 0 0 8px',
    fontFamily: THEME.font.sans,
  },
};

export default App;
