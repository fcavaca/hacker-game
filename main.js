// SCREENS — what each player sees. Every phone runs this file. The host's phone also runs the engine.

import { connect, ONLINE } from './net.js?v=22';
import { createEngine } from './engine.js?v=22';
import { SOLO, DUEL, seeded, WIN_LINES, FAIL_LINES } from './games.js?v=22';
import { ROLE_INFO, SETTINGS_UI, MODIFIERS, HOW, GAMER_ROLES, HACKER_ROLES, NPC_ROLES, PLACES, SOLO_IDS, SOCIAL_IDS, SENSOR_IDS } from './config.js?v=22';
import { icon } from './icons.js?v=22';
import { avatarSVG, randomAvatar, cleanAvatar, AV_PARTS, unlockLevel, lockedFix, randomUnlocked } from './avatar.js?v=22';
import { loadProfile, createProfile, saveProfile, levelOf, levelProgress, recordGame, LEVELS } from './profile.js?v=22';
import { unlockAudio, setTrack, sfx, prefs, savePrefs } from './music.js?v=22';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), ov = $('#overlay'), toasts = $('#toasts'), spl = $('#splash'), modal = $('#modal');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const once = (fn) => { let used = false; return (v) => { if (!used) { used = true; fn(v); } }; };
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const shakeEl = (el) => { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

// ---------- who am I ----------
// one id per phone (kept after closing the browser), so re-opening the game never creates a second you
const me = { id: sessionStorage.getItem('pid') || localStorage.getItem('pid') || 'p' + Math.random().toString(36).slice(2, 10) };
sessionStorage.setItem('pid', me.id); localStorage.setItem('pid', me.id);
me.name = sessionStorage.getItem('name') || localStorage.getItem('name') || '';
const savedAv = sessionStorage.getItem('av') || localStorage.getItem('av');
let profile = loadProfile();
const myLevel = () => (profile ? levelOf(profile.xp) : 1);
me.av = savedAv && JSON.parse(savedAv).hc !== undefined ? cleanAvatar(JSON.parse(savedAv)) : randomUnlocked(myLevel());
if (profile && !me.name) me.name = profile.name;
// the character is saved on the phone the moment you change it, so it stays the same game after game
function storeAv() { for (const st of [localStorage, sessionStorage]) st.setItem('av', JSON.stringify(me.av)); }
if (!savedAv) storeAv();
const joinMsg = () => ({ type: 'join', name: me.name, av: me.av, lvl: myLevel() });

let S = null, offset = 0, net = null, engine = null, isHost = false, room = null;
const ui = { overlay: null, cleanup: null, roleShownFor: sessionStorage.getItem('roleShown'), duelPlayed: null, emergencyFor: null,
  tab: 'net', outTab: 'news', revealRole: false, error: '', home: 'main', editAv: false, splashQ: [], splashOn: false, later: [],
  viewKey: '', socialPending: false, breachFor: null, frozenShown: false };
const seen = new Set(JSON.parse(sessionStorage.getItem('seen') || '[]'));

const hnow = () => Date.now() + offset;
const mine = () => S?.players?.[me.id];
const pl = (id) => S?.players?.[id];
const pname = (id) => pl(id)?.name ?? '???';
const av = (p, size = 36, cls = '') => avatarSVG(p?.av, size, cls);
const roleText = (r) => (ROLE_INFO[r]?.text || '').replace('{hack}', S.settings.hackSec).replace('{afk}', S.settings.afkDelay).replace('{scans}', S.settings.itScans).replace('{cd}', S.settings.powerCd);
const duelOf = (p) => (p?.duel ? S.duels?.[p.duel] : null);
const frozenUntil = (p) => Math.max(p?.frozenUntil || 0, S?.freezeAllUntil || 0);
const canHack = (p) => p.team === 'hacker' && p.role !== 'insider';

function enterCls(key) { if (key === ui.viewKey) return ''; ui.viewKey = key; return 'enter'; }

// ---------- QR codes ----------
function qrSVG(text, size = 220) {
  if (!window.qrcode) return '<div class="qr-missing">QR unavailable</div>';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg class="qr" width="${size}" height="${size}" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#06070d"/></svg>`;
}
const badgeBlock = (p, size = 210) => `<div class="badge-box">${qrSVG('HPG:' + p.badge, size)}<div class="badge-code">${esc(p.badge)}</div></div>`;

// ---------- sending / receiving ----------
function act(a) {
  a = JSON.parse(JSON.stringify(a));
  if (isHost) engine.handle(me.id, a);
  else net?.sendAction(me.id, a);
}

function publish(state) {
  const str = JSON.stringify(state);
  net?.publish(str);
  try { localStorage.setItem('host-' + room, str); } catch { /* storage full */ }
  receive(JSON.parse(str));
}

function receive(s) {
  const prevPhase = S?.phase, prevStage = S?.lobby?.stage;
  S = s;
  offset = s.hostNow ? s.hostNow - Date.now() : 0;
  // the host remembers the settings for next time
  if (isHost && S.phase === 'waiting') try { localStorage.setItem('hpg-last-settings', JSON.stringify(S.settings)); } catch { /* ignore */ }
  if (prevPhase !== S.phase) onPhaseChange(prevPhase);
  if (S.phase === 'lobby' && S.lobby?.stage === 'result' && prevStage === 'vote') onVoteResult();
  // not in the room yet (game was running, or the first join got lost): keep asking to join while the room is open
  if (!isHost && !ui.leaving && !mine() && S.phase === 'waiting' && Date.now() - (ui.lastJoin || 0) > 2500) { ui.lastJoin = Date.now(); act(joinMsg()); }
  handleNotes();
  syncOverlays();
  render();
}

function onPhaseChange(prev) {
  if (S.phase === 'lobby' && prev === 'playing') {
    const L = S.lobby;
    showSplash({ kind: 'alarm', title: L.reason === 'afk' ? 'ERROR 404' : 'LOBBY!', text: L.reason === 'afk' ? `${pname(L.found)} was found AFK. Everyone to the Lobby!` : `${pname(L.by)} called everyone to the Lobby!` });
  }
  if (S.phase === 'playing' && prev === 'waiting') ui.tab = 'net';
  if (S.phase === 'ended') {
    closeOverlay();
    const p = mine();
    if (p?.team) {
      const won = S.result?.winner === (p.team === 'hacker' ? 'hackers' : 'gamers') || p.npcWon;
      showSplash(S.result?.winner === 'none' ? { kind: 'info', title: 'GAME OVER', text: S.result.text, tapOnly: true }
        : { kind: won ? 'win' : 'lose', title: won ? 'VICTORY' : 'DEFEAT', text: S.result.text, tapOnly: true });
      const r = S.result?.winner !== 'none' ? recordGame(S, me.id) : null;
      if (r) {
        profile = loadProfile();
        ui.lastXp = r;
        showSplash({ kind: 'good', title: `+${r.gained.total} XP`, text: r.gained.parts.map(([k, v]) => `${k} +${v}`).join(' · '), tapOnly: true });
        if (r.after > r.before) showSplash({ kind: 'win', title: `LEVEL ${r.after}!`, text: 'You leveled up — new customisations unlocked! Check your character.', tapOnly: true });
      }
    }
  }
}

// the game logo: "TrustIssues" + ".exe" that slams down and cracks the ground (still = already cracked, no animation)
function tiLogo(still = false, tag = 'has stopped working.') {
  const rocks = [[-90, -70, 200], [85, -80, -160], [-130, -20, 90], [125, -30, -240], [-50, -110, 300], [40, -120, -120], [-160, 10, 60], [160, 5, -90]]
    .map(([x, y, r]) => `<b class="ti-rock" style="--x:${x}px;--y:${y}px;--r:${r}deg"></b>`).join('');
  return `<div class="ti-logo ${still ? 'still' : ''}"><span class="ti-name">TrustIssues</span><span class="ti-exe">.exe<svg class="ti-cracks" viewBox="-150 -60 300 120" aria-hidden="true"><path d="M0 0L-28 7L-52 3L-88 17L-145 12"/><path d="M0 0L24 9L58 5L96 21L148 16"/><path d="M0 0L-11 24L-29 39L-36 60"/><path d="M0 0L13 21L9 39L27 58"/><path d="M0 0L-44 -7L-82 -3"/><path d="M0 0L41 -9L72 -5"/><path d="M-52 3L-60 27"/><path d="M58 5L69 31"/></svg><i class="ti-flash"></i>${rocks}</span><div class="ti-ground"></div><small class="ti-tag">${esc(tag)}</small></div>`;
}

// voted out: the player gets up from their computer and walks away; the screen says DISCONNECTED
function leaveScene(k) {
  return `<div class="leave-scene"><div class="ls-person">${av(k, 92)}</div><div class="ls-chair"></div><div class="ls-desk"></div><div class="ls-monitor"><div class="ls-screen"><span class="on">ONLINE</span><span class="off">DISCONNECTED</span></div><i></i></div><div class="ls-bye">👋</div></div>`;
}

// drum roll + big reveal when the votes are counted
function onVoteResult() {
  const o = S.lobby.outcome || {};
  const n = Object.keys(o.counts || {}).length + 1;
  const revealAt = (3 + n * 0.9) * 1000; // matches the bar animation timing in renderLobby
  sfx('drum'); setTimeout(() => sfx('drum'), 1500);
  setTimeout(() => {
    if (S.phase !== 'lobby') return;
    sfx('reveal');
    if (o.kicked === me.id) return; // the kicked player gets their own KICKED message
    const k = pl(o.kicked);
    if (!k) return showSplash({ kind: 'info', title: 'NO KICK', text: o.text });
    const good = o.team === 'hacker' ? (mine()?.team === 'hacker' ? 'lose' : 'win') : o.team ? 'lose' : 'alert';
    showSplash({ kind: good, title: o.team === 'hacker' ? 'HACKER DOWN!' : 'VOTED OUT!', text: o.text, scene: k.id });
  }, revealAt + 400);
}

// ---------- rooms ----------
function makeCode() { const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; return Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join(''); }

function saveMe() {
  const v = ($('#name')?.value ?? me.name).trim();
  if (!v) { ui.error = 'Pick a nickname first!'; render(); return false; }
  me.name = v.slice(0, 16);
  const fix = lockedFix(me.av, myLevel());
  if (fix.changed) { me.av = fix.av; toast('🔒 Some items on your character are locked — level up to use them!', 'bad'); }
  if (!profile) profile = createProfile(me.name); else if (profile.name !== me.name) { profile.name = me.name; saveProfile(profile); }
  for (const st of [localStorage, sessionStorage]) { st.setItem('name', me.name); st.setItem('av', JSON.stringify(me.av)); }
  return true;
}

async function startHost(saved) {
  net = await connect(room, { isHost: true, onAction: (from, a) => engine.handle(from, a) });
  engine = createEngine(room, me.id, publish, saved);
}

async function createRoom() {
  if (!saveMe()) return;
  room = makeCode(); isHost = true;
  sessionStorage.setItem('room', room); sessionStorage.setItem('hostOf', room);
  app.innerHTML = '<div class="screen center loading">Booting the server…</div>';
  await startHost(null);
  act(joinMsg());
  try { const last = JSON.parse(localStorage.getItem('hpg-last-settings')); if (last) act({ type: 'settings', patch: last }); } catch { /* ignore */ }
}

async function joinRoom() {
  const code = ($('#code')?.value || '').trim().toUpperCase();
  if (code.length !== 4) { ui.error = 'Room codes have 4 letters.'; return render(); }
  room = code; isHost = false;
  app.innerHTML = '<div class="screen center loading">Connecting…</div>';
  net = await connect(room, { isHost: false, onState: receive });
  if (!(await net.exists())) {
    // 🥚 a few joke codes
    ui.error = { HACK: 'Nice try. You can\'t hack the join screen. 🤨', NOOB: 'Room NOOB is just you. Forever. 🫠', OHIO: 'Room OHIO exists… in another dimension. 🌽', SIGM: 'Sigmas don\'t join rooms. Rooms join them. 🗿' }[code]
      || `Room ${code} doesn't exist. Check the code!`;
    net.close?.(); net = null; room = null;
    return render();
  }
  sessionStorage.setItem('room', room);
  act(joinMsg());
}

// the host ended the room: send everyone back to the start screen
function roomClosed() {
  if (isHost) return;
  sessionStorage.removeItem('room');
  net?.close?.(); net = null;
  ui.overlay = null; ov.className = ''; ov.innerHTML = '';
  app.innerHTML = `<div class="screen center ${enterCls('closed')}"><h2>ROOM CLOSED</h2><p class="hint center">The host ended the room. See you next game!</p><button class="btn big hot" id="home">${icon('left')} Back to start</button></div>`;
  $('#home').onclick = () => location.reload();
}

// keep the screen awake during a game. Most important on the HOST's phone: it runs the whole game,
// and if it locks, nobody's games/duels get counted until it wakes up again.
let wakeLock = null;
async function keepAwake() {
  const want = room && S && ['playing', 'lobby', 'waiting'].includes(S.phase);
  if (!want || document.visibilityState !== 'visible' || wakeLock || !navigator.wakeLock) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch { /* not allowed right now */ }
}
document.addEventListener('visibilitychange', keepAwake);
document.addEventListener('pointerdown', keepAwake, { passive: true });
setInterval(keepAwake, 10000);

// tell the host "I'm still here" every 15 s (phones that close the game drop out of the waiting room)
setInterval(() => { if (room && S && mine() && S.phase !== 'closed') act({ type: 'hb' }); }, 15000);

async function leave() {
  if (!(await ask(isHost ? 'End the room?' : 'Leave the room?', isHost ? 'You are the host — leaving ends the game for everyone.' : S?.phase === 'playing' || S?.phase === 'lobby' ? 'You will be out of this game.' : 'You can join again with the code.', 'Leave'))) return;
  ui.leaving = true; // don't auto-rejoin while the goodbye message goes out
  act({ type: isHost ? 'closeRoom' : 'leave' });
  await new Promise((r) => setTimeout(r, 700)); // give the message time to reach everyone
  if (isHost) localStorage.removeItem('host-' + room);
  sessionStorage.removeItem('room'); sessionStorage.removeItem('hostOf');
  location.reload();
}

// ---------- notifications ----------
function handleNotes() {
  for (const n of S.notes?.[me.id] || []) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    if (n.siren) siren();
    if (n.later && isBusy()) { ui.later.push(n); continue; } // no immediate effect: wait until the game/duel is over
    if (n.delay) { setTimeout(() => { if (n.title) showSplash(n); else toast(n.text, n.kind); }, n.delay); continue; }
    if (n.title) showSplash(n); else toast(n.text, n.kind);
  }
  sessionStorage.setItem('seen', JSON.stringify([...seen].slice(-300)));
  flushLater();
}
// busy = playing a game, in a duel, reading your role… (messages with no immediate effect wait)
function isBusy() {
  if (S?.phase === 'playing' && mine()?.team && ui.roleShownFor !== S.gameId) return true;
  return ['role', 'game', 'duel', 'intro', 'social', 'breach', 'emergency', 'hack', 'frozen'].includes(ui.overlay);
}
function flushLater() {
  if (!ui.later.length || isBusy()) return;
  for (const n of ui.later.splice(0)) { if (n.title) showSplash(n); else toast(n.text, n.kind); }
}

