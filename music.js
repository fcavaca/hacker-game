// MUSIC + SOUND EFFECTS, all synthesised live with the Web Audio API (no audio files, no copyright).
// Three loops: 'menu' (chill, funny lo-fi), 'game' (tense pulse), 'lobby' (suspense + heartbeat).
// Players can switch music / sound effects / vibration off in their personal settings.

const KEY = 'hpg-audio';
export const prefs = (() => { try { return { music: true, sfx: true, vibrate: true, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { music: true, sfx: true, vibrate: true }; } })();
export function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ } applyPrefs(); }

let ctx = null, master, musicBus, sfxBus, noiseBuf;
let track = null, wanted = null, timer = 0, step = 0, nextT = 0;

export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyPrefs();
      if (wanted) startTrack(wanted);
    } else if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio on this device */ }
}

function applyPrefs() {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(prefs.music ? 0.22 : 0, ctx.currentTime, 0.1);
  sfxBus.gain.setTargetAtTime(prefs.sfx ? 0.8 : 0, ctx.currentTime, 0.05);
}

// ---------- tiny synths ----------
function note(bus, f, t, d, { type = 'sine', vol = 0.2, attack = 0.005, release = null, detune = 0, filter = null } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (release ?? d));
  let out = g;
  if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; g.connect(fl); out = fl; }
  o.connect(g); out.connect(bus);
  o.start(t); o.stop(t + (release ?? d) + 0.05);
}
function noise(bus, t, d, vol = 0.1, hp = 6000) {
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + d + 0.02);
}
function kick(bus, t, vol = 0.5) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.3);
}
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> frequency
// a cartoon "bloop": a short note that slides up or down in pitch
function slide(bus, f1, f2, t, d, vol = 0.06, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.05);
}

// ---------- the three loops (16 steps per bar) ----------
const TRACKS = {
  // menu: chill, swingy lo-fi with soft jazzy chords, a bouncy bass and silly bubble "bloops"
  menu: {
    bpm: 84,
    play(s, t, dur) {
      const bar = Math.floor(s / 16) % 4, i = s % 16;
      if (i % 2 === 1) t += dur * 0.28; // swing: off-beats come a little late (lazy feel)
      const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]; // Fmaj7 Em7 Dm7 Cmaj7
      const ch = chords[bar], root = ch[0] - 12;
      // soft "electric piano" chord, played twice per bar
      if (i === 0 || i === 7) ch.forEach((n, k) => note(musicBus, hz(n), t + k * 0.012, dur * 6, { type: 'triangle', vol: 0.032, attack: 0.02, filter: 1800 }));
      // bouncy bass: boom … ba-boom
      if (i === 0) note(musicBus, hz(root), t, dur * 2.5, { type: 'sine', vol: 0.2 });
      if (i === 6) note(musicBus, hz(root + 7), t, dur * 1.2, { type: 'sine', vol: 0.14 });
      if (i === 10) note(musicBus, hz(root + 12), t, dur * 1.2, { type: 'sine', vol: 0.12 });
      // relaxed drums: soft kick, finger-snap, quiet shaker
      if (i === 0 || i === 10) kick(musicBus, t, 0.22);
      if (i === 4 || i === 12) noise(musicBus, t, 0.08, 0.05, 2500);
      if (i % 2 === 0) noise(musicBus, t, 0.025, 0.015, 9000);
      // lazy little melody (pentatonic, so it always sounds happy)
      const mel = [[72, null, 69, null, 67, null, null, 69, 72, null, 74, null, null, 72, null, null],
        [71, null, null, 67, null, 64, null, null, 67, null, 69, 71, null, null, null, null],
        [69, null, 72, null, 74, null, 72, null, 69, null, null, 67, null, 65, null, null],
        [67, null, null, null, 64, null, 67, null, 72, null, null, null, null, null, null, null]][bar];
      if (mel[i]) note(musicBus, hz(mel[i]), t, dur * 1.6, { type: 'sine', vol: 0.05, attack: 0.01 });
      // the funny part: bubble bloops and a "boing" at the end of the loop
      if (i === 14 && bar % 2 === 0) slide(musicBus, hz(76), hz(88), t, 0.12, 0.05);
      if (i === 15 && bar === 1) slide(musicBus, hz(84), hz(72), t, 0.18, 0.045, 'triangle');
      if (i === 12 && bar === 3) { slide(musicBus, hz(48), hz(72), t, 0.25, 0.06, 'triangle'); slide(musicBus, hz(72), hz(60), t + 0.25, 0.2, 0.04, 'triangle'); }
    },
  },
  game: {
    bpm: 100,
    play(s, t, dur) {
      const bar = Math.floor(s / 16) % 4, i = s % 16;
      const root = [38, 38, 39, 36][bar]; // D D Eb C — uneasy
      if (i % 8 === 0) kick(musicBus, t, 0.4);
      if (i % 2 === 1) noise(musicBus, t, 0.03, 0.03, 9000);
      if (i % 2 === 0) note(musicBus, hz(root), t, dur * 1.5, { type: 'sawtooth', vol: 0.14, filter: 380 });
      if (i === 0 || i === 10) note(musicBus, hz(root + 24 + (bar === 2 ? 1 : 0)), t, dur * 3, { type: 'square', vol: 0.03, filter: 1800 });
      if (i === 12 && bar === 3) note(musicBus, hz(root + 31), t, dur * 4, { type: 'triangle', vol: 0.05 });
    },
  },
  lobby: {
    bpm: 72,
    play(s, t, dur) {
      const bar = Math.floor(s / 16) % 2, i = s % 16;
      if (i === 0 || i === 2) kick(musicBus, t, i === 0 ? 0.45 : 0.3); // heartbeat
      if (i === 0) {
        const r = bar ? 41 : 40;
        note(musicBus, hz(r), t, dur * 16, { type: 'sawtooth', vol: 0.06, attack: 0.8, filter: 600, detune: -8 });
        note(musicBus, hz(r + 7), t, dur * 16, { type: 'sawtooth', vol: 0.04, attack: 0.8, filter: 700, detune: 8 });
      }
      if (i === 8 || i === 14) note(musicBus, hz(bar ? 76 : 77), t, dur * 3, { type: 'sine', vol: 0.04 });
      if (i % 4 === 3) noise(musicBus, t, 0.02, 0.02, 10000);
    },
  },
};

