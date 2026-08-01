// The only sports Statpad tracks. Every saved score's `sport` must be one of
// these codes so the Today/Stats/Crowns views group cleanly — see the bug where
// a cropped screenshot let "Unknown" / "Not visible in image" leak in.
export const VALID_SPORTS = ['MLB', 'NFL', 'NBA', 'NHL'] as const;
export type Sport = (typeof VALID_SPORTS)[number];

const VALID = new Set<string>(VALID_SPORTS);

// Common ways the model might name a sport instead of the code, so a valid
// screenshot never gets rejected over phrasing.
const ALIASES: Record<string, Sport> = {
  BASEBALL: 'MLB',
  FOOTBALL: 'NFL',
  BASKETBALL: 'NBA',
  HOCKEY: 'NHL',
};

/**
 * Coerce a raw sport string into a canonical code, or null if it can't be
 * resolved (e.g. "Unknown", "Not visible in image"). Callers should treat null
 * as "couldn't determine the sport" rather than saving it.
 */
export function normalizeSport(raw: string | null | undefined): Sport | null {
  const s = (raw || '').trim().toUpperCase();
  if (VALID.has(s)) return s as Sport;
  return ALIASES[s] ?? null;
}
