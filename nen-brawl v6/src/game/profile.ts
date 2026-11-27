export interface Profile { matches: number; wins: number; kills: number; best: number; brMatches: number; brWins: number; brKills: number; brBest: number }
const KEY = 'nenbrawl.profile';
const EMPTY: Profile = { matches: 0, wins: 0, kills: 0, best: 0, brMatches: 0, brWins: 0, brKills: 0, brBest: 0 };
export function getProfile(): Profile {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...EMPTY }; }
}
export function saveProfile(fn: (p: Profile) => void) {
  const p = getProfile();
  fn(p);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
  return p;
}
