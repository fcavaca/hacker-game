// GAME ENGINE — runs only on the host's phone. It owns the true game state, applies every
// rule, and publishes the state to all players whenever something changes.
//
// BADGES: every player has a 4-digit badge code (shown as a QR code). Scanning someone's badge
// proves you are next to them: start a duel, report an AFK player, check in to the Lobby,
// confirm a dare, receive a courier package, find someone in Hide & Seek, IT scans, Firewall
// shields and Healer revives all work by scanning badges.

import { SOLO_IDS, SENSOR_IDS, SOCIAL_IDS, EMERGENCY_IDS, DUEL_IDS, DUEL_BETTER, DEFAULT_SETTINGS, ZONES, DARES,
  GAMER_ROLES, HACKER_ROLES, NPC_ROLES, MODIFIERS, ROLE_INFO } from './config.js?v=9';
import { cleanAvatar, COLOR_NAMES, HAIR_COLOR_NAMES, partName } from './avatar.js?v=9';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let counter = 0;
const newId = (p) => p + Date.now().toString(36) + (counter++).toString(36);
const MIN = 60000;

function newPlayer(id, name, av) {
  return {
    id, name, av: cleanAvatar(av),
    team: null, role: null, startRole: null, mod: null,
    alive: true, afk: false, found: false, kicked: false,
    games: [], done: 0, readyAt: 0, nosens: false,
    lucky: false, shield: false, badge: '',
    pending: null, remote: null,      // hacks waiting to make you go AFK
    charges: 0, scans: 0, prog: {}, progT: {},
    duel: null, wins: 0, lastWinAt: 0,
    task: null,                       // open social game
    powerAt: 0,                       // role power available again at
    trapUsed: false, tankUsed: false, clutchUsed: false, liveUntil: 0,
    frozenUntil: 0, idol: null, target: null, npcWon: false, bugged: false,
    // stats for the end-of-game awards
    lost: 0, hacks: 0, cures: 0, revives: 0, finds: 0, votes: 0, afkMin: null,
  };
}