function toast(text, kind = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = text;
  t.onclick = () => t.remove();
  toasts.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4200);
  beep(kind);
}

function confetti(host, n = 60) {
  const cols = ['#00e08a', '#ffd23f', '#ff4d4d', '#ffb020', '#fff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = pickOne(cols);
    c.style.animationDelay = Math.random() * 0.6 + 's';
    c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    host.appendChild(c);
  }
}

// Full-screen messages. If many pile up, the oldest unimportant ones are dropped (max 3 waiting).
function showSplash(n) {
  ui.splashQ.push(n);
  while (ui.splashQ.length > 3) {
    const i = ui.splashQ.findIndex((x) => !['alarm', 'win', 'lose'].includes(x.kind));
    ui.splashQ.splice(i >= 0 ? i : 0, 1);
  }
  if (!ui.splashOn) nextSplash();
}
function nextSplash() {
  const n = ui.splashQ.shift();
  if (!n) { ui.splashOn = false; spl.className = ''; spl.innerHTML = ''; return; }
  ui.splashOn = true;
  // role results (IT Guy scan, Debugger…) first play a "scanning" animation, then reveal the answer
  if (n.reveal) {
    spl.className = 'show scanning';
    spl.onclick = null;
    const who = n.who ? pl(n.who) : null;
    spl.innerHTML = `<div class="sp-inner"><div class="scan-av">${who ? av(who, 120) : `<div class="sp-icon">${icon('crosshair')}</div>`}<i class="scan-beam"></i></div><div class="sp-title">${esc(n.scanText || 'SCANNING…')}</div><div class="scan-bar"><div></div></div><div class="sp-text mono">${who ? esc(who.name) : ''}</div></div>`;
    sfx('tick'); setTimeout(() => sfx('tick'), 600); setTimeout(() => sfx('tick'), 1200);
    setTimeout(() => drawSplash(n), 1900);
    return;
  }
  drawSplash(n);
}
function drawSplash(n) {
  const ic = { win: 'trophy', lose: 'skull', alarm: 'alert', alert: 'swords', good: 'shield', info: 'zap', bad: 'x' }[n.kind] || 'zap';
  spl.className = 'show ' + n.kind + (n.reveal ? ' revealed' : '');
  spl.innerHTML = `<div class="sp-rays"></div><div class="sp-inner">${n.scene && pl(n.scene) ? leaveScene(pl(n.scene)) : n.who && pl(n.who) ? `<div class="sp-who">${av(pl(n.who), 90)}</div>` : `<div class="sp-icon">${icon(ic)}</div>`}<div class="sp-title glitch" data-t="${esc(n.title)}">${esc(n.title)}</div><div class="sp-text">${esc(n.text)}</div>${n.btn ? `<button class="btn big hot sp-btn">${n.btn.label}</button>` : ''}<div class="sp-tap">tap to continue</div></div>`;
  if (n.btn) $('.sp-btn', spl).onclick = (e) => { e.stopPropagation(); n.btn.fn(); close(); };
  // wins and losses always wait for a tap
  if (n.kind === 'win' || n.kind === 'lose') n.tapOnly = true;
  if (n.kind === 'win') confetti(spl);
  if (n.kind === 'alarm' || n.kind === 'lose') { document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake'); }
  beep(n.kind);
  if (prefs.vibrate && navigator.vibrate && navigator.userActivation?.hasBeenActive) try { navigator.vibrate(n.kind === 'alarm' ? [200, 80, 200, 80, 300] : [120]); } catch { /* ignore */ }
  // big end-of-game screens wait for a tap; everything else also closes on its own
  const t = n.tapOnly ? null : setTimeout(close, n.kind === 'alarm' || n.kind === 'alert' || n.reveal ? 4500 : 3400);
  function close() { clearTimeout(t); spl.onclick = null; nextSplash(); }
  spl.onclick = null;
  setTimeout(() => { spl.onclick = close; }, n.tapOnly ? 900 : 300); // ignore an accidental tap right as it appears
}

// sound: the first tap anywhere unlocks audio (phones require that); taps on buttons make a soft click
document.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (e.target.closest?.('button')) sfx('click');
}, { capture: true });
const beep = (kind) => sfx(kind);
const siren = () => sfx('siren'); // Catfish trap alarm

// Personal settings (each player, on their own phone)
function openPrefs() {
  const body = openOverlay('prefs', `${icon('tool')} My settings`, { closeLabel: 'Close' });
  const row = (k, label, hint) => `<div class="set"><span>${label}<small class="set-hint">${hint}</small></span><button class="switch ${prefs[k] ? 'on' : ''}" data-pref="${k}"><i></i></button></div>`;
  const draw = () => {
    body.innerHTML = `<div class="settings">${row('music', 'Music', 'Menu, game and lobby music')}${row('sfx', 'Sound effects', 'Pop-ups, games, duels, wins and losses')}${row('vibrate', 'Vibration', 'Buzz on big moments (Android)')}</div>`;
    $$('[data-pref]', body).forEach((b) => b.onclick = () => { prefs[b.dataset.pref] = !prefs[b.dataset.pref]; savePrefs(); draw(); });
  };
  draw();
}

function ask(title, text, ok = 'Yes') {
  return new Promise((res) => {
    modal.className = 'show';
    modal.innerHTML = `<div class="md-card"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row"><button class="btn ghost" id="mdNo">Cancel</button><button class="btn hot" id="mdOk">${esc(ok)}</button></div></div>`;
    const close = (v) => { modal.className = ''; modal.innerHTML = ''; res(v); };
    $('#mdNo').onclick = () => close(false);
    $('#mdOk').onclick = () => close(true);
  });
}

// ---------- overlays ----------
function openOverlay(kind, title, opts = {}) {
  closeOverlay();
  ui.overlay = kind;
  ov.className = 'show ' + kind;
  ov.innerHTML = `<div class="ov-card"><div class="ov-head"><b>${title}</b>${opts.closeLabel ? `<button class="btn small ghost ov-x">${opts.closeLabel}</button>` : ''}</div><div class="ov-body"></div></div>`;
  if (opts.closeLabel) $('.ov-x', ov).onclick = () => { const f = opts.onClose; closeOverlay(); f?.(); };
  return $('.ov-body', ov);
}

function closeOverlay() {
  const c = ui.cleanup; ui.cleanup = null;
  if (c) { try { c(); } catch (e) { console.error(e); } }
  ui.overlay = null; ov.className = ''; ov.innerHTML = '';
  setTimeout(() => { if (S) flushLater(); }, 400); // held messages show once the game/duel screen is closed
}

function syncOverlays() {
  const p = mine();
  if (!p) return;
  const t = hnow();
  // game over or back in the waiting room: close the scanner, games, everything (except the guide / account / settings)
  if ((S.phase === 'ended' || S.phase === 'waiting') && ui.overlay && !['how', 'profile', 'roles', 'prefs'].includes(ui.overlay)) closeOverlay();
  // the roles list updates live while the host edits it
  if (S.phase !== 'waiting' && ui.overlay === 'roles') closeOverlay();
  // frozen (DDoS or System Update) beats everything except duels in progress
  if (S.phase === 'playing' && p.alive && frozenUntil(p) > t) {
    if (ui.overlay !== 'frozen' && ui.overlay !== 'duel') showFrozen();
    return;
  }
  if (ui.overlay === 'frozen') closeOverlay();
  if (S.phase === 'playing' && p.alive && p.remote && ui.emergencyFor !== p.remote.id) {
    ui.emergencyFor = p.remote.id;
    return startEmergency(p.remote);
  }
  if (ui.overlay === 'emergency' && (!p.remote || !p.alive || S.phase !== 'playing')) closeOverlay();
  // the hack finished on the host (maybe sooner than this phone counted) -> close the hack screen
  if (ui.overlay === 'hack' && pl(ui.hackTarget)?.pending) { if (ui.hackProg) ui.hackProg[ui.hackTarget] = 0; closeOverlay(); }
  const b = S.breach;
  if (S.phase === 'playing' && p.alive && b && b.fixers.includes(me.id) && !b.fixed[me.id] && ui.breachFor !== b.until + b.g[me.id] && ui.overlay !== 'emergency' && ui.overlay !== 'duel') {
    ui.breachFor = b.until + b.g[me.id];
    return startBreach(b);
  }
  if (ui.overlay === 'breach' && (!b || b.fixed?.[me.id])) closeOverlay();
  const d = duelOf(p);
  if (d && d.st === 'active' && ui.duelPlayed !== d.id && ui.overlay !== 'emergency') { ui.duelPlayed = d.id; startDuel(d); }
  if (ui.overlay === 'duel' && (!d || d.st !== 'active')) closeOverlay();
  if (ui.overlay === 'social') { if (p.task) { ui.socialPending = false; drawSocial(); } else if (!ui.socialPending) closeOverlay(); }
  if ((S.phase !== 'playing' || !p.alive) && ['game', 'duel', 'hack', 'picker', 'social', 'badge', 'intro', 'breach'].includes(ui.overlay)) closeOverlay();
  if (S.phase === 'waiting' && ui.overlay === 'role') closeOverlay();
  if (S.phase === 'playing' && p.team && ui.roleShownFor !== S.gameId && !ui.overlay) showRole();
}

function showFrozen() {
  const p = mine();
  const sys = (S.freezeAllUntil || 0) > hnow();
  const body = openOverlay('frozen', sys ? `${icon('clock')} SYSTEM UPDATE` : `${icon('wifioff')} DDoS ATTACK`);
  body.innerHTML = `<div class="frozen-box"><div class="ice">${icon(sys ? 'clock' : 'wifioff')}</div><h2>${sys ? 'Installing update 1 of 1…' : 'YOUR PHONE IS FROZEN'}</h2><p>${sys ? 'Every phone is frozen. Do not turn off your brain.' : 'A Hacker flooded your phone. No games, duels or scans.'}</p><div class="big-num" data-cd="${frozenUntil(p)}">${fmt(frozenUntil(p) - hnow())}</div><div class="hn-bar"><div class="ice-bar"></div></div></div>`;
}

function showRole() {
  const p = mine(), info = ROLE_INFO[p.role];
  const body = openOverlay('role', 'Your secret role');
  const mates = p.team === 'hacker' && S.settings.hackersKnow ? Object.values(S.players).filter((x) => x.team === 'hacker' && x.id !== me.id) : [];
  const teamName = { gamer: 'GAMERS', hacker: 'HACKERS', npc: 'NPC' }[p.team];
  // intro: shutters slam shut, the game name glitches in, then they open on your role
  const intro = document.createElement('div');
  intro.className = 'shutter';
  intro.innerHTML = `<div class="sh-top"></div><div class="sh-bot"></div><div class="sh-logo">${tiLogo(false, 'assigning your role…')}</div>`;
  ov.appendChild(intro);
  sfx('whoosh'); setTimeout(() => sfx('reveal'), 900); setTimeout(() => sfx('whoosh'), 2100);
  setTimeout(() => intro.classList.add('open'), 2100);
  setTimeout(() => intro.remove(), 2900);
  body.innerHTML = `<div class="rolecard ${p.team}">
    <div class="role-av">${av(p, 130, 'float')}<div class="role-badge">${icon(info.ic)}</div></div>
    <p class="team">YOU ARE</p>
    <h2 class="glitch" data-t="${info.name.toUpperCase()}">${info.name.toUpperCase()}</h2>
    <p class="team">Team ${teamName}</p>
    <p class="role-text">${roleText(p.role)}</p>
    ${p.role === 'bounty' ? `<div class="mates"><small>Your target</small><span>${av(pl(p.target), 30)}${esc(pname(p.target))}</span></div>` : ''}
    ${p.mod ? `<div class="modchip">${icon(MODIFIERS[p.mod].ic)} <b>${MODIFIERS[p.mod].name}</b> — ${MODIFIERS[p.mod].text}</div>` : ''}
    ${mates.length ? `<div class="mates"><small>Your Hacker team</small>${mates.map((m) => `<span>${av(m, 30)}${esc(m.name)}${m.role === 'insider' ? ' (Insider)' : ''}</span>`).join('')}</div>` : ''}
    <p class="hint">Don't let anyone see your screen!</p>
    <button class="btn big hot" id="gotRole">LET'S GO</button></div>`;
  $('#gotRole').onclick = () => { ui.roleShownFor = S.gameId; sessionStorage.setItem('roleShown', S.gameId); closeOverlay(); render(); };
}

function openBadge() {
  const body = openOverlay('badge', `${icon('grid')} My badge`, { closeLabel: 'Close' });
  body.innerHTML = `<div class="center">${av(mine(), 70)}<h2>${esc(me.name)}</h2>${badgeBlock(mine(), 250)}<p class="hint">Let the other person scan this with their SCAN button.</p></div>`;
}

function howToPlay() {
  const body = openOverlay('how', `${icon('news')} How to play`, { closeLabel: 'Close' });
  const sec = (ic, t, txt) => `<div class="how-sec"><div class="how-ic">${icon(ic)}</div><div><b>${t}</b><p>${txt}</p></div></div>`;
  const roles = (list) => list.map((r) => `<div class="how-role"><span>${icon(ROLE_INFO[r].ic)}</span><div><b>${ROLE_INFO[r].name}</b><small>${roleText(r) || ROLE_INFO[r].text}</small></div></div>`).join('');
  const save = S; if (!S) S = { settings: { hackSec: 60, afkDelay: 60, itScans: 4, powerCd: 5 } };
  body.innerHTML = `
    ${sec('gamepad', 'The goal', 'Gamers fill the NETWORK bar by winning games and duels before the timer runs out. Secret Hackers try to hack everyone. Find them and Vote Kick them!')}
    ${sec('pin', 'Games', 'Each game shows a place (Kitchen, Stairs…). Walk there and play it. After every game you wait a bit — keep moving!')}
    ${sec('grid', 'Your badge', 'Every player has a QR badge (Me tab). Scanning badges with the SCAN button proves you are next to someone.')}
    ${sec('swords', 'Duels', 'Tap "Find me an opponent" or get a forced Duel Call. Find the player — ONE of you scans the other\'s badge — and the duel starts. Winners get progress (Hackers get a remote hack!).')}
    ${sec('skull', 'Hacks', 'A Hacker who stays close to you for a while hacks you silently — you go AFK a minute later. Remote hacks warn you: finish the emergency game to survive.')}
    ${sec('wifioff', 'AFK', 'When you go AFK, freeze and stay silent, holding up your QR. Whoever finds you scans it → ERROR 404 → everyone goes to the Lobby.')}
    ${sec('users', 'Lobby', 'Scan the caller\'s QR to check in (late = no vote). Discuss, then Vote Kick. Skipping or tying can trigger a glitch hack!')}
    ${sec('key', 'Lobby Key', 'One random secret player holds the key and can call a Lobby anytime. It moves every 5 minutes — beat the holder in a duel to steal it.')}
    <h3>Gamer roles</h3>${roles(GAMER_ROLES)}
    <h3>Hacker roles</h3>${roles(['hacker', ...HACKER_ROLES])}
    <h3>NPC roles (play for themselves)</h3>${roles(NPC_ROLES)}
    <h3>Modifiers</h3>${Object.values(MODIFIERS).map((m) => `<div class="how-role"><span>${icon(m.ic)}</span><div><b>${m.name}</b><small>${m.text}</small></div></div>`).join('')}`;
  S = save;
}

