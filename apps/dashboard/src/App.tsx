import React, { useState, useCallback } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS } from './styles/theme';
import { useSSE } from './hooks/useSSE';
import type { PropertyState, ToolCallData, EventState, ActivityItem } from './hooks/useSSE';
import { PropertyStrip } from './components/PropertyStrip';
import { DemoControls } from './components/DemoControls';
import { ProviderToggle } from './components/ProviderToggle';
import { EventTimeline } from './components/EventTimeline';
import { Stage } from './components/Stage';
import { ActivityFeed } from './components/ActivityFeed';
import { FinancialBar } from './components/FinancialBar';
import { DrilldownModal } from './components/DrilldownModal';
import type { DrilldownData } from './components/DrilldownModal';

const App: React.FC = () => {
  const state = useSSE();
  const [drilldown, setDrilldown] = useState<DrilldownData>(null);

  const closeDrilldown = useCallback(() => setDrilldown(null), []);

  const openPropertyDrilldown = useCallback((property: PropertyState) => {
    setDrilldown({ type: 'property', data: property });
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

  return (
    <div style={styles.root}>
      {/* ─── Top Strip ──────────────────────────────────────────────────── */}
      <div style={styles.topStrip}>
        <PropertyStrip
          properties={state.properties}
          onPropertyClick={openPropertyDrilldown}
        />
        <div style={styles.topControls}>
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

      {/* ─── Main Workspace ─────────────────────────────────────────────── */}
      <div style={styles.workspace}>
        <EventTimeline
          events={state.events}
          activeEventIndex={state.activeEventIndex}
          upcomingTasks={state.upcomingTasks}
          onSelectEvent={state.selectEvent}
        />
        <Stage
          events={state.events}
          activeEventIndex={state.activeEventIndex}
          isProcessing={state.isProcessing}
          onToolCardClick={openToolCallDrilldown}
          onEventClick={openEventDrilldown}
        />
        <ActivityFeed
          activities={state.activities}
          onActivityClick={openActivityDrilldown}
        />
      </div>

      {/* ─── Bottom Bar ─────────────────────────────────────────────────── */}
      <FinancialBar financials={state.financials} />

      {/* ─── Error Banner ───────────────────────────────────────────────── */}
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

      {/* ─── Drilldown Modal ────────────────────────────────────────────── */}
      <DrilldownModal data={drilldown} onClose={closeDrilldown} />
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

  // Top strip
  topStrip: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '16px',
    padding: '12px 16px',
    flexShrink: 0,
    borderBottom: `1px solid ${THEME.bg.border}`,
    minHeight: '96px',
  },
  topControls: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: '6px',
    flexShrink: 0,
  },

  // Main workspace
  workspace: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    margin: '0 12px',
    gap: '0',
    borderRadius: RADIUS.lg,
    border: `1px solid ${THEME.bg.border}`,
  },

  // Error
  errorBanner: {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: RADIUS.sm,
    padding: '8px 16px',
    fontSize: '13px',
    color: THEME.status.emergency,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 500,
    animation: 'slideInFromBelow 0.2s ease-out',
  },
  errorIcon: {
    fontSize: '14px',
  },
  errorDismiss: {
    background: 'none',
    border: 'none',
    color: THEME.status.emergency,
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 0 0 8px',
    fontFamily: THEME.font.sans,
  },
};

export default App;
