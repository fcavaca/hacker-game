// PLAYER ACCOUNT (saved on this phone): level, XP, stats and unlocked customisations.

const KEY = 'hpg-profile';
// total XP needed to REACH each level (index = level - 1)
export const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000];

export function levelOf(xp) {
  let l = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) l = i + 1;
  return l;
}
export function levelProgress(xp) {
  const l = levelOf(xp);
  const from = LEVELS[l - 1], to = LEVELS[l] ?? from + 1000;
  return { level: l, into: xp - from, need: to - from, pct: Math.min(100, Math.round((xp - from) / (to - from) * 100)) };
}

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* full */ } }
export function createProfile(name) {
  const p = { name, xp: 0, created: Date.now(), played: 0, wins: 0, games: 0, duelWins: 0, hacks: 0, counted: [] };
  saveProfile(p);
  return p;
}

// XP earned from a finished game (S = final state, id = my player id)
export function gameXp(S, id) {
  const p = S.players[id];
  if (!p || !p.team) return null;
  const won = S.result?.winner === (p.team === 'hacker' ? 'hackers' : 'gamers');
  const parts = [['Played a game', 20], ['Games finished', p.done * 6], ['Duels won', (p.wins || 0) * 12], ['Hacks', (p.hacks || 0) * 15],
    ['Saves & revives', ((p.cures || 0) + (p.revives || 0)) * 15], ['Team victory', won ? 40 : 0], ['NPC goal', p.npcWon ? 60 : 0], ['Survived', p.alive ? 10 : 0]]
    .filter(([, v]) => v > 0);
  return { total: parts.reduce((s, [, v]) => s + v, 0), parts, won: won || p.npcWon };
}

// Applies a finished game to the profile once. Returns { gained, before, after } or null.
export function recordGame(S, id) {
  const prof = loadProfile();
  if (!prof || !S.gameId || prof.counted.includes(S.gameId)) return null;
  const x = gameXp(S, id);
  if (!x) return null;
  const p = S.players[id];
  const before = levelOf(prof.xp);
  prof.xp += x.total;
  prof.played++; if (x.won) prof.wins++;
  prof.games += p.done || 0; prof.duelWins += p.wins || 0; prof.hacks += p.hacks || 0;
  prof.counted = [...prof.counted.slice(-50), S.gameId];
  saveProfile(prof);
  return { gained: x, before, after: levelOf(prof.xp) };
}
