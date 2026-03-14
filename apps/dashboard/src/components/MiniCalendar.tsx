import React from 'react';
import { THEME } from '@apm/shared';
import type { BookingRange } from '../hooks/useSSE';

interface Props {
  bookings: BookingRange[];
  compact?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const BOOKING_COLORS = [
  '#F59E0B', // amber (current guest)
  '#3B82F6', // blue (upcoming)
  '#8B5CF6', // violet
  '#059669', // green
];

export const MiniCalendar: React.FC<Props> = ({ bookings, compact = false }) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  // Map each day -> booking index (first match wins)
  const dayMap = new Map<number, number>();
  bookings.forEach((b, bIdx) => {
    const ci = new Date(b.checkIn);
    const co = new Date(b.checkOut);
    for (let d = 1; d <= daysInMonth; d++) {
      if (dayMap.has(d)) continue;
      const dayStart = new Date(year, month, d);
      const dayEnd = new Date(year, month, d + 1);
      if (ci < dayEnd && co > dayStart) {
        dayMap.set(d, bIdx);
      }
    }
  });

  const cellSize = compact ? 20 : 30;
  const gap = compact ? 1 : 2;

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const gridWidth = cellSize * 7 + gap * 6;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: compact ? '2px' : '6px',
      width: gridWidth,
      fontFamily: THEME.font.sans,
    }}>
      {/* Month header */}
      <div style={{
        textAlign: 'center',
        fontSize: compact ? 10 : 13,
        fontWeight: 700,
        color: THEME.text.accent,
        letterSpacing: '-0.01em',
      }}>
        {compact ? MONTH_NAMES[month].substring(0, 3) : MONTH_NAMES[month]} {year}
      </div>

      {/* Day-of-week headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(7, ${cellSize}px)`,
        gap: `${gap}px`,
      }}>
        {DAY_ABBR.map((d, i) => (
          <div key={i} style={{
            height: compact ? 12 : 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? 8 : 10,
            fontWeight: 600,
            color: THEME.text.muted,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(7, ${cellSize}px)`,
        gap: `${gap}px`,
      }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} style={{ width: cellSize, height: cellSize }} />;
          }

          const bookingIdx = dayMap.get(day);
          const isBooked = bookingIdx !== undefined;
          const isToday = day === todayDate;
          const color = isBooked
            ? BOOKING_COLORS[bookingIdx % BOOKING_COLORS.length]
            : undefined;

          return (
            <div key={i} style={{
              width: cellSize,
              height: cellSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: compact ? 9 : 11,
              fontWeight: isToday ? 700 : isBooked ? 600 : 400,
              color: isBooked ? '#FFFFFF' : isToday ? THEME.text.accent : THEME.text.secondary,
              backgroundColor: isBooked ? color : isToday ? 'rgba(0,0,0,0.06)' : 'transparent',
              borderRadius: compact ? '3px' : '6px',
              boxShadow: isToday && !isBooked
                ? `inset 0 0 0 1.5px ${THEME.text.accent}`
                : undefined,
            }}>
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend — non-compact only */}
      {!compact && bookings.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          marginTop: '4px',
        }}>
          {bookings.map((b, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: BOOKING_COLORS[i % BOOKING_COLORS.length],
                flexShrink: 0,
              }} />
              <span style={{ color: THEME.text.secondary, fontWeight: 500 }}>
                {b.guestName}
              </span>
              <span style={{ color: THEME.text.muted, fontSize: '10px' }}>
                {formatShortDateRange(b.checkIn, b.checkOut)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Compact legend — just guest initials under the calendar */}
      {compact && bookings.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '6px',
          justifyContent: 'center',
          marginTop: '1px',
        }}>
          {bookings.map((b, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '8px',
              color: THEME.text.muted,
            }}>
              <div style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: BOOKING_COLORS[i % BOOKING_COLORS.length],
                flexShrink: 0,
              }} />
              {b.guestName.split(' ')[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function formatShortDateRange(checkIn: string, checkOut: string): string {
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  const m = ci.toLocaleString('en-US', { month: 'short' });
  return `${m} ${ci.getDate()}–${co.getDate()}`;
}
