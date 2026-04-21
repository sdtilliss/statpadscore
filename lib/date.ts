/**
 * Returns the current Statpad "game date" as YYYY-MM-DD.
 * Statpad resets at 4am PST, so we subtract 4 hours before
 * calculating the PT calendar date.
 */
export function getStatpadDate(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return shifted.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}