// Camera QR scanner (falls back to typing the 4-digit code)
function openScanner(title, mode = null) {
  // the QR reader library is big, so it only downloads the first time someone scans
  if (!window.jsQR && !document.getElementById('jsqr')) { const s = document.createElement('script'); s.id = 'jsqr'; s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; document.head.appendChild(s); }
  const body = openOverlay('scanner', `${icon('crosshair')} ${title}`, { closeLabel: 'Close' });
  body.innerHTML = `<div class="cam scan"><video playsinline muted autoplay></video><div class="scanframe"><i></i><b></b></div></div>
    <p class="hint center scan-msg">Point your camera at their QR code</p>
    <div class="row"><input id="manCode" class="inp code small" maxlength="4" inputmode="numeric" placeholder="0000" autocomplete="off"><button class="btn hot" id="manGo">${icon('check')} OK</button></div>
    <p class="hint center">Camera not working? Type the 4 digits under their QR.</p>`;
  const video = $('video', body);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let stream = null, dead = false, raf = 0, last = 0;
  const stopCam = () => stream?.getTracks().forEach((t) => t.stop());
  const submit = (code) => {
    if (!/^\d{4}$/.test(code)) return shakeEl($('#manCode'));
    dead = true;
    act({ type: 'badge', code, mode });
    beep('good');
    closeOverlay();
  };
  function loop() {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    const t = performance.now();
    if (t - last < 180 || !video.videoWidth || !window.jsQR) return;
    last = t;
    const w = 360, h = Math.round(video.videoHeight * w / video.videoWidth);
    canvas.width = w; canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const res = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
    const m = res?.data?.match(/^HPG:(\d{4})$/);
    if (m) submit(m[1]);
  }
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (dead) return stopCam();
      video.srcObject = stream;
      await video.play().catch(() => {});
      loop();
    } catch {
      $('.cam', body)?.classList.add('off');
      const m = $('.scan-msg', body); if (m) m.textContent = 'Camera not available here — type the code instead.';
    }
  })();
  $('#manGo').onclick = () => submit($('#manCode').value.trim());
  $('#manCode').onkeydown = (e) => { if (e.key === 'Enter') submit(e.target.value.trim()); };
  ui.cleanup = () => { dead = true; cancelAnimationFrame(raf); stopCam(); };
}

// A game starts with a short "how to play" card, then the real game
function playGame(i) {
  const p = mine(), g = p.games[i], G = SOLO[g?.t];
  if (!G) return;
  // 2 solo games in a row, then you have to duel someone
  if (!G.social && (p.soloStreak || 0) >= 2) return showSplash({ kind: 'alert', title: 'DUEL TIME', tapOnly: true,
    text: p.duel ? 'You played 2 games in a row. You already have a duel waiting — find your opponent and scan their badge!' : 'You played 2 games in a row. Duel someone before your next game. Tap below and the game picks your opponent:',
    btn: p.duel ? null : { label: `${icon('swords')} FIND SOMEONE NOW`, fn: () => act({ type: 'duelRandom' }) } });
  if (G.social) {
    if (p.task && p.task.i !== i) return toast('Finish (or give up) your other social game first.', 'bad');
    if (!p.task) { act({ type: 'taskOpen', i }); ui.socialPending = true; }
    openSocialTask(i);
    return;
  }
  const need = Number(S.settings.walkSteps ?? 15);
  const key = S.gameId + ':' + i + ':' + g.t;
  ui.walked ||= {};
  const [place, twist] = String(g.z || '').split(' · ');
  const body = openOverlay('intro', `${icon(G.ic)} ${G.name}`, { closeLabel: 'Not now' });
  body.innerHTML = `<div class="intro"><div class="intro-ic">${icon(G.ic)}</div><h2>${G.name}</h2>
    <div class="intro-zone">${icon('pin')} Go to: <b>${esc(place)}</b>${twist ? `<span class="twist">and play it <b>${esc(twist)}</b></span>` : ''}</div>
    ${need > 0 ? `<div class="walk"><div class="walk-top"><span>🚶 Walk there</span><b class="walk-n">0/${need} steps</b></div><div class="walk-bar"><div></div></div><small class="walk-msg">Start walking — your phone counts your steps.</small></div>` : ''}
    <p class="intro-how">${HOW[g.t] || G.tag}</p><button class="btn big hot" id="goGame" ${need > 0 ? 'disabled' : ''}>${icon('play')} GO!</button><p class="hint center">Giving up or failing = 2-min game ban.</p></div>`;
  $('#goGame').onclick = () => runGame(i);
  if (need > 0) ui.cleanup = countSteps(need, ui.walked[key] || 0, (n, fake) => {
    ui.walked[key] = n;
    const el = $('.walk-n', body); if (!el) return;
    el.textContent = `${Math.min(n, need)}/${need} steps`;
    $('.walk-bar div', body).style.width = Math.min(100, n / need * 100) + '%';
    if (fake) $('.walk-msg', body).textContent = 'No step sensor on this device — walk there anyway, the bar fills by itself.';
    if (n >= need) { $('#goGame', body).disabled = false; $('.walk-msg', body).textContent = '✅ You made it. Now follow the twist and play!'; $('.walk', body).classList.add('done'); sfx('good'); }
  });
}

// Step counter from the motion sensor (a step = a bump in acceleration). No sensor → fills slowly on its own.
function countSteps(need, start, onStep) {
  let n = start, got = false, lastStep = 0, high = false, avg = 9.8, dead = false, fakeIv = null;
  onStep(n);
  if (n >= need) return () => {};
  const onMotion = (e) => {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
    got = true;
    const m = Math.hypot(a.x, a.y, a.z);
    avg = avg * 0.9 + m * 0.1;
    const t = performance.now();
    if (!high && m > avg + 1.6 && t - lastStep > 300) { high = true; lastStep = t; n++; onStep(n); if (n >= need) stop(); }
    else if (high && m < avg + 0.4) high = false;
  };
  const begin = () => window.addEventListener('devicemotion', onMotion);
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then((r) => { if (r === 'granted' && !dead) begin(); }).catch(() => {});
    } else begin();
  } catch { /* no sensor */ }
  // nothing from the sensor after 2.5 s (laptop, permission refused): count by itself, ~1.5 steps per second
  const fb = setTimeout(() => { if (got || dead) return; fakeIv = setInterval(() => { n++; onStep(n, true); if (n >= need) stop(); }, 650); }, 2500);
  function stop() { dead = true; window.removeEventListener('devicemotion', onMotion); clearTimeout(fb); clearInterval(fakeIv); }
  return stop;
}

function runGame(i) {
  const g = mine().games[i], G = SOLO[g.t];
  sfx('whoosh');
  const body = openOverlay('game', `${icon(G.ic)} ${G.name}`, { closeLabel: 'Give up', onClose: () => act({ type: 'gameDone', i, ok: false }) });
  const done = once((res) => {
    closeOverlay();
    if (res === 'skip') act({ type: 'gameSkip', i });
    else {
      act({ type: 'gameDone', i, ok: res === true });
      if (res === true) toast(`✅ ${pickOne(WIN_LINES)}`, 'good'); else toast(`❌ ${pickOne(FAIL_LINES)}`, 'bad');
    }
  });
  ui.cleanup = G.run(body, done) || null;
}

function openSocialTask(i) {
  const g = mine()?.games?.[i], G = g && SOLO[g.t];
  if (!G) return;
  openOverlay('social', `${icon(G.ic)} ${G.name}`, { closeLabel: 'Give up', onClose: () => act({ type: 'taskCancel' }) });
  drawSocial();
}

function drawSocial() {
  if (ui.overlay !== 'social') return;
  const p = mine(), k = p.task, body = $('.ov-body', ov);
  if (!body) return;
  if (!k) { body.innerHTML = '<p class="center loading">Setting it up…</p>'; return; }
  let h = '';
  if (k.kind === 'dare') {
    h = `<div class="task-hero dare">${icon('zap')}</div><p class="dare-text">${esc(k.text)}</p><p class="hint center">When you've done it, your witness scans your badge with their SCAN button:</p>${badgeBlock(p)}`;
  } else if (k.kind === 'courier') {
    const t = pl(k.target);
    const revealAt = k.reveal || k.at + 45000, until = k.until || k.at + 60000;
    const reveal = hnow() > revealAt;
    h = `<div class="task-hero">${icon('package')}</div><p class="dare-text">Deliver the hot data to…</p>
      <div class="deadline">${icon('clock')} Deliver within <b data-cd="${until}">${fmt(until - hnow())}</b></div>
      <div class="clue">${icon('eye')} <b>CLUE:</b> ${esc(k.clue)}</div>
      ${reveal ? `<div class="courier-target">${av(t, 80, 'float')}<b>${esc(t?.name)}</b><small>(last 15 seconds — here's the answer!)</small></div>` : `<p class="hint center">The name is revealed in the last 15 seconds.</p>`}
      <p class="hint center">Find them. <b>They</b> scan your badge to receive the package.</p>${badgeBlock(p, 170)}`;
  } else if (k.kind === 'vanish') {
    const hiding = hnow() < k.huntAt;
    h = hiding
      ? `<div class="task-hero vanish">${icon('eye')}</div><p class="dare-text">HIDE NOW!</p><p class="center">Everyone has been warned. The hunt starts in</p><div class="big-num" data-cd="${k.huntAt}">${fmt(k.huntAt - hnow())}</div><p class="hint center">Survive = <b>+2</b> for your team. Found = <b>−1</b> and a 1-min game ban (and if a Hacker finds you, they get a remote hack!).</p>`
      : `<div class="task-hero vanish hunted">${icon('eye')}</div><p class="dare-text">THEY'RE HUNTING YOU</p><div class="big-num" data-cd="${k.until}">${fmt(k.until - hnow())}</div><p class="hint center">If someone finds you, you MUST show this badge:</p>${badgeBlock(p, 200)}`;
  } else {
    h = `<div class="task-hero">${icon('users')}</div><p class="dare-text">Collect 2 badges</p><p class="hint center">Walk up to 2 different players, ask them to open <b>Me → Show my badge</b>, and scan each one with the button below.</p><div class="hs-row">${[0, 1].map((n) => k.got[n] ? `<div class="hs-slot done">${av(pl(k.got[n]), 60)}<small>${esc(pname(k.got[n]))}</small></div>` : '<div class="hs-slot">?</div>').join('')}</div><button class="btn big hot" id="hsScan">${icon('crosshair')} SCAN A BADGE</button>`;
  }
  // while being hunted the badge screen is locked open: no going back, no giving up
  const hunted = k.kind === 'vanish' && hnow() >= k.huntAt;
  if (!hunted) h += `<button class="btn ghost" id="soMin">${icon('left')} Back to the game (task stays open)</button>`;
  $('.ov-x', ov)?.classList.toggle('hidden', hunted);
  body.innerHTML = h;
  $('#hsScan')?.addEventListener('click', () => openScanner('Scan a badge'));
  if ($('#soMin')) $('#soMin').onclick = () => { ui.cleanup = null; ov.className = ''; ov.innerHTML = ''; ui.overlay = null; render(); };
}

function startEmergency(r) {
  const G = SOLO[r.g];
  const body = openOverlay('emergency', `${icon('alert')} YOU ARE BEING HACKED`);
  body.innerHTML = `<div class="alarm-txt">Finish this before the timer hits zero or you go AFK!<b data-cd="${r.at}">${fmt(r.at - hnow())}</b></div><p class="hint center">${HOW[r.g] || ''}</p><div class="em-game"></div>`;
  beep('alarm');
  const done = once((res) => { closeOverlay(); act({ type: 'emergencyDone', ok: res === true }); });
  ui.cleanup = G.run($('.em-game', body), done) || null;
}

function startBreach(b) {
  const g = b.g[me.id], G = SOLO[g];
  const body = openOverlay('emergency breach', `${icon('alert')} DUAL BREACH`);
  body.innerHTML = `<div class="alarm-txt">Fix your half of the breach!<b data-cd="${b.until}">${fmt(b.until - hnow())}</b></div><p class="hint center">${HOW[g] || ''}</p><div class="em-game"></div>`;
  const done = once((res) => { closeOverlay(); act({ type: 'breachFix', ok: res === true }); if (res !== true) ui.breachFor = null; });
  ui.cleanup = G.run($('.em-game', body), done) || null;
  ui.overlay = 'breach';
}

function startDuel(d) {
  const G = DUEL[d.g];
  const other = d.a === me.id ? d.b : d.a;
  const body = openOverlay('duel', `${icon('swords')} DUEL`);
  body.innerHTML = `<div class="versus big">${av(mine(), 80, 'slide-l')}<b>VS</b>${av(pl(other), 80, 'slide-r')}</div><div class="duel-name">${icon(G.ic)} ${G.name}</div><p class="hint center">${G.desc}</p><div class="count du-c"></div><div class="du-game"></div>`;
  let gameCleanup = null;
  const c = $('.du-c', body);
  const iv = setInterval(() => {
    const left = d.startAt - hnow();
    if (left > 0) { const n = String(Math.ceil(left / 1000)); if (c.textContent !== n) { c.textContent = n; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); sfx('tick'); } return; }
    sfx('fight');
    clearInterval(iv); c.remove(); $('.versus', body)?.remove();
    const finish = once((score) => {
      act({ type: 'duelScore', id: d.id, score });
      closeOverlay();
      toast('Score sent — waiting for your opponent…');
    });
    // live duels (Hot Potato, Aura Duel) also get the duel state, a way to act, and the player's badge
    const api = { me: me.id, otherName: pname(other), get: () => S.duels?.[d.id], act: (x) => act({ ...x, id: d.id }), now: hnow, badge: (size) => badgeBlock(mine(), size) };
    gameCleanup = G.run($('.du-game', body), seeded(d.seed), finish, api);
    // count games: if the opponent is already out and you beat their score, you win right away
    if (gameCleanup?.level) {
      watch = setInterval(() => {
        const opp = S.duels?.[d.id]?.score?.[other];
        if (opp != null && gameCleanup.level() > opp) finish(gameCleanup.level());
      }, 200);
    }
  }, 100);
  let watch = 0;
  ui.cleanup = () => { clearInterval(iv); clearInterval(watch); gameCleanup?.(); };
}

