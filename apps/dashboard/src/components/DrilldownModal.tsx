import React, { useEffect, useCallback } from 'react';
import { THEME, TOOL_COLORS } from '@apm/shared';
import { RADIUS, ANIMATION, SHADOW } from '../styles/theme';
import type { PropertyState, EventState, ToolCallData, ActivityItem } from '../hooks/useSSE';

type DrilldownData =
  | { type: 'property'; data: PropertyState }
  | { type: 'event'; data: EventState }
  | { type: 'tool_call'; data: ToolCallData }
  | { type: 'activity'; data: ActivityItem }
  | null;

interface Props {
  data: DrilldownData;
  onClose: () => void;
}

export type { DrilldownData };

export const DrilldownModal: React.FC<Props> = ({ data, onClose }) => {
  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!data) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button style={styles.closeButton} onClick={onClose}>
          ×
        </button>

        {/* Content */}
        <div style={styles.content}>
          {data.type === 'property' && <PropertyDetail property={data.data} />}
          {data.type === 'event' && <EventDetail event={data.data} />}
          {data.type === 'tool_call' && <ToolCallDetail toolCall={data.data} />}
          {data.type === 'activity' && <ActivityDetail activity={data.data} />}
        </div>
      </div>
    </div>
  );
};

// ─── Property Detail ─────────────────────────────────────────────────────────

