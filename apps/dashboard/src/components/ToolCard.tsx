import React, { useState } from 'react';
import { THEME, TOOL_COLORS } from '@apm/shared';
import { RADIUS, ANIMATION, SHADOW } from '../styles/theme';
import type { ToolCallData } from '../hooks/useSSE';

interface Props {
  toolCall: ToolCallData;
  index: number;
  onClick: () => void;
}

export const ToolCard: React.FC<Props> = ({ toolCall, index, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const color = TOOL_COLORS[toolCall.tool_name] || '#6b7280';
  const isEmergency = (toolCall.input as Record<string, unknown> | undefined)?.severity === 'emergency';

  const cardStyle: React.CSSProperties = {
    ...styles.card,
    borderLeftColor: color,
    animation: `toolCardSlideIn ${ANIMATION.slow} ${ANIMATION.easeOut} both`,
    animationDelay: `${index * 80}ms`,
    ...(hovered ? { backgroundColor: THEME.bg.cardHover, transform: 'translateY(-1px)', boxShadow: SHADOW.md } : {}),
    ...(isEmergency ? { animation: `toolCardSlideIn ${ANIMATION.slow} ${ANIMATION.easeOut} both, emergencyPulse 2s ease-in-out infinite` } : {}),
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

export function renderToolContent(toolCall: ToolCallData, color: string): React.ReactNode {
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
    case 'get_property_status':
      return <PropertyStatusCard input={input} result={result} color={color} />;
    case 'lookup_guest':
      return <LookupGuestCard input={input} result={result} color={color} />;
    case 'query_database':
      return <QueryDatabaseCard input={input} result={result} color={color} />;
    case 'report_maintenance_issue':
      return <ReportMaintenanceCard input={input} result={result} color={color} />;
    case 'create_booking':
      return <CreateBookingCard input={input} result={result} color={color} />;
    case 'edit_booking':
      return <EditBookingCard input={input} result={result} color={color} />;
    case 'escalate_to_owner':
      return <EscalateCard input={input} result={result} color={color} />;
    case 'send_payment_link':
      return <PaymentLinkCard input={input} result={result} color={color} />;
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
        <span style={{
          ...styles.footerStatus,
          color: status === 'delivered' ? THEME.status.normal
               : status === 'queued' ? THEME.text.muted
               : THEME.status.emergency,
        }}>
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: THEME.status.emergency,
    border: '1px solid rgba(239, 68, 68, 0.2)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  high: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    color: '#EA580C',
    border: '1px solid rgba(249, 115, 22, 0.18)',
  },
  medium: {
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    color: THEME.status.attention,
    border: '1px solid rgba(234, 179, 8, 0.18)',
  },
  low: {
    backgroundColor: 'rgba(107, 114, 128, 0.08)',
    color: THEME.text.secondary,
    border: '1px solid rgba(107, 114, 128, 0.15)',
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
            {vendorName} <span style={{ color: THEME.status.attention }}>{'★'.repeat(Math.round(vendorRating))}</span>
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
            <span style={{
              display: 'inline-block',
              animation: 'deltaArrowBounce 0.6s ease-out',
            }}>
              {isIncrease ? '▲' : '▼'}
            </span>
            {' '}{percentChange}
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

const CONFIDENCE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  high: { bg: 'rgba(34, 197, 94, 0.08)', color: THEME.status.normal, border: 'rgba(34, 197, 94, 0.18)' },
  medium: { bg: 'rgba(234, 179, 8, 0.08)', color: THEME.status.attention, border: 'rgba(234, 179, 8, 0.18)' },
  low: { bg: 'rgba(239, 68, 68, 0.08)', color: THEME.status.emergency, border: 'rgba(239, 68, 68, 0.18)' },
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
            border: `1px solid ${confStyle.border}`,
          }}
        >
          {(confidence ?? 'medium').charAt(0).toUpperCase() + (confidence ?? 'medium').slice(1)}
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
                  fontSize: '14px',
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
          <span style={styles.schedulePropertyName}>{propertyName}</span>
        </div>
        <div style={styles.scheduleChange}>
          <span style={styles.scheduleType}>{eventType}:</span>
          <span style={styles.scheduleOld}>{oldTime}</span>
          <span style={{ ...styles.scheduleArrow, color }}>→</span>
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
          Scheduled Task
        </span>
        <span style={styles.scheduledTaskClock}>⏱</span>
      </div>
      <div style={styles.scheduledTaskBody}>
        <div style={styles.scheduledTaskDescription}>{description}</div>
      </div>
      {firesIn && (
        <div style={styles.footer}>
          <span style={{
            color,
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: THEME.font.mono,
            letterSpacing: '-0.01em',
          }}>
            Fires in {firesIn}
          </span>
        </div>
      )}
    </>
  );
};

