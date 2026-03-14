/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
 * Strips all non-digit characters, then:
 * - 10 digits → prepend +1
 * - 11 digits starting with 1 → prepend +
 * - Already starts with + → keep as-is (strip non-digits after +)
 * Returns null if the result doesn't look like a valid E.164 number.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  // If it starts with +, strip non-digits after the + and validate
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      return `+${digits}`;
    }
    return null;
  }

  // Strip all non-digit characters
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return null;
}
