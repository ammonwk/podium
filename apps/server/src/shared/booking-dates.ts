import { BOOKING_TIMES } from '@apm/shared';

/**
 * Parse a date string (YYYY-MM-DD or full ISO 8601), extract the date portion,
 * and return an ISO string with the standard check-in time in Mountain Time (UTC-7).
 */
export function normalizeCheckIn(raw: string): string {
  return normalizeToMountain(raw, BOOKING_TIMES.CHECK_IN_HOUR);
}

/**
 * Parse a date string (YYYY-MM-DD or full ISO 8601), extract the date portion,
 * and return an ISO string with the standard check-out time in Mountain Time (UTC-7).
 */
export function normalizeCheckOut(raw: string): string {
  return normalizeToMountain(raw, BOOKING_TIMES.CHECK_OUT_HOUR);
}

function normalizeToMountain(raw: string, hour: number): string {
  // Extract the date portion — works for "2026-03-20", "2026-03-20T15:00:00Z", etc.
  const dateOnly = raw.slice(0, 10); // "YYYY-MM-DD"
  const [year, month, day] = dateOnly.split('-').map(Number);

  // Build a Mountain Time date (UTC-7) and convert to UTC for storage
  // Mountain Time offset: UTC-7 (MDT) — so 15:00 MT = 22:00 UTC
  const utcHour = hour + 7;
  const d = new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0, 0));
  return d.toISOString();
}