function startTrack(name) {
  clearInterval(timer);
  track = name;
  if (!ctx || !name) return;
  step = 0; nextT = ctx.currentTime + 0.1;
  timer = setInterval(() => {
    const T = TRACKS[track]; if (!T) return;
    const dur = 60 / T.bpm / 4;
    while (nextT < ctx.currentTime + 0.15) { if (prefs.music) T.play(step, nextT, dur); nextT += dur; step++; }
  }, 40);
}
// change the music (does nothing if it is already playing)
export function setTrack(name) { wanted = name; if (name !== track) startTrack(name); }

// ---------- sound effects ----------
export function sfx(kind) {
  if (!ctx || !prefs.sfx) return;
  const t = ctx.currentTime, b = sfxBus;
  const seq = (notes, type = 'sine', vol = 0.2, gap = 0.09) => notes.forEach((n, i) => note(b, hz(n), t + i * gap, gap * 1.6, { type, vol }));
  switch (kind) {
    case 'click': note(b, 1800, t, 0.03, { type: 'square', vol: 0.03 }); break;
    case 'tick': note(b, 1200, t, 0.05, { type: 'sine', vol: 0.12 }); break;
    case 'good': seq([76, 83], 'sine', 0.18); break;
    case 'bad': note(b, 180, t, 0.3, { type: 'sawtooth', vol: 0.12, filter: 900 }); break;
    case 'win': seq([72, 76, 79, 84, 88], 'square', 0.08, 0.1); seq([60, 64, 67, 72], 'triangle', 0.12, 0.12); break;
    case 'lose': seq([67, 63, 60, 55], 'sawtooth', 0.09, 0.16); break;
    case 'alarm': for (let i = 0; i < 3; i++) { note(b, 880, t + i * 0.24, 0.12, { type: 'square', vol: 0.12 }); note(b, 660, t + i * 0.24 + 0.12, 0.12, { type: 'square', vol: 0.12 }); } break;
    case 'alert': seq([81, 88], 'triangle', 0.18, 0.08); break;
    case 'whoosh': { const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(4000, t + 0.35); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); s.connect(f); f.connect(g); g.connect(b); s.start(t); s.stop(t + 0.45); break; }
    case 'fight': kick(b, t, 0.6); seq([64, 71, 76], 'square', 0.1, 0.07); break;
    case 'drum': for (let i = 0; i < 14; i++) noise(b, t + i * 0.07, 0.06, 0.06 + i * 0.008, 1500); kick(b, t + 1.0, 0.7); break;
    case 'siren': for (let i = 0; i < 12; i++) { note(b, 900, t + i * 0.5, 0.25, { type: 'square', vol: 0.25 }); note(b, 600, t + i * 0.5 + 0.25, 0.25, { type: 'square', vol: 0.25 }); } break;
    case 'reveal': note(b, hz(48), t, 1.2, { type: 'sawtooth', vol: 0.15, filter: 800 }); seq([60, 67, 72], 'triangle', 0.15, 0.18); break;
    default: note(b, 740, t, 0.08, { vol: 0.12 });
  }
}
