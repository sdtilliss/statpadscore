/**
 * Returns the current Statpad "game date" as YYYY-MM-DD.
 * Statpad resets at 3am PT, so we subtract 3 hours before
 * calculating the PT calendar date.
 */
export function getStatpadDate(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return shifted.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/**
 * Resolve the label from a Statpad screenshot's date dropdown into a YYYY-MM-DD
 * Statpad day.
 *
 * The dropdown reads either "Today" or a bare "M/D" (e.g. "7/18") with no year.
 * - "Today" (or empty) -> the current Statpad day.
 * - "M/D" -> its most recent occurrence on or before today (Statpad only lets
 *   you play recent days), and only if it lands within the last 365 days (our
 *   retention window) and isn't in the future.
 * - Anything unrecognized or out of range -> null, so the caller can fall back
 *   to today rather than filing a score somewhere wrong.
 */
export function resolveStatpadDate(label: string | null | undefined): string | null {
  const today = getStatpadDate();
  const trimmed = (label || '').trim();
  if (!trimmed || /^today$/i.test(trimmed)) return today;

  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const [ty, tm, td] = today.split('-').map(Number);
  // Assume the current Statpad year; if that lands in the future, it must have
  // been last year's occurrence.
  const year = month > tm || (month === tm && day > td) ? ty - 1 : ty;
  const resolved = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Reject impossible calendar dates (e.g. 2/30, which Date would roll forward).
  if (new Date(resolved + 'T12:00:00Z').toISOString().split('T')[0] !== resolved) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Date.parse(today + 'T12:00:00Z') - Date.parse(resolved + 'T12:00:00Z');
  if (diff < 0 || diff > 365 * dayMs) return null; // future or older than retention
  return resolved;
}