const PropertyDetail: React.FC<{ property: PropertyState }> = ({ property }) => {
  const statusColors: Record<string, string> = {
    normal: THEME.status.normal,
    attention: THEME.status.attention,
    emergency: THEME.status.emergency,
  };

  return (
    <>
      <div style={styles.detailHeader}>
        <h2 style={styles.detailTitle}>{property.name}</h2>
        <div
          style={{
            ...styles.statusPill,
            backgroundColor: `${statusColors[property.status] || THEME.text.muted}15`,
            color: statusColors[property.status] || THEME.text.muted,
          }}
        >
          {property.status}
        </div>
      </div>

      <div style={styles.detailGrid}>
        <DetailRow label="Location" value={property.location} />
        <DetailRow label="ID" value={property.id} mono />
        <DetailRow
          label="Current Price"
          value={`$${property.current_price}/night`}
          highlight
        />
        <DetailRow label="Base Price" value={`$${property.base_price}/night`} />
        <DetailRow
          label="Rating"
          value={`★ ${property.rating} (${property.review_count} reviews)`}
        />
        <DetailRow label="Guest Flow" value={property.guestFlow} />
      </div>

      {property.activeIssues.length > 0 && (
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Active Issues</h3>
          {property.activeIssues.map((issue, i) => (
            <div key={`issue-${i}`} style={styles.issueItem}>
              <span style={styles.issueDot}>●</span> {issue}
            </div>
          ))}
        </div>
      )}

      {property.schedule.length > 0 && (
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Schedule</h3>
          {property.schedule.map((seg, i) => (
            <div key={`sched-${seg.type}-${i}`} style={styles.scheduleRow}>
              <span style={{
                ...styles.scheduleType,
                color: seg.type === 'checkout' ? '#2563EB'
                  : seg.type === 'cleaning' ? '#B45309'
                  : seg.type === 'checkin' ? '#047857'
                  : '#B91C1C',
              }}>
                {seg.type}
              </span>
              <span style={styles.scheduleRange}>{seg.start}% – {seg.end}%</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ─── Event Detail ────────────────────────────────────────────────────────────

const EventDetail: React.FC<{ event: EventState }> = ({ event }) => {
  return (
    <>
      <div style={styles.detailHeader}>
        <h2 style={styles.detailTitle}>{event.name}</h2>
        <div
          style={{
            ...styles.statusPill,
            backgroundColor: event.status === 'done'
              ? `${THEME.status.normal}15`
              : event.status === 'active'
              ? 'rgba(59, 130, 246, 0.10)'
              : 'rgba(107, 114, 128, 0.10)',
            color: event.status === 'done'
              ? THEME.status.normal
              : event.status === 'active'
              ? '#2563EB'
              : THEME.text.muted,
          }}
        >
          {event.status}
        </div>
      </div>

      <div style={styles.detailGrid}>
        <DetailRow label="Source" value={event.source} />
        {event.startedAt && <DetailRow label="Started" value={new Date(event.startedAt).toLocaleTimeString()} mono />}
        {event.completedAt && <DetailRow label="Completed" value={new Date(event.completedAt).toLocaleTimeString()} mono />}
      </div>

      {event.thinkingText && (
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Reasoning</h3>
          <pre style={styles.codeBlock}>{event.thinkingText}</pre>
        </div>
      )}

      {event.toolCalls.length > 0 && (
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Tool Calls ({event.toolCalls.length})</h3>
          {event.toolCalls.map((tc) => (
            <div key={tc.id} style={styles.toolCallSummary}>
              <div style={{
                ...styles.toolCallName,
                color: TOOL_COLORS[tc.tool_name] || THEME.text.secondary,
              }}>
                {tc.tool_name}
              </div>
              <pre style={styles.miniCodeBlock}>{JSON.stringify(tc.input, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ─── Tool Call Detail ────────────────────────────────────────────────────────

const ToolCallDetail: React.FC<{ toolCall: ToolCallData }> = ({ toolCall }) => {
  const color = TOOL_COLORS[toolCall.tool_name] || THEME.text.secondary;

  return (
    <>
      <div style={styles.detailHeader}>
        <h2 style={{ ...styles.detailTitle, color }}>{toolCall.tool_name}</h2>
      </div>

      <div style={styles.detailGrid}>
        <DetailRow label="Event" value={toolCall.event_name} />
        <DetailRow label="Timestamp" value={new Date(toolCall.timestamp).toLocaleTimeString()} mono />
      </div>

      <div style={styles.detailSection}>
        <h3 style={styles.sectionTitle}>Input</h3>
        <SyntaxHighlightedJson data={toolCall.input} />
      </div>

      <div style={styles.detailSection}>
        <h3 style={styles.sectionTitle}>Result</h3>
        <SyntaxHighlightedJson data={toolCall.result} />
      </div>
    </>
  );
};

// ─── Activity Detail ─────────────────────────────────────────────────────────

const ActivityDetail: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
  return (
    <>
      <div style={styles.detailHeader}>
        <h2 style={styles.detailTitle}>{activity.type.replace(/_/g, ' ')}</h2>
        <div style={styles.statusPill}>{activity.eventName}</div>
      </div>

      <div style={styles.detailGrid}>
        <DetailRow label="Type" value={activity.type} />
        <DetailRow label="Time" value={new Date(activity.timestamp).toLocaleTimeString()} mono />
      </div>

      <div style={styles.detailSection}>
        <h3 style={styles.sectionTitle}>Data</h3>
        <SyntaxHighlightedJson data={activity.data} />
      </div>
    </>
  );
};

// ─── Shared Components ───────────────────────────────────────────────────────

const DetailRow: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}> = ({ label, value, mono, highlight }) => (
  <div style={styles.detailRow}>
    <span style={styles.detailLabel}>{label}</span>
    <span
      style={{
        ...styles.detailValue,
        fontFamily: mono ? THEME.font.mono : THEME.font.sans,
        color: highlight ? THEME.text.accent : THEME.text.primary,
        fontWeight: highlight ? 600 : 400,
      }}
    >
      {value}
    </span>
  </div>
);

const SyntaxHighlightedJson: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const json = JSON.stringify(data, null, 2);
  // Light-theme syntax highlighting
  const highlighted = json
    .replace(/"([^"]+)":/g, '<span style="color: #7C3AED">"$1"</span>:')
    .replace(/: "([^"]*?)"/g, ': <span style="color: #059669">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span style="color: #3B82F6">$1</span>')
    .replace(/: (true|false)/g, ': <span style="color: #D97706">$1</span>')
    .replace(/: (null)/g, ': <span style="color: #DC2626">$1</span>');

  return (
    <pre
      style={styles.codeBlock}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: `modalOverlayIn ${ANIMATION.normal} ${ANIMATION.easeOut}`,
    backdropFilter: 'blur(8px)',
  },
  panel: {
    backgroundColor: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.xl,
    maxWidth: '700px',
    width: '90%',
    maxHeight: '80vh',
    position: 'relative',
    animation: `modalPanelIn ${ANIMATION.normal} ${ANIMATION.easeOut}`,
    boxShadow: SHADOW.xl,
    display: 'flex',
    flexDirection: 'column',
  },
  closeButton: {
    position: 'absolute',
    top: '12px',
    right: '16px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.sm,
    color: THEME.text.primary,
    fontSize: '20px',
    cursor: 'pointer',
    zIndex: 1,
    fontFamily: THEME.font.sans,
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  detailTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: THEME.text.accent,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  statusPill: {
    fontSize: '14px',
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(107, 114, 128, 0.10)',
    color: THEME.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  detailGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
  },
  detailLabel: {
    fontSize: '14px',
    color: THEME.text.muted,
    fontWeight: 500,
    minWidth: '100px',
    flexShrink: 0,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  detailValue: {
    fontSize: '15px',
    color: THEME.text.primary,
    lineHeight: '1.4',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: THEME.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    margin: 0,
  },
  codeBlock: {
    backgroundColor: '#F9FAFB',
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.sm,
    padding: '14px 16px',
    fontFamily: THEME.font.mono,
    fontSize: '14px',
    lineHeight: '1.55',
    color: THEME.text.primary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '300px',
    overflowY: 'auto',
    margin: 0,
  },
  miniCodeBlock: {
    backgroundColor: '#F9FAFB',
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: '4px',
    padding: '8px 10px',
    fontFamily: THEME.font.mono,
    fontSize: '14px',
    lineHeight: '1.4',
    color: THEME.text.secondary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '120px',
    overflowY: 'auto',
    margin: '4px 0 0',
  },
  issueItem: {
    fontSize: '15px',
    color: THEME.text.primary,
    lineHeight: '1.4',
    padding: '4px 0',
  },
  issueDot: {
    color: THEME.status.attention,
    fontSize: '10px',
    marginRight: '6px',
  },
  scheduleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '3px 0',
  },
  scheduleType: {
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'capitalize' as const,
    minWidth: '90px',
  },
  scheduleRange: {
    fontSize: '14px',
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
  },
  toolCallSummary: {
    padding: '8px 0',
    borderBottom: `1px solid ${THEME.bg.border}`,
  },
  toolCallName: {
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginBottom: '4px',
  },
};
