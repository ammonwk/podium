import React, { useState } from 'react';
import { THEME, TOOL_COLORS } from '@apm/shared';
import { RADIUS, ANIMATION } from '../styles/theme';
import type { ToolCallData } from '../hooks/useSSE';

interface Props {
  toolCall: ToolCallData;
  index: number;
  onClick: () => void;
}

export const ToolCard: React.FC<Props> = ({ toolCall, index, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const color = TOOL_COLORS[toolCall.tool_name] || '#6b7280';
  const isEmergency = (toolCall.input as Record<string, unknown>).severity === 'emergency';

  const cardStyle: React.CSSProperties = {
    ...styles.card,
    borderLeftColor: color,
    animation: `slideInFromBelow ${ANIMATION.normal} ${ANIMATION.easeOut} both`,
    animationDelay: `${index * 50}ms`,
    ...(hovered ? { backgroundColor: THEME.bg.cardHover } : {}),
    ...(isEmergency ? { animation: `slideInFromBelow ${ANIMATION.normal} ${ANIMATION.easeOut} both, emergencyPulse 2s ease-in-out infinite` } : {}),
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {renderToolContent(toolCall, color)}
    </div>
  );
};

function renderToolContent(toolCall: ToolCallData, color: string): React.ReactNode {
  const input = toolCall.input as Record<string, unknown>;
  const result = toolCall.result as Record<string, unknown>;

  switch (toolCall.tool_name) {
    case 'send_sms':
      return <SmsCard input={input} result={result} color={color} />;
    case 'create_work_order':
      return <WorkOrderCard input={input} result={result} color={color} />;
    case 'adjust_price':
      return <PriceAdjustCard input={input} result={result} color={color} />;
    case 'log_decision':
      return <DecisionCard input={input} result={result} color={color} />;
    case 'get_market_data':
      return <MarketDataCard input={input} result={result} color={color} />;
    case 'update_schedule':
      return <ScheduleUpdateCard input={input} result={result} color={color} />;
    case 'schedule_task':
      return <ScheduleTaskCard input={input} result={result} color={color} />;
    default:
      return <GenericCard toolName={toolCall.tool_name} input={input} result={result} />;
  }
}

// ─── SMS Card ────────────────────────────────────────────────────────────────

const SmsCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const recipientName = (result.recipient_name as string) || (input.to as string) || 'Guest';
  const message = (input.body as string) || '';
  const status = (result.status as string) || 'queued';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>SMS</span>
        <span style={styles.headerDetail}>→ {recipientName}</span>
      </div>
      <div style={styles.smsBubbleRow}>
        <div style={styles.smsBubble}>
          {message}
        </div>
      </div>
      <div style={styles.footer}>
        <span style={styles.footerStatus}>
          {status === 'delivered' ? '✓ Delivered' : status === 'queued' ? '● Queued' : '✗ Failed'}
        </span>
        <span style={styles.footerTimestamp}>{formatTime(result.timestamp as string)}</span>
      </div>
    </>
  );
};

// ─── Work Order Card ─────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, React.CSSProperties> = {
  emergency: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  high: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    color: '#f97316',
    border: '1px solid rgba(249, 115, 22, 0.3)',
  },
  medium: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    color: '#eab308',
    border: '1px solid rgba(234, 179, 8, 0.25)',
  },
  low: {
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
    color: '#9ca3af',
    border: '1px solid rgba(107, 114, 128, 0.25)',
  },
};

const WorkOrderCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const severity = (input.severity as string) || 'medium';
  const vendorName = (result.vendor_name as string) || 'Unknown Vendor';
  const vendorRating = (result.vendor_rating as number) || 0;
  const propertyName = (result.property_name as string) || (input.property_id as string) || '';
  const issue = (input.issue_description as string) || '';
  const cost = (input.estimated_cost as number) || (result.estimated_cost as number) || 0;
  const status = (result.status as string) || 'dispatched';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Work Order</span>
        <span style={{ ...styles.severityBadge, ...(SEVERITY_STYLES[severity] || SEVERITY_STYLES.medium) }}>
          {severity.toUpperCase()}
        </span>
      </div>
      <div style={styles.body}>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Vendor</span>
          <span style={styles.bodyValue}>
            {vendorName} <span style={{ color: '#eab308' }}>{'★'.repeat(Math.round(vendorRating))}</span>
            <span style={styles.bodyMuted}> {vendorRating.toFixed(1)}</span>
          </span>
        </div>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Property</span>
          <span style={styles.bodyValue}>{propertyName}</span>
        </div>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Issue</span>
          <span style={styles.bodyValue}>{issue}</span>
        </div>
      </div>
      <div style={styles.footer}>
        <span style={styles.footerCost}>${cost.toLocaleString()}</span>
        <span style={styles.footerStatus}>{status}</span>
      </div>
    </>
  );
};

// ─── Price Adjustment Card ───────────────────────────────────────────────────

const PriceAdjustCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const propertyId = (result.property_id as string) || (input.property_id as string) || '';
  const propertyName = (result.property_name as string) || propertyId;
  const previousPrice = (result.previous_price as number) || 0;
  const newPrice = (result.new_price as number) || (input.new_price as number) || 0;
  const percentChange = (result.percent_change as string) || '';
  const isIncrease = newPrice > previousPrice;
  const reason = (input.reason as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Price Adjustment</span>
      </div>
      <div style={styles.priceBody}>
        <div style={styles.pricePropertyName}>{propertyName}</div>
        <div style={styles.priceNumbers}>
          <span style={styles.priceOld}>${previousPrice}</span>
          <span style={styles.priceArrow}>→</span>
          <span style={styles.priceNew}>${newPrice}</span>
        </div>
        {percentChange && (
          <div
            style={{
              ...styles.priceDelta,
              color: isIncrease ? THEME.status.normal : THEME.status.emergency,
            }}
          >
            {isIncrease ? '▲' : '▼'} {percentChange}
          </div>
        )}
        {reason && (
          <div style={styles.priceReason}>{reason}</div>
        )}
      </div>
    </>
  );
};

// ─── Decision Card ───────────────────────────────────────────────────────────

const CONFIDENCE_COLORS: Record<string, { bg: string; color: string }> = {
  high: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  medium: { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308' },
  low: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
};

const DecisionCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const [expanded, setExpanded] = useState(false);
  const category = (input.category as string) || (result.category as string) || '';
  const confidence = (input.confidence as string) || 'medium';
  const summary = (input.summary as string) || (result.summary as string) || '';
  const caveat = (input.confidence_caveat as string) || '';
  const confStyle = CONFIDENCE_COLORS[confidence] || CONFIDENCE_COLORS.medium;

  const truncatedSummary = summary.length > 200 && !expanded
    ? summary.substring(0, 200) + '...'
    : summary;

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Decision</span>
        {category && (
          <span style={styles.categoryBadge}>{category}</span>
        )}
        <span
          style={{
            ...styles.confidenceBadge,
            backgroundColor: confStyle.bg,
            color: confStyle.color,
            border: `1px solid ${confStyle.color}30`,
          }}
        >
          {confidence}
        </span>
      </div>
      <div style={styles.body}>
        <div style={styles.decisionSummary}>
          {truncatedSummary}
          {summary.length > 200 && (
            <button
              style={styles.showMoreBtn}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? 'show less' : 'show more'}
            </button>
          )}
        </div>
      </div>
      {caveat && (
        <div style={styles.footer}>
          <span style={styles.footerCaveat}>{caveat}</span>
        </div>
      )}
    </>
  );
};

// ─── Market Data Card ────────────────────────────────────────────────────────

const MarketDataCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ result, color }) => {
  const location = (result.location as string) || '';
  const competitorRate = (result.avg_competitor_rate as number) || 0;
  const occupancy = (result.occupancy_percent as number) || 0;
  const localEvents = (result.local_events as string) || '';
  const properties = (result.your_properties as Array<{ id: string; name: string; current_price: number; gap: string }>) || [];

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Market Data</span>
        {location && <span style={styles.headerDetail}>{location}</span>}
      </div>
      <div style={styles.body}>
        <div style={styles.marketMetrics}>
          <div style={styles.marketMetric}>
            <span style={styles.marketMetricValue}>${competitorRate}</span>
            <span style={styles.marketMetricLabel}>Avg Competitor</span>
          </div>
          <div style={styles.marketMetric}>
            <span style={styles.marketMetricValue}>{occupancy}%</span>
            <span style={styles.marketMetricLabel}>Occupancy</span>
          </div>
        </div>
        {localEvents && (
          <div style={styles.marketEvents}>
            <span style={styles.bodyMuted}>Events: </span>{localEvents}
          </div>
        )}
        {properties.length > 0 && (
          <div style={styles.marketProperties}>
            {properties.map(p => (
              <div key={p.id} style={styles.marketPropertyRow}>
                <span style={styles.bodyValue}>{p.name}</span>
                <span style={styles.bodyMuted}>${p.current_price}</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: p.gap.startsWith('-') ? THEME.status.emergency : THEME.status.normal,
                }}>
                  {p.gap}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// ─── Schedule Update Card ────────────────────────────────────────────────────

const ScheduleUpdateCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const propertyName = (result.property_name as string) || (input.property_id as string) || '';
  const eventType = (result.event_type as string) || (input.event_type as string) || '';
  const oldTime = (result.old_time as string) || (input.original_time as string) || '';
  const newTime = (result.new_time as string) || (input.new_time as string) || '';
  const downstream = (result.downstream as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Schedule Update</span>
      </div>
      <div style={styles.body}>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>{propertyName}</span>
        </div>
        <div style={styles.scheduleChange}>
          <span style={styles.scheduleType}>{eventType}:</span>
          <span style={styles.scheduleOld}>{oldTime}</span>
          <span style={styles.scheduleArrow}>→</span>
          <span style={styles.scheduleNew}>{newTime}</span>
        </div>
      </div>
      {downstream && (
        <div style={styles.footer}>
          <span style={styles.footerImpact}>↳ {downstream}</span>
        </div>
      )}
    </>
  );
};

// ─── Schedule Task Card ──────────────────────────────────────────────────────

const ScheduleTaskCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const description = (result.description as string) || (input.task_description as string) || '';
  const firesIn = (result.fires_in as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>
          ⏰ Scheduled Task
        </span>
      </div>
      <div style={{ ...styles.body, borderStyle: 'dashed', borderColor: `${color}30`, borderWidth: '1px', borderRadius: RADIUS.sm, padding: '10px' }}>
        <div style={styles.bodyValue}>{description}</div>
      </div>
      {firesIn && (
        <div style={styles.footer}>
          <span style={{ color, fontSize: '12px', fontWeight: 500 }}>
            Fires in {firesIn}
          </span>
        </div>
      )}
    </>
  );
};

// ─── Generic Card ────────────────────────────────────────────────────────────

const GenericCard: React.FC<{
  toolName: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}> = ({ toolName, input }) => {
  return (
    <>
      <div style={styles.header}>
        <span style={styles.headerLabel}>{toolName}</span>
      </div>
      <div style={styles.body}>
        <pre style={styles.genericPre}>
          {JSON.stringify(input, null, 2)}
        </pre>
      </div>
    </>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderLeft: `3px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.md,
    padding: '12px 16px',
    cursor: 'pointer',
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  headerLabel: {
    fontSize: '13px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  headerDetail: {
    fontSize: '13px',
    color: THEME.text.secondary,
    fontWeight: 500,
  },
  severityBadge: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: '4px',
    letterSpacing: '0.05em',
  },
  categoryBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: '4px',
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
    color: THEME.text.secondary,
    border: '1px solid rgba(107, 114, 128, 0.2)',
    textTransform: 'capitalize' as const,
  },
  confidenceBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: '4px',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  bodyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  bodyLabel: {
    fontSize: '12px',
    color: THEME.text.muted,
    minWidth: '60px',
    flexShrink: 0,
  },
  bodyValue: {
    fontSize: '14px',
    color: THEME.text.primary,
    lineHeight: '1.4',
  },
  bodyMuted: {
    fontSize: '12px',
    color: THEME.text.muted,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    paddingTop: '4px',
    borderTop: `1px solid ${THEME.bg.border}`,
  },
  footerStatus: {
    fontSize: '12px',
    color: THEME.text.muted,
    fontWeight: 500,
  },
  footerTimestamp: {
    fontSize: '11px',
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
  },
  footerCost: {
    fontSize: '16px',
    fontWeight: 700,
    color: THEME.text.accent,
  },
  footerCaveat: {
    fontSize: '12px',
    color: THEME.text.muted,
    fontStyle: 'italic',
    lineHeight: '1.4',
  },
  footerImpact: {
    fontSize: '12px',
    color: THEME.text.secondary,
    lineHeight: '1.4',
  },

  // SMS specific
  smsBubbleRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  smsBubble: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '12px 12px 2px 12px',
    padding: '8px 12px',
    fontSize: '14px',
    color: THEME.text.primary,
    maxWidth: '85%',
    lineHeight: '1.45',
  },

  // Price specific
  priceBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'flex-start',
  },
  pricePropertyName: {
    fontSize: '13px',
    color: THEME.text.secondary,
    fontWeight: 500,
  },
  priceNumbers: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  priceOld: {
    fontSize: '20px',
    color: THEME.text.muted,
    fontWeight: 500,
    textDecoration: 'line-through',
    fontFamily: THEME.font.mono,
  },
  priceArrow: {
    fontSize: '18px',
    color: THEME.text.muted,
  },
  priceNew: {
    fontSize: '24px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
  },
  priceDelta: {
    fontSize: '16px',
    fontWeight: 700,
  },
  priceReason: {
    fontSize: '12px',
    color: THEME.text.muted,
    lineHeight: '1.4',
    marginTop: '2px',
  },

  // Decision specific
  decisionSummary: {
    fontSize: '14px',
    color: THEME.text.primary,
    lineHeight: '1.5',
  },
  showMoreBtn: {
    display: 'inline',
    marginLeft: '4px',
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: THEME.font.sans,
    padding: 0,
  },

  // Market data specific
  marketMetrics: {
    display: 'flex',
    gap: '20px',
    marginBottom: '4px',
  },
  marketMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  marketMetricValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
  },
  marketMetricLabel: {
    fontSize: '11px',
    color: THEME.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  marketEvents: {
    fontSize: '13px',
    color: THEME.text.secondary,
    lineHeight: '1.4',
  },
  marketProperties: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    marginTop: '4px',
  },
  marketPropertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    fontSize: '13px',
  },

  // Schedule specific
  scheduleChange: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    flexWrap: 'wrap',
  },
  scheduleType: {
    fontSize: '13px',
    color: THEME.text.secondary,
    fontWeight: 500,
    textTransform: 'capitalize' as const,
  },
  scheduleOld: {
    fontSize: '16px',
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
    textDecoration: 'line-through',
  },
  scheduleArrow: {
    fontSize: '16px',
    color: '#8b5cf6',
  },
  scheduleNew: {
    fontSize: '16px',
    fontWeight: 600,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
  },

  // Generic
  genericPre: {
    fontSize: '12px',
    color: THEME.text.secondary,
    fontFamily: THEME.font.mono,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: '1.4',
    maxHeight: '100px',
    overflow: 'auto',
  },
};
