import React, { useState } from 'react';
import { THEME } from '@apm/shared';
import type { BookingRange } from '../hooks/useSSE';

interface Props {
  bookings: BookingRange[];
  currentPrice: number;
  basePrice: number;
  maintenanceDays?: number[];
  compact?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const BOOKED_COLOR = '#3B82F6';
const REPAIR_COLOR = '#EF4444';
const PRICE_HOVER_COLOR = '#10B981';

export const MiniCalendar: React.FC<Props> = ({ bookings, currentPrice, basePrice, maintenanceDays = [], compact = false }) => {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  // Map each day -> booked (true/false)
  const bookedDays = new Set<number>();
  bookings.forEach((b) => {
    const ci = new Date(b.checkIn);
    const co = new Date(b.checkOut);
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(year, month, d);
      const dayEnd = new Date(year, month, d + 1);
      if (ci < dayEnd && co > dayStart) {
        bookedDays.add(d);
      }
    }
  });

  const maintenanceSet = new Set(maintenanceDays);

  const cellSize = compact ? 20 : 30;
  const cellHeight = compact ? 28 : 40;
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
            return <div key={i} style={{ width: cellSize, height: cellHeight }} />;
          }

          const isBooked = bookedDays.has(day);
          const isMaintenance = maintenanceSet.has(day);
          const isToday = day === todayDate;
          const isHovered = hoveredDay === day;

          let bgColor = 'transparent';
          if (isMaintenance) bgColor = REPAIR_COLOR;
          else if (isBooked) bgColor = BOOKED_COLOR;
          else if (isToday) bgColor = 'rgba(0,0,0,0.06)';

          const hasColor = isBooked || isMaintenance;
          const dayPrice = isBooked ? basePrice : currentPrice;
          const priceStr = `$${dayPrice}`;

          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                width: cellSize,
                height: cellHeight,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0,
                backgroundColor: bgColor,
                borderRadius: compact ? '3px' : '6px',
                boxShadow: isToday && !hasColor
                  ? `inset 0 0 0 1.5px ${THEME.text.accent}`
                  : undefined,
                cursor: 'default',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span style={{
                fontSize: compact ? 9 : 11,
                fontWeight: isToday ? 700 : hasColor ? 600 : 400,
                color: hasColor ? '#FFFFFF' : isToday ? THEME.text.accent : THEME.text.secondary,
                lineHeight: 1,
              }}>
                {day}
              </span>
              <span style={{
                fontSize: compact ? 6 : 8,
                fontWeight: 500,
                lineHeight: 1,
                marginTop: compact ? 1 : 2,
                color: isHovered
                  ? PRICE_HOVER_COLOR
                  : hasColor
                    ? 'rgba(255,255,255,0.85)'
                    : '#000000',
                opacity: isHovered ? 1 : 0.45,
                transition: 'color 0.15s ease, opacity 0.15s ease',
              }}>
                {priceStr}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
};