// ─── Property Status Card ─────────────────────────────────────────────────────

const PropertyStatusCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const properties = (result.properties as Array<Record<string, unknown>>) || [];
  const propertyId = (input.property_id as string) || '';
  const checkStart = (input.check_availability_start as string) || '';
  const checkEnd = (input.check_availability_end as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Property Status</span>
        {propertyId && <span style={styles.headerDetail}>{propertyId}</span>}
      </div>
      <div style={styles.body}>
        {(checkStart || checkEnd) && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Checking</span>
            <span style={styles.bodyValue}>{checkStart} — {checkEnd}</span>
          </div>
        )}
        {properties.map((p, i) => (
          <div key={i} style={{ ...styles.bodyRow, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={styles.bodyValue}>
              {(p.property_name as string) || (p.property_id as string)}
              {' '}
              <span style={styles.bodyMuted}>${p.current_price as number}/night</span>
            </span>
            {(p.available_windows as Array<Record<string, unknown>>)?.length > 0 && (
              <span style={{ fontSize: 13, color: THEME.status.normal }}>
                {(p.available_windows as Array<Record<string, unknown>>).length} available window(s)
              </span>
            )}
            {(p.bookings as Array<Record<string, unknown>>)?.length > 0 && (
              <span style={styles.bodyMuted}>
                {(p.bookings as Array<Record<string, unknown>>).length} booking(s)
              </span>
            )}
          </div>
        ))}
        {properties.length === 0 && (
          <span style={styles.bodyMuted}>No properties returned</span>
        )}
      </div>
    </>
  );
};

// ─── Lookup Guest Card ────────────────────────────────────────────────────────

const LookupGuestCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const guestName = (result.guest_name as string) || (input.guest_phone as string) || 'Unknown';
  const phone = (input.guest_phone as string) || (input.phone as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Lookup Guest</span>
      </div>
      <div style={styles.body}>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Guest</span>
          <span style={styles.bodyValue}>{guestName}</span>
        </div>
        {phone && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Phone</span>
            <span style={{ ...styles.bodyValue, fontFamily: THEME.font.mono }}>{phone}</span>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Query Database Card ──────────────────────────────────────────────────────

const QueryDatabaseCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const collection = (input.collection as string) || '';
  const operation = (input.operation as string) || '';
  const count = (result.count as number) ?? '?';
  const filterObj = input.filter as Record<string, unknown> | undefined;
  const filterKeys = filterObj && typeof filterObj === 'object' ? Object.keys(filterObj) : [];

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Database Query</span>
        <span style={styles.categoryBadge}>{collection}</span>
      </div>
      <div style={styles.body}>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Operation</span>
          <span style={styles.bodyValue}>{operation}</span>
        </div>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Results</span>
          <span style={{ ...styles.bodyValue, fontFamily: THEME.font.mono, fontWeight: 700 }}>{count}</span>
        </div>
        {filterKeys.length > 0 && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Filter</span>
            <span style={styles.bodyMuted}>{filterKeys.join(', ')}</span>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Report Maintenance Card ──────────────────────────────────────────────────

const ReportMaintenanceCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const severity = (input.severity as string) || 'medium';
  const category = (input.category as string) || '';
  const issue = (input.issue_description as string) || '';
  const propertyName = (result.property_name as string) || (input.property_id as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Maintenance Report</span>
        <span style={{ ...styles.severityBadge, ...(SEVERITY_STYLES[severity] || SEVERITY_STYLES.medium) }}>
          {severity.toUpperCase()}
        </span>
      </div>
      <div style={styles.body}>
        {propertyName && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Property</span>
            <span style={styles.bodyValue}>{propertyName}</span>
          </div>
        )}
        {category && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Category</span>
            <span style={{ ...styles.bodyValue, textTransform: 'capitalize' as const }}>{category}</span>
          </div>
        )}
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Issue</span>
          <span style={styles.bodyValue}>{issue}</span>
        </div>
      </div>
    </>
  );
};

// ─── Create Booking Card ──────────────────────────────────────────────────────

const CreateBookingCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const guestName = (result.guest_name as string) || (input.guest_name as string) || '';
  const propertyName = (result.property_name as string) || (input.property_id as string) || '';
  const checkIn = (result.check_in as string) || (input.check_in as string) || '';
  const checkOut = (result.check_out as string) || (input.check_out as string) || '';
  const nights = (result.nights as number) || 0;
  const total = (result.total_estimate as number) || 0;

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>New Booking</span>
      </div>
      <div style={styles.body}>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Guest</span>
          <span style={styles.bodyValue}>{guestName}</span>
        </div>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Property</span>
          <span style={styles.bodyValue}>{propertyName}</span>
        </div>
        <div style={styles.bodyRow}>
          <span style={styles.bodyLabel}>Dates</span>
          <span style={styles.bodyValue}>{checkIn} — {checkOut}</span>
        </div>
      </div>
      <div style={styles.footer}>
        {nights > 0 && <span style={styles.footerStatus}>{nights} night{nights !== 1 ? 's' : ''}</span>}
        {total > 0 && <span style={styles.footerCost}>${total.toLocaleString()}</span>}
      </div>
    </>
  );
};

// ─── Edit Booking Card ────────────────────────────────────────────────────────

const EditBookingCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const propertyName = (result.property_name as string) || '';
  const changes = (result.changes as string) || '';
  const checkIn = (result.check_in as string) || '';
  const checkOut = (result.check_out as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Edit Booking</span>
      </div>
      <div style={styles.body}>
        {propertyName && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Property</span>
            <span style={styles.bodyValue}>{propertyName}</span>
          </div>
        )}
        {changes && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Changes</span>
            <span style={styles.bodyValue}>{changes}</span>
          </div>
        )}
        {(checkIn || checkOut) && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Dates</span>
            <span style={styles.bodyValue}>{checkIn} — {checkOut}</span>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Escalate to Owner Card ──────────────────────────────────────────────────

const EscalateCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ input, result, color }) => {
  const severity = (input.severity as string) || 'high';
  const summary = (input.summary as string) || '';
  const ownerName = (result.owner_name as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Escalation</span>
        <span style={{ ...styles.severityBadge, ...(SEVERITY_STYLES[severity] || SEVERITY_STYLES.high) }}>
          {severity.toUpperCase()}
        </span>
      </div>
      <div style={styles.body}>
        {ownerName && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Owner</span>
            <span style={styles.bodyValue}>{ownerName}</span>
          </div>
        )}
        <div style={styles.decisionSummary}>{summary}</div>
      </div>
    </>
  );
};

// ─── Payment Link Card ───────────────────────────────────────────────────────