export function createEngine(code, hostId, publish, saved) {
  const S = saved || {
    code, hostId, gameId: null, phase: 'waiting', settings: { ...DEFAULT_SETTINGS },
    players: {}, order: [], credits: 0, goal: 1,
    timerEndsAt: 0, timeLeftAtPause: 0, round: 0, startedAt: 0, totalMs: 0,
    duels: {}, lobby: null, keyHolder: null, keyMovesAt: 0, keyWiped: false, nextForcedAt: 0,
    penaltyAt: 0, penaltyPending: false, nextEventAt: 0, event: null, surgeUntil: 0, lagUntil: 0,
    freezeAllUntil: 0, bountyOpen: false, breach: null, sabReadyAt: 0, breachReadyAt: 0, lagUsed: false, wipeUsed: false,
    news: [], log: [], notes: {}, result: null, version: 0, hostNow: 0,
  };
  S.settings = { ...DEFAULT_SETTINGS, ...S.settings };
  for (const k of Object.keys(S.settings)) if (k.startsWith('r_') && typeof S.settings[k] === 'boolean') S.settings[k] = S.settings[k] ? 50 : 0; // old saves
  let dirty = true;
  const now = () => Date.now();
  const P = (id) => S.players[id];
  const set = () => S.settings;
  const inGame = () => Object.values(S.players).filter((p) => p.team);
  const alive = () => inGame().filter((p) => p.alive);
  const elapsed = () => S.startedAt ? S.totalMs - Math.max(0, (S.phase === 'playing' ? S.timerEndsAt - now() : S.timeLeftAtPause)) : 0;
  const mins = () => Math.max(0, Math.floor(elapsed() / MIN));
  const duelOf = (p) => (p.duel ? S.duels[p.duel] : null);
  const inActiveDuel = (p) => duelOf(p)?.st === 'active';
  const canHack = (p) => p.team === 'hacker' && p.role !== 'insider';
  const freePlay = (p) => p.team === 'hacker'; // the whole Hacker team (Trojan too) plays fake games: no cooldowns, no bans
  const frozen = (p) => now() < Math.max(p.frozenUntil || 0, S.freezeAllUntil || 0);
  const cdMs = (p) => set().powerCd * MIN * (p.mod === 'lowbattery' ? 2 : 1);
  // each special role has a chance (0–100%) to be in the game; rolled once per role at the start
  const roll = (r) => Math.random() * 100 < (Number(set()['r_' + r]) || 0);
  const enabled = (r) => (Number(set()['r_' + r]) || 0) > 0;

  // title -> FULL-SCREEN message; kind: info | good | bad | win | lose | alarm | alert ; siren: phone keeps screaming
  function note(pid, text, kind = 'info', title = null, extra = null) {
    if (!pid || !P(pid)) return;
    const list = (S.notes[pid] ||= []);
    list.push({ id: newId('n'), text, kind, ...(title ? { title } : {}), ...(extra || {}) });
    if (list.length > 15) list.splice(0, list.length - 15);
    dirty = true;
  }
  const noteAll = (text, kind, title, except = null) => { for (const x of inGame()) if (x.id !== except) note(x.id, text, kind, title); };
  function news(text) { S.news.push({ t: now(), text }); if (S.news.length > 40) S.news.shift(); dirty = true; }
  function log(text, extra) { S.log.push({ t: now(), m: mins(), text, ...(extra || {}) }); if (S.log.length > 150) S.log.shift(); dirty = true; }

  function newBadges(players) {
    const used = new Set(inGame().map((p) => p.badge));
    for (const p of players) {
      used.delete(p.badge);
      let c; do { c = String(1000 + Math.floor(Math.random() * 9000)); } while (used.has(c));
      used.add(c); p.badge = c;
    }
  }

  function zonePick(prev) { const zs = ZONES[set().place] || ZONES.house; return pick(zs.filter((z) => z !== prev)); }
  function makeGames(n, p) {
    const pool = SOLO_IDS.filter((g) => !(p && p.nosens && SENSOR_IDS.includes(g)));
    const out = [];
    while (out.length < n) out.push(...shuffle(pool));
    let prev = p?.games?.length ? p.games[p.games.length - 1].z : null;
    return out.slice(0, n).map((t) => { const z = zonePick(prev); prev = z; return { t, z, done: false }; });
  }
  const otherGame = (cur, p) => pick(SOLO_IDS.filter((g) => g !== cur && !(p.nosens && SENSOR_IDS.includes(g))));

  // ---------- starting / resetting ----------
  function setRole(p, role) {
    p.role = role;
    p.team = ['hacker', ...HACKER_ROLES].includes(role) ? 'hacker' : NPC_ROLES.includes(role) ? 'npc' : 'gamer';
    if (role === 'itguy') p.scans = Math.max(1, p.mod === 'lowbattery' ? Math.floor(set().itScans / 2) : set().itScans);
  }

  function startGame() {
    const ids = shuffle(S.order.filter((id) => P(id)));
    const n = ids.length;
    const hk = Math.max(1, Math.min(set().hackers, Math.floor((n - 1) / 2)));
    const npcPool = shuffle(NPC_ROLES.filter(roll));
    const npcN = n >= 5 ? Math.max(0, Math.min(set().npcs, npcPool.length, n - hk - 2)) : 0;
    S.gameId = newId('g');
    ids.forEach((id) => { const old = P(id); Object.assign(old, newPlayer(id, old.name, old.av), { lvl: old.lvl || 1 }); });
    const players = ids.map(P);
    if (set().modifiers) for (const p of players) if (Math.random() < 0.3) p.mod = pick(Object.keys(MODIFIERS));
    const hackers = players.slice(0, hk), npcs = players.slice(hk, hk + npcN), gamers = players.slice(hk + npcN);
    // hackers
    const hSpecial = shuffle(HACKER_ROLES.filter((r) => r !== 'insider' && roll(r)));
    const insider = hk >= 2 && roll('insider');
    hackers.forEach((p, i) => {
      if (i === hk - 1 && insider) return setRole(p, 'insider');
      setRole(p, hSpecial.length ? hSpecial.pop() : 'hacker');
    });
    // NPCs
    npcs.forEach((p) => setRole(p, npcPool.pop()));
    // gamers
    const gSpecial = shuffle(GAMER_ROLES.filter(roll));
    if (gSpecial.includes('itguy')) { gSpecial.splice(gSpecial.indexOf('itguy'), 1); gSpecial.unshift('itguy'); }
    gamers.forEach((p) => setRole(p, gSpecial.length ? gSpecial.shift() : 'gamer'));
    for (const p of players) {
      p.startRole = p.role;
      // only 4 games are visible at the start; every 2 finished games reveal 2 more (until all are shown)
      const all = makeGames(set().gamesPerPlayer, p);
      p.games = all.slice(0, 4); p.queue = all.slice(4); p.sinceReveal = 0;
      if (p.role === 'bounty') p.target = pick(players.filter((x) => x !== p)).id;
    }
    newBadges(players);
    S.goal = Math.max(3, Math.round(gamers.length * set().gamesPerPlayer * 0.75));
    const t = now();
    Object.assign(S, { credits: 0, round: 1, duels: {}, lobby: null, result: null, news: [], log: [], notes: {},
      penaltyAt: 0, penaltyPending: false, phase: 'playing', startedAt: t, totalMs: set().timerMin * MIN, timerEndsAt: t + set().timerMin * MIN,
      nextForcedAt: t + set().forcedDuelMin * MIN, nextEventAt: set().events === 'off' ? 0 : t + 5 * MIN,
      surgeUntil: 0, lagUntil: 0, freezeAllUntil: 0, bountyOpen: false, breach: null, sabReadyAt: t + 5 * MIN, breachReadyAt: t + 5 * MIN,
      lagUsed: false, wipeUsed: false, keyWiped: false, event: null });
    S.keyHolder = null;
    giveKey();
    log(`Roles: ${players.map((p) => `${p.name} = ${ROLE_INFO[p.role]?.name || p.role}${p.mod ? ` (${MODIFIERS[p.mod]?.name || p.mod})` : ''}`).join(' · ')}`, { roles: players.map((p) => ({ id: p.id, role: p.role, mod: p.mod || null })) });
    news('🎮 GAME ON! Hackers are hiding among you…');
  }

  function backToWaiting() {
    for (const p of Object.values(S.players)) Object.assign(p, newPlayer(p.id, p.name, p.av), { lvl: p.lvl || 1 });
    Object.assign(S, { phase: 'waiting', duels: {}, lobby: null, result: null, notes: {}, news: [], log: [], keyHolder: null, breach: null });
  }

  function endGame(winner, text) {
    if (S.phase === 'ended') return;
    for (const d of Object.values(S.duels)) endDuel(d);
    for (const p of inGame()) if (p.role === 'fanboy' && p.idol && !p.npcWon) {
      const t = P(p.idol)?.team;
      if (t && ((t === 'gamer' && winner === 'gamers') || (t === 'hacker' && winner === 'hackers'))) p.npcWon = true;
    }
    S.phase = 'ended';
    S.breach = null;
    S.result = { winner, text };
    news(text);
  }

  function checkWin() {
    if (S.phase !== 'playing' && S.phase !== 'lobby') return;
    const al = alive();
    const h = al.filter((p) => p.team === 'hacker').length;
    const g = al.filter((p) => p.team === 'gamer').length;
    if (h === 0) endGame('gamers', 'Every Hacker got Vote Kicked. The network is safe!');
    else if (h >= g) endGame('hackers', 'The Hackers took over the network. GG, it\'s over.');
    else if (S.credits >= S.goal) endGame('gamers', 'Network secured 100% — the Hackers are locked out!');
  }

  function npcWin(p, why) {
    if (p.npcWon) return;
    p.npcWon = true;
    note(p.id, why, 'win', '🏆 YOU WON (NPC)');
    log(`🏆 NPC ${p.name} (${p.role}) achieved their goal`);
  }

  // ---------- Lobby Key ----------
  function giveKey() {
    if (S.keyWiped) { S.keyHolder = null; return; }
    const prev = S.keyHolder;
    const cands = alive().filter((p) => p.id !== prev);
    const next = cands.length ? pick(cands) : alive()[0];
    if (prev && P(prev)?.alive && (!next || next.id !== prev)) note(prev, '🔑 The Lobby Key slipped away from you…');
    S.keyHolder = next ? next.id : null;
    S.keyMovesAt = now() + set().keyMoveMin * MIN;
    if (next && next.id !== prev) note(next.id, 'Only you can call everyone to the Lobby without a body. Use it wisely.', 'alert', '🔑 YOU GOT THE KEY');
    dirty = true;
  }

  // ---------- games / credits ----------
  function addCredits(n) { S.credits = Math.max(0, S.credits + n); dirty = true; }

  function gameWon(p, i) {
    const g = p.games[i];
    if (!g || g.done) return;
    g.done = true; p.done++;
    if (!freePlay(p)) p.readyAt = now() + set().cooldownSec * 1000;
    p.sinceReveal = (p.sinceReveal || 0) + 1;
    if (p.sinceReveal >= 2 && p.queue?.length) {
      p.sinceReveal = 0;
      p.games.push(...p.queue.splice(0, 2));
      note(p.id, '🆕 2 new games unlocked!', 'good');
    }
    if (p.team === 'gamer') {
      addCredits(1);
      if (!p.lucky && Math.random() < 0.1) { p.lucky = true; note(p.id, 'A one-time anti-hack shield. The next hack on you bounces off.', 'good', '🍀 LUCKY!'); }
      if (S.bountyOpen) { S.bountyOpen = false; p.shield = true; note(p.id, 'You were first! You get a Firewall shield.', 'win', '🎯 BOUNTY CLAIMED'); news(`🎯 ${p.name} claimed the bounty!`); }
    }
    news(`🟢 Someone finished a game at the ${g.z}`);
    if (p.games.every((x) => x.done) && !p.queue?.length) note(p.id, '🏁 All your games are done! Help with duels and Hide & Seek.', 'good');
  }

  function completeTask(doer, witness, msg) {
    const task = doer.task;
    if (!task) return;
    doer.task = null;
    gameWon(doer, task.i);
    const what = { dare: 'DARE', courier: 'DELIVERY', handshake: 'HANDSHAKE', vanish: 'VANISHED' }[task.kind];
    note(doer.id, msg || (witness ? `${witness.name} confirmed it. Legend.` : 'Badges collected. Smooth operator.'), 'win', `✅ ${what}${task.kind === 'vanish' ? '!' : ' DONE'}`);
    if (witness) note(witness.id, `✅ You confirmed ${doer.name}'s ${task.kind === 'courier' ? 'delivery' : 'dare'}.`, 'good');
    log(`${{ dare: '🎭', courier: '📦', handshake: '🤝', vanish: '🥷' }[task.kind]} ${doer.name} finished a ${task.kind}${witness ? ` (with ${witness.name})` : ''}`);
  }

  function courierClue(p, target) {
    const others = alive().filter((x) => x.id !== p.id);
    const facts = shuffle([
      { v: COLOR_NAMES[target.av.c], f: (x) => COLOR_NAMES[x.av.c], text: (v) => `wears a ${v.toUpperCase()} hoodie` },
      { v: HAIR_COLOR_NAMES[target.av.hc], f: (x) => HAIR_COLOR_NAMES[x.av.hc], text: (v) => `has ${v.toUpperCase()} hair`, skip: partName(target.av, 'h') === 'bald' },
      { v: partName(target.av, 'h'), f: (x) => partName(x.av, 'h'), text: (v) => `has a ${v.toUpperCase()} hairstyle` },
      { v: partName(target.av, 'a'), f: (x) => partName(x.av, 'a'), text: (v) => `has ${v.toUpperCase()} on their character`, skip: partName(target.av, 'a') === 'none' },
      { v: partName(target.av, 'f'), f: (x) => partName(x.av, 'f'), text: (v) => `has a ${v.toUpperCase()}`, skip: partName(target.av, 'f') === 'none' },
      { v: target.name[0].toUpperCase(), f: (x) => x.name[0].toUpperCase(), text: (v) => `has a name starting with "${v}"` },
    ]).filter((c) => !c.skip);
    const unique = facts.find((c) => others.filter((x) => c.f(x) === c.v).length === 1);
    if (unique) return `The player who ${unique.text(unique.v)}.`;
    const two = facts.slice(0, 2);
    return `The player who ${two[0].text(two[0].v)} and ${two[1].text(two[1].v)}.`;
  }

  // ---------- hacking ----------
  function scoutPing(victim) {
    for (const x of alive()) if (x.role === 'scout' && x.id !== victim.id) note(x.id, 'A hack just happened somewhere. Who? Where? Find out.', 'alert', '📡 HACK DETECTED');
  }

  // returns true if the hack really worked
  function applyHack(q, byId, kind) {
    const by = P(byId);
    const who = by?.name ?? '👾 A glitch';
    if (q.shield) { q.shield = false; note(q.id, 'Your Firewall shield blocked a hack. Someone is after you…', 'good', '🧱 BLOCKED!'); log(`🧱 ${who} tried to hack ${q.name} — blocked by a shield`); return false; }
    if (q.lucky) { q.lucky = false; note(q.id, 'Your Lucky shield just blocked a hack. Someone is after you…', 'good', '🍀 BLOCKED!'); log(`🍀 ${who} tried to hack ${q.name} — blocked by Lucky`); return false; }
    if (q.role === 'honeypot' && !q.trapUsed && by) {
      q.trapUsed = true;
      note(by.id, 'You hacked the CATFISH. Your phone is screaming — everyone around can hear it! RUN.', 'alarm', '🍯 TRAPPED!', { siren: true });
      note(q.id, 'Someone just fell into your trap. Listen for the alarm!', 'win', '🍯 GOTCHA');
      log(`🍯 ${who} fell into ${q.name}'s Catfish trap`);
      return 'trap';
    }
    if (q.role === 'tank' && !q.tankUsed) { q.tankUsed = true; note(q.id, 'You tanked a hack! Someone just tried to hack you.', 'alert', '🛡️ TANKED'); log(`🛡️ ${q.name} (Tank) absorbed a hack from ${who}`); return false; }
    if (kind !== 'remote') q.pending = { at: now() + set().afkDelay * 1000, by: byId };
    if (by) by.hacks++;
    log(`💀 ${who} hacked ${q.name} (${kind})`);
    if (q.liveUntil > now() && by) {
      news(`🔴 LIVE ON STREAM: ${by.name} just hacked ${q.name}!`);
      noteAll(`${by.name} just hacked ${q.name} — live on stream!`, 'alarm', '🔴 CAUGHT LIVE');
    }
    scoutPing(q);
    return true;
  }

  function goAfk(x, byId) {
    if (!x.alive) return;
    x.alive = false; x.afk = true; x.pending = null; x.remote = null; x.task = null;
    if (x.afkMin == null) x.afkMin = elapsed() / MIN;
    if (x.duel && S.duels[x.duel]) endDuel(S.duels[x.duel]);
    newBadges([x]);
    log(`📴 ${x.name} went AFK`);
    if (x.role === 'ragequit' && elapsed() < 10 * MIN) npcWin(x, 'You got hacked early — rage quit SUCCESSFUL.');
    else note(x.id, 'You got hacked. Freeze where you are, show your QR code, and don\'t say a word until someone finds you.', 'alarm', 'HACKED');
    if (S.keyHolder === x.id) giveKey();
    dirty = true;
  }

  function penaltyHack() {
    S.penaltyAt = 0;
    const victims = alive().filter((p) => p.team !== 'hacker' && !p.pending && !p.remote);
    if (victims.length) applyHack(pick(victims), null, 'indecision glitch');
    dirty = true;
  }

  function itScan(p, q) {
    if (p.role !== 'itguy') return note(p.id, '🛠️ Only the IT Guy can do that.');
    if (p.scans < 1) return note(p.id, '🛠️ No scans left.', 'bad');
    if (!q.alive) return note(p.id, `🛠️ ${q.name} is already out.`);
    p.scans--;
    if (q.mod === 'vpn') return note(p.id, `🔒 Scan failed: VPN detected on ${q.name}'s phone.`, 'bad');
    if (q.pending || q.remote) {
      q.pending = null; q.remote = null; p.cures++;
      note(p.id, `${q.name} WAS hacked — you wiped the virus!`, 'win', '🛠️ CURED');
      note(q.id, 'The IT Guy found a virus on your phone and deleted it. You owe them one.', 'good', '🛠️ SAVED');
      log(`🛠️ IT Guy ${p.name} cured ${q.name}`);
    } else note(p.id, `🛠️ ${q.name}'s phone is clean.`, 'good');
  }

  function powerReady(p) {
    if (now() < p.powerAt) { note(p.id, `⏳ Your power recharges in ${Math.ceil((p.powerAt - now()) / 1000)} s.`); return false; }
    return true;
  }

  // ---------- duels ----------
  function newDuel(a, b, forced) {
    const d = { id: newId('d'), a: a.id, b: b.id, st: 'pending', at: now(), forced: !!forced,
      g: pick(DUEL_IDS), seed: Math.floor(Math.random() * 2 ** 31), score: {} };
    S.duels[d.id] = d; a.duel = b.duel = d.id;
    return d;
  }

  function endDuel(d) {
    delete S.duels[d.id];
    if (P(d.a)?.duel === d.id) P(d.a).duel = null;
    if (P(d.b)?.duel === d.id) P(d.b).duel = null;
    dirty = true;
  }

  function forcedDuel() {
    S.nextForcedAt = now() + set().forcedDuelMin * MIN;
    const free = shuffle(alive().filter((p) => !p.duel && !p.remote && !frozen(p)));
    if (free.length < 2) return;
    const [a, b] = free;
    newDuel(a, b, true);
    for (const [x, y] of [[a, b], [b, a]]) note(x.id, `Find ${y.name} — one of you scans the other's badge. 90 seconds, or you BOTH get a 2-min game ban!`, 'alert', '⚔️ DUEL CALL!');
  }

  function rpsWinner(sa, sb) {
    const beats = { f: 'v', v: 'p', p: 'f' }; // Firewall blocks Virus, Virus infects Patch, Patch fixes Firewall
    let a = 0, b = 0;
    for (let i = 0; i < 3; i++) { const x = String(sa || '')[i], y = String(sb || '')[i]; if (!x && !y) continue; if (!y || beats[x] === y) a++; else if (!x || beats[y] === x) b++; }
    return a === b ? 0 : a > b ? 1 : -1;
  }

  // winnerId: set when the duel ends early (first player to finish wins)
  function resolveDuel(d, winnerId = null) {
    const better = DUEL_BETTER[d.g];
    const A = P(d.a), B = P(d.b), t = now();
    endDuel(d);
    if (A) A.readyAt = t + set().cooldownSec * 1000;
    if (B) B.readyAt = t + set().cooldownSec * 1000;
    if (!A || !B) return;
    let res; // 1 = A wins, -1 = B wins, 0 = draw
    if (winnerId) res = winnerId === d.a ? 1 : -1;
    else if (better === 'rps') res = rpsWinner(d.score[d.a], d.score[d.b]);
    else {
      const worst = better === 'low' ? Infinity : -Infinity;
      const adj = (x, s) => (s == null ? worst : (x.mod === 'noob' || S.lagUntil > t) ? (better === 'low' ? s * 1.25 : s * 0.8) : s);
      const sa = adj(A, d.score[d.a]), sb = adj(B, d.score[d.b]);
      res = sa === sb ? 0 : (better === 'low' ? sa < sb : sa > sb) ? 1 : -1;
    }
    if (res === 0) { for (const x of [A, B]) note(x.id, 'Perfectly balanced. Nobody wins this one.', 'info', '🤝 DRAW'); return; }
    const w = res > 0 ? A : B, l = res > 0 ? B : A;
    w.wins++; w.lastWinAt = t; l.lost++;
    let extra = '';
    if (S.keyHolder === l.id && w.alive) {
      S.keyHolder = w.id; S.keyMovesAt = t + set().keyMoveMin * MIN;
      extra = ' …and you STOLE the Lobby Key! 🔑';
      note(l.id, '🔑 They stole your Lobby Key too!', 'bad');
    }
    const surge = S.surgeUntil > t;
    if (w.team === 'gamer') {
      addCredits(surge ? 2 : 1); w.done++;
      note(w.id, `You destroyed ${l.name}! +${surge ? 2 : 1} to the Network bar.${extra}`, 'win', 'VICTORY');
    } else if (canHack(w) && l.team !== 'hacker' && l.mod !== 'noob') {
      w.charges++;
      note(w.id, `You beat ${l.name}. 📡 Remote hack unlocked!${extra}`, 'win', 'VICTORY');
    } else note(w.id, `You beat ${l.name}!${extra}`, 'win', 'VICTORY');
    note(l.id, `${w.name} beat you. Shake it off and get back out there.`, 'lose', 'DEFEAT');
    log(`⚔️ ${w.name} beat ${l.name} in a duel`);
    if (l.role === 'trojan' && w.team !== 'hacker' && w.alive && !w.pending && !w.remote) {
      if (applyHack(w, l.id, 'trojan') === true) note(l.id, `🦠 Malware spread: you infected ${w.name}. They drop in ${set().afkDelay} s.`, 'good');
    }
  }

  // ---------- badge scans ----------
  function badgeScan(p, a) {
    const owner = inGame().find((x) => x.badge === String(a.code).trim());
    if (!owner) return note(p.id, '❓ Unknown code. Try again.', 'bad');
    if (owner === p) return note(p.id, '🤳 That\'s your own badge, genius.');
    if (S.phase === 'lobby') {
      const L = S.lobby;
      if (L.stage === 'gather' && owner.id === L.by && p.alive) {
        L.arrived[p.id] = true;
        note(p.id, '✅ Checked in to the Lobby.', 'good');
        if (alive().every((x) => L.arrived[x.id])) advanceLobby();
      } else note(p.id, '🛋️ In the Lobby you can only scan the person who called it (to check in).');
      return;
    }
    if (!p.alive) return;
    if (frozen(p)) return note(p.id, '🧊 Your phone is frozen!', 'bad');
    if (a.mode === 'heal') {
      if (p.role !== 'healer') return;
      if (!owner.afk || owner.kicked) return note(p.id, `💚 ${owner.name} doesn't need reviving.`);
      if (!powerReady(p)) return;
      p.powerAt = now() + cdMs(p); p.revives++;
      Object.assign(owner, { alive: true, afk: false, found: false, pending: null, remote: null });
      newBadges([owner]);
      note(owner.id, `${p.name} revived you! You're back in the game.`, 'win', '💚 REVIVED');
      note(p.id, `You revived ${owner.name}!`, 'win', '💚 HEALED');
      news('💚 Someone came back from the dead!');
      log(`💚 Respawner ${p.name} revived ${owner.name}`);
      return;
    }
    if (a.mode === 'fw') {
      if (p.role !== 'firewall') return;
      if (!owner.alive) return note(p.id, `${owner.name} is out.`);
      if (!powerReady(p)) return;
      p.powerAt = now() + cdMs(p);
      owner.shield = true;
      note(p.id, `🧱 Shield placed on ${owner.name}.`, 'good');
      note(owner.id, 'Someone put a Firewall shield on you. The next hack bounces off.', 'good', '🧱 SHIELDED');
      log(`🧱 Firewall ${p.name} shielded ${owner.name}`);
      return;
    }
    if (owner.afk && !owner.found) {
      if (p.mod === 'nointernet') return note(p.id, '📵 No Internet — you can\'t report. Get someone else to scan them!', 'bad');
      owner.found = true; startLobby('afk', p, owner); return;
    }
    if (a.mode === 'it') return itScan(p, owner);
    const d = duelOf(p);
    if (d && (d.a === owner.id || d.b === owner.id) && d.st !== 'active') {
      d.st = 'active'; d.startAt = now() + 3500;
      p.task = p.task?.kind === 'vanish' ? p.task : null; owner.task = owner.task?.kind === 'vanish' ? owner.task : null;
      return;
    }
    if (owner.alive && owner.task) {
      const k = owner.task;
      if (k.kind === 'dare') return completeTask(owner, p);
      if (k.kind === 'courier' && k.target === p.id) return completeTask(owner, p);
      if (k.kind === 'vanish') {
        if (now() < k.huntAt) return note(p.id, `🙈 No peeking! The hunt for ${owner.name} starts in ${Math.ceil((k.huntAt - now()) / 1000)} s.`);
        // being found HURTS: the hider's team loses 1, the hider is banned 1 min; the finder gains (a Hacker finder secretly gets a remote hack)
        owner.task = null;
        owner.readyAt = now() + MIN;
        if (owner.team === 'gamer') addCredits(-1);
        note(owner.id, `${p.name} found you. −1 for your team and a 1-min game ban. Better hiding spot next time!`, 'lose', '👀 FOUND YOU');
        if (p.team === 'gamer') addCredits(1);
        if (canHack(p)) p.charges++;
        p.finds++;
        note(p.id, `You found ${owner.name}!${p.team === 'gamer' ? ' +1 to the Network bar.' : canHack(p) ? ' 📡 Remote hack unlocked.' : ''}`, 'win', '👀 FOUND!');
        log(`👀 ${p.name} found ${owner.name} in Hide & Seek`);
        return;
      }
    }
    if (p.task?.kind === 'handshake') {
      if (!owner.alive) return note(p.id, `${owner.name} is out — doesn't count.`);
      if (p.task.got.includes(owner.id)) return note(p.id, `🤝 Already got ${owner.name}. Find someone else!`);
      p.task.got.push(owner.id);
      if (p.task.got.length >= p.task.need) completeTask(p, null);
      else note(p.id, `🤝 ${owner.name} scanned! ${p.task.got.length}/${p.task.need}`, 'good');
      return;
    }
    if (p.task?.kind === 'courier' && p.task.target === owner.id) return note(p.id, `📦 Wrong way round: ${owner.name} must scan YOUR badge.`);
    note(p.id, `👋 That's ${owner.name}'s badge. Nothing happens right now.`);
  }

  // ---------- Lobby ----------
  function startLobby(reason, by, found) {
    const t = now();
    S.timeLeftAtPause = Math.max(0, S.timerEndsAt - t);
    for (const d of Object.values(S.duels)) endDuel(d);
    S.breach = null;
    const dropped = [];
    for (const x of alive()) {
      x.task = null;
      if (!(x.pending || x.remote)) continue;
      const byId = (x.pending || x.remote).by;
      if (x.role === 'clutch' && !x.clutchUsed) {
        x.clutchUsed = true; x.pending = null; x.remote = null;
        note(x.id, `${P(byId)?.name ?? 'A glitch'} just tried to hack you, noob.`, 'win', '😎 CLUTCH!');
        log(`😎 ${x.name} clutched a hack from ${P(byId)?.name ?? 'a glitch'}`);
        continue;
      }
      goAfk(x, byId); x.found = true; dropped.push(x.name);
    }
    S.phase = 'lobby';
    S.lobby = { reason, by: by.id, found: found ? found.id : null, dropped, stage: 'gather',
      endsAt: t + set().gatherSec * 1000, arrived: { [by.id]: true }, late: [], ready: {}, votes: {}, outcome: null };
    news(reason === 'afk' ? `⚠️ ERROR 404 — ${found.name} was found AFK by ${by.name}` : `📢 ${by.name} called everyone to the Lobby!`);
    if (dropped.length) news(`📴 Disconnected when the Lobby started: ${dropped.join(', ')}`);
    checkWin();
  }

  function advanceLobby() {
    const L = S.lobby, t = now();
    if (!L) return;
    if (L.stage === 'gather') {
      L.late = alive().filter((p) => !L.arrived[p.id]).map((p) => p.id);
      if (L.late.length) news(`⏰ Late to the Lobby (no vote this time): ${L.late.map((id) => P(id).name).join(', ')}`);
      L.stage = 'talk'; L.endsAt = t + set().talkSec * 1000;
    } else if (L.stage === 'talk') { L.stage = 'vote'; L.endsAt = t + set().voteSec * 1000; }
    else if (L.stage === 'vote') { tally(); L.stage = 'result'; L.endsAt = t + 13000; }
    else if (L.stage === 'result') {
      // the win check waits until everyone has seen the dramatic vote reveal
      checkWin();
      if (S.phase === 'ended') { dirty = true; return; }
      S.phase = 'playing'; S.lobby = null; S.round++;
      S.timerEndsAt = t + S.timeLeftAtPause;
      S.nextForcedAt = t + set().forcedDuelMin * MIN;
      if (S.penaltyPending) { S.penaltyPending = false; S.penaltyAt = t + MIN; }
      S.keyWiped = false;
      newBadges(alive());
      giveKey();
      news(`▶️ Round ${S.round} — go go go!`);
    }
    dirty = true;
  }

  const voters = () => alive().filter((p) => !S.lobby.late.includes(p.id));

  function tally() {
    const L = S.lobby;
    const counts = {}; let skip = 0;
    for (const [voter, target] of Object.entries(L.votes)) {
      const v = P(voter);
      if (!v?.alive || L.late.includes(voter)) continue;
      const w = v.role === 'captain' ? 2 : 1;
      if (target === 'skip') skip += w; else counts[target] = (counts[target] || 0) + w;
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    for (const [id, n] of ranked) if (P(id)) P(id).votes += n;
    const top = ranked[0];
    const tie = ranked.length > 1 && ranked[1][1] === top[1];
    const board = { counts, skip };
    if (top && !tie && top[1] > skip) {
      const k = P(top[0]);
      k.alive = false; k.kicked = true; k.task = null;
      if (k.duel && S.duels[k.duel]) endDuel(S.duels[k.duel]);
      if (S.keyHolder === k.id) S.keyHolder = null;
      const r = set().reveal;
      const teamTxt = k.team === 'hacker' ? 'a HACKER 💀' : k.team === 'npc' ? 'an NPC 🤖' : 'a Gamer 🎮';
      const what = r === 'role' ? ` They were: ${ROLE_NAME(k)}.` : r === 'team' ? (k.team === 'hacker' ? ' They were a HACKER 💀' : ` They were ${teamTxt}… not a Hacker.`) : '';
      L.outcome = { kicked: k.id, text: `${k.name} got Vote Kicked!${what}`, team: r === 'none' ? null : k.team, ...board };
      log(`🥾 ${k.name} (${ROLE_INFO[k.role]?.name || k.role}) was Vote Kicked with ${top[1]} votes`);
      if (k.role === 'troll') npcWin(k, 'They actually kicked you. Masterful trolling.');
      else note(k.id, 'The group voted you out. Follow the rest from the sidelines — and no talking!', 'lose', 'KICKED', { delay: Math.round((3 + (Object.keys(counts).length + 1) * 0.9) * 1000 + 400) }); // shown after the vote reveal
      for (const b of inGame()) if (b.role === 'bounty' && b.target === k.id && b.id !== k.id) npcWin(b, `${k.name} got kicked. Bounty collected. 💰`);
    } else {
      const text = !top && !skip ? 'Nobody voted. Nobody gets kicked.'
        : skip >= (top ? top[1] : 0) ? 'The Lobby skipped. Nobody gets kicked.' : 'It\'s a tie. Nobody gets kicked.';
      L.outcome = { kicked: null, text, ...board };
      if (Math.random() < 0.5) S.penaltyPending = true;
    }
    news(L.outcome.text);
  }
  const ROLE_NAME = (k) => ({ hacker: 'a HACKER 💀', trojan: 'a HACKER (Malware) 💀', ddos: 'a HACKER (DDoS) 💀', insider: 'the TROJAN (Hacker team) 💀' }[k.role]
    || `the ${ROLE_INFO[k.role]?.name || k.role} (${k.team === 'npc' ? 'NPC' : 'Gamer'})`);

  // ---------- events + sabotage ----------
  function fireEvent() {
    const lvl = set().events;
    S.nextEventAt = lvl === 'off' ? 0 : now() + (lvl === 'rare' ? 7 + Math.random() * 3 : 4 + Math.random() * 2) * MIN;
    if (S.breach) return;
    const kinds = ['surge', 'leak', 'update', 'bounty', 'key'];
    const k = pick(kinds), t = now();
    // events are announced in the news + a full-screen message for everyone
    if (k === 'surge') { S.surgeUntil = t + 2 * MIN; noteAll('For 2 minutes, every duel win gives DOUBLE progress. Go fight!', 'alert', '⚡ POWER SURGE'); news('⚡ POWER SURGE — duel wins count double for 2 min!'); }
    if (k === 'leak') {
      const v = pick(alive());
      if (v) { noteAll(`Leaked file: ${v.name} is ${ROLE_NAME(v)}.`, 'alarm', '🔓 DATA LEAK'); news(`🔓 DATA LEAK: ${v.name} is ${ROLE_NAME(v)}`); log(`🔓 Data leak revealed ${v.name}`); }
    }
    if (k === 'update') { S.freezeAllUntil = t + 20000; noteAll('Every phone is frozen for 20 seconds. Anyone in the middle of a game must restart it.', 'alert', '🔄 SYSTEM UPDATE'); news('🔄 SYSTEM UPDATE — everyone frozen for 20 s'); }
    if (k === 'bounty') { S.bountyOpen = true; noteAll('The first Gamer to finish a game gets a Firewall shield. GO!', 'alert', '🎯 BOUNTY'); news('🎯 BOUNTY: first finished game wins a shield'); }
    if (k === 'key') {
      const h = P(S.keyHolder);
      if (h) { noteAll(`${h.name} holds the Lobby Key right now. Beat them in a duel to steal it!`, 'alert', '🔑 KEY EXPOSED'); news(`🔑 KEY EXPOSED: ${h.name} has it`); }
    }
    dirty = true;
  }

  function sabotage(p, kind) {
    const t = now();
    if (!set().sabotage || !canHack(p)) return;
    if (t < S.sabReadyAt) return note(p.id, `💣 Sabotage recharging: ${Math.ceil((S.sabReadyAt - t) / 1000)} s.`);
    if (kind === 'breach') {
      if (t < S.breachReadyAt || S.breach) return note(p.id, '💣 Dual Breach not ready yet.');
      const fixers = shuffle(alive().filter((x) => !frozen(x))).slice(0, 2);
      if (fixers.length < 2) return;
      S.breach = { until: t + MIN, fixers: fixers.map((x) => x.id), fixed: {}, g: Object.fromEntries(fixers.map((x) => [x.id, pick(EMERGENCY_IDS)])) };
      S.breachReadyAt = t + 6 * MIN;
      for (const x of fixers) note(x.id, 'You were picked to fix it! Finish the fix game within 60 s or the network loses 20%.', 'alarm', '🚨 DUAL BREACH');
      for (const x of inGame()) if (!fixers.includes(x)) note(x.id, `${fixers.map((f) => f.name).join(' and ')} must fix it in 60 s — or the network loses 20%!`, 'alarm', '🚨 DUAL BREACH');
      news(`🚨 DUAL BREACH — ${fixers.map((x) => x.name).join(' & ')} must fix it!`);
    } else if (kind === 'lag') {
      if (S.lagUsed) return note(p.id, 'Lag Spike already used.');
      S.lagUsed = true; S.lagUntil = t + 2 * MIN;
      noteAll('All duels are harder for 2 minutes.', 'alert', '🐌 LAG SPIKE'); news('🐌 LAG SPIKE — duels are harder for 2 min');
    } else if (kind === 'wipe') {
      if (S.wipeUsed) return note(p.id, 'Key Wipe already used.');
      S.wipeUsed = true; S.keyWiped = true; S.keyHolder = null;
      noteAll('The Lobby Key is gone until the next Lobby.', 'alert', '🔑 KEY WIPED'); news('🔑 KEY WIPED — no Lobby Key until the next Lobby');
    } else return;
    log(`💣 ${p.name} used sabotage: ${kind}`);
    S.sabReadyAt = t + 5 * MIN;
  }

  function breachDone(success, byPatcher) {
    const b = S.breach; if (!b) return;
    S.breach = null;
    if (success) {
      if (byPatcher) { addCredits(Math.round(S.goal * 0.1)); news('🔧 The Patcher fixed the breach alone! +10%'); noteAll('The Patcher fixed it alone. +10% to the network!', 'win', '🔧 PATCHED'); }
      else { news('✅ Breach fixed!'); noteAll('The breach was fixed in time.', 'good', '✅ BREACH FIXED'); }
    } else {
      addCredits(-Math.round(S.goal * 0.2));
      news('💥 Breach FAILED — the network lost 20%');
      noteAll('Nobody fixed it in time. The network lost 20%!', 'lose', '💥 BREACH FAILED');
    }
  }

  // ---------- player actions while playing ----------
  function playAction(p, a) {
    const t = now();
    if (!p.alive) return false;
    const blockedActs = ['taskOpen', 'gameDone', 'duelRandom', 'badge', 'goLive', 'debug', 'ddos', 'fwSelf', 'remoteHack', 'sabotage', 'keyLobby'];
    if (frozen(p) && blockedActs.includes(a.type)) { note(p.id, '🧊 Your phone is frozen!', 'bad'); return true; }
    switch (a.type) {
      case 'taskOpen': {
        const g = p.games[a.i];
        if (!g || g.done || !SOCIAL_IDS.includes(g.t) || inActiveDuel(p) || (t < p.readyAt - 500 && !freePlay(p)) || p.task) return true;
        if (g.t === 'dare') p.task = { i: a.i, kind: 'dare', text: pick(DARES) };
        if (g.t === 'handshake') p.task = { i: a.i, kind: 'handshake', need: 2, got: [] };
        if (g.t === 'courier') {
          const others = alive().filter((x) => x.id !== p.id);
          if (!others.length) return true;
          const target = pick(others);
          // 60 s to deliver; the name is revealed in the last 15 s
          p.task = { i: a.i, kind: 'courier', target: target.id, clue: courierClue(p, target), at: t, until: t + MIN, reveal: t + 45000 };
        }
        if (g.t === 'vanish') {
          // 20 s to hide, then 40 s of hunting
          p.task = { i: a.i, kind: 'vanish', huntAt: t + 20000, until: t + MIN };
          for (const x of alive()) if (x.id !== p.id) note(x.id, `${p.name} is hiding RIGHT NOW. In 20 s the hunt starts: find them and scan their badge within 40 s!`, 'alert', '👀 HIDE & SEEK');
        }
        return true;
      }
      case 'taskCancel': {
        if (p.task) { p.task = null; p.readyAt = t + set().penaltySec * 1000; note(p.id, `❌ Gave up — no games for ${Math.round(set().penaltySec / 60)} min.`, 'bad'); }
        return true;
      }
      case 'gameDone': {
        const g = p.games[a.i];
        // Hackers' games don't count, so they can play any game at any time (no cooldown, no ban)
        if (!g || g.done || SOCIAL_IDS.includes(g.t) || inActiveDuel(p) || (t < p.readyAt - 500 && !freePlay(p))) return true;
        if (a.ok) gameWon(p, a.i);
        else {
          p.games[a.i] = { t: otherGame(g.t, p), z: zonePick(g.z), done: false };
          if (!freePlay(p)) p.readyAt = t + set().penaltySec * 1000;
          if (freePlay(p)) note(p.id, '❌ Fake game failed — a new one was added.', 'bad'); else note(p.id, `❌ Game failed — no games for ${Math.round(set().penaltySec / 60)} min. A new one was added.`, 'bad');
        }
        return true;
      }
      case 'gameSkip': {
        p.nosens = true;
        p.games = p.games.map((g) => (!g.done && SENSOR_IDS.includes(g.t)) ? { t: otherGame(g.t, p), z: g.z, done: false } : g);
        note(p.id, '🔁 That game needs a camera/mic your phone can\'t use — swapped it.');
        return true;
      }
      case 'badge': badgeScan(p, a); return true;
      case 'duelRandom': {
        if (p.duel) return true;
        if (t < p.readyAt - 500) { note(p.id, '⏳ Cooldown first — keep walking!'); return true; }
        const free = alive().filter((q) => q.id !== p.id && !q.duel && !q.remote);
        if (!free.length) { note(p.id, '⚔️ Nobody is free to duel right now.'); return true; }
        const q = pick(free);
        newDuel(p, q, false);
        note(p.id, `The game picked ${q.name}. Find them — one of you scans the other's badge!`, 'alert', `⚔️ VS ${q.name.toUpperCase()}`);
        note(q.id, `${p.name} wants to fight! Find them — one of you scans the other's badge.`, 'alert', '⚔️ CHALLENGE!');
        return true;
      }
      case 'duelRefuse': {
        const d = duelOf(p);
        if (d && d.b === p.id && !d.forced && d.st !== 'active') {
          endDuel(d);
          p.readyAt = t + set().penaltySec * 1000;
          note(d.a, `🐔 ${p.name} chickened out of your duel.`);
          note(p.id, `🐔 Duel refused — no games for ${Math.round(set().penaltySec / 60)} min.`, 'bad');
        }
        return true;
      }
      case 'duelCancel': {
        const d = duelOf(p);
        if (d && d.a === p.id && !d.forced && d.st !== 'active') { endDuel(d); note(d.b, `${p.name} cancelled the duel.`); }
        return true;
      }
      case 'duelScore': {
        const d = S.duels[a.id];
        if (!d || d.st !== 'active' || (d.a !== p.id && d.b !== p.id) || d.score[p.id] != null) return true;
        const better = DUEL_BETTER[d.g];
        d.score[p.id] = better === 'rps' ? String(a.score).slice(0, 3) : Number(a.score);
        const other = d.a === p.id ? d.b : d.a;
        if (d.score[other] != null) resolveDuel(d);
        // TIME games (lower = better): the first to finish wins on the spot; a fail (huge time) hands the win to the other player.
        else if (better === 'low') resolveDuel(d, d.score[p.id] < 90000 ? p.id : other);
        // COUNT games: the first one out loses as soon as the other beats their score (their phone ends the duel automatically).
        return true;
      }
      case 'hackTick': {
        const q = P(a.target);
        if (!canHack(p) || frozen(p) || !q || !q.alive || q.team === 'hacker' || q.pending || q.remote) return false;
        if (t - (p.progT[q.id] || 0) < 800) return false;
        p.progT[q.id] = t;
        p.prog[q.id] = (p.prog[q.id] || 0) + 1;
        p.hackTarget = q.id;
        if (p.prog[q.id] % 5 === 0) dirty = true; // share progress every 5 s so it is never lost
        if (p.prog[q.id] >= set().hackSec) {
          p.prog[q.id] = 0;
          if (applyHack(q, p.id, 'close') !== 'trap') note(p.id, `${q.name} is infected. They drop in ${set().afkDelay} s. Act natural.`, 'win', '💀 HACK PLANTED');
          return true;
        }
        return false;
      }
      case 'remoteHack': {
        const q = P(a.target);
        if (!canHack(p) || p.charges < 1) return true;
        if (!q || !q.alive || q.team === 'hacker' || q.pending || q.remote) { note(p.id, '📡 Can\'t reach them right now.'); return true; }
        p.charges--;
        const res = applyHack(q, p.id, 'remote');
        if (res !== 'trap') note(p.id, `📡 Remote hack fired at ${q.name}.`, 'good');
        if (res === true) { q.task = q.task?.kind === 'vanish' ? null : q.task; q.remote = { id: newId('r'), at: t + set().afkDelay * 1000, by: p.id, g: pick(EMERGENCY_IDS) }; }
        return true;
      }
      case 'emergencyDone': {
        if (!p.remote) return true;
        if (a.ok) { log(`🛡️ ${p.name} fought off a remote hack`); p.remote = null; note(p.id, 'You fought off the hack. Respect.', 'win', '🛡️ SURVIVED'); }
        else goAfk(p, p.remote.by);
        return true;
      }
      case 'keyLobby': { if (S.keyHolder === p.id) startLobby('key', p, null); return true; }
      // ----- role powers -----
      case 'fwSelf': {
        if (p.role !== 'firewall' || !powerReady(p)) return true;
        p.powerAt = t + cdMs(p); p.shield = true;
        note(p.id, 'Shield on yourself. The next hack bounces off.', 'good', '🧱 SHIELDED');
        return true;
      }
      case 'goLive': {
        if (p.role !== 'streamer' || !powerReady(p)) return true;
        p.liveUntil = t + 2 * MIN; p.powerAt = p.liveUntil + cdMs(p);
        note(p.id, 'You are LIVE for 2 minutes. Anyone who hacks you now gets exposed!', 'alert', '🔴 LIVE');
        log(`🔴 ${p.name} went live`);
        return true;
      }
      case 'debug': {
        const q = P(a.target);
        if (p.role !== 'debugger' || !q || !powerReady(p)) return true;
        p.powerAt = t + cdMs(p);
        if (q.mod === 'vpn') note(p.id, `🔒 ${q.name}: VPN detected. No data.`, 'bad');
        else note(p.id, `${q.name} ${t - (q.lastWinAt || 0) < 3 * MIN ? 'WON a duel in the last 3 minutes. 🤨' : 'has NOT won a duel in the last 3 minutes.'}`, 'info', '🐞 DEBUG RESULT');
        return true;
      }
      case 'ddos': {
        const q = P(a.target);
        if (p.role !== 'ddos' || !q || !q.alive || q.team === 'hacker' || !powerReady(p)) return true;
        p.powerAt = t + cdMs(p); q.frozenUntil = t + MIN;
        note(q.id, 'Your phone is frozen for 60 seconds. No games, duels or scans.', 'alarm', '🌊 DDoS ATTACK');
        note(p.id, `🌊 ${q.name} is frozen for 60 s.`, 'good');
        log(`🌊 ${p.name} DDoSed ${q.name}`);
        return true;
      }
      case 'pickIdol': {
        const q = P(a.target);
        if (p.role !== 'fanboy' || p.idol || !q || q === p) return true;
        p.idol = q.id; note(p.id, `${q.name} is your idol now. Make their team win!`, 'good', '🤩 IDOL PICKED');
        return true;
      }
      case 'sabotage': sabotage(p, a.kind); return true;
      case 'breachFix': {
        const b = S.breach;
        if (!b) return true;
        if (a.patch) { if (p.role === 'patcher') breachDone(true, true); return true; }
        if (!b.fixers.includes(p.id) || b.fixed[p.id]) return true;
        if (a.ok) { b.fixed[p.id] = true; note(p.id, '✅ Your part of the breach is fixed!', 'good'); if (b.fixers.every((id) => b.fixed[id] || !P(id)?.alive)) breachDone(true, false); }
        else b.g[p.id] = pick(EMERGENCY_IDS);
        return true;
      }
    }
    return false;
  }

  function lobbyAction(p, a) {
    const L = S.lobby;
    if (!L) return false;
    if (a.type === 'badge') { badgeScan(p, a); return true; }
    if (!p.alive) return false;
    switch (a.type) {
      case 'readyVote':
        if (L.stage !== 'talk' || L.ready[p.id]) return false; // can't undo
        L.ready[p.id] = true;
        if (alive().every((x) => L.ready[x.id])) advanceLobby();
        return true;
      case 'vote':
        if (L.stage !== 'vote' || L.late.includes(p.id) || L.votes[p.id]) return false; // one vote, no take-backs
        if (a.target !== 'skip' && !P(a.target)?.alive) return false;
        L.votes[p.id] = a.target;
        if (voters().every((x) => L.votes[x.id])) advanceLobby();
        return true;
      case 'pickIdol': return playAction(p, a);
    }
    return false;
  }

  // ---------- incoming actions ----------
  function handle(from, a) {
    try { if (_handle(from, a)) dirty = true; } catch (e) { console.error('engine error', e); }
  }

  function _handle(from, a) {
    if (!a || !a.type) return false;
    if (a.type === '_ping') return true;
    if (a.type === 'join') {
      const nm = String(a.name || 'Player').slice(0, 16);
      const p = P(from);
      const lvl = Math.max(1, Math.min(99, Number(a.lvl) || 1));
      if (p) { p.name = nm; p.lvl = lvl; if (a.av && S.phase === 'waiting') p.av = cleanAvatar(a.av); }
      else if (S.phase === 'waiting' && S.order.length < 12) { S.players[from] = Object.assign(newPlayer(from, nm, a.av), { lvl }); S.order.push(from); }
      else return true;
      // nobody shares a colour: if it's taken, give the first free one
      const me = P(from);
      const taken = new Set(Object.values(S.players).filter((x) => x.id !== from).map((x) => x.av.c));
      if (taken.has(me.av.c)) {
        const free = [...Array(12).keys()].find((c) => !taken.has(c));
        if (free !== undefined) { me.av = { ...me.av, c: free }; note(from, '🎨 Your colour was taken, so you got a new one.'); }
      }
      return true;
    }
    const p = P(from);
    if (!p) return false;
    const host = from === S.hostId;
    switch (a.type) {
      case 'settings':
        if (host && S.phase === 'waiting') {
          for (const [k, v] of Object.entries(a.patch || {})) if (k in DEFAULT_SETTINGS && typeof v === typeof DEFAULT_SETTINGS[k]) S.settings[k] = v;
        }
        return true;
      case 'settingsReset':
        if (host && S.phase === 'waiting') S.settings = { ...DEFAULT_SETTINGS };
        return true;
      case 'rolesView': // the host opened/closed the roles list -> it opens/closes for everyone
        if (host) S.rolesView = !!a.open;
        return true;
      case 'remove':
        if (host && S.phase === 'waiting' && a.id !== S.hostId) { delete S.players[a.id]; S.order = S.order.filter((x) => x !== a.id); }
        return true;
      case 'start':
        if (host && S.phase === 'waiting' && S.order.length >= 3) { S.rolesView = false; startGame(); }
        return true;
      case 'again':
        if (host && S.phase === 'ended') backToWaiting();
        return true;
      case 'endNow':
        if (host && (S.phase === 'playing' || S.phase === 'lobby')) endGame('none', 'The host ended the game.');
        return true;
      case 'next':
        if (host && S.phase === 'lobby') advanceLobby();
        return true;
    }
    if (S.phase === 'lobby') return lobbyAction(p, a);
    if (S.phase === 'playing') return playAction(p, a);
    return false;
  }

  // ---------- clock ----------
  function tick() {
    const t = now();
    if (S.phase === 'playing') {
      if (t >= S.timerEndsAt) return endGame('hackers', 'Time ran out — the Hackers win!');
      for (const p of alive()) {
        if (p.pending && t >= p.pending.at) goAfk(p, p.pending.by);
        else if (p.remote && t >= p.remote.at) goAfk(p, p.remote.by);
        if (p.task?.kind === 'vanish' && t >= p.task.until) { if (p.team === 'gamer') addCredits(1); completeTask(p, null, 'Nobody found you! +2 to the Network bar. Ninja level: maximum. 🥷'); }
        if (p.task?.kind === 'courier' && t >= p.task.until) {
          p.task = null; p.readyAt = t + set().penaltySec * 1000;
          note(p.id, `Time's up — the package expired. No games for ${Math.round(set().penaltySec / 60)} min.`, 'lose', '📦 TOO LATE');
        }
        if (p.role === 'bug' && !p.bugged && elapsed() >= S.totalMs / 2) {
          p.bugged = true;
          const pool = [...GAMER_ROLES.filter(enabled), 'gamer', 'gamer'];
          const nr = Math.random() < 0.3 ? 'hacker' : pick(pool);
          setRole(p, nr);
          note(p.id, `Your role glitched. You are now: ${nr.toUpperCase()}${nr === 'hacker' ? ' — you play for the Hackers now!' : ''} (check the Me tab).`, 'alarm', '🐛 ROLE GLITCH');
          log(`🐛 ${p.name} (Bug) glitched into ${nr}`);
        }
        if (p.role === 'ragequit' && !p.npcWon && elapsed() >= 10 * MIN) { setRole(p, 'gamer'); note(p.id, 'You survived 10 minutes. You are a normal Gamer now — help your team win!', 'info', '😤 RAGE OVER'); }
        if (p.role === 'fanboy' && !p.idol && elapsed() >= 2 * MIN) { const q = pick(alive().filter((x) => x.id !== p.id)); if (q) { p.idol = q.id; note(p.id, `You took too long, so your idol is ${q.name}.`, 'info', '🤩 IDOL PICKED'); } }
      }
      if (S.penaltyAt && t >= S.penaltyAt) penaltyHack();
      if (t >= S.keyMovesAt && !S.keyWiped) giveKey();
      if (t >= S.nextForcedAt) forcedDuel();
      if (S.nextEventAt && t >= S.nextEventAt) fireEvent();
      if (S.breach && t >= S.breach.until) breachDone(false);
      for (const d of Object.values(S.duels)) {
        const limit = d.forced ? 90000 : set().duelTimeout * 1000;
        if (d.st === 'pending' && t - d.at > limit) {
          if (d.forced) {
            for (const id of [d.a, d.b]) { const x = P(id); if (x) { x.readyAt = t + set().penaltySec * 1000; note(id, 'You didn\'t find each other in time. 2-minute game ban for both!', 'lose', '⌛ TOO SLOW'); } }
          } else { note(d.a, '⌛ Duel timed out — they never showed up.'); note(d.b, '⌛ Duel timed out.'); }
          endDuel(d);
        } else if (d.st === 'active' && t > d.startAt + 130000) resolveDuel(d);
      }
      checkWin();
    } else if (S.phase === 'lobby' && S.lobby && t >= S.lobby.endsAt) advanceLobby();
  }

  function flush() {
    if (!dirty) return;
    dirty = false;
    S.version++;
    S.hostNow = now();
    publish(S);
  }

  const t1 = setInterval(tick, 250);
  const t2 = setInterval(flush, 150);
  // test hook (used only by the developer to skip waiting times): window.__hpg.state / .fire()
  if (typeof window !== 'undefined') window.__hpg = { state: S, fire: fireEvent, touch: () => { dirty = true; }, handle };
  return { handle, stop() { clearInterval(t1); clearInterval(t2); } };
}
