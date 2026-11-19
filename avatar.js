// Custom human characters, drawn as SVG.
// An avatar is { s, h, hc, e, m, f, c, a } = indexes into the lists below.
// New options are always added at the END of a list so old saved characters keep working.

export const SKINS = ['#ffdcb8', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#a8e6a1', '#b9c7ff'];
export const HAIR_COLORS = ['#1c1c1c', '#5a3a1e', '#a0582a', '#e8c46a', '#c0392b', '#ff3dce', '#00d2ff', '#e9e9e9', '#7dff4d', '#8a5cff'];
// 12 team colours: hoodie AND headset use the player's colour, and nobody in a room shares one.
export const AV_COLORS = ['#00ffa3', '#00d2ff', '#ff3dce', '#ffd23f', '#ff7a1a', '#8a5cff', '#ff2d55', '#7dff4d', '#f2f2f2', '#2b2f45', '#ffb38a', '#4d6bff'];
export const COLOR_NAMES = ['mint green', 'cyan', 'pink', 'yellow', 'orange', 'purple', 'red', 'lime green', 'white', 'dark grey', 'peach', 'blue'];
export const HAIR_COLOR_NAMES = ['black', 'brown', 'ginger', 'blonde', 'red', 'pink', 'blue', 'white', 'green', 'purple'];

export const AV_PARTS = {
  s: { label: 'Skin', colors: SKINS },
  h: { label: 'Hair', list: ['short', 'buzz', 'long', 'curly', 'bun', 'mohawk', 'ponytail', 'bald', 'spiky', 'afro', 'emo fringe', 'pigtails',
    'curtains', 'bob', 'space buns', 'braids', 'locs', 'quiff', 'wolf cut', 'undercut'] },
  hc: { label: 'Hair colour', colors: HAIR_COLORS },
  e: { label: 'Eyes', list: ['normal', 'happy', 'sleepy', 'wink', 'angry', 'wide', 'googly', 'side-eye', 'tired', 'stars'] },
  m: { label: 'Mouth', list: ['smile', 'grin', 'flat', 'open', 'smirk', 'tongue', 'buck teeth', 'wobbly', 'vampire', 'kiss'] },
  f: { label: 'Face', list: ['none', 'mustache', 'beard', 'goatee', 'freckles', 'big blush', 'scar', 'unibrow'] },
  c: { label: 'Colour', colors: AV_COLORS },
  k: { label: 'Headset', list: ['gaming', 'neon', 'cat ears', 'retro', 'pro RGB', 'wired earbuds', 'bunny ears', 'devil horns'] },
  a: { label: 'Extra', list: ['none', 'glasses', 'shades', 'monocle', 'cap', 'beanie', 'hacker mask', 'earring', 'party hat', 'clown nose', 'eye patch', 'sweatband', 'flower', 'propeller cap'] },
  hd: { label: 'Hood', list: ['down', 'up', 'no hood'] }, // added last so old characters keep their look (hood down)
};

// Level needed to use an option: UNLOCK[part][optionIndex] = level. Everything else is free.
export const UNLOCK = {
  s: { 6: 5, 7: 5 },
  h: { 5: 2, 9: 3, 10: 4, 11: 2, 15: 3, 16: 3, 17: 2, 18: 4, 19: 2 },
  hc: { 5: 2, 6: 2, 8: 3, 9: 4 },
  e: { 6: 2, 7: 3, 8: 2, 9: 5 },
  m: { 6: 2, 7: 2, 8: 4, 9: 3 },
  f: { 2: 3, 3: 2, 5: 2, 6: 5, 7: 4 },
  k: { 1: 2, 2: 3, 3: 2, 4: 5, 6: 4, 7: 6 },
  a: { 3: 3, 6: 5, 8: 2, 9: 3, 10: 4, 11: 2, 12: 2, 13: 6 },
};
export const unlockLevel = (k, i) => UNLOCK[k]?.[i] || 1;
// Replace anything above the player's level with the free default
export function lockedFix(a, lvl) {
  const out = cleanAvatar(a); let changed = false;
  for (const k of Object.keys(out)) if (unlockLevel(k, out[k]) > lvl) { out[k] = 0; changed = true; }
  return { av: out, changed };
}
const COUNT = Object.fromEntries(Object.entries(AV_PARTS).map(([k, v]) => [k, (v.list || v.colors).length]));

export function randomAvatar() {
  const r = (n) => Math.floor(Math.random() * n);
  const a = {};
  for (const k of Object.keys(COUNT)) a[k] = r(COUNT[k]);
  a.s = r(6); // mostly human skin tones when random
  if (Math.random() < 0.4) a.a = 0;
  if (Math.random() < 0.55) a.f = 0;
  return a;
}

// random, but only with options unlocked at this level
export function randomUnlocked(lvl) {
  for (let i = 0; i < 50; i++) { const a = randomAvatar(); if (lockedFix(a, lvl).changed === false) return a; }
  return lockedFix(randomAvatar(), lvl).av;
}

export function cleanAvatar(a) {
  a = a || {};
  const out = {};
  for (const k of Object.keys(COUNT)) out[k] = Number.isInteger(a[k]) && a[k] >= 0 && a[k] < COUNT[k] ? a[k] : 0;
  return out;
}

export const partName = (a, k) => { const p = AV_PARTS[k]; return p.list ? p.list[cleanAvatar(a)[k]] : ''; };

function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const INK = '#1a1420';

export function avatarSVG(raw, size = 48, extra = '') {
  const a = cleanAvatar(raw);
  const skin = SKINS[a.s], skinD = darken(skin, 0.8), hair = HAIR_COLORS[a.hc], hood = AV_COLORS[a.c], hoodD = darken(hood, 0.7);
  const P = (k) => AV_PARTS[k].list[a[k]];
  const hairS = P('h'), eyes = P('e'), mouth = P('m'), face = P('f'), acc = P('a'), set = P('k'), hd = P('hd');
  const up = hd === 'up';
  const kc = hood, kcD = darken(kc, 0.65); // headset = same colour as the hoodie
  let s = '';
  // hood UP shapes: a round hood that hugs the head and tucks in at the neck (the shoulders show wider below),
  // and an oval face opening that closes under the chin
  const HOOD_OUT = 'M27 79 Q17 71 16.5 48 Q17 10.5 50 10.5 Q83 10.5 83.5 48 Q83 71 73 79 Q50 87 27 79 Z';
  const HOOD_OPEN = 'M24.5 47.5 A25.5 28.5 0 1 1 75.5 47.5 A25.5 28.5 0 1 1 24.5 47.5 Z';
  // hood up: the dark inside of the hood, then the hair behind the head shows inside the opening only
  if (up) {
    s += `<defs><clipPath id="av-hood-clip"><path d="${HOOD_OPEN}"/></clipPath></defs><path d="${HOOD_OPEN}" fill="${hoodD}"/>`;
    const inside = { long: `<path d="M25 44 Q22 80 30 88 L70 88 Q78 80 75 44 Z" fill="${hair}"/>`, bob: `<path d="M24 40 Q21 68 29 72 L71 72 Q79 68 76 40 Z" fill="${hair}"/>`, 'wolf cut': `<path d="M23 42 L22 66 L77 66 L77 42 Z" fill="${hair}"/>`, braids: `<path d="M24 42 L24 62 L76 62 L76 42 Z" fill="${hair}"/>`, locs: `<path d="M24 42 L24 70 L76 70 L76 42 Z" fill="${hair}"/>` }[hairS];
    if (inside) s += `<g clip-path="url(#av-hood-clip)">${inside}</g>`;
  }
  // hair behind the head (hood down / no hood)
  if (!up) {
    if (hairS === 'long') s += `<path d="M25 44 Q22 80 30 88 L70 88 Q78 80 75 44 Z" fill="${hair}"/>`;
    if (hairS === 'ponytail') s += `<ellipse cx="77" cy="50" rx="7" ry="15" fill="${hair}" transform="rotate(18 77 50)"/>`;
    if (hairS === 'afro') s += `<circle cx="50" cy="38" r="33" fill="${hair}"/>`;
    if (hairS === 'pigtails') s += `<circle cx="20" cy="44" r="9" fill="${hair}"/><circle cx="80" cy="44" r="9" fill="${hair}"/>`;
    if (hairS === 'bob') s += `<path d="M24 40 Q21 68 29 72 L71 72 Q79 68 76 40 Z" fill="${hair}"/>`;
  }
  // braids, locs and the wolf cut hang OVER the hoodie, so they are drawn after the body (see below)
  let overBody = '';
  if (!up) {
    if (hairS === 'braids') overBody += [24, 76].map((x) => [52, 59, 66, 73, 80].map((y, i) => `<ellipse cx="${x + (x < 50 ? -1 : 1) * (i % 2)}" cy="${y}" rx="${4.6 - i * 0.25}" ry="4.4" fill="${hair}" stroke="rgba(255,255,255,.28)" stroke-width="1.1"/>`).join('') + `<path d="M${x - 3} 84 h6" stroke="#ff4d4d" stroke-width="2.4" stroke-linecap="round"/>`).join('');
    if (hairS === 'locs') overBody += [[25, 30, 20, 74], [30, 26, 26, 80], [70, 26, 74, 80], [75, 30, 80, 74], [35, 24, 33, 70], [65, 24, 67, 70]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + (x1 < 50 ? -3 : 3)} ${(y1 + y2) / 2} ${x2} ${y2}" stroke="${hair}" stroke-width="5.5" stroke-linecap="round" fill="none"/>`).join('');
    if (hairS === 'wolf cut') overBody += `<path d="M23 42 L20 70 L27 64 L29 76 L36 68 L64 68 L71 76 L73 64 L80 70 L77 42 Z" fill="${hair}"/>`;
  }
  // hood DOWN: lying behind the neck · hood UP: the back of the hood behind the head
  if (hd === 'down') s += `<path d="M21 88 Q16 57 50 54 Q84 57 79 88 Z" fill="${hood}"/><path d="M30 84 Q29 64 50 62 Q71 64 70 84 Z" fill="${hoodD}"/>`;
  // body: hoodie (or a plain sweater without a hood)
  s += `<path d="M12 100 Q14 78 50 75 Q86 78 88 100 Z" fill="${hood}"/>`;
  if (hd === 'down') s += `<path d="M22 86 Q36 79 50 80 Q64 79 78 86" fill="none" stroke="${hoodD}" stroke-width="2.4" opacity=".7"/>`; // hood seam
  s += `<path d="M36 92 H64 V100 H36 Z" fill="${hoodD}" opacity=".45"/>`; // front pocket
  s += `<path d="M33 77 Q50 94 67 77" fill="none" stroke="${hoodD}" stroke-width="3"/>`;
  if (hd !== 'no hood') s += `<path d="M44 84 V96 M56 84 V96" stroke="${hoodD}" stroke-width="2" stroke-linecap="round"/>`; // drawstrings
  s += overBody;
  // neck + ears + head (slightly bigger head = funnier)
  s += `<rect x="43" y="62" width="14" height="16" rx="5" fill="${skinD}"/>`;
  if (!up) s += `<circle cx="26" cy="49" r="6" fill="${skin}"/><circle cx="74" cy="49" r="6" fill="${skin}"/>`; // ears (inside the hood when it's up)
  s += `<ellipse cx="50" cy="46" rx="24" ry="27" fill="${skin}"/>`;
  // hair on top
  const top = {
    short: `<path d="M26 43 Q24 16 50 16 Q76 16 74 43 Q69 28 50 28 Q32 28 26 43 Z" fill="${hair}"/>`,
    buzz: `<path d="M27 38 Q28 19 50 19 Q72 19 73 38 Q64 27 50 27 Q36 27 27 38 Z" fill="${hair}" opacity=".85"/>`,
    long: `<path d="M25 50 Q21 15 50 15 Q79 15 75 50 Q73 31 62 26 Q50 33 36 27 Q27 33 25 50 Z" fill="${hair}"/>`,
    curly: [[30, 31], [38, 22], [50, 18], [62, 22], [70, 31], [26, 41], [74, 41], [44, 25], [56, 25]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8.5" fill="${hair}"/>`).join(''),
    bun: `<circle cx="50" cy="12" r="9" fill="${hair}"/><path d="M26 41 Q25 18 50 18 Q75 18 74 41 Q67 28 50 28 Q33 28 26 41 Z" fill="${hair}"/>`,
    mohawk: `<path d="M43 29 L44 8 L50 1 L56 8 L57 29 Q50 26 43 29 Z" fill="${hair}"/>`,
    ponytail: `<path d="M26 41 Q25 17 50 17 Q75 17 74 41 Q67 28 50 28 Q33 28 26 41 Z" fill="${hair}"/>`,
    bald: '<ellipse cx="41" cy="27" rx="7" ry="3.5" fill="#fff" opacity=".4"/>',
    spiky: `<path d="M26 40 L23 20 L33 26 L35 11 L44 22 L50 6 L56 22 L65 11 L67 26 L77 20 L74 40 Q67 28 50 28 Q33 28 26 40 Z" fill="${hair}"/>`,
    afro: '',
    'emo fringe': `<path d="M25 46 Q22 15 50 15 Q78 15 75 40 Q60 26 30 52 Z" fill="${hair}"/>`,
    pigtails: `<path d="M26 41 Q25 17 50 17 Q75 17 74 41 Q67 28 50 28 Q33 28 26 41 Z" fill="${hair}"/>`,
    // v1.1 hair
    curtains: `<path d="M25 46 Q22 15 50 16 Q78 15 75 46 Q72 31 57 27 Q53 31 50 25 Q47 31 43 27 Q28 31 25 46 Z" fill="${hair}"/>`,
    bob: `<path d="M25 48 Q21 14 50 15 Q79 14 75 48 L72 48 Q72 37 67 35 L33 35 Q28 37 28 48 Z" fill="${hair}"/>`,
    'space buns': `<circle cx="31" cy="17" r="8.5" fill="${hair}"/><circle cx="69" cy="17" r="8.5" fill="${hair}"/><path d="M26 41 Q25 18 50 18 Q75 18 74 41 Q67 29 50 29 Q33 29 26 41 Z" fill="${hair}"/>`,
    braids: `<path d="M25 50 Q21 15 50 15 Q79 15 75 50 Q73 31 58 26 L50 32 L42 26 Q27 31 25 50 Z" fill="${hair}"/>`,
    locs: `<path d="M26 40 Q25 16 50 16 Q75 16 74 40 Q67 27 50 27 Q33 27 26 40 Z" fill="${hair}"/>` + [[36, 24, 33, 38], [44, 22, 43, 35], [56, 22, 57, 35], [64, 24, 67, 38]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${hair}" stroke-width="5" stroke-linecap="round"/>`).join(''),
    quiff: `<path d="M27 38 Q24 20 38 16 Q50 3 68 10 Q79 17 73 38 Q66 26 50 27 Q34 26 27 38 Z" fill="${hair}"/><path d="M42 13 Q54 8 64 13" stroke="#fff" stroke-width="1.6" fill="none" opacity=".25"/>`,
    'wolf cut': `<path d="M25 46 Q22 14 50 15 Q78 14 75 46 L71 37 L67 43 L62 32 L56 39 L50 30 L44 39 L38 32 L33 43 L29 37 Z" fill="${hair}"/>`,
    undercut: `<path d="M27 38 Q28 20 46 18 Q50 30 27 38 Z" fill="${hair}" opacity=".45"/><path d="M33 30 Q36 13 56 13 Q77 15 74 38 Q68 24 54 25 Q42 26 33 30 Z" fill="${hair}"/>`,
  }[hairS];
  // eyebrows: SAME colour as the hair (bald people get dark brows)
  const browCol = hairS === 'bald' ? INK : hair;
  const browY = eyes === 'wide' || eyes === 'googly' ? 36 : 39;
  const brow = face === 'unibrow'
    ? `<path d="M34 ${browY + 1} Q50 ${browY - 4} 66 ${browY + 1}" stroke="${browCol}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    : eyes === 'angry'
      ? `<path d="M34 38 L46 42.5 M66 38 L54 42.5" stroke="${browCol}" stroke-width="3.6" stroke-linecap="round"/>`
      : eyes === 'tired' || eyes === 'sleepy'
        ? `<path d="M35 41 L46 40 M54 40 L65 41" stroke="${browCol}" stroke-width="3.2" stroke-linecap="round"/>`
        : `<path d="M35 ${browY + 1} Q40.5 ${browY - 2.5} 46 ${browY + 1} M54 ${browY + 1} Q59.5 ${browY - 2.5} 65 ${browY + 1}" stroke="${browCol}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  // eyes (class "eye" blinks via CSS)
  const open = (x, r = 4.4, dx = 0.6) => `<g class="eye"><ellipse cx="${x}" cy="48" rx="${r}" ry="${r + 0.7}" fill="#fff"/><circle cx="${x + dx}" cy="48.6" r="${r * 0.55}" fill="${INK}"/><circle cx="${x + dx + 1}" cy="47.2" r="${r * 0.2}" fill="#fff"/></g>`;
  const arc = (x) => `<path d="M${x - 4.5} 49 Q${x} 44 ${x + 4.5} 49" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const sleepy = (x) => `<path d="M${x - 4.5} 48 H${x + 4.5}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M${x - 3.5} 48 Q${x} 51.5 ${x + 3.5} 48" fill="${INK}"/>`;
  const googly = (x, dx, dy) => `<g class="eye"><circle cx="${x}" cy="47" r="7" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="${x + dx}" cy="${47 + dy}" r="3.2" fill="${INK}"/></g>`;
  const star = (x) => `<path d="M${x} 42 L${x + 1.8} 46 L${x + 6} 46.4 L${x + 2.8} 49.2 L${x + 3.8} 53.4 L${x} 51 L${x - 3.8} 53.4 L${x - 2.8} 49.2 L${x - 6} 46.4 L${x - 1.8} 46 Z" fill="#ffd23f" stroke="${INK}" stroke-width="1.2"/>`;
  const eyeSvg = {
    normal: open(41) + open(59), happy: arc(41) + arc(59), sleepy: sleepy(41) + sleepy(59), wink: open(41) + arc(59), angry: open(41) + open(59),
    wide: open(41, 5.6) + open(59, 5.6), googly: googly(40, 2.5, 2) + googly(60, -2, -2), 'side-eye': open(41, 4.4, 2.2) + open(59, 4.4, 2.2),
    tired: open(41) + open(59) + `<path d="M36 53.5 Q41 56 46 53.5 M54 53.5 Q59 56 64 53.5" stroke="${skinD}" stroke-width="2" fill="none"/>`,
    stars: star(41) + star(59),
  }[eyes];
  // nose, cheeks
  const blushR = face === 'big blush' ? 6 : 3.6, blushO = face === 'big blush' ? 0.55 : 0.22;
  const nose = acc === 'clown nose' ? '<circle cx="50" cy="55" r="5.5" fill="#ff2d55" stroke="#a0102c" stroke-width="1"/><circle cx="48.3" cy="53.4" r="1.4" fill="#fff" opacity=".7"/>'
    : `<path d="M50 50 Q46.5 57 51 58" stroke="${skinD}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  let faceSvg = nose + `<circle cx="34" cy="57" r="${blushR}" fill="#ff6b8b" opacity="${blushO}"/><circle cx="66" cy="57" r="${blushR}" fill="#ff6b8b" opacity="${blushO}"/>`;
  if (face === 'freckles') faceSvg += [[32, 55], [35, 58], [38, 55], [62, 55], [65, 58], [68, 55]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="${darken(skin, 0.6)}"/>`).join('');
  if (face === 'scar') faceSvg += `<path d="M60 38 L66 52 M61 42 L65 41 M62 46 L66 45" stroke="#b33" stroke-width="1.6" stroke-linecap="round"/>`;
  // mouth
  const ms = `stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"`;
  const mouthSvg = {
    smile: `<path d="M42 62 Q50 69 58 62" ${ms}/>`,
    grin: `<path d="M41 61 Q50 72 59 61 Z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
    flat: `<path d="M44 64 H56" ${ms}/>`,
    open: `<ellipse cx="50" cy="64" rx="5" ry="4" fill="${INK}"/><ellipse cx="50" cy="66" rx="3" ry="1.6" fill="#ff6b8b"/>`,
    smirk: `<path d="M44 64 Q52 66 57 61" ${ms}/>`,
    tongue: `<path d="M42 62 Q50 70 58 62 Z" fill="${INK}"/><path d="M46.5 65 Q50 72 53.5 65 Z" fill="#ff6b8b"/>`,
    'buck teeth': `<path d="M42 62 Q50 67 58 62" ${ms}/><rect x="46" y="63" width="3.8" height="5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1"/><rect x="50.2" y="63" width="3.8" height="5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1"/>`,
    wobbly: `<path d="M42 64 Q44.5 61 47 64 T52 64 T57 64" ${ms}/>`,
    vampire: `<path d="M42 62 Q50 68 58 62" ${ms}/><path d="M45 63 L46.5 67.5 L48 63.8 M52 63.8 L53.5 67.5 L55 63" fill="#fff" stroke="${INK}" stroke-width="1"/>`,
    kiss: `<path d="M48 61 Q53 62.5 49 64.5 Q53 66.5 48 68" ${ms}/>`,
  }[mouth];
  let fh = '';
  if (face === 'mustache') fh = `<path d="M38 60.5 Q44 55.5 50 59 Q56 55.5 62 60.5 Q56 62.5 50 60.8 Q44 62.5 38 60.5 Z" fill="${hair}"/>`;
  if (face === 'beard') fh = `<path d="M24 50 Q26 76 50 78 Q74 76 76 50 Q72 66 60 66 Q50 70 40 66 Q28 66 24 50 Z" fill="${hair}"/>`;
  if (face === 'goatee') fh = `<path d="M45 68 Q50 76 55 68 Q50 70 45 68 Z" fill="${hair}"/><path d="M40 60.5 Q45 57.5 50 59.5 Q55 57.5 60 60.5" stroke="${hair}" stroke-width="2.4" fill="none"/>`;
  // accessories
  const accSvg = {
    none: '',
    glasses: `<g fill="rgba(180,220,255,.25)" stroke="${INK}" stroke-width="2.2"><rect x="33" y="42" width="15" height="12" rx="4"/><rect x="52" y="42" width="15" height="12" rx="4"/></g><path d="M48 47 H52 M33 46 L27 45 M67 46 L73 45" stroke="${INK}" stroke-width="2"/>`,
    shades: `<path d="M31 43 H69 L67 51 Q64 55.5 57 53 L53 47 H47 L43 53 Q36 55.5 33 51 Z" fill="${INK}"/><path d="M35 45.5 H41" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`,
    monocle: `<circle cx="59" cy="48" r="7.5" fill="rgba(200,230,255,.25)" stroke="#d4a017" stroke-width="2.2"/><path d="M66 50 Q72 62 68 74" stroke="#d4a017" stroke-width="1.4" fill="none"/>`,
    cap: `<path d="M25 37 Q25 13 50 13 Q75 13 75 37 Z" fill="${hood}"/><path d="M50 33 L87 35 Q87 40 77 40 L50 38 Z" fill="${hoodD}"/><circle cx="50" cy="14" r="2.4" fill="${hoodD}"/>`,
    beanie: `<path d="M25 36 Q25 10 50 10 Q75 10 75 36 Z" fill="${hood}"/><rect x="23" y="31" width="54" height="8" rx="4" fill="${hoodD}"/><circle cx="50" cy="8" r="5" fill="#fff"/>`,
    'hacker mask': `<path d="M25 55 Q50 52 75 55 L73 66 Q50 80 27 66 Z" fill="#16131c"/><path d="M32 60 H68 M35 65 H65" stroke="${hood}" stroke-width="1.6" opacity=".8"/>`,
    earring: '<circle cx="25" cy="57" r="2.8" fill="#ffd23f" stroke="#a07a10" stroke-width="1"/>',
    'party hat': `<path d="M36 22 L50 -2 L64 22 Z" fill="${hood}" stroke="${INK}" stroke-width="1.5"/><path d="M40 15 L60 15 M44 8 L56 8" stroke="#fff" stroke-width="2"/><circle cx="50" cy="-1" r="3.5" fill="#ffd23f"/>`,
    'clown nose': '',
    'eye patch': `<path d="M24 36 L76 44" stroke="${INK}" stroke-width="2"/><ellipse cx="59" cy="48" rx="7" ry="6.5" fill="${INK}"/>`,
    sweatband: `<rect x="25" y="29" width="50" height="7" rx="3" fill="${hood}"/><path d="M30 31 H70" stroke="#fff" stroke-width="1.2" opacity=".6"/>`,
    flower: '<g transform="translate(70 26)"><circle r="4" cx="0" cy="-5" fill="#ff6bd6"/><circle r="4" cx="5" cy="0" fill="#ff6bd6"/><circle r="4" cx="0" cy="5" fill="#ff6bd6"/><circle r="4" cx="-5" cy="0" fill="#ff6bd6"/><circle r="3" fill="#ffd23f"/></g>',
    'propeller cap': `<path d="M27 34 Q27 14 50 14 Q73 14 73 34 Z" fill="${hood}"/><path d="M27 30 Q50 25 73 30" stroke="#ffd23f" stroke-width="2" fill="none"/><path d="M50 14 V6" stroke="${INK}" stroke-width="2"/><g class="prop"><ellipse cx="42" cy="5" rx="8" ry="2.5" fill="#ff2d55"/><ellipse cx="58" cy="5" rx="8" ry="2.5" fill="#00d2ff"/></g>`,
  }[acc];
  // the GAMER HEADSET — every character wears one. The band sits ON the head/hair (it used to float above it).
  const hatTop = { cap: 13, beanie: 11, 'propeller cap': 14 }[acc];
  const T = up ? 14 : Math.min(hatTop ?? 99, { bald: 19, buzz: 18, afro: 7, curly: 11, spiky: 17, mohawk: 18, quiff: 11, undercut: 14, 'space buns': 17 }[hairS] ?? 15);
  const band = (w = 5, col = INK) => `<path d="M22 50 Q21 ${T} 50 ${T} Q79 ${T} 78 50" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const cups = (rx = 6.5, ry = 10, fill = kc, stroke = INK) => `<ellipse cx="21" cy="50" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2"/><ellipse cx="79" cy="50" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  const mic = `<path d="M19 58 Q22 70 38 67" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="39.5" cy="66.5" r="3" fill="${kc}" stroke="${INK}" stroke-width="1.4"/>`;
  const headset = {
    gaming: band() + cups() + `<rect x="17.5" y="45" width="2.5" height="10" rx="1.2" fill="${kcD}"/><rect x="80" y="45" width="2.5" height="10" rx="1.2" fill="${kcD}"/>` + mic,
    neon: band(3.2, kc) + cups(7.5, 9, '#101018', kc) + `<circle cx="21" cy="50" r="3" fill="${kc}"/><circle cx="79" cy="50" r="3" fill="${kc}"/>`,
    'cat ears': band() + `<path d="M28 21 L30 6 L40 15 Z M72 21 L70 6 L60 15 Z" fill="${kc}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M31 15 L32 10 L36 14 M69 15 L68 10 L64 14" fill="#ffb3d9"/>` + cups(6.5, 9.5) + mic,
    retro: band(2.6, '#777') + `<circle cx="21" cy="50" r="8.5" fill="#ff7a1a" stroke="${INK}" stroke-width="1.6"/><circle cx="79" cy="50" r="8.5" fill="#ff7a1a" stroke="${INK}" stroke-width="1.6"/>`,
    'pro RGB': band(6.5) + `<path d="M24 36 Q26 ${T + 3} 50 ${T + 3} Q74 ${T + 3} 76 36" fill="none" stroke="${kc}" stroke-width="2" class="rgb"/>` + cups(8, 12, '#16131c') + `<ellipse cx="21" cy="50" rx="4" ry="7" fill="none" stroke="${kc}" stroke-width="2" class="rgb"/><ellipse cx="79" cy="50" rx="4" ry="7" fill="none" stroke="${kc}" stroke-width="2" class="rgb"/>` + mic,
    'wired earbuds': `<path d="M24 53 Q22 68 34 76 Q42 82 50 86 M76 53 Q78 68 66 76 Q58 82 50 86 L50 98" fill="none" stroke="#f4f4f4" stroke-width="1.8" stroke-linecap="round"/><rect x="47.5" y="84" width="5" height="7" rx="1.5" fill="${kc}" stroke="${INK}" stroke-width="1"/>
      <ellipse cx="24.5" cy="50" rx="4.2" ry="5" fill="#f4f4f4" stroke="${INK}" stroke-width="1.4"/><ellipse cx="75.5" cy="50" rx="4.2" ry="5" fill="#f4f4f4" stroke="${INK}" stroke-width="1.4"/><circle cx="24.5" cy="50" r="1.6" fill="${kc}"/><circle cx="75.5" cy="50" r="1.6" fill="${kc}"/>`,
    'bunny ears': band() + `<ellipse cx="36" cy="-2" rx="5.5" ry="15" fill="${kc}" stroke="${INK}" stroke-width="1.8" transform="rotate(-12 36 10)"/><ellipse cx="64" cy="-2" rx="5.5" ry="15" fill="${kc}" stroke="${INK}" stroke-width="1.8" transform="rotate(12 64 10)"/>` + cups(6.5, 9.5) + mic,
    'devil horns': band() + `<path d="M30 18 Q24 6 28 -2 Q34 8 38 13 Z M70 18 Q76 6 72 -2 Q66 8 62 13 Z" fill="#ff2d55" stroke="${INK}" stroke-width="1.6"/>` + cups(6.5, 10, kc) + mic,
  }[set];
  const hideHair = ['cap', 'beanie', 'propeller cap'].includes(acc) && !['long', 'afro', 'pigtails'].includes(hairS);
  const mouthPart = acc === 'hacker mask' ? '' : mouthSvg;
  // hood UP: the hood frames the face and covers the hair (only a fringe peeks out)
  // the rim is a ring around the face: hugs the head like a real hoodie, with a seam on top and a soft shadow inside
  const hoodFront = up ? `<path fill-rule="evenodd" d="${HOOD_OUT} ${HOOD_OPEN}" fill="${hood}"/>`
    + `<path d="${HOOD_OPEN}" fill="none" stroke="${hoodD}" stroke-width="2.6"/>`
    + `<path d="M50 11 V19" stroke="${hoodD}" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`
    + `<path d="M22 31 Q28 17 41 13.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".18"/>` : '';
  // hood UP: long hair falls OUT of the hood, over the hoodie
  const fall = !up ? '' : {
    long: [1, -1].map((d) => { const x = (v) => 50 - d * (50 - v); return `<path d="M${x(27)} 48 Q${x(23)} 70 ${x(26)} 93 L${x(31)} 89 L${x(34)} 93 Q${x(32)} 72 ${x(33.5)} 58 Z" fill="${hair}"/>`; }).join(''),
    braids: [31, 69].map((x) => [62, 69, 76, 83].map((y, i) => `<ellipse cx="${x + (x < 50 ? -1 : 1) * (i % 2)}" cy="${y}" rx="${4.4 - i * 0.25}" ry="4.2" fill="${hair}" stroke="rgba(255,255,255,.28)" stroke-width="1.1"/>`).join('') + `<path d="M${x - 3} 87.5 h6" stroke="#ff4d4d" stroke-width="2.4" stroke-linecap="round"/>`).join(''),
    locs: [[28, 50, 26, 88], [32, 58, 31, 92], [72, 50, 74, 88], [68, 58, 69, 92]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + (x1 < 50 ? -2 : 2)} ${(y1 + y2) / 2} ${x2} ${y2}" stroke="${hair}" stroke-width="5" stroke-linecap="round" fill="none"/>`).join(''),
    'wolf cut': `<path d="M27 48 L25 72 L29 67 L31 76 L34 68 L33 56 Z M73 48 L75 72 L71 67 L69 76 L66 68 L67 56 Z" fill="${hair}"/>`,
  }[hairS] || '';
  const hairTop = hideHair ? '' : up ? `<g clip-path="url(#av-hood-clip)">${top}</g>` : top;
  s += hairTop + hoodFront + fall + faceSvg + fh + brow + eyeSvg + mouthPart + accSvg + headset;
  return `<svg class="av ${extra}" style="--av:${kc}" width="${size}" height="${size}" viewBox="0 -8 100 108" aria-hidden="true">${s}</svg>`;
}