function pickPlayer(title, filter, cb, extra = null) {
  const body = openOverlay('picker', title, { closeLabel: 'Cancel' });
  const list = Object.values(S.players).filter((p) => p.team && p.id !== me.id && !p.kicked && !(p.afk && p.found) && filter(p));
  if (!list.length) { body.innerHTML = '<p class="hint center">Nobody available.</p>'; return; }
  body.innerHTML = `<div class="pgrid">${list.map((p) => `<button class="pcard" data-id="${p.id}">${av(p, 64)}<span>${esc(p.name)}</span>${extra ? extra(p) : ''}</button>`).join('')}</div>`;
  $$('.pcard', body).forEach((b) => b.onclick = () => { closeOverlay(); cb(b.dataset.id); });
}

// how far this Hacker has hacked someone (0–100%), from the host's saved progress or this phone's memory
const hackPct = (id) => Math.round(Math.min(1, Math.max(mine()?.prog?.[id] || 0, ui.hackProg?.[id] || 0) / S.settings.hackSec) * 100);
const hackLocked = () => S.startedAt && S.totalMs - (S.timerEndsAt - hnow()) < 30000;

function startHack(targetId) {
  const need = S.settings.hackSec;
  // progress adds up: take whatever is higher — what this phone remembers or what the host saved
  ui.hackProg ||= {};
  let prog = Math.max(mine().prog?.[targetId] || 0, ui.hackProg[targetId] || 0), on = false;
  ui.hackTarget = targetId;
  const body = openOverlay('hack', `${icon('skull')} Close hack`, { closeLabel: 'Stop' });
  body.innerHTML = `<div class="hack-target">${av(pl(targetId), 90)}<b>${esc(pname(targetId))}</b></div>
    <p class="hint center">Stay within arm's reach and only keep hacking ON while you're that close (honor rule). Progress is saved if you pause.</p>
    <div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg"/></svg><div class="ring-n"></div></div>
    <button class="btn big hk-toggle"></button>`;
  const fg = $('.ring-fg', body), num = $('.ring-n', body), btn = $('.hk-toggle', body);
  const C = 2 * Math.PI * 52;
  fg.style.strokeDasharray = C;
  const draw = () => {
    fg.style.strokeDashoffset = C * (1 - Math.min(1, prog / need));
    num.textContent = `${Math.round(Math.min(prog, need) / need * 100)}%`;
    btn.textContent = on ? 'PAUSE HACKING' : 'START HACKING';
    btn.classList.toggle('danger', on); body.classList.toggle('hacking', on);
  };
  const iv = setInterval(() => {
    if (!on) return;
    act({ type: 'hackTick', target: targetId });
    prog++; ui.hackProg[targetId] = prog >= need ? 0 : prog;
    if (prog >= need) { on = false; clearInterval(iv); draw(); num.textContent = 'DONE'; btn.remove(); setTimeout(() => { if (ui.overlay === 'hack') closeOverlay(); }, 1200); return; }
    draw();
  }, 1000);
  btn.onclick = () => { on = !on; draw(); };
  draw();
  ui.cleanup = () => clearInterval(iv);
}

// ---------- screens ----------
function render() {
  document.body.dataset.place = S?.settings?.place || 'house';
  setTrack(!room || !S || S.phase === 'waiting' || S.phase === 'ended' ? 'menu' : S.phase === 'lobby' ? 'lobby' : 'game');
  if (!room) return renderHome();
  if (!S) { app.innerHTML = '<div class="screen center loading">Connecting…</div>'; return; }
  if (S.phase === 'closed') return roomClosed();
  const p = mine();
  if (!p) {
    // joining while a game runs: you can't play yet, but you can follow the live feed
    app.innerHTML = S.phase === 'waiting'
      ? '<div class="screen center"><h2>Joining…</h2><button class="btn ghost" id="leave">Leave</button></div>'
      : `<div class="screen ${enterCls('spectate')}"><div class="card center"><h2>GAME IN PROGRESS</h2><p class="hint center">You'll join automatically in the next game. Meanwhile, watch the chaos:</p></div>
        <h3>${icon('news')} Live feed</h3>${newsList((S.news || []).slice(-15).reverse())}<button class="btn ghost" id="leave">${icon('logout')} Leave</button></div>`;
    $('#leave').onclick = leave; return;
  }
  if (S.phase === 'waiting') return renderWaiting();
  if (S.phase === 'ended') return renderEnded();
  if (!p.team) { app.innerHTML = '<div class="screen center"><h2>Game in progress</h2><p class="hint">Wait for the next one.</p></div>'; return; }
  if (S.phase === 'lobby') return renderLobby();
  return p.alive ? renderPlaying() : renderOut();
}

function avatarEditor(a = me.av) {
  const lvl = myLevel();
  return `<div class="av-editor">${Object.entries(AV_PARTS).map(([k, part]) => {
    const n = (part.list || part.colors).length;
    const need = unlockLevel(k, a[k]);
    const val = part.colors ? `<i class="swatch" style="background:${part.colors[a[k]]}"></i>` : `<small>${part.list[a[k]]}</small>`;
    return `<div class="avrow ${need > lvl ? 'locked' : ''} ${k === 'k' ? 'headset' : ''}"><button class="arrow" data-p="${k}" data-d="-1" data-n="${n}">${icon('left')}</button><span>${part.label}${val}${need > lvl ? `<em>${icon('lock')} Level ${need}</em>` : ''}</span><button class="arrow" data-p="${k}" data-d="1" data-n="${n}">${icon('right')}</button></div>`;
  }).join('')}<button class="btn ghost small" id="avRand">${icon('dice')} Randomize</button><p class="hint center">🔒 items are a preview — level up to use them.</p></div>`;
}

function levelChip() {
  if (!profile) return `<button class="acct-chip" id="acctBtn">${icon('user')} Create account</button>`;
  const lp = levelProgress(profile.xp);
  return `<button class="acct-chip" id="acctBtn"><span class="lv">Lv ${lp.level}</span><span class="mini-xp"><i style="width:${lp.pct}%"></i></span>${esc(profile.name)}</button>`;
}

