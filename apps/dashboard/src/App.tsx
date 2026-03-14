import React, { useState, useCallback } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, SHADOW, ANIMATION } from './styles/theme';
import { useSSE } from './hooks/useSSE';
import type { PropertyState, ToolCallData, EventState, ActivityItem } from './hooks/useSSE';
import { PropertyVillage } from './components/PropertyVillage';
import { PropertyDetail } from './components/PropertyDetail';
import { DemoControls } from './components/DemoControls';
import { ProviderToggle } from './components/ProviderToggle';
import { Stage } from './components/Stage';
import { ActivityFeed } from './components/ActivityFeed';
import { FinancialBar } from './components/FinancialBar';
import { DrilldownModal } from './components/DrilldownModal';
import type { DrilldownData } from './components/DrilldownModal';
import { ChatWidget } from './components/ChatWidget';

const App: React.FC = () => {
  const state = useSSE();
  const [drilldown, setDrilldown] = useState<DrilldownData>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

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

  const openActivityDrilldown = useCallback((activity: ActivityItem) => {
    setDrilldown({ type: 'activity', data: activity });
  }, []);

  const selectedProperty = selectedPropertyId
    ? state.properties.find(p => p.id === selectedPropertyId) || null
    : null;

  // AI status text for the top nav
  const aiStatusText = state.isProcessing
    ? `Handling: ${state.events[state.activeEventIndex]?.name || 'event'}...`
    : state.demoPhase === 'self-managing'
    ? 'AI is self-managing your properties'
    : state.events.length > 0
    ? `${state.events.filter(e => e.status === 'done').length} events handled`
    : 'Watching 3 properties';

  return (
    <div style={styles.root}>
      {/* ─── Top Navigation ───────────────────────────────────────────── */}
      <div style={styles.topNav}>
        <div style={styles.navLeft}>
          <div style={styles.logoContainer}>
            <span style={styles.logoIcon}>🏠</span>
            <span style={styles.logoText}>Homebase</span>
          </div>
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

      {/* ─── Main Content ─────────────────────────────────────────────── */}
      <div style={styles.mainContent}>
        {selectedProperty ? (
          /* Property Detail Drill-In */
          <PropertyDetail
            property={selectedProperty}
            activities={state.activities}
            onBack={closePropertyView}
          />
        ) : (
          /* Village + Panels */
          <>
            {/* 3D Property Village */}
            <PropertyVillage
              properties={state.properties}
              onPropertyClick={openPropertyView}
            />

            {/* Two-column layout: AI Panel + Activity Feed */}
            <div style={styles.panelsContainer}>
              <div style={styles.aiPanelWrapper}>
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
              <div style={styles.activityWrapper}>
                <ActivityFeed
                  activities={state.activities}
                  onActivityClick={openActivityDrilldown}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Bottom Bar ───────────────────────────────────────────────── */}
      <FinancialBar financials={state.financials} />

      {/* ─── Error Banner ─────────────────────────────────────────────── */}
      {state.error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠</span>
          {state.error}
          <button
            style={styles.errorDismiss}
            onClick={() => {/* Error auto-clears on reconnect */}}
          >
            ×
          </button>
        </div>
      )}

      {/* ─── Drilldown Modal ──────────────────────────────────────────── */}
      <DrilldownModal data={drilldown} onClose={closeDrilldown} />

      {/* ─── Chat Widget ──────────────────────────────────────────────── */}
      <ChatWidget />
    </div>
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
    padding: '12px 24px',
    flexShrink: 0,
    borderBottom: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.card,
    boxShadow: SHADOW.sm,
    zIndex: 10,
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoIcon: {
    fontSize: '24px',
  },
  logoText: {
    fontSize: '20px',
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
    padding: '6px 16px',
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

  // Main content
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '0 24px',
  },

  // Panels below village
  panelsContainer: {
    flex: 1,
    display: 'flex',
    gap: '20px',
    overflow: 'hidden',
    paddingBottom: '12px',
    minHeight: 0,
  },
  aiPanelWrapper: {
    flex: 2,
    minWidth: 0,
    display: 'flex',
  },
  activityWrapper: {
    flex: 1,
    minWidth: '300px',
    maxWidth: '380px',
    display: 'flex',
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
  errorIcon: {
    fontSize: '16px',
  },
  errorDismiss: {
    background: 'none',
    border: 'none',
    color: THEME.status.emergency,
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0 0 0 8px',
    fontFamily: THEME.font.sans,
    transition: 'opacity 0.15s ease',
  },
};

export default App;