const PaymentLinkCard: React.FC<{
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  color: string;
}> = ({ result, color }) => {
  const totalDisplay = (result.total_display as string) || '';
  const status = (result.status as string) || '';
  const bookingId = (result.booking_id as string) || '';

  return (
    <>
      <div style={styles.header}>
        <span style={{ ...styles.headerLabel, color }}>Payment Link</span>
      </div>
      <div style={styles.body}>
        {bookingId && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Booking</span>
            <span style={{ ...styles.bodyValue, fontFamily: THEME.font.mono }}>{bookingId}</span>
          </div>
        )}
        {totalDisplay && (
          <div style={styles.bodyRow}>
            <span style={styles.bodyLabel}>Amount</span>
            <span style={{ ...styles.bodyValue, fontWeight: 700 }}>{totalDisplay}</span>
          </div>
        )}
      </div>
      {status && (
        <div style={styles.footer}>
          <span style={{
            ...styles.footerStatus,
            color: status === 'link_created' ? THEME.status.normal : THEME.text.muted,
          }}>
            {status === 'link_created' ? '✓ Link Created' : status}
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
    padding: '14px 18px',
    cursor: 'pointer',
    transition: `all ${ANIMATION.normal} ${ANIMATION.easeOut}`,
    boxShadow: SHADOW.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  headerLabel: {
    fontSize: '14px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: THEME.text.accent,
  },
  headerDetail: {
    fontSize: '14px',
    color: THEME.text.secondary,
    fontWeight: 500,
  },
  severityBadge: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: '5px',
    letterSpacing: '0.05em',
  },
  categoryBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: '5px',
    backgroundColor: 'rgba(107, 114, 128, 0.08)',
    color: THEME.text.secondary,
    border: '1px solid rgba(107, 114, 128, 0.12)',
    textTransform: 'capitalize' as const,
  },
  confidenceBadge: {
    fontSize: '12px',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: '5px',
    letterSpacing: '0.02em',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  bodyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
  },
  bodyLabel: {
    fontSize: '14px',
    color: THEME.text.muted,
    minWidth: '65px',
    flexShrink: 0,
  },
  bodyValue: {
    fontSize: '15px',
    color: THEME.text.primary,
    lineHeight: '1.4',
  },
  bodyMuted: {
    fontSize: '14px',
    color: THEME.text.muted,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    paddingTop: '6px',
    borderTop: `1px solid ${THEME.bg.borderLight}`,
  },
  footerStatus: {
    fontSize: '14px',
    color: THEME.text.muted,
    fontWeight: 500,
  },
  footerTimestamp: {
    fontSize: '14px',
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
  },
  footerCost: {
    fontSize: '18px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
  },
  footerCaveat: {
    fontSize: '14px',
    color: THEME.text.muted,
    fontStyle: 'italic',
    lineHeight: '1.4',
  },
  footerImpact: {
    fontSize: '14px',
    color: THEME.text.secondary,
    lineHeight: '1.4',
  },

  // SMS specific
  smsBubbleRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  smsBubble: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.12)',
    borderRadius: '14px 14px 2px 14px',
    padding: '10px 14px',
    fontSize: '15px',
    color: THEME.text.primary,
    maxWidth: '85%',
    lineHeight: '1.5',
  },

  // Price specific
  priceBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'flex-start',
  },
  pricePropertyName: {
    fontSize: '14px',
    color: THEME.text.secondary,
    fontWeight: 500,
  },
  priceNumbers: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
  },
  priceOld: {
    fontSize: '22px',
    color: THEME.text.muted,
    fontWeight: 500,
    textDecoration: 'line-through',
    fontFamily: THEME.font.mono,
  },
  priceArrow: {
    fontSize: '20px',
    color: THEME.text.muted,
  },
  priceNew: {
    fontSize: '28px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
    animation: 'numberRoll 0.4s ease-out',
  },
  priceDelta: {
    fontSize: '18px',
    fontWeight: 700,
  },
  priceReason: {
    fontSize: '14px',
    color: THEME.text.muted,
    lineHeight: '1.4',
    marginTop: '2px',
  },

  // Decision specific
  decisionSummary: {
    fontSize: '15px',
    color: THEME.text.primary,
    lineHeight: '1.5',
  },
  showMoreBtn: {
    display: 'inline',
    marginLeft: '4px',
    background: 'none',
    border: 'none',
    color: THEME.tool.sms,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: THEME.font.sans,
    padding: 0,
    transition: `opacity ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },

  // Market data specific
  marketMetrics: {
    display: 'flex',
    gap: '24px',
    marginBottom: '6px',
  },
  marketMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  marketMetricValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
  },
  marketMetricLabel: {
    fontSize: '11px',
    color: THEME.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontWeight: 600,
  },
  marketEvents: {
    fontSize: '14px',
    color: THEME.text.secondary,
    lineHeight: '1.4',
  },
  marketProperties: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '4px',
  },
  marketPropertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    fontSize: '14px',
  },

  // Schedule specific
  schedulePropertyName: {
    fontSize: '14px',
    color: THEME.text.secondary,
    fontWeight: 500,
  },
  scheduleChange: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    flexWrap: 'wrap',
  },
  scheduleType: {
    fontSize: '15px',
    color: THEME.text.secondary,
    fontWeight: 500,
    textTransform: 'capitalize' as const,
  },
  scheduleOld: {
    fontSize: '18px',
    color: THEME.text.muted,
    fontFamily: THEME.font.mono,
    textDecoration: 'line-through',
  },
  scheduleArrow: {
    fontSize: '18px',
    color: THEME.tool.scheduling,
  },
  scheduleNew: {
    fontSize: '18px',
    fontWeight: 600,
    color: THEME.text.accent,
    fontFamily: THEME.font.mono,
  },

  // Scheduled task specific
  scheduledTaskClock: {
    fontSize: '16px',
    animation: 'clockTick 2s ease-in-out infinite',
    display: 'inline-block',
  },
  scheduledTaskBody: {
    borderStyle: 'dashed',
    borderColor: 'rgba(20, 184, 166, 0.2)',
    borderWidth: '1px',
    borderRadius: RADIUS.sm,
    padding: '12px 14px',
    backgroundColor: 'rgba(20, 184, 166, 0.04)',
    animation: 'dashedBorderPulse 3s ease-in-out infinite',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  scheduledTaskDescription: {
    fontSize: '15px',
    color: THEME.text.primary,
    lineHeight: '1.45',
  },

  // Generic
  genericPre: {
    fontSize: '14px',
    color: THEME.text.primary,
    fontFamily: THEME.font.mono,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: '1.4',
    maxHeight: '120px',
    overflow: 'auto',
    backgroundColor: THEME.bg.primary,
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${THEME.bg.borderLight}`,
  },
};
