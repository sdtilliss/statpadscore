// A "Magic Bean" is a perfect grid: every one of the 5 athlete tiles came back
// at the 100th percentile (all purple). Statpad still reports a global "beat
// X%" for those grids (e.g. 91.7%) because other people also went perfect, but
// a perfect grid can't be beaten — so we record it as 100%.
//
// Stored as an explicit flag (rather than derived from purpleTiles) so it only
// applies from the day this shipped forward, plus any score an admin
// explicitly grants via /api/admin/magic-bean.
import type { Score } from './types';

export const MAGIC_BEAN_TILES = 5;
export const MAGIC_BEAN_COLOR = '#40e0d0'; // turquoise
export const MAGIC_BEAN_ICON = '🩵';

export function isPerfectGrid(purpleTiles: number): boolean {
  return purpleTiles >= MAGIC_BEAN_TILES;
}

export function isMagicBean(s: Pick<Score, 'magicBean'>): boolean {
  return s.magicBean === true;
}