// ---------- 🥚 easter eggs on the home screen ----------
function homeEasterEggs() {
  // 1) tap the logo 7 times: the program "crashes"
  let taps = 0, tapT = 0;
  $('.home .ti-logo')?.addEventListener('click', () => {
    taps = Date.now() - tapT < 800 ? taps + 1 : 1; tapT = Date.now();
    if (taps >= 7) { taps = 0; fakeCrash(); }
  });
  // 2) hold your character for 1.5 s: it gets dizzy
  const avEl = $('#avTap'); let holdT = null;
  avEl?.addEventListener('pointerdown', () => { holdT = setTimeout(() => { ui.heldAv = true; avEl.classList.remove('dizzy'); void avEl.offsetWidth; avEl.classList.add('dizzy'); sfx('whoosh'); toast(pickOne(['😵 Stop touching me. I have trust issues.', '😵‍💫 Personal space, please. I don\'t know you.', '🫨 Bro is NOT a fidget toy.'])); }, 1500); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => avEl?.addEventListener(ev, () => clearTimeout(holdT)));
  // 3) secret nicknames
  const NAMES = [[/^(67|6\s?7|six\s?seven)$/i, '6️⃣7️⃣ SIX SEVEN 🤷'], [/tung\s?tung/i, '🪵 TUNG TUNG TUNG SAHUR. He knows where you live.'],
    [/skibidi/i, '🚽 Skibidi detected. Aura −1000.'], [/^(admin|hacker|root)$/i, '🤨 Bold name for someone with trust issues.'], [/^(mom|mum|mama)$/i, '👩 "Did you eat?" — Mom, probably']];
  let lastEgg = '';
  $('#name')?.addEventListener('input', (e) => {
    const v = e.target.value.trim(), hit = NAMES.find(([re]) => re.test(v));
    if (hit && lastEgg !== hit[1]) { lastEgg = hit[1]; toast(hit[1]); if (hit[1].startsWith('6️⃣')) { const a = $('#avTap'); a.classList.remove('sixseven'); void a.offsetWidth; a.classList.add('sixseven'); } }
    if (!hit) lastEgg = '';
  });
}

// fake "has stopped working" window
function fakeCrash() {
  sfx('lose');
  modal.className = 'show';
  modal.innerHTML = `<div class="crash"><div class="crash-bar"><span>TrustIssues.exe</span><b>✕</b></div><div class="crash-body"><div class="crash-x">✕</div><div><p><b>TrustIssues.exe has stopped working</b></p><p>Windows is looking for a solution to the problem…</p><p class="hint">Just kidding. There is no solution. Your friends are still lying.</p></div></div><div class="crash-btns"><button class="btn small" id="crWait">Wait for it to respond</button><button class="btn small" id="crClose">Close program</button></div></div>`;
  const close = () => { modal.className = ''; modal.innerHTML = ''; };
  $('#crWait').onclick = () => { $('.crash-body p.hint').textContent = '⏳ Still waiting… still not trusting anyone.'; setTimeout(close, 1600); };
  $('#crClose').onclick = () => { close(); document.body.classList.add('bsod'); setTimeout(() => document.body.classList.remove('bsod'), 900); };
}

// character customisation: its own screen; changes only stick when you press SAVE
function renderAvatarScreen() {
  const d = ui.avDraft;
  const changed = JSON.stringify(d) !== JSON.stringify(me.av);
  app.innerHTML = `<div class="screen home av-screen ${enterCls('avatar')}">
    <div class="av-top"><button class="back" id="avBack">${icon('left')} ${changed ? 'Cancel' : 'Back'}</button><b>YOUR CHARACTER</b><button class="btn small hot" id="avSave2">${icon('check')} Save</button></div>
    <div class="home-av av-big">${avatarSVG(d, 170, 'float')}</div>
    ${avatarEditor(d)}
    <button class="btn big hot" id="avSave">${icon('check')} SAVE CHARACTER</button>
  </div>`;
  $$('.arrow').forEach((b) => b.onclick = () => {
    const k = b.dataset.p, n = +b.dataset.n;
    d[k] = (d[k] + +b.dataset.d + n) % n;
    renderAvatarScreen();
  });
  $('#avRand').onclick = () => { ui.avDraft = randomUnlocked(myLevel()); renderAvatarScreen(); };
  const save = () => {
    const fix = lockedFix(d, myLevel());
    if (fix.changed) toast('🔒 Locked items were swapped — level up to use them!', 'bad');
    me.av = fix.av; storeAv();
    toast('✅ Character saved!', 'good');
    ui.home = 'main'; renderHome();
  };
  $('#avSave').onclick = save; $('#avSave2').onclick = save;
  $('#avBack').onclick = async () => {
    if (changed && !(await ask('Discard changes?', 'Your new look will not be saved.', 'Discard'))) return;
    ui.home = 'main'; renderHome();
  };
}

// ---------- 🕹️ ARCADE: play any solo game alone, just for practice / fun (no room needed, no XP) ----------
const ARCADE_IDS = SOLO_IDS.filter((g) => !SOCIAL_IDS.includes(g) && SOLO[g]?.run);
const arcadeStats = () => { try { return JSON.parse(localStorage.getItem('ti-arcade') || '{}'); } catch { return {}; } };
function arcadeSave(g, won) {
  const st = arcadeStats(), s = st[g] || { w: 0, p: 0, streak: 0, best: 0 };
  s.p++; if (won) { s.w++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
  st[g] = s; try { localStorage.setItem('ti-arcade', JSON.stringify(st)); } catch { /* private mode */ }
  return s;
}

// one pretty "game cartridge" card, used by the in-game list, the Arcade and "Play for fun"
const G_ACCENTS = ['#ffd23f', '#ff4d4d', '#00e08a', '#ffb020', '#4dc3ff', '#ff6bd6'];
const accentOf = (id) => G_ACCENTS[[...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % G_ACCENTS.length];
const kindOf = (id) => SOLO[id]?.social ? 'PEOPLE' : { noise: 'MIC', unmute: 'MIC', quiet: 'MIC', shake: 'MOTION', tilt: 'MOTION', colour: 'CAMERA', disco: 'SOUND' }[id] || 'TAP';
function gameCard(id, { cls = '', attrs = '', foot = '', sub = null, n = null } = {}) {
  const G = SOLO[id];
  return `<button class="gcard ${G.social ? 'social' : ''} ${cls}" style="--acc:${accentOf(id)}" ${attrs}>
    <span class="g-art"><span class="g-ic">${icon(G.ic)}</span><i class="g-kind">${kindOf(id)}</i>${n != null ? `<i class="g-num">#${String(n).padStart(2, '0')}</i>` : ''}</span>
    <span class="g-txt"><b>${esc(G.name)}</b><small>${esc(sub ?? G.tag)}</small>${foot ? `<span class="g-zone">${foot}</span>` : ''}</span></button>`;
}

function renderArcade() {
  const st = arcadeStats(), f = ui.arcFilter || 'all';
  const list = ARCADE_IDS.filter((g) => f === 'all' || (f === 'nosens' ? !SENSOR_IDS.includes(g) : SENSOR_IDS.includes(g)));
  const totalW = Object.values(st).reduce((a, s) => a + s.w, 0), tried = ARCADE_IDS.filter((g) => st[g]?.p).length;
  app.innerHTML = `<div class="screen home arcade ${enterCls('arcade')}">
    <div class="av-top"><button class="back" id="arcBack">${icon('left')} Back</button><b>ARCADE</b><span></span></div>
    <p class="hint center">Every solo game, no friends needed. Practice for the real thing or just kill time.</p>
    <div class="arc-stats"><span><b>${totalW}</b> wins</span><span><b>${tried}/${ARCADE_IDS.length}</b> games tried</span></div>
    <button class="btn big hot" id="arcRand">${icon('dice')} RANDOM GAME</button>
    <div class="seg arc-filter">${[['all', 'All'], ['nosens', 'Just tapping'], ['sens', 'Mic / motion / camera']].map(([k, t]) => `<button class="${k === f ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
    <div class="games arc-games">${list.map((g) => { const s = st[g]; return gameCard(g, { cls: `arc-card ${s?.w ? 'won' : ''}`, attrs: `data-g="${g}"`, foot: s ? `🏆 ${s.w} · 🔥 best ${s.best}` : '<i class="g-new">NEW</i>' }); }).join('')}</div>
  </div>`;
  $('#arcBack').onclick = () => { ui.home = 'main'; renderHome(); };
  $$('.arc-filter button').forEach((b) => b.onclick = () => { ui.arcFilter = b.dataset.f; renderArcade(); });
  $$('.arc-card').forEach((b) => b.onclick = () => arcadeIntro(b.dataset.g));
  $('#arcRand').onclick = () => arcadeIntro(pickOne(list.length ? list : ARCADE_IDS));
}

// "how to play" card first, so nobody starts a timer without knowing the rules
function arcadeIntro(g) {
  const G = SOLO[g], s = arcadeStats()[g];
  sfx('whoosh');
  const body = openOverlay('arcade-intro', `${icon(G.ic)} ${G.name}`, { closeLabel: 'Back' });
  body.innerHTML = `<div class="task-hero">${icon(G.ic)}</div><p class="dare-text">${esc(G.tag)}</p><p class="hint center">${HOW[g] || ''}</p>
    ${SENSOR_IDS.includes(g) ? `<p class="hint center">${icon('mic')} This one uses your phone's mic, motion or camera — allow it when asked.</p>` : ''}
    ${s ? `<p class="center arc-mine">🏆 ${s.w} wins of ${s.p} · 🔥 best streak ${s.best}</p>` : ''}
    <button class="btn big hot" id="arcPlay">${icon('play')} PLAY</button>`;
  $('#arcPlay').onclick = () => arcadePlay(g);
}

function arcadePlay(g) {
  const G = SOLO[g];
  sfx('whoosh');
  const body = openOverlay('game', `${icon(G.ic)} ${G.name}`, { closeLabel: 'Give up', onClose: () => arcadeResult(g, false, true) });
  const done = once((res) => { closeOverlay(); arcadeResult(g, res === true); });
  ui.cleanup = G.run(body, done) || null;
}

function arcadeResult(g, won, gaveUp = false) {
  const s = arcadeSave(g, won), G = SOLO[g];
  sfx(won ? 'win' : 'lose');
  const body = openOverlay('arcade-res', `${icon(G.ic)} ${G.name}`);
  body.innerHTML = `<div class="arc-res ${won ? 'good' : 'bad'}"><b>${won ? 'YOU WON' : gaveUp ? 'RAGE QUIT' : 'YOU LOST'}</b><p>${won ? pickOne(WIN_LINES) : gaveUp ? 'Giving up is also a strategy. A bad one.' : pickOne(FAIL_LINES)}</p>
    <div class="arc-stats"><span>🔥 streak <b>${s.streak}</b></span><span>🏆 best <b>${s.best}</b></span><span><b>${s.w}/${s.p}</b> won</span></div></div>
    <button class="btn big hot" id="arcAgain">${icon('play')} PLAY AGAIN</button>
    <button class="btn" id="arcNext">${icon('dice')} Random game</button>
    <button class="btn ghost" id="arcList">${icon('left')} All games</button>`;
  if (won && s.streak >= 3) confetti($('.arc-res', body), 50); // 3 wins in a row = party
  $('#arcAgain').onclick = () => arcadePlay(g);
  $('#arcNext').onclick = () => arcadeIntro(pickOne(ARCADE_IDS.filter((x) => x !== g)));
  $('#arcList').onclick = () => { closeOverlay(); renderArcade(); };
}

function renderHome() {
  if (ui.home === 'avatar') return renderAvatarScreen();
  if (ui.home === 'arcade') return renderArcade();
  if (ui.home === 'join') {
    app.innerHTML = `<div class="screen home ${enterCls('join')}">
      <button class="back" id="back">${icon('left')} Back</button>
      <div class="home-av">${avatarSVG(me.av, 120, 'float')}</div>
      <h1 class="title">ENTER CODE</h1>
      <p class="hint center">Ask the host for the 4-letter room code.</p>
      <input id="code" class="inp code" maxlength="4" placeholder="ABCD" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <button class="btn big hot" id="join">${icon('login')} JOIN</button>
      ${ui.error ? `<p class="err">${esc(ui.error)}</p>` : ''}
    </div>`;
    ui.error = '';
    $('#back').onclick = () => { ui.home = 'main'; renderHome(); };
    $('#join').onclick = joinRoom;
    $('#code').onkeydown = (e) => { if (e.key === 'Enter') joinRoom(); };
    $('#code').focus();
    return;
  }
  app.innerHTML = `<div class="screen home ${enterCls('home')}">
    <div class="home-top">${levelChip()}<button class="gear" id="prefsBtn">${icon('tool')}</button></div>
    ${tiLogo(true)}
    <div class="home-av" id="avTap">${avatarSVG(me.av, 150, 'float')}<button class="edit-av">${icon('edit')}</button></div>
    <p class="hint center tap-hint">Tap your character to customise it</p>
    <input id="name" class="inp name" maxlength="16" placeholder="Your gamer tag" value="${esc(me.name)}" autocomplete="off">
    <div class="choices">
      <button class="choice host" id="host"><span>${icon('monitor')}</span><b>HOST</b><small>Create a room</small></button>
      <button class="choice join" id="toJoin"><span>${icon('login')}</span><b>JOIN</b><small>Enter a code</small></button>
    </div>
    <button class="btn arcade-btn" id="arcBtn">${icon('play')} ARCADE <small>play the mini-games solo</small></button>
    <button class="btn ghost" id="howBtn">${icon('news')} How to play</button>
    ${ui.error ? `<p class="err">${esc(ui.error)}</p>` : ''}
    <p class="mode ${ONLINE ? 'on' : ''}">${ONLINE ? '● ONLINE' : '● LOCAL TEST MODE'}</p>
  </div>`;
  ui.error = '';
  const keepName = () => { me.name = $('#name').value; };
  $('#avTap').onclick = () => { if (ui.heldAv) { ui.heldAv = false; return; } keepName(); ui.avDraft = { ...me.av }; ui.home = 'avatar'; renderHome(); };
  homeEasterEggs();
  $('#acctBtn').onclick = () => { keepName(); openProfile(); };
  $('#prefsBtn').onclick = openPrefs;
  $('#host').onclick = createRoom;
  $('#toJoin').onclick = () => { if (!saveMe()) return; ui.home = 'join'; renderHome(); };
  $('#howBtn').onclick = howToPlay;
  $('#arcBtn').onclick = () => { keepName(); ui.home = 'arcade'; renderHome(); };
}

function fmtSetting(s, v) {
  if (s.type === 'toggle') return v ? 'ON' : 'OFF';
  if (s.zero && v === 0) return s.zero;
  if (s.unit === 'time') return v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : `${v}s`;
  return `${v}${s.unit ? (s.unit === 'min' ? ' min' : s.unit) : ''}`;
}

function settingControl(s, host) {
  if (s.head) return `<div class="set-head">${s.head}</div>`;
  if (s.type === 'rolesbtn') {
    const all = [...GAMER_ROLES, ...HACKER_ROLES, ...NPC_ROLES];
    const active = all.filter((r) => S.settings['r_' + r] > 0);
    return `<button class="roles-open" id="rolesOpen"><span class="ro-ic">${icon('users')}</span><span><b>Choose roles</b><small>${active.length} of ${all.length} roles can appear · tap to ${host ? 'edit' : 'see'}</small></span>${icon('right')}</button>
      <div class="ro-preview">${active.map((r) => `<i class="${ROLE_INFO[r].team}" title="${ROLE_INFO[r].name}">${icon(ROLE_INFO[r].ic)}</i>`).join('')}</div>`;
  }
  const v = S.settings[s.k];
  if (s.type === 'step') {
    return `<div class="set"><span>${s.label}${s.hint ? `<small class="set-hint">${s.hint}</small>` : ''}</span><div class="stepper"><button data-step="${s.k}" data-d="-1" ${!host || v <= s.min ? 'disabled' : ''}>${icon('minus')}</button><b>${fmtSetting(s, v)}</b><button data-step="${s.k}" data-d="1" ${!host || v >= s.max ? 'disabled' : ''}>${icon('plus')}</button></div></div>`;
  }
  if (s.type === 'toggle') return `<div class="set"><span>${s.label}</span><button class="switch ${v ? 'on' : ''}" data-toggle="${s.k}" ${host ? '' : 'disabled'}><i></i></button></div>`;
  const segIc = (o) => (s.k === 'place' ? icon(PLACES[o].ic) : '');
  return `<div class="set col"><span>${s.label}</span><div class="seg ${s.k === 'place' ? 'places' : ''}">${s.opts.map(([o, t]) => `<button class="${o === v ? 'on' : ''}" data-seg="${s.k}" data-v="${o}" ${host ? '' : 'disabled'}>${segIc(o)}${t}</button>`).join('')}</div>${s.hint ? `<small class="set-hint">${s.hint}</small>` : ''}</div>`;
}

// All roles with a 0–100% chance each (steps of 10). 0% = never, 100% = always (if there are enough players).
function openRoles() {
  const host = me.id === S.hostId;
  const body = openOverlay('roles', `${icon('users')} Roles${host ? '' : ' <small>· the host is choosing</small>'}`, { closeLabel: host ? 'Done' : 'Close' });
  const prevClose = $('.ov-x', ov);
  if (prevClose && !host) prevClose.onclick = () => { ui.rolesDismissed = true; closeOverlay(); };
  const draw = () => {
    ui.rolesDraw = draw;
    const group = (title, list, team) => `<h3>${title}</h3>${list.map((r) => {
      const v = S.settings['r_' + r] ?? 0;
      return `<div class="role-row ${team} ${v ? 'on' : ''}"><span class="rr-ic">${icon(ROLE_INFO[r].ic)}</span><div class="rr-txt"><b>${ROLE_INFO[r].name}</b><small>${roleText(r)}</small></div>
        <div class="stepper small"><button data-rr="${r}" data-d="-1" ${!host || v <= 0 ? 'disabled' : ''}>${icon('minus')}</button><b>${v}%</b><button data-rr="${r}" data-d="1" ${!host || v >= 100 ? 'disabled' : ''}>${icon('plus')}</button></div>
        <div class="rr-bar"><div style="width:${v}%"></div></div></div>`;
    }).join('')}`;
    body.innerHTML = `<p class="hint">The chance that each role is in the game. 0% = never, 100% = always (if there are enough players). Normal Gamers and Hackers fill the rest.</p>
      ${group('Gamer roles', GAMER_ROLES, 'gamer')}${group('Hacker roles', HACKER_ROLES, 'hacker')}${group('NPC roles (play for themselves)', NPC_ROLES, 'npc')}`;
    $$('[data-rr]', body).forEach((b) => b.onclick = () => {
      const k = 'r_' + b.dataset.rr;
      const nv = Math.min(100, Math.max(0, (S.settings[k] ?? 0) + 10 * +b.dataset.d));
      S.settings[k] = nv; // instant feedback; the host confirms
      act({ type: 'settings', patch: { [k]: nv } });
      draw();
    });
  };
  draw();
}

// ---------- account ----------
function openProfile() {
  const body = openOverlay('profile', `${icon('user')} Account`, { closeLabel: 'Close' });
  const draw = () => {
    if (!profile) {
      body.innerHTML = `<div class="center">${avatarSVG(me.av, 120, 'float')}<h2>Create your account</h2><p class="hint">Your account lives on this phone. Play games to earn XP, level up and unlock new headsets, hair, faces and extras for your character.</p>
        <input id="pName" class="inp name" maxlength="16" placeholder="Your gamer tag" value="${esc(me.name)}"><button class="btn big hot" id="pCreate">${icon('check')} CREATE ACCOUNT</button></div>`;
      $('#pCreate').onclick = () => {
        const n = $('#pName').value.trim();
        if (!n) return shakeEl($('#pName'));
        me.name = n.slice(0, 16); profile = createProfile(me.name);
        localStorage.setItem('name', me.name); sessionStorage.setItem('name', me.name);
        toast('✅ Account created! Play to level up.', 'good'); draw(); render();
      };
      return;
    }
    const lp = levelProgress(profile.xp);
    const next = [];
    for (const [k, part] of Object.entries(AV_PARTS)) {
      const n = (part.list || part.colors).length;
      for (let i = 0; i < n; i++) {
        const lv = unlockLevel(k, i);
        if (lv > lp.level) next.push({ lv, k, i, label: part.list ? `${part.list[i]} <small>(${part.label.toLowerCase()})</small>` : `<i class="swatch" style="background:${part.colors[i]}"></i> new ${part.label.toLowerCase()}` });
      }
    }
    next.sort((a, b) => a.lv - b.lv);
    const stat = (ic, label, v) => `<div class="pstat">${icon(ic)}<b>${v}</b><small>${label}</small></div>`;
    body.innerHTML = `<div class="center">${avatarSVG(me.av, 120, 'float')}<h2>${esc(profile.name)}</h2>
      <div class="lvl-badge">LEVEL ${lp.level}</div>
      <div class="xpbar"><div style="width:${lp.pct}%"></div><span>${lp.into} / ${lp.need} XP</span></div></div>
      <div class="pstats">${stat('gamepad', 'played', profile.played)}${stat('trophy', 'wins', profile.wins)}${stat('grid', 'games done', profile.games)}${stat('swords', 'duels won', profile.duelWins)}${stat('skull', 'hacks', profile.hacks)}${stat('star', 'total XP', profile.xp)}</div>
      <h3>${icon('lock')} Next unlocks</h3>
      ${next.length ? `<div class="unlocks">${next.slice(0, 12).map((u) => `<div class="unlock"><span class="u-lv">Lv ${u.lv}</span>${u.label}</div>`).join('')}</div>` : '<p class="good-text">Everything unlocked. Legend status.</p>'}
      <p class="hint">How to earn XP: play (+20), finish games (+6 each), win duels (+12), hack (+15), save people (+15), win with your team (+40) or as an NPC (+60).</p>`;
  };
  draw();
}

function renderWaiting() {
  const players = S.order.map((id) => S.players[id]).filter(Boolean);
  const host = me.id === S.hostId;
  app.innerHTML = `<div class="screen waiting ${enterCls('waiting')}">
    <div class="roomcode"><small>ROOM CODE</small><b>${esc(S.code).split('').map((c, i) => `<span style="animation-delay:${i * 0.12}s">${c}</span>`).join('')}</b><small>${ONLINE ? 'Friends: open the game and press JOIN' : 'Local test: join from another tab'}</small></div>
    <div class="place-banner"><span class="pb-ic">${icon(PLACES[S.settings.place].ic)}</span><div><b>${PLACES[S.settings.place].name}</b><small>${PLACES[S.settings.place].vibe}</small></div></div>
    <h3>${icon('users')} Squad <span class="count-pill">${players.length}/12</span></h3>
    <div class="squad">${players.map((p) => `<div class="member">${av(p, 62, 'bob')}<span>${esc(p.name)}</span><em class="lvl">Lv ${p.lvl || 1}</em>${p.id === S.hostId ? `<i class="crown">${icon('crown')}</i>` : ''}${host && p.id !== me.id ? `<button class="rm" data-id="${p.id}">${icon('x')}</button>` : ''}</div>`).join('')}</div>
    <div class="row-btns"><button class="btn ghost small" id="howBtn">${icon('news')} How to play</button><button class="btn ghost small" id="prefsBtn">${icon('tool')} My sound settings</button></div>
    <h3>${icon('tool')} Settings ${host ? '<button class="btn tiny ghost" id="resetSet">Reset to default</button>' : '<small>· host decides</small>'}</h3>
    <div class="settings">${SETTINGS_UI.map((s) => settingControl(s, host)).join('')}</div>
    ${host ? `<div class="card host-tip">${icon('monitor')} <span><b>Host: your phone runs the game.</b> Keep the game open and the screen on (don't lock it or switch apps) — otherwise nobody's games count until you're back.</span></div><button class="btn big hot start" id="start" ${players.length < 3 ? 'disabled' : ''}>${icon('play')} START GAME</button>${players.length < 3 ? '<p class="hint center">Need at least 3 players.</p>' : ''}` : '<p class="hint center pulse-text">Waiting for the host to start…</p>'}
    <button class="btn ghost" id="leave">${icon('logout')} Leave room</button>
  </div>`;
  const patch = (k, v) => act({ type: 'settings', patch: { [k]: v } });
  $$('[data-step]').forEach((b) => b.onclick = () => {
    const s = SETTINGS_UI.find((x) => x.k === b.dataset.step);
    patch(s.k, Math.min(s.max, Math.max(s.min, S.settings[s.k] + s.step * +b.dataset.d)));
  });
  $$('[data-toggle]').forEach((b) => b.onclick = () => patch(b.dataset.toggle, !S.settings[b.dataset.toggle]));
  $$('[data-seg]').forEach((b) => b.onclick = () => patch(b.dataset.seg, b.dataset.v));
  $('#rolesOpen')?.addEventListener('click', () => openRoles());
  $('#prefsBtn').onclick = openPrefs;
  $('#resetSet')?.addEventListener('click', async () => { if (await ask('Reset settings?', 'All settings and role chances go back to the defaults.', 'Reset')) act({ type: 'settingsReset' }); });
  $$('.rm').forEach((b) => b.onclick = () => act({ type: 'remove', id: b.dataset.id }));
  $('#start')?.addEventListener('click', () => act({ type: 'start' }));
  $('#howBtn').onclick = howToPlay;
  $('#leave').onclick = leave;
}

function topbar() {
  const pct = Math.min(100, Math.round(S.credits / S.goal * 100));
  const t = hnow();
  const left = S.phase === 'playing' ? S.timerEndsAt - t : S.timeLeftAtPause;
  const timer = S.phase === 'playing' ? `<b data-cd="${S.timerEndsAt}">${fmt(left)}</b>` : `<b>${fmt(left)}</b>`;
  const chips = [S.surgeUntil > t ? `<span class="evchip surge">${icon('zap')}SURGE <b data-cd="${S.surgeUntil}"></b></span>` : '',
    S.lagUntil > t ? `<span class="evchip lag">${icon('clock')}LAG <b data-cd="${S.lagUntil}"></b></span>` : '',
    S.breach ? `<span class="evchip breach">${icon('alert')}BREACH <b data-cd="${S.breach.until}"></b></span>` : '',
    S.keyWiped ? `<span class="evchip">${icon('key')}KEY WIPED</span>` : ''].join('');
  return `<header class="topbar"><div class="tb-row"><span class="tb-round">R${S.round}</span><span class="tb-timer ${left < 120000 ? 'low' : ''}">${icon('clock')}${timer}</span><span class="tb-me">${av(mine(), 32)}</span></div>
    <div class="netbar"><div style="width:${pct}%"></div><span>NETWORK ${pct}%</span></div>${chips ? `<div class="evchips">${chips}</div>` : ''}</header>`;
}

function tabbar(tabs, cur) {
  return `<nav class="tabbar">${tabs.map(([k, ic, label, badge]) => k === 'scan'
    ? `<button class="tab-scan" id="tabScan"><span>${icon(ic)}</span><small>${label}</small></button>`
    : `<button class="tab ${cur === k ? 'on' : ''}" data-tab="${k}">${icon(ic)}<small>${label}</small>${badge ? '<i class="badge"></i>' : ''}</button>`).join('')}</nav>`;
}

function newsList(items) {
  const safeImg = (s) => typeof s === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s);
  return items.length ? `<ul class="feed">${items.map((n) => `<li class="${n.img ? 'has-img' : ''}"><span class="ft">${new Date(n.t - offset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>${esc(n.text)}${safeImg(n.img) ? `<img class="feed-img" src="${n.img}" alt="photo">` : ''}</li>`).join('')}</ul>` : '<p class="hint">Nothing yet…</p>';
}
window.addEventListener('hpg-photo', (e) => { if (room && mine()) act({ type: 'photo', img: e.detail.img, what: e.detail.what }); });

function duelCard(d) {
  const iAmA = d.a === me.id, other = pl(iAmA ? d.b : d.a);
  const G = DUEL[d.g];
  const vs = `<div class="versus">${av(mine(), 56, 'slide-l')}<b>VS</b>${av(other, 56, 'slide-r')}</div>`;
  if (d.st === 'active') return `<div class="card duel">${vs}<p class="center pulse-text">Duel in progress…</p></div>`;
  const limit = d.forced ? 90000 : S.settings.duelTimeout * 1000;
  return `<div class="card duel ${!iAmA || d.forced ? 'hot' : ''}">${d.forced ? '<div class="forced">FORCED DUEL</div>' : ''}${vs}
    <p class="center"><b>${esc(other?.name)}</b> · ${icon(G.ic)} ${G.name}</p>
    <p class="center">Find them — <b>one</b> of you scans the other's badge and the duel starts. <b class="cd-pill" data-cd="${d.at + limit}">${fmt(d.at + limit - hnow())}</b></p>
    <div class="row"><button class="btn hot" id="duelScan">${icon('crosshair')} SCAN THEM</button><button class="btn" id="duelBadge">${icon('grid')} MY BADGE</button></div>
    ${iAmA && !d.forced ? '<button class="btn small ghost" id="duelCancel">Cancel duel</button>' : ''}${!iAmA && !d.forced ? '<button class="btn small ghost" id="duelRefuse">Refuse (2-min ban)</button>' : ''}
    <p class="hint center">You can keep playing games while you search.</p></div>`;
}

function powerBtn(p, id, ic, label) {
  const t = hnow();
  const ready = (p.powerAt || 0) <= t;
  return `<button class="btn ${ready ? 'hot' : ''}" id="${id}" ${ready ? '' : 'disabled'}>${icon(ic)} ${label}${ready ? '' : ` <span data-until="${p.powerAt}">${fmt(p.powerAt - t)}</span>`}</button>`;
}

function roleTools(p) {
  const t = hnow();
  let h = '';
  if (canHack(p)) {
    const mates = S.settings.hackersKnow ? Object.values(S.players).filter((x) => x.team === 'hacker' && x.id !== me.id) : [];
    h += `<div class="card hacker"><b>${icon('skull')} Hacker tools</b>${mates.length ? `<div class="mates">${mates.map((x) => `<span>${av(x, 26)}${esc(x.name)}${x.alive ? '' : ' (out)'}</span>`).join('')}</div>` : ''}
      <div class="row"><button class="btn danger" id="closeHack">${icon('skull')} Close hack</button><button class="btn danger" id="remoteHack" ${p.charges < 1 ? 'disabled' : ''}>${icon('radio')} Remote (${p.charges})</button></div>
      ${p.role === 'ddos' ? powerBtn(p, 'ddosBtn', 'wifioff', 'DDoS: freeze a phone') : ''}
      <p class="hint">Win duels to earn remote hacks${p.role === 'trojan' ? ' — and LOSE duels on purpose to infect the winner' : ''}. Your games are fake — play them anyway to look busy.</p></div>`;
    if (S.settings.sabotage) {
      const ready = t >= (S.sabReadyAt || 0);
      h += `<div class="card hacker"><b>${icon('alert')} Sabotage</b>${ready ? '' : `<p class="hint">Recharging <span data-until="${S.sabReadyAt}">${fmt(S.sabReadyAt - t)}</span></p>`}
        <button class="btn danger" data-sab="breach" ${!ready || t < S.breachReadyAt || S.breach ? 'disabled' : ''}>${icon('alert')} Dual Breach <small>2 players must fix it in 60 s or −20%</small></button>
        <div class="row"><button class="btn danger" data-sab="lag" ${!ready || S.lagUsed ? 'disabled' : ''}>${icon('clock')} Lag Spike</button><button class="btn danger" data-sab="wipe" ${!ready || S.wipeUsed ? 'disabled' : ''}>${icon('key')} Key Wipe</button></div></div>`;
    }
  }
  if (p.role === 'insider') {
    const mates = Object.values(S.players).filter((x) => x.team === 'hacker' && x.id !== me.id);
    h += `<div class="card hacker"><b>${icon('eye')} Insider</b><div class="mates">${mates.map((x) => `<span>${av(x, 26)}${esc(x.name)}${x.alive ? '' : ' (out)'}</span>`).join('')}</div><p class="hint">Protect them. Lie for them. Vote with them.</p></div>`;
  }
  if (p.role === 'itguy') h += `<div class="card it"><b>${icon('tool')} IT Guy · ${p.scans} scans left</b><button class="btn" id="itScan" ${p.scans < 1 ? 'disabled' : ''}>${icon('shield')} Scan someone's badge</button><p class="hint">Ask them to show their badge. If they were hacked, you cure them.</p></div>`;
  if (p.role === 'firewall') h += `<div class="card it"><b>${icon('shield')} Firewall</b>${powerBtn(p, 'fwScan', 'crosshair', 'Shield someone (scan badge)')}${powerBtn(p, 'fwSelf', 'shield', 'Shield myself')}</div>`;
  if (p.role === 'healer') h += `<div class="card it"><b>${icon('star')} ${ROLE_INFO.healer.name}</b>${powerBtn(p, 'healScan', 'crosshair', 'Revive: scan an AFK QR')}<p class="hint">Find an AFK player and scan the QR on their phone.</p></div>`;
  if (p.role === 'streamer') h += `<div class="card it"><b>${icon('radio')} Streamer</b>${p.liveUntil > t ? `<div class="live">● LIVE <b data-cd="${p.liveUntil}">${fmt(p.liveUntil - t)}</b></div>` : powerBtn(p, 'goLive', 'radio', 'GO LIVE (2 min)')}</div>`;
  if (p.role === 'debugger') h += `<div class="card it"><b>${icon('bug')} Debugger</b>${powerBtn(p, 'debugBtn', 'bug', 'Debug a player')}</div>`;
  if (p.role === 'patcher') h += `<div class="card it"><b>${icon('tool')} Patcher</b>${S.breach ? `<button class="btn hot" id="patchBtn">${icon('tool')} FIX THE BREACH ALONE (+10%)</button>` : '<p class="hint">Waiting for a Dual Breach…</p>'}</div>`;
  if (['honeypot', 'tank', 'scout', 'captain', 'clutch'].includes(p.role)) {
    const st = { honeypot: p.trapUsed ? 'Trap used.' : 'Trap armed 🍯', tank: p.tankUsed ? 'Armor used.' : 'Armor intact 🛡️', clutch: p.clutchUsed ? 'Clutch used.' : 'Clutch ready 😎', scout: 'Listening for hacks 📡', captain: 'You break ties 👑' }[p.role];
    h += `<div class="card it"><b>${icon(ROLE_INFO[p.role].ic)} ${ROLE_INFO[p.role].name}</b><p class="hint">${st}</p></div>`;
  }
  if (p.role === 'bounty') h += `<div class="card npc"><b>${icon('crosshair')} Your target</b><div class="mates"><span>${av(pl(p.target), 30)}${esc(pname(p.target))}</span></div>${p.npcWon ? '<p class="good-text">✅ Bounty collected!</p>' : '<p class="hint">Get them Vote Kicked.</p>'}</div>`;
  if (p.role === 'fanboy') h += `<div class="card npc"><b>${icon('star')} Your idol</b>${p.idol ? `<div class="mates"><span>${av(pl(p.idol), 30)}${esc(pname(p.idol))}</span></div>` : `<button class="btn hot" id="pickIdol">${icon('star')} Pick your idol</button><p class="hint">Auto-picked after 2 minutes.</p>`}</div>`;
  if (['troll', 'ragequit', 'bug'].includes(p.role)) h += `<div class="card npc"><b>${icon(ROLE_INFO[p.role].ic)} ${ROLE_INFO[p.role].name}</b><p class="hint">${p.npcWon ? '✅ You already won!' : roleText(p.role)}</p></div>`;
  if (p.mod) h += `<div class="modchip">${icon(MODIFIERS[p.mod].ic)} <b>${MODIFIERS[p.mod].name}</b> — ${MODIFIERS[p.mod].text}</div>`;
  if (p.shield) h += `<div class="card lucky"><div class="card-ic">${icon('shield')}</div><div><b>Shield active</b><p class="hint">The next hack on you is blocked.</p></div></div>`;
  return h;
}

function renderPlaying() {
  const p = mine(), info = ROLE_INFO[p.role], t = hnow();
  const d = duelOf(p);
  const duelActive = d?.st === 'active';
  const blocked = p.readyAt > t && p.team !== 'hacker' ? p.readyAt : 0; // Hackers' games are fake: never blocked
  const tab = ui.tab;
  let v = '';
  if (tab === 'net') {
    const pct = Math.min(100, Math.round(S.credits / S.goal * 100));
    v += `<div class="hero-net"><div class="hn-pct">${pct}<small>%</small></div><div class="hn-label">NETWORK SECURED</div><div class="hn-bar"><div style="width:${pct}%"></div></div><div class="hn-row"><span>${icon('clock')} <b data-cd="${S.timerEndsAt}">${fmt(S.timerEndsAt - t)}</b></span><span>${icon('users')} ${Object.values(S.players).filter((x) => x.team && x.alive).length} online</span></div></div>`;
    if (d) v += duelCard(d);
    if (S.breach && p.role !== 'patcher') v += `<div class="card bad center">${icon('alert')} DUAL BREACH — ${S.breach.fixers.map((id) => esc(pname(id))).join(' & ')} must fix it! <b data-cd="${S.breach.until}"></b></div>`;
    if (p.task) v += `<div class="card"><div class="card-ic">${icon(SOLO[p.games[p.task.i]?.t]?.ic || 'zap')}</div><div><b>${SOLO[p.games[p.task.i]?.t]?.name} in progress</b><button class="btn small" id="openTask">Open it</button></div></div>`;
    if (S.keyHolder === me.id) {
      const max = S.settings.meetMax ?? 2, left = Math.max(0, max - (p.meets || 0));
      const warm = (S.roundStartAt || S.startedAt || 0) + 30000;
      v += `<div class="card key ${left ? '' : 'dead'}"><div class="card-ic">${icon('key')}</div><div><b>You hold the Lobby Key</b>`
        + (left ? `<p class="hint">Only you can call a Lobby without a body. ${left}/${max} left for you this game.</p>${warm > t ? `<p class="hint">Warming up… usable in <b data-until="${warm}">${fmt(warm - t)}</b></p>` : ''}<button class="btn hot small" id="keyLobby">${icon('users')} Call everyone to the Lobby</button>`
          : '<p class="hint">You used all your Lobbies this game — this key does nothing for you. Keep it secret. 😏</p>') + '</div></div>';
    }
    if (p.lucky) v += `<div class="card lucky"><div class="card-ic">${icon('star')}</div><div><b>Lucky shield active</b><p class="hint">The next hack on you bounces off.</p></div></div>`;
    if (blocked) v += `<div class="card cool"><div class="card-ic">${icon('clock')}</div><div><b>Cooldown <span data-until="${blocked}">${fmt(blocked - t)}</span></b><p class="hint">Walk to your next game's location!</p></div></div>`;
    v += `<h3>${icon('activity')} Live feed</h3>${newsList(S.news.slice(-8).reverse())}`;
  } else if (tab === 'games') {
    v += `<h2 class="tab-title">${icon('grid')} Your games</h2><p class="hint">Walk to the place on each game, then play it there. The ones marked "with players" need other people.</p>`;
    if (blocked) v += `<div class="card cool"><div class="card-ic">${icon('clock')}</div><div><b>Next game in <span data-until="${blocked}">${fmt(blocked - t)}</span></b><p class="hint">Use the time to move!</p></div></div>`;
    if (duelActive) v += '<div class="card"><p class="hint">You\'re in a duel — finish it first.</p></div>';
    v += `<div class="games">${p.games.map((g, i) => {
      const G = SOLO[g.t]; const open = p.task?.i === i;
      return gameCard(g.t, { cls: `${g.done ? 'done' : ''} ${open ? 'open' : ''}`, attrs: `data-g="${i}" ${g.done || (blocked && !open) || duelActive ? 'disabled' : ''}`, n: i + 1,
        sub: open ? 'IN PROGRESS — tap to open' : null, foot: g.done ? `${icon('check')}DONE` : G.social ? `${icon('users')}with players` : `${icon('pin')}${esc(g.z || '')}` });
    }).join('')}</div>`;
  } else if (tab === 'duel') {
    v += `<h2 class="tab-title">${icon('swords')} Duels</h2>`;
    if (d) v += duelCard(d);
    else {
      const mustDuel = (p.soloStreak || 0) >= 2;
      v += `<button class="duel-big" id="duelRandom" ${blocked && !mustDuel ? 'disabled' : ''}><span>${icon('crosshair')}</span><b>FIND ME AN OPPONENT</b><small>${blocked && !mustDuel ? `Cooldown <span data-until="${blocked}">${fmt(blocked - t)}</span>` : 'The game picks someone at random. Find them, one of you scans the other, fight!'}</small></button>`;
      v += `<div class="card"><b>Win a duel</b><p class="hint">+1 to the Network bar (+2 during a Power Surge). Beat the Lobby Key holder and you steal the key. Refusing a duel = 2-min game ban.</p></div>`;
      v += `<div class="card"><b>${icon('alert')} Forced duels</b><p class="hint">Every ${S.settings.forcedDuelMin} min the game throws two random players into a duel. 90 s to find each other — or both get a 2-min game ban.</p></div>`;
      v += `<h3>Duel games</h3><div class="duel-list">${Object.values(DUEL).map((G) => `<div>${icon(G.ic)}<b>${G.name}</b><small>${G.desc}</small></div>`).join('')}</div>`;
    }
  } else if (tab === 'me') {
    v += `<div class="me-card">${av(p, 120, 'float')}<h2>${esc(p.name)}</h2>
      <button class="btn" id="myBadge">${icon('grid')} Show my badge QR</button>
      <button class="role-reveal ${ui.revealRole ? 'shown ' + p.team : ''}" id="roleChip">${ui.revealRole ? `${icon(info.ic)}<b>${info.name}</b><small>tap to hide</small>` : `${icon('eye')}<b>TAP TO SHOW ROLE</b><small>check nobody is looking</small>`}</button></div>`;
    if (ui.revealRole) v += `<p class="role-text">${roleText(p.role)}</p>${roleTools(p)}`;
    v += `<div class="row-btns"><button class="btn ghost small" id="howBtn">${icon('news')} How to play</button><button class="btn ghost small" id="prefsBtn">${icon('tool')} Sound settings</button></div>`;
    if (me.id === S.hostId) v += `<button class="btn ghost small" id="endNow">${icon('x')} Host: end game</button>`;
  }
  const hasPower = (p.powerAt || 0) <= t && ['firewall', 'healer', 'streamer', 'debugger', 'ddos'].includes(p.role);
  const tabs = [['net', 'activity', 'Network'], ['games', 'grid', 'Games', !blocked && !duelActive], ['scan', 'crosshair', 'SCAN'], ['duel', 'swords', 'Duel', !!d], ['me', 'user', 'Me', S.keyHolder === me.id || p.charges > 0 || hasPower]];
  app.innerHTML = `${topbar()}<main class="view ${enterCls('play-' + tab)}">${v}</main>${tabbar(tabs, tab)}`;

  $$('.tab').forEach((b) => b.onclick = () => { ui.tab = b.dataset.tab; render(); });
  $('#tabScan').onclick = () => openScanner('Scan a badge');
  $('#roleChip')?.addEventListener('click', () => { ui.revealRole = !ui.revealRole; render(); });
  $('#myBadge')?.addEventListener('click', openBadge);
  $('#howBtn')?.addEventListener('click', howToPlay);
  $('#prefsBtn')?.addEventListener('click', openPrefs);
  $('#openTask')?.addEventListener('click', () => playGame(p.task.i));
  $('#keyLobby')?.addEventListener('click', async () => { if (await ask('Call a Lobby?', 'Everyone gets pulled to the Lobby to talk and vote.', 'CALL LOBBY')) act({ type: 'keyLobby' }); });
  $$('.gcard').forEach((b) => b.onclick = () => playGame(+b.dataset.g));
  $('#duelRandom')?.addEventListener('click', () => act({ type: 'duelRandom' }));
  $('#duelScan')?.addEventListener('click', () => openScanner('Scan your opponent'));
  $('#duelBadge')?.addEventListener('click', openBadge);
  $('#duelRefuse')?.addEventListener('click', async () => { if (await ask('Refuse the duel?', 'You get a 2-minute game ban.', 'Refuse')) act({ type: 'duelRefuse' }); });
  $('#duelCancel')?.addEventListener('click', () => act({ type: 'duelCancel' }));
  const notMate = (x) => x.team !== 'hacker' || !S.settings.hackersKnow;
  $('#closeHack')?.addEventListener('click', () => {
    if (hackLocked()) return toast('⏳ Hacking unlocks 30 seconds into the game.', 'bad');
    pickPlayer(`${icon('skull')} Who are you close to?`, notMate, startHack, (x) => { const pct = hackPct(x.id); return `<div class="pick-hack"><div style="width:${pct}%"></div><small>${pct}%</small></div>`; });
  });
  $('#remoteHack')?.addEventListener('click', () => pickPlayer(`${icon('radio')} Remote hack who?`, notMate, (id) => act({ type: 'remoteHack', target: id })));
  $('#ddosBtn')?.addEventListener('click', () => pickPlayer(`${icon('wifioff')} DDoS who?`, notMate, (id) => act({ type: 'ddos', target: id })));
  $$('[data-sab]').forEach((b) => b.onclick = async () => { if (await ask('Use sabotage?', b.textContent.trim(), 'DO IT')) act({ type: 'sabotage', kind: b.dataset.sab }); });
  $('#itScan')?.addEventListener('click', () => openScanner('IT scan', 'it'));
  $('#fwScan')?.addEventListener('click', () => openScanner('Shield someone', 'fw'));
  $('#fwSelf')?.addEventListener('click', () => act({ type: 'fwSelf' }));
  $('#healScan')?.addEventListener('click', () => openScanner('Revive: scan AFK QR', 'heal'));
  $('#goLive')?.addEventListener('click', () => act({ type: 'goLive' }));
  $('#debugBtn')?.addEventListener('click', () => pickPlayer(`${icon('bug')} Debug who?`, () => true, (id) => act({ type: 'debug', target: id })));
  $('#patchBtn')?.addEventListener('click', () => act({ type: 'breachFix', patch: true }));
  $('#pickIdol')?.addEventListener('click', () => pickPlayer(`${icon('star')} Who is your idol?`, () => true, (id) => act({ type: 'pickIdol', target: id })));
  $('#endNow')?.addEventListener('click', async () => { if (await ask('End the game?', 'This ends the game for everyone.', 'End game')) act({ type: 'endNow' }); });
}

function renderOut() {
  const p = mine();
  const waiting = p.afk && !p.found;
  const title = p.kicked ? 'KICKED' : 'AFK';
  let v = waiting
    ? `<div class="outbox afk-now">${av(p, 70, 'grey')}<h2 class="glitch" data-t="AFK">AFK</h2><p>Freeze! Say NOTHING. Hold up your phone — whoever finds you scans this to report you (a Healer can scan it to revive you):</p>${badgeBlock(p, 230)}</div>`
    : `<div class="outbox">${av(p, 80, 'grey')}<h2 class="glitch" data-t="${title}">${title}</h2><p>${p.kicked ? 'You got Vote Kicked. Watch the chaos — but no talking! Or just go touch some grass. 🌱' : 'You were found. Follow the game, stay silent. (A Healer can still revive you — show them this:)'}</p>${!p.kicked ? badgeBlock(p, 140) : ''}${p.npcWon ? '<p class="good-text">🏆 You already won as an NPC!</p>' : ''}</div>`;
  if (ui.outTab === 'news') {
    const items = [...S.news, ...S.log.map((l) => ({ t: l.t, text: '🕵️ ' + l.text }))].sort((a, b) => b.t - a.t);
    v += `<h3>${icon('news')} Live news <small>· includes secret events</small></h3>${newsList(items)}`;
  } else if (ui.outTab === 'players') {
    // spectator view: every player's role, status, hack danger and stats
    const t = hnow(), hackers = Object.values(S.players).filter((x) => x.team === 'hacker');
    v += `<h3>${icon('users')} Everyone <small>· secret info, only for players who are out</small></h3><div class="spec">${Object.values(S.players).filter((x) => x.team).map((x) => {
      const prog = Math.max(0, ...hackers.map((h) => h.prog?.[x.id] || 0));
      const danger = x.pending ? 100 : x.remote ? 100 : Math.round(prog / S.settings.hackSec * 100);
      const status = x.kicked ? 'Kicked' : x.afk ? 'AFK' : x.pending ? `HACKED — drops in ${fmt(x.pending.at - t)}` : x.remote ? `REMOTE HACK — ${fmt(x.remote.at - t)}` : 'Alive';
      return `<div class="spec-row ${x.team} ${x.alive ? '' : 'out'}">${av(x, 44, x.alive ? '' : 'grey')}<div class="spec-main"><b>${esc(x.name)} <span class="rv-role">${icon(ROLE_INFO[x.role].ic)}${ROLE_INFO[x.role].name}</span></b>
        <small class="${x.pending || x.remote ? 'bad' : ''}">${status}</small>
        ${x.team !== 'hacker' && x.alive ? `<div class="danger"><div style="width:${danger}%"></div><span>hack ${danger}%</span></div>` : ''}
        <small>${x.done} games · ${x.wins || 0}W / ${x.lost || 0}L duels · ${x.hacks || 0} hacks · ${x.votes || 0} votes</small></div></div>`;
    }).join('')}</div>`;
  } else {
    v += `<h3>${icon('grid')} Play for fun</h3><div class="games">${ARCADE_IDS.map((id) => gameCard(id, { attrs: `data-p="${id}"` })).join('')}</div>`;
  }
  app.innerHTML = `${topbar()}<main class="view ${enterCls('out-' + ui.outTab + waiting)}">${v}</main>${tabbar([['news', 'news', 'News'], ['players', 'users', 'Players'], ['games', 'grid', 'Games']], ui.outTab)}`;
  $$('.tab').forEach((b) => b.onclick = () => { ui.outTab = b.dataset.tab; render(); });
  $$('[data-p]').forEach((b) => b.onclick = () => {
    const G = SOLO[b.dataset.p];
    const body = openOverlay('practice', `${icon(G.ic)} ${G.name}`, { closeLabel: 'Close' });
    const done = once((res) => { closeOverlay(); toast(res === true ? `✅ ${pickOne(WIN_LINES)}` : res === 'skip' ? 'Not available on this device' : `❌ ${pickOne(FAIL_LINES)}`, res === true ? 'good' : 'info'); });
    ui.cleanup = G.run(body, done) || null;
  });
}

function renderLobby() {
  const L = S.lobby, p = mine();
  const alivePlayers = Object.values(S.players).filter((x) => x.team && x.alive);
  const late = L.late || [];
  let v = L.reason === 'afk'
    ? `<div class="err404 glitch" data-t="ERROR 404">ERROR 404</div><p class="center sub404">player not found</p><div class="found">${av(pl(L.found), 70, 'grey')}<p><b>${esc(pname(L.found))}</b> was found AFK by <b>${esc(pname(L.by))}</b></p></div>`
    : `<div class="err404 key glitch" data-t="LOBBY">LOBBY</div><div class="found">${av(pl(L.by), 70, 'bob')}<p><b>${esc(pname(L.by))}</b> called everyone to the Lobby!</p></div>`;
  if (L.dropped?.length) v += `<div class="card bad center">${icon('wifioff')} Disconnected when the Lobby started: <b>${L.dropped.map(esc).join(', ')}</b></div>`;
  if (L.stage === 'gather') {
    const arrived = alivePlayers.filter((x) => L.arrived?.[x.id]);
    v += `<div class="stage-card"><small>GET TO THE LOBBY</small><b data-cd="${L.endsAt}">${fmt(L.endsAt - hnow())}</b></div>`;
    if (L.by === me.id) v += `<div class="checkcode"><small>Everyone scans this to check in</small>${badgeBlock(p, 220)}</div>`;
    else if (!p.alive) v += '<p class="hint center">You are out.</p>';
    else if (L.arrived?.[me.id]) v += `<div class="card good center">${icon('check')} Checked in. Wait for the others.</div>`;
    else v += `<div class="checkin"><p class="center">Go to <b>${esc(pname(L.by))}</b> and scan the QR on their phone.</p><button class="btn big hot" id="ckScan">${icon('crosshair')} SCAN TO CHECK IN</button><p class="hint center">Not checked in when time runs out = no vote this round.</p></div>`;
    v += `<h3>Checked in ${arrived.length}/${alivePlayers.length}</h3><div class="squad small">${alivePlayers.map((x) => `<div class="member ${L.arrived?.[x.id] ? 'in' : 'dim'}">${av(x, 46)}<span>${esc(x.name)}</span></div>`).join('')}</div>`;
  }
  if (L.stage === 'talk') {
    const ready = alivePlayers.filter((x) => L.ready?.[x.id]).length;
    v += `<div class="stage-card"><small>DISCUSS — WHO IS THE HACKER?</small><b data-cd="${L.endsAt}">${fmt(L.endsAt - hnow())}</b></div>`;
    if (late.length) v += `<p class="center hint">${icon('clock')} Late (no vote): ${late.map((id) => esc(pname(id))).join(', ')}</p>`;
    if (p.alive) v += `<button class="btn big ${L.ready?.[me.id] ? 'sel' : 'hot'}" id="readyVote" ${L.ready?.[me.id] ? 'disabled' : ''}>${icon('vote')} ${L.ready?.[me.id] ? 'READY ✓ — locked in' : 'READY TO VOTE'}</button>`;
    v += `<p class="center hint">${ready}/${alivePlayers.length} ready — if everyone is ready, voting starts now.</p>`;
  }
  if (L.stage === 'vote') {
    const myVote = L.votes?.[me.id];
    const canVote = p.alive && !late.includes(me.id);
    const count = Object.keys(L.votes || {}).length;
    v += `<div class="stage-card vote"><small>VOTE KICK</small><b data-cd="${L.endsAt}">${fmt(L.endsAt - hnow())}</b><small>${count} voted</small></div>`;
    if (canVote) {
      const locked = !!myVote;
      v += `${locked ? `<p class="center good-text">${icon('lock')} Vote locked in — no take-backs.</p>` : '<p class="hint center">Choose carefully: you can\'t change your vote.</p>'}
        <div class="pgrid">${alivePlayers.filter((x) => x.id !== me.id).map((x) => `<button class="pcard vote ${myVote === x.id ? 'sel' : ''} ${L.votes?.[x.id] ? 'has-voted' : ''}" data-v="${x.id}" ${locked ? 'disabled' : ''}>${av(x, 62)}<span>${esc(x.name)}</span>${L.votes?.[x.id] ? '<i class="voted-tag">✓ VOTED</i>' : late.includes(x.id) ? '<i class="voted-tag late">LATE</i>' : ''}</button>`).join('')}</div><button class="btn ghost vote ${myVote === 'skip' ? 'sel' : ''}" data-v="skip" ${locked ? 'disabled' : ''}>${icon('skip')} Skip vote</button>`;
    } else {
      v += `<p class="hint center">${p.alive ? 'You were late — no vote this round.' : 'You are out — you can\'t vote.'}</p>`;
      v += `<div class="pgrid">${alivePlayers.map((x) => `<div class="pcard ${L.votes?.[x.id] ? 'has-voted' : ''}">${av(x, 62)}<span>${esc(x.name)}</span>${L.votes?.[x.id] ? '<i class="voted-tag">✓ VOTED</i>' : ''}</div>`).join('')}</div>`;
    }
  }
  if (L.stage === 'result') {
    const o = L.outcome || {};
    const k = o.kicked ? pl(o.kicked) : null;
    const rows = Object.entries(o.counts || {}).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map((r) => r[1]), o.skip || 0);
    v += `<div class="result ${o.team === 'hacker' ? 'hackerdown' : ''}"><div class="votes-in glitch" data-t="THE VOTES ARE IN">THE VOTES ARE IN</div>
      <div class="vbars">${[...rows].reverse().map(([id, n], i) => `<div class="vbar ${id === o.kicked ? 'top' : ''}" style="--d:${1.2 + i * 0.9}s">${av(pl(id), 36)}<span class="vname">${esc(pname(id))}</span><div class="vtrack"><div style="--w:${n / max * 100}%"></div></div><b>${n}</b></div>`).join('')}
        ${o.skip ? `<div class="vbar" style="--d:${1.2 + rows.length * 0.9}s"><span class="vskip">${icon('skip')}</span><span class="vname">Skip</span><div class="vtrack"><div style="--w:${o.skip / max * 100}%"></div></div><b>${o.skip}</b></div>` : ''}</div>
      <div class="suspense" style="--d:${1.2 + (rows.length + 1) * 0.9}s">and the player leaving the network is…</div>
      <div class="verdict" style="--d:${3 + (rows.length + 1) * 0.9}s">${k ? leaveScene(k) :`<div class="res-ic">${icon('skip')}</div>`}<p>${esc(o.text || '')}</p></div>
      <small>Game continues in <b data-cd="${L.endsAt}">${fmt(L.endsAt - hnow())}</b></small></div>`;
  }
  if (me.id === S.hostId) v += `<button class="btn small ghost" id="next">${icon('skip')} Host: skip to next step</button>`;
  app.innerHTML = `<main class="view lobby ${enterCls('lobby-' + L.stage)}">${v}</main>`;
  $$('.vote').forEach((b) => b.onclick = () => act({ type: 'vote', target: b.dataset.v }));
  $('#readyVote')?.addEventListener('click', () => act({ type: 'readyVote' }));
  $('#ckScan')?.addEventListener('click', () => openScanner('Check in'));
  $('#next')?.addEventListener('click', () => act({ type: 'next' }));
}

// Fun end-of-game awards from the stats the host tracked
// end screen timeline: the starting line-up as cards, then each moment with its minute and emoji
function highlights() {
  const items = [];
  for (const l of S.log) {
    const last = items[items.length - 1];
    if (last && !l.roles && last.text === l.text) { last.n++; continue; } // same thing twice in a row → "×2"
    items.push({ ...l, n: 1 });
  }
  return items.map((l) => {
    const time = `<span class="hl-t">${l.roles ? 'START' : `MIN ${l.m}`}</span>`;
    if (l.roles) {
      const cards = l.roles.map((r) => {
        const p = pl(r.id), info = ROLE_INFO[r.role] || { name: r.role, ic: 'users' };
        return `<div class="hl-role ${p?.team || ''}">${p ? av(p, 34) : ''}<div><b>${esc(p?.name || '?')}</b><small>${icon(info.ic)} ${esc(info.name)}</small>${r.mod ? `<i>${icon(MODIFIERS[r.mod]?.ic || 'zap')} ${esc(MODIFIERS[r.mod]?.name || r.mod)}</i>` : ''}</div></div>`;
      }).join('');
      return `<li class="hl-item">${time}<div class="hl-body"><span class="hl-e">🎭</span><p>The line-up</p><div class="hl-roles">${cards}</div></div></li>`;
    }
    const m = l.text.match(/^(\p{Extended_Pictographic}️?)\s*/u);
    const emoji = m ? m[1] : '•', text = m ? l.text.slice(m[0].length) : l.text;
    return `<li class="hl-item">${time}<div class="hl-body"><span class="hl-e">${emoji}</span><p>${esc(text)}${l.n > 1 ? ` <b class="hl-x">×${l.n}</b>` : ''}</p></div></li>`;
  }).join('');
}

function awards(players) {
  const best = (f, min = 1) => { const top = [...players].sort((a, b) => f(b) - f(a))[0]; return top && f(top) >= min ? top : null; };
  const n = (v, one, many) => `${v} ${v === 1 ? one : many}`;
  const list = [
    ['trophy', 'MVP', 'most games finished', best((x) => x.done), (x) => n(x.done, 'game', 'games')],
    ['swords', 'Duel King', 'most duels won', best((x) => x.wins || 0), (x) => n(x.wins, 'win', 'wins')],
    ['x', 'Punching Bag', 'most duels lost', best((x) => x.lost || 0), (x) => n(x.lost, 'loss', 'losses')],
    ['skull', 'Virus Spreader', 'most hacks', best((x) => x.hacks || 0), (x) => n(x.hacks, 'hack', 'hacks')],
    ['shield', 'Life Saver', 'most cures & revives', best((x) => (x.cures || 0) + (x.revives || 0)), (x) => n((x.cures || 0) + (x.revives || 0), 'save', 'saves')],
    ['eye', 'Bloodhound', 'found the most hiders', best((x) => x.finds || 0), (x) => `${x.finds} found`],
    ['vote', 'Most Suspected', 'most votes against them', best((x) => x.votes || 0), (x) => n(x.votes, 'vote', 'votes')],
    ['wifioff', 'First Down', 'first to go AFK', (() => { const a = players.filter((x) => x.afkMin != null).sort((p, q) => p.afkMin - q.afkMin)[0]; return a || null; })(), (x) => `minute ${Math.floor(x.afkMin)}`],
    ['star', 'Unbreakable', 'never went down + most games', best((x) => (x.alive ? x.done : 0)), (x) => `${n(x.done, 'game', 'games')}, never down`],
  ].filter((a) => a[3]);
  return list.map(([ic, title, what, p, val], i) => `<div class="award" style="animation-delay:${0.2 + i * 0.1}s"><span class="aw-ic">${icon(ic)}</span>${av(p, 44)}<div><b>${title}</b><small>${esc(p.name)} · ${val(p)}</small><em>${what}</em></div></div>`).join('') || '<p class="hint">No awards this time.</p>';
}

function renderEnded() {
  const r = S.result || {}, p = mine();
  const won = p?.team && (r.winner === (p.team === 'hacker' ? 'hackers' : 'gamers') || p.npcWon);
  const cls = r.winner === 'none' || !p?.team ? 'over' : won ? 'won' : 'lost';
  const title = cls === 'over' ? 'GAME OVER' : won ? 'VICTORY' : 'DEFEAT';
  const players = Object.values(S.players).filter((x) => x.team);
  const teamOf = (x) => x.startRole && ROLE_INFO[x.startRole]?.team === 'npc' ? 'npc' : x.team;
  app.innerHTML = `<main class="view ended ${cls} ${enterCls('ended')}">
    <div class="end-hero">${av(p, 130, cls === 'lost' ? 'grey' : 'float')}<h1 class="glitch" data-t="${title}">${title}</h1>
      <p>${r.winner === 'gamers' ? 'The GAMERS win' : r.winner === 'hackers' ? 'The HACKERS win' : ''}</p><small>${esc(r.text || '')}</small></div>
    ${ui.lastXp ? `<div class="xp-earned">${icon('star')} <b>+${ui.lastXp.gained.total} XP</b> · Level ${levelOf(profile?.xp || 0)}<div class="xpbar"><div style="width:${levelProgress(profile?.xp || 0).pct}%"></div></div></div>` : ''}
    <h3>${icon('trophy')} Awards</h3>
    <div class="awards">${awards(players)}</div>
    <h3>${icon('users')} Who was who</h3>
    <div class="reveal">${players.map((x, i) => { const info = ROLE_INFO[x.role]; const sr = x.startRole !== x.role ? ` <small>(was ${ROLE_INFO[x.startRole]?.name})</small>` : ''; return `<div class="rv ${teamOf(x)}" style="animation-delay:${0.3 + i * 0.12}s">${av(x, 50, x.alive ? '' : 'grey')}<div><b>${esc(x.name)}${x.npcWon ? ' 🏆' : ''}</b><small>${x.kicked ? 'Vote Kicked' : x.afk ? 'Hacked (AFK)' : 'Survived'} · ${x.done} games · ${x.wins || 0} duel wins${x.mod ? ' · ' + MODIFIERS[x.mod].name : ''}</small></div><span class="rv-role">${icon(info.ic)}${info.name}${sr}</span></div>`; }).join('')}</div>
    <h3>${icon('news')} Highlights</h3>
    <ol class="hl">${highlights()}</ol>
    ${me.id === S.hostId ? `<button class="btn big hot" id="again">${icon('play')} PLAY AGAIN</button>` : '<p class="hint center pulse-text">Waiting for the host…</p>'}
    <button class="btn ghost" id="leave">${icon('logout')} Leave room</button>
  </main>`;
  if (cls === 'won' && !document.querySelector('.ended .confetti')) confetti($('.end-hero'), 40);
  $('#again')?.addEventListener('click', () => act({ type: 'again' }));
  $('#leave').onclick = leave;
}

// ---------- live countdowns ----------
setInterval(() => {
  $$('[data-cd]').forEach((e) => { e.textContent = fmt(+e.dataset.cd - hnow()); });
  $$('[data-until]').forEach((e) => {
    const left = +e.dataset.until - hnow();
    e.textContent = fmt(left);
    if (left <= 0 && !e.dataset.fired) { e.dataset.fired = '1'; setTimeout(render, 50); }
  });
  // close the frozen screen / reveal courier names exactly on time
  if (S && ui.overlay === 'frozen' && frozenUntil(mine()) <= hnow()) { closeOverlay(); render(); }
  const task = S && ui.overlay === 'social' ? mine()?.task : null;
  if (task?.kind === 'courier' && !$('.courier-target') && hnow() > (task.reveal || task.at + 45000)) drawSocial();
  if (task?.kind === 'vanish' && $('.task-hero.vanish:not(.hunted)') && hnow() > task.huntAt) { drawSocial(); sfx('alarm'); }
  // Hide & Seek: when the hunt starts the badge pops up on its own, even if the hider went back to the game
  const vt = S?.phase === 'playing' && mine()?.alive ? mine()?.task : null;
  if (vt?.kind === 'vanish' && hnow() > vt.huntAt && (!ui.overlay || ui.overlay === 'picker')) { openSocialTask(vt.i); sfx('alarm'); }
}, 250);

// floating background particles
for (let i = 0; i < 18; i++) {
  const d = document.createElement('i');
  d.className = 'particle';
  d.style.left = Math.random() * 100 + '%';
  d.style.animationDelay = -Math.random() * 20 + 's';
  d.style.animationDuration = 14 + Math.random() * 16 + 's';
  d.style.opacity = 0.15 + Math.random() * 0.4;
  document.body.appendChild(d);
}

// ---------- start up (also resumes after a page reload) ----------
function hideBoot() {
  const b = $('#boot');
  if (!b) return;
  sessionStorage.setItem('booted', '1');
  window.__bootDone?.(); // everything loaded: fill the bar
  // 🥚 playing between 2 and 5 at night? the loading screen notices
  const hr = new Date().getHours();
  if (hr >= 2 && hr < 5) $('.boot-term', b)?.insertAdjacentHTML('beforeend', '<p style="--d:2.1s">&gt; why are you awake at 3 AM?… <b>SUS</b></p>');
  // counted from when the page started opening, so a slow download doesn't add extra waiting
  const wait = Math.max(0, 2500 - performance.now()); // long enough to see the .exe slam
  setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 700); }, wait);
}

(async function boot() {
  const r = sessionStorage.getItem('room');
  try {
    if (r) {
      room = r;
      if (sessionStorage.getItem('hostOf') === r) {
        isHost = true;
        const saved = localStorage.getItem('host-' + r);
        await startHost(saved ? JSON.parse(saved) : null);
      } else {
        net = await connect(r, { isHost: false, onState: receive });
        if (!(await net.exists())) {
          net.close?.(); net = null; room = null;
          sessionStorage.removeItem('room');
          ui.error = `Room ${r} doesn't exist anymore.`;
        }
      }
      if (room) act(joinMsg());
    }
  } finally {
    render();
    if (document.fonts?.ready) document.fonts.ready.then(hideBoot); else hideBoot();
  }
})();
