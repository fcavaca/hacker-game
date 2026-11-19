// MINI-GAMES.
// Solo game: run(root, done) -> cleanup function. done(true) = win, done(false) = fail,
//            done('skip') = this phone can't do it (no mic / camera).
// Duel game: run(root, rand, done) -> cleanup. rand() is shared so both players get the SAME challenge.
//            Call done(score).

import { avatarSVG, randomAvatar } from './avatar.js?v=21';

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = Math.random;
const pick = (a, r = rnd) => a[Math.floor(r() * a.length)];
const shuffle = (a, r = rnd) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r) => r.querySelector(s);

export const WIN_LINES = ['Absolute legend. 🔥', 'Hacked the planet. 🌍', 'Too easy. Next!', 'Your keyboard is smoking. 💨', 'GG EZ.', 'The network thanks you. 🫡', 'Certified 10x gamer.', 'Speedrun strats. ⚡'];
export const FAIL_LINES = ['Skill issue. 💀', 'The bugs won this time. 🐛', 'Even your grandma does it faster…', 'Error 418: I\'m a teapot.', 'Rage quit loading…', 'Ctrl+Z won\'t save you now.'];

function timers() {
  const ids = [];
  return {
    every(f, ms) { const id = setInterval(f, ms); ids.push(id); return id; },
    after(f, ms) { const id = setTimeout(f, ms); ids.push(id); return id; },
    clear() { ids.forEach((i) => { clearInterval(i); clearTimeout(i); }); },
  };
}

// Shrinking time bar at the top of a game. Returns a stop function.
function timeBar(root, sec, onEnd) {
  const bar = document.createElement('div');
  bar.className = 'tbar';
  bar.innerHTML = '<div></div><span></span>';
  root.prepend(bar);
  const start = Date.now();
  const iv = setInterval(() => {
    const left = sec * 1000 - (Date.now() - start);
    bar.firstChild.style.width = Math.max(0, left / (sec * 1000) * 100) + '%';
    bar.lastChild.textContent = Math.max(0, Math.ceil(left / 1000)) + 's';
    bar.classList.toggle('low', left < 10000);
    if (left <= 0) { clearInterval(iv); onEnd(); }
  }, 100);
  return () => clearInterval(iv);
}

function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

function keypad(onKey) {
  const k = document.createElement('div');
  k.className = 'keypad';
  for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']) {
    const b = document.createElement('button');
    b.className = 'key' + (key === 'ok' ? ' ok' : key === 'del' ? ' del' : '');
    b.textContent = key === 'del' ? '⌫' : key === 'ok' ? 'ENTER' : key;
    b.onclick = () => onKey(key);
    k.appendChild(b);
  }
  return k;
}

// Code-breaking: "Password Crack" (solo) and "Code Race" (duel).
function mastermind(root, { digits, code, maxTries, onWin, onLose }) {
  let cur = '', tries = 0;
  root.insertAdjacentHTML('beforeend', `<p class="hint">Digits never repeat. <b class="g">■</b> right spot · <b class="y">■</b> wrong spot · <b class="d">■</b> not in the code · ${maxTries} tries</p><div class="mm-cur"></div><div class="mm-hist"></div>`);
  const hist = $('.mm-hist', root), curEl = $('.mm-cur', root);
  const show = () => { curEl.innerHTML = Array.from({ length: digits }, (_, i) => `<span>${cur[i] ?? ''}</span>`).join(''); };
  root.appendChild(keypad((k) => {
    if (k === 'del') cur = cur.slice(0, -1);
    else if (k === 'ok') {
      if (cur.length !== digits) return shake(curEl);
      tries++;
      const cells = cur.split('').map((c, i) => `<span class="${c === code[i] ? 'g' : code.includes(c) ? 'y' : 'd'}">${c}</span>`).join('');
      hist.insertAdjacentHTML('afterbegin', `<div class="mm-row">${cells}<small>${tries}/${maxTries}</small></div>`);
      if (cur === code) return onWin();
      if (tries >= maxTries) return onLose();
      cur = '';
    } else if (cur.length < digits) cur += k;
    show();
  }));
  show();
}

// "Simon" memory: "Glitch Memory" (solo) and "Memory Race" (duel).
function simon(root, r, { target, onWin, onFail }) {
  const seq = [];
  let pos = 0, accepting = false, dead = false;
  root.insertAdjacentHTML('beforeend', `<p class="hint sm-status">Watch the pattern…</p><div class="simon">${[0, 1, 2, 3].map((i) => `<button class="sbtn s${i}" data-i="${i}"></button>`).join('')}</div><p class="hint sm-level"></p>`);
  const btns = [...root.querySelectorAll('.sbtn')], status = $('.sm-status', root), lvl = $('.sm-level', root);
  const light = async (i, ms) => { btns[i].classList.add('lit'); await wait(ms); btns[i].classList.remove('lit'); };
  async function round() {
    if (dead) return;
    if (target && seq.length >= target) return onWin(seq.length);
    seq.push(Math.floor(r() * 4));
    pos = 0; accepting = false;
    status.textContent = 'WATCH';
    lvl.textContent = `Level ${seq.length}${target ? ' / ' + target : ''}`;
    await wait(650);
    const speed = Math.max(220, 430 - seq.length * 20);
    for (const s of seq) { if (dead) return; await light(s, speed); await wait(150); }
    if (dead) return;
    status.textContent = 'YOUR TURN';
    accepting = true;
  }
  btns.forEach((b) => b.onclick = () => {
    if (!accepting) return;
    const i = +b.dataset.i;
    light(i, 140);
    if (i !== seq[pos]) { accepting = false; return onFail(seq.length - 1); }
    pos++;
    if (pos === seq.length) { accepting = false; status.textContent = 'NICE'; setTimeout(round, 450); }
  });
  round();
  return { stop: () => { dead = true; }, level: () => Math.max(0, seq.length - 1) };
}

function hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

// Random "alien" symbol drawn on a 3×3 dot grid.
function glyph(r) {
  const pts = [[4, 4], [12, 4], [20, 4], [4, 12], [12, 12], [20, 12], [4, 20], [12, 20], [20, 20]];
  let cur = Math.floor(r() * 9), d = `M${pts[cur]}`;
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { let nx; do { nx = Math.floor(r() * 9); } while (nx === cur); d += ` L${pts[nx]}`; cur = nx; }
  const dot = r() < 0.5 ? `<circle cx="${pts[cur][0]}" cy="${pts[cur][1]}" r="2.2" fill="currentColor"/>` : '';
  return { key: d + dot, svg: `<svg viewBox="0 0 24 24" class="glyph"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>${dot}</svg>` };
}

// Phone keyboards turn "--" into "—", quotes into curly quotes and add capitals: ignore all that.
const normalize = (s) => s.replace(/[—–]/g, '--').replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

const WORDS = ['FIREWALL', 'MALWARE', 'ROUTER', 'PACKET', 'SERVER', 'BACKDOOR', 'PASSWORD', 'NETWORK', 'KERNEL',
  'BUFFER', 'TROJAN', 'PHISHING', 'BOTNET', 'EXPLOIT', 'CIPHER', 'PROXY', 'DATABASE', 'SPYWARE', 'RAGEQUIT', 'KEYBOARD', 'WEBCAM', 'GLITCH'];
// Odd One Out: twin emojis (rounds 1–2) and one sneaky flipped/rotated emoji (rounds 3–4)
const ODD_TWINS = [['😂', '🤣', 'One of them is laughing WAY too hard'], ['🙂', '🙃', 'Someone is upside down. Who?'], ['😐', '😑', 'One of them is SO done with this'],
  ['😺', '😸', 'One cat has more rizz'], ['🌚', '🌝', 'One moon is judging you'], ['🥺', '🥹', 'One is about to cry'], ['🙈', '🙊', 'One monkey said something it shouldn\'t'],
  ['🤫', '🤭', 'Someone is spilling the tea'], ['💀', '☠️', 'One skeleton goes to the gym'], ['😴', '😪', 'One of them is fake sleeping']];
const ODD_TRICKS = [['🦆', 'scaleX(-1)', 'One duck is walking the wrong way'], ['🗿', 'rotate(180deg)', 'One 🗿 is doing a handstand'], ['🐈', 'scaleX(-1)', 'One cat is facing the other way'],
  ['🍌', 'rotate(90deg)', 'One banana is lying down'], ['🦖', 'scaleX(-1)', 'One dino is running away'], ['🤡', 'rotate(14deg)', 'One clown is slightly tilted. Clown behaviour.'],
  ['🚶', 'scaleX(-1)', 'One NPC is walking home early'], ['🐸', 'scale(1.25)', 'One frog skipped leg day… no, it\'s just bigger']];

// Brainrot Translator: [word, right meaning, fake, fake]
const BRAINROT = [['no cap', 'for real, not lying', 'wearing no hat', 'out of phone battery'], ['rizz', 'charm, flirting skills', 'a type of pasta', 'a skin rash'],
  ['delulu', 'delusional (in a fun way)', 'a dance from 2009', 'a Danish pastry'], ['fanum tax', 'stealing a bite of your friend\'s food', 'a real tax in Ohio', 'a gym fee'],
  ['mid', 'just average, nothing special', 'the middle seat', 'a midnight snack'], ['cooked', 'in big trouble, it\'s over', 'ready to eat', 'very good at cooking'],
  ['glazing', 'hyping someone up WAY too much', 'putting icing on donuts', 'cleaning windows'], ['yapping', 'talking non-stop', 'a small dog', 'yawning loudly'],
  ['mogged', 'outshined by someone better looking', 'got a new mug', 'covered in fog'], ['aura', 'your vibe / coolness points', 'a pet name', 'a type of wifi'],
  ['it\'s giving…', 'it has the vibe of…', 'handing out gifts', 'giving up'], ['bet', 'okay, deal', 'gambling money', 'a type of bed'],
  ['ate', 'did it perfectly', 'had lunch', 'the number 8 in Danish'], ['touch grass', 'go outside, you\'re online too much', 'a gardening job', 'a new dance'],
  ['rent free', 'you can\'t stop thinking about it', 'a cheap flat', 'no wifi bill'], ['lowkey', 'secretly / a little bit', 'a quiet piano key', 'a short person'],
  ['Ohio', 'weird, cursed, chaotic', 'a fancy restaurant', 'an exam grade'], ['skibidi', 'nobody knows 💀', 'a Polish soup', 'a ski brand'],
  ['NPC', 'someone acting like a background character', 'a new phone case', 'a school subject'], ['sus', 'suspicious', 'super useful', 'a sushi place'],
  ['main character', 'acting like the star of the movie', 'the tallest person', 'first in line'], ['the ick', 'something that instantly turns you off', 'a small insect', 'a sneeze']];

// Delulu Detector: [message, true = delulu]
const DELULU = [['"She liked my story, so she\'s in love with me."', true], ['"My crush looked in my direction. We\'re basically dating."', true],
  ['"I\'ll become a millionaire from one TikTok."', true], ['"The teacher will forget about the exam."', true], ['"I\'ll write my whole thesis tonight."', true],
  ['"Pineapple pizza is healthy because fruit."', true], ['"I\'m not addicted to my phone." (screen time: 11 h)', true], ['"He said \'k\'. He\'s obsessed with me."', true],
  ['"I\'ll start the gym on Monday." (it\'s the 9th Monday)', true], ['"I don\'t need sleep, I have energy drinks."', true],
  ['"My phone is on 3%. I should charge it."', false], ['"I studied 0 hours. I might fail."', false], ['"I was late, so the bus left without me."', false],
  ['"Mom said dinner is ready, so dinner is ready."', false], ['"He replied after 4 days. Maybe he\'s not that into me."', false],
  ['"If I spend all my money now, I\'ll be broke."', false], ['"I have class at 8, so maybe sleep before 3."', false], ['"I ate a whole pizza. I\'m full."', false]];

// Cap or No Cap: [fact, true = real]
const FACTS = [['Octopuses have 3 hearts.', true], ['Bananas are berries, but strawberries are not.', true], ['A day on Venus is longer than its year.', true],
  ['Honey never goes bad.', true], ['Sharks are older than trees.', true], ['Wombat poop is cube-shaped.', true], ['Cows have best friends.', true],
  ['The Eiffel Tower grows taller in summer.', true], ['Denmark has more pigs than people.', true], ['Scotland\'s national animal is the unicorn.', true],
  ['Goldfish only remember things for 3 seconds.', false], ['You swallow 8 spiders a year in your sleep.', false], ['The Great Wall of China is visible from space.', false],
  ['Bulls get angry at the colour red.', false], ['Lightning never strikes the same place twice.', false], ['Humans only use 10% of their brain.', false],
  ['Bats are blind.', false], ['Cracking your knuckles gives you arthritis.', false], ['Chameleons change colour to match the background.', false]];

// Group Chat Chaos: [sender, message, true = it's really Mom]
const CHAT = [['Mom', 'where are you??', true], ['Mom', 'call me', true], ['Mom', 'did you eat?', true], ['Mom', 'who is "Bro 🔥" in your contacts', true], ['Mom', '👍', true],
  ['Mom', 'buy milk pls', true], ['Mom', 'are you wearing a jacket', true], ['Bro', '💀💀💀', false], ['Group chat', 'who took my yoghurt', false], ['Meme Lord', '📷 [cursed image]', false],
  ['Ex', 'hey', false], ['Unknown', 'You won a free iPhone 🎉', false], ['Teacher', 'deadline is TOMORROW', false], ['Bestie', 'OMG CALL ME', false],
  ['Mom (new number)', 'send me your password', false], ['M0m', 'did u eat?', false], ['Dad', 'Mom says text her', false], ['Mommy Long Legs', 'come play 🕷️', false]];

// Sigma Grindset routine steps
const SIGMA = ['⏰ Wake up at 4:00', '🧊 Ice bath', '🥚 Drink raw eggs', '📓 Journal your goals', '💪 1000 push-ups', '🚫 Ignore the group chat', '🕶️ Sunglasses indoors',
  '🏃 Run 10 km', '📈 Check crypto', '🧱 Stare at a wall for 20 min', '🥩 Steak for breakfast', '📵 Delete TikTok (again)'];

// Aura Duel: real-life challenges, a third player judges
const AURA_CHALLENGES = ['Walk past the judge like the main character of a movie.', 'Do your most dramatic slow-motion turn.', 'Do your best villain laugh.',
  'Pose like you just won the World Cup.', 'Say "it is what it is" with MAXIMUM aura.', 'Runway walk to the nearest door and back.',
  'Give the judge your most mysterious stare for 5 seconds.', 'Explain in 10 seconds why you are HIM / HER.', 'Enter the room like you own the building.',
  'Do the most confident handshake of your life with the judge.'];
const CIPHER_WORDS = ['HACKER', 'NOOB', 'PING', 'LOBBY', 'GLITCH', 'VIRUS', 'PATCH', 'ADMIN', 'LOGIN', 'WIFI', 'AFK', 'LAGGING', 'TOUCHGRASS', 'SUS', 'GGWP'];
const COLOURS = [
  { n: 'RED', c: '#ff3b5c', test: (h, s, v) => s > 0.4 && v > 0.25 && (h < 18 || h > 335) },
  { n: 'BLUE', c: '#3b8bff', test: (h, s, v) => s > 0.35 && v > 0.2 && h > 195 && h < 255 },
  { n: 'GREEN', c: '#2ee88f', test: (h, s, v) => s > 0.3 && v > 0.2 && h > 85 && h < 165 },
  { n: 'YELLOW', c: '#ffd400', test: (h, s, v) => s > 0.4 && v > 0.4 && h > 42 && h < 70 },
];

// ---------- shared helpers for the v0.9 games ----------
// iPhones ask permission for the motion sensors; it must be asked right after a tap (the GO button)
function requestMotion(cb) {
  try {
    const D = window.DeviceMotionEvent, O = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      D.requestPermission().then((r) => { if (r === 'granted') cb(); }).catch(() => {});
      if (O && typeof O.requestPermission === 'function') O.requestPermission().catch(() => {});
    } else cb();
  } catch { /* no sensors */ }
}
const myAv = () => { try { return JSON.parse(localStorage.getItem('av')) || randomAvatar(); } catch { return randomAvatar(); } };

// Make 67: an equation with blanks (r = random function, so duels can share the same one)
function make67(r, hard) {
  const R = (a, n) => a + Math.floor(r() * n);
  const T = [
    () => { const a = R(2, 8), b = R(2, Math.max(1, Math.min(8, Math.floor(60 / a) - 1))); return { ops: ['×', '+'], nums: [a, b, 67 - a * b] }; },
    () => { const a = R(6, 4), b = R(8, 3); return { ops: ['×', '−'], nums: [a, b, a * b - 67] }; },
    () => { const a = R(10, 30), b = R(5, 20); return { ops: ['+', '+'], nums: [a, b, 67 - a - b] }; },
    () => { const a = R(3, 6), b = R(3, 6), c = R(2, 9); const d = a * b + c - 67; return d > 0 ? { ops: ['×', '+', '−'], nums: [a, b, c, d] } : { ops: ['×', '+', '+'], nums: [a, b, c, -d] }; },
  ];
  let q; do { q = pick(hard ? T : T.slice(0, 3), r)(); } while (q.nums.some((n) => n <= 0 || n > 60));
  q.tiles = shuffle([...q.nums, ...Array.from({ length: 3 }, () => R(1, 30))], r);
  return q;
}
function calc67(nums, ops) { // × first, then + and − from left to right
  const v = [nums[0]], o = [];
  ops.forEach((op, i) => { if (op === '×') v[v.length - 1] *= nums[i + 1]; else { o.push(op); v.push(nums[i + 1]); } });
  return o.reduce((s, op, i) => op === '+' ? s + v[i + 1] : s - v[i + 1], v[0]);
}
// one equation on screen; calls onSolved() when the blanks make 67
function eq67(root, q, onSolved) {
  let filled = [], used = [];
  const box = document.createElement('div');
  box.innerHTML = '<div class="eq"></div><div class="tiles six-tiles"></div><div class="dec-btns"><button class="btn small ghost back">⌫ Back</button></div>';
  root.appendChild(box);
  const eq = $('.eq', box), tw = $('.six-tiles', box);
  function draw() {
    eq.innerHTML = q.nums.map((_, i) => `<span class="blank ${filled[i] != null ? 'f' : ''}">${filled[i] ?? '?'}</span>${q.ops[i] ? `<b>${q.ops[i]}</b>` : ''}`).join('') + '<b>=</b><span class="six-target">67</span>';
    tw.innerHTML = '';
    q.tiles.forEach((n, i) => {
      const b = document.createElement('button'); b.className = 'tile'; b.textContent = n; b.disabled = used.includes(i);
      b.onclick = () => {
        filled.push(n); used.push(i);
        if (filled.length === q.nums.length) {
          if (calc67(filled, q.ops) === 67) { box.remove(); return onSolved(); }
          shake(eq); filled = []; used = [];
        }
        draw();
      };
      tw.appendChild(b);
    });
  }
  $('.back', box).onclick = () => { filled.pop(); used.pop(); draw(); };
  draw();
}

// Tung Tung: the angry log chases you. Used by the solo game and the duel. onEnd(msSurvived, survivedAll)
const TUNG_SVG = '<svg viewBox="0 0 60 90"><rect x="14" y="10" width="32" height="74" rx="14" fill="#a8743f" stroke="#5b3a1a" stroke-width="3"/><path d="M18 30h24M18 58h24" stroke="#7a4e25" stroke-width="2"/><path d="M19 25l9 4M41 25l-9 4" stroke="#1a0f05" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="33" r="3.4" fill="#fff"/><circle cx="36" cy="33" r="3.4" fill="#fff"/><circle cx="24.6" cy="33.6" r="1.7"/><circle cx="35.4" cy="33.6" r="1.7"/><path d="M23 46q7-5 14 0" stroke="#1a0f05" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M46 44l9-14" stroke="#a8743f" stroke-width="5" stroke-linecap="round"/><rect x="50" y="2" width="8" height="30" rx="4" fill="#d9a066" stroke="#5b3a1a" stroke-width="2" transform="rotate(25 54 17)"/></svg>';
function tungRun(root, { r = rnd, lives = 3, secs = 25, text, onEnd }) {
  root.insertAdjacentHTML('beforeend', `<p class="hint">${text}</p><div class="arena tung-ar"><div class="tung-me"></div><div class="tung">${TUNG_SVG}</div><div class="tung-warn hidden">TUNG TUNG TUNG</div></div><div class="scorebar"><span class="sr"></span><span class="sg">run!</span></div>`);
  const ar = $('.tung-ar', root), meEl = $('.tung-me', root), tung = $('.tung', root), warn = $('.tung-warn', root), sr = $('.sr', root);
  meEl.innerHTML = avatarSVG(myAv(), 46);
  const hearts = () => { sr.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, maxL - lives)); };
  const maxL = lives; hearts();
  let W = ar.clientWidth || 300, H = ar.clientHeight || 300;
  const me = { x: W * 0.5, y: H * 0.75 }, aim = { ...me }, tg = { x: W * 0.5, y: 30 };
  const start = performance.now();
  let safeUntil = 0, dashAt = start + 3500, dashing = 0, warned = false, dead = false, raf, last = start;
  const move = (e) => { const b = ar.getBoundingClientRect(); aim.x = Math.max(20, Math.min(W - 20, e.clientX - b.left)); aim.y = Math.max(20, Math.min(H - 20, e.clientY - b.top)); e.preventDefault(); };
  ar.addEventListener('pointerdown', move); ar.addEventListener('pointermove', move);
  const finish = (all) => { if (dead) return; dead = true; cancelAnimationFrame(raf); stopBar(); onEnd(Math.round(performance.now() - start), all); };
  const loop = (t) => {
    if (dead) return;
    W = ar.clientWidth || W; H = ar.clientHeight || H;
    const dt = Math.min(50, t - last) / 16; last = t;
    me.x += (aim.x - me.x) * 0.25 * dt; me.y += (aim.y - me.y) * 0.25 * dt;
    if (!warned && t > dashAt - 900) { warned = true; warn.classList.remove('hidden'); shake(ar); }
    if (t > dashAt) { dashing = t + 650; dashAt = t + 2600 + r() * 2200; warned = false; setTimeout(() => warn.classList.add('hidden'), 400); }
    const sp = (1.1 + (t - start) / 9000) * (t < dashing ? 3.4 : 1);
    const dx = me.x - tg.x, dy = me.y - tg.y, d = Math.hypot(dx, dy) || 1;
    tg.x += dx / d * sp * dt; tg.y += dy / d * sp * dt;
    meEl.style.transform = `translate(${me.x - 23}px, ${me.y - 23}px)`;
    tung.style.transform = `translate(${tg.x - 22}px, ${tg.y - 33}px) rotate(${Math.sin(t / 90) * 10}deg)`;
    meEl.classList.toggle('blink', t < safeUntil);
    if (d < 34 && t > safeUntil) {
      lives--; safeUntil = t + 1300; shake(ar); hearts();
      $('.sg', root).textContent = 'BONK! 💥';
      tg.x = me.x > W / 2 ? 30 : W - 30; tg.y = me.y > H / 2 ? 30 : H - 30; // knocked back to a corner
      if (lives <= 0) return finish(false);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const stopBar = timeBar(root, secs, () => finish(true));
  return () => { dead = true; cancelAnimationFrame(raf); stopBar(); };
}

// Brainrot question block (used by the solo game and the duel race). onAnswer(correct)
function slangQuestion(root, item, r, onAnswer) {
  const [word, right, ...fake] = item;
  const opts = shuffle([right, ...fake], r);
  root.innerHTML = `<div class="br-word"><small>bro said</small>"${esc(word)}"</div><p class="hint center">What does it mean?</p><div class="br-opts">${opts.map((o) => `<button class="btn br-opt">${esc(o)}</button>`).join('')}</div>`;
  root.querySelectorAll('.br-opt').forEach((b) => b.onclick = () => {
    const ok = b.textContent === right;
    b.classList.add(ok ? 'right' : 'wrong');
    if (!ok) root.querySelectorAll('.br-opt').forEach((x) => { if (x.textContent === right) x.classList.add('right'); });
    root.querySelectorAll('.br-opt').forEach((x) => { x.disabled = true; });
    setTimeout(() => onAnswer(ok), ok ? 450 : 900);
  });
}

// shake strength from the motion sensor; onJolt(strength) ~60 times per second while moving
function shakeSensor(onJolt) {
  let last = null, got = false;
  const h = (e) => {
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a || a.x == null) return;
    got = true;
    if (last) onJolt(Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z));
    last = { x: a.x, y: a.y, z: a.z };
  };
  requestMotion(() => window.addEventListener('devicemotion', h));
  return { stop: () => window.removeEventListener('devicemotion', h), got: () => got };
}

// ======================= SOLO GAMES =======================
export const SOLO = {
  password: {
    name: 'Password Crack', ic: 'lock', tag: 'Crack the 4-digit code',
    run(root, done) {
      const code = shuffle('0123456789'.split('')).slice(0, 4).join('');
      mastermind(root, { digits: 4, code, maxTries: 8, onWin: () => done(true), onLose: () => done(false) });
      return timeBar(root, 100, () => done(false));
    },
  },

  decrypt: {
    name: 'Decrypt', ic: 'type', tag: 'Unscramble 2 hacker words',
    run(root, done) {
      let solved = 0;
      root.insertAdjacentHTML('beforeend', '<p class="hint">Word <b class="wn">1</b> of 2 — tap the letters in the right order.</p><div class="answer"></div><div class="tiles"></div><div class="dec-btns"><button class="btn small ghost back">⌫ Back</button><button class="btn small ghost clr">Clear</button></div>');
      const ans = $('.answer', root), tiles = $('.tiles', root);
      let w, letters, typed, used, order;
      function newWord() {
        w = pick(WORDS);
        letters = shuffle(w.split(''));
        while (letters.join('') === w) letters = shuffle(w.split(''));
        typed = ''; used = new Set(); order = []; draw();
      }
      // backspace: give back the last letter you tapped
      $('.back', root).onclick = () => { if (!order.length) return; used.delete(order.pop()); typed = typed.slice(0, -1); draw(); };
      function draw() {
        ans.innerHTML = w.split('').map((_, i) => `<span>${typed[i] ?? ''}</span>`).join('');
        tiles.innerHTML = '';
        letters.forEach((c, i) => {
          const b = document.createElement('button');
          b.className = 'tile'; b.textContent = c; b.disabled = used.has(i);
          b.onclick = () => {
            used.add(i); order.push(i); typed += c;
            if (typed.length === w.length) {
              if (typed === w) { solved++; if (solved >= 2) return done(true); $('.wn', root).textContent = 2; pop(ans); return newWord(); }
              typed = ''; used.clear(); order = []; shake(ans);
            }
            draw();
          };
          tiles.appendChild(b);
        });
      }
      $('.clr', root).onclick = () => { typed = ''; used.clear(); order = []; draw(); };
      newWord();
      return timeBar(root, 80, () => done(false));
    },
  },

  memory: {
    name: 'Glitch Memory', ic: 'cpu', tag: 'Repeat the pattern to level 6',
    run(root, done) {
      const s = simon(root, rnd, { target: 6, onWin: () => done(true), onFail: () => done(false) });
      const stop = timeBar(root, 90, () => done(false));
      return () => { s.stop(); stop(); };
    },
  },

  packets: {
    name: 'Packet Catcher', ic: 'package', tag: 'Catch green, dodge red',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Catch <b class="g">20</b> green packets. Gold = +3. Touch <b class="r">red</b> 3 times and you\'re out.</p><div class="arena"></div><div class="scorebar"><span class="sg">0/20</span><span class="sr">♥♥♥</span></div>');
      const ar = $('.arena', root);
      let got = 0, bad = 0; const T = timers();
      const upd = () => { $('.sg', root).textContent = `${Math.min(got, 20)}/20`; $('.sr', root).textContent = '♥'.repeat(3 - bad) + '♡'.repeat(bad); };
      T.every(() => {
        const roll = rnd();
        const kind = roll < 0.07 ? 'gold' : roll < 0.68 ? 'good' : 'bad';
        const p = document.createElement('button');
        p.className = 'packet ' + kind;
        p.style.left = (rnd() * 82) + '%'; p.style.top = (rnd() * 78) + '%';
        p.onpointerdown = () => {
          p.classList.add('hit'); setTimeout(() => p.remove(), 150);
          if (kind === 'bad') { bad++; shake(ar); if (bad >= 3) return done(false); }
          else { got += kind === 'gold' ? 3 : 1; if (got >= 20) return done(true); }
          upd();
        };
        ar.appendChild(p);
        setTimeout(() => p.remove(), 1150);
      }, 480);
      const stop = timeBar(root, 45, () => done(false));
      return () => { T.clear(); stop(); };
    },
  },

  oddone: {
    name: 'Odd One Out', ic: 'eye', tag: 'One of them is SUS',
    run(root, done) {
      let round = 0, miss = 0;
      root.insertAdjacentHTML('beforeend', '<p class="odd-q"></p><p class="hint center">Round <b class="rn">1</b>/4 · 3 mistakes max</p><div class="gridx odd-grid"></div>');
      const g = $('.gridx', root), q = $('.odd-q', root);
      const twins = shuffle(ODD_TWINS), tricks = shuffle(ODD_TRICKS);
      function draw() {
        const size = [5, 6, 6, 7][round];
        // rounds 1–2: a near-twin emoji · rounds 3–4: the SAME emoji, but one is flipped, turned or bigger
        const trick = round >= 2;
        const [a, b, line] = trick ? tricks[round] : twins[round];
        q.textContent = `🔎 ${line}`;
        const odd = Math.floor(rnd() * size * size);
        g.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        g.innerHTML = '';
        for (let i = 0; i < size * size; i++) {
          const c = document.createElement('button');
          c.className = 'cell';
          c.innerHTML = `<span${i === odd && trick ? ` style="display:inline-block;transform:${b}"` : ''}>${i === odd && !trick ? b : a}</span>`;
          c.onclick = () => {
            if (i === odd) { round++; if (round >= 4) return done(true); $('.rn', root).textContent = round + 1; draw(); }
            else { c.classList.add('wrong'); miss++; if (miss >= 3) done(false); }
          };
          g.appendChild(c);
        }
      }
      draw();
      return timeBar(root, 60, () => done(false));
    },
  },

  binary: {
    name: 'Binary Switch', ic: 'binary', tag: 'Flip bits to hit the number',
    run(root, done) {
      let round = 0, target = 0, bits = [];
      const vals = [32, 16, 8, 4, 2, 1];
      root.insertAdjacentHTML('beforeend', '<p class="hint">Turn switches ON so their values add up to the target. Round <b class="rn">1</b>/4</p><div class="target"><small>TARGET</small><b></b></div><div class="bits"></div><div class="cur-sum">= 0</div><button class="btn ok-btn">Check</button>');
      const tg = $('.target b', root), bw = $('.bits', root), sum = $('.cur-sum', root);
      const total = () => bits.reduce((s, b, i) => s + b * vals[i], 0);
      function draw() {
        target = (round < 2 ? 3 : 20) + Math.floor(rnd() * (round < 2 ? 28 : 43)); bits = [0, 0, 0, 0, 0, 0];
        tg.textContent = target; bw.innerHTML = ''; sum.textContent = '= 0';
        vals.forEach((v, i) => {
          const b = document.createElement('button');
          b.className = 'bit'; b.innerHTML = `<small>${v}</small><span>0</span>`;
          b.onclick = () => { bits[i] ^= 1; b.classList.toggle('on', !!bits[i]); $('span', b).textContent = bits[i]; sum.textContent = `= ${total()}`; };
          bw.appendChild(b);
        });
      }
      $('.ok-btn', root).onclick = () => {
        if (total() === target) { round++; if (round >= 4) return done(true); $('.rn', root).textContent = round + 1; pop(tg); draw(); }
        else shake(tg);
      };
      draw();
      return timeBar(root, 80, () => done(false));
    },
  },

  cipher: {
    name: 'Alien Cipher', ic: 'hexagon', tag: 'Decode the alien message',
    run(root, done) {
      // harder version: a 2-word message, and every real symbol has an evil MIRRORED twin in the key
      let w1, w2; do { w1 = pick(CIPHER_WORDS); w2 = pick(CIPHER_WORDS); } while (w1 === w2 || w1.length + w2.length > 13);
      const msgTxt = w1 + ' ' + w2;
      const letters = [...new Set((w1 + w2).split(''))];
      const free = shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((c) => !letters.includes(c)));
      const map = {}, seen = new Set();
      const mirror = (svg) => svg.replace('<path', '<g transform="translate(24 0) scale(-1 1)"><path').replace('</svg>', '</g></svg>');
      for (const c of letters) {
        let g; do { g = glyph(rnd); } while (seen.has(g.key)); seen.add(g.key); map[c] = g.svg;
        const twin = free.pop(); if (twin) map[twin] = mirror(g.svg); // looks almost the same… but it isn't
      }
      while (Object.keys(map).length < Math.min(20, letters.length * 2 + 3) && free.length) { let g; do { g = glyph(rnd); } while (seen.has(g.key)); seen.add(g.key); map[free.pop()] = g.svg; }
      const legend = shuffle(Object.keys(map));
      root.insertAdjacentHTML('beforeend', `<p class="hint">An alien sent a 2-word message. Decode it with the key. ⚠️ Careful: some symbols are <b>mirrored twins</b>!</p><div class="cipher"><span class="ci-w"><small>1</small>${w1.split('').map((c) => map[c]).join('')}</span><span class="ci-w"><small>2</small>${w2.split('').map((c) => map[c]).join('')}</span></div><div class="legend">${legend.map((c) => `<span>${map[c]}<b>${c}</b></span>`).join('')}</div><input class="inp" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Type both words"><button class="btn ok-btn">Decode</button><p class="hint center ci-tries">3 tries</p>`);
      const inp = $('.inp', root);
      let tries = 3;
      const clean = (s) => normalize(s).replace(/\s/g, '');
      const check = () => {
        if (clean(inp.value) === clean(msgTxt)) return done(true);
        tries--; shake(inp);
        if (tries <= 0) return done(false);
        $('.ci-tries', root).textContent = `Wrong! ${tries} ${tries === 1 ? 'try' : 'tries'} left`;
      };
      $('.ok-btn', root).onclick = check;
      inp.onkeydown = (e) => { if (e.key === 'Enter') check(); };
      return timeBar(root, 90, () => done(false));
    },
  },

  slider: {
    name: 'Slider Puzzle', ic: 'slider', tag: 'Put tiles 1–8 in order',
    run(root, done) {
      const solved = '1,2,3,4,5,6,7,8,0';
      const tiles = [1, 2, 3, 4, 5, 6, 7, 8, 0];
      const nb = (i) => [i - 3, i + 3, i % 3 ? i - 1 : -1, i % 3 < 2 ? i + 1 : -1].filter((j) => j >= 0 && j < 9);
      let blank = 8, last = -1;
      for (let k = 0; k < 60 || tiles.join() === solved; k++) {
        const j = pick(nb(blank).filter((x) => x !== last));
        [tiles[blank], tiles[j]] = [tiles[j], tiles[blank]];
        last = blank; blank = j;
      }
      root.insertAdjacentHTML('beforeend', '<p class="hint">Slide the tiles into order 1 → 8. The empty spot goes bottom-right.</p><div class="slider"></div>');
      const g = $('.slider', root);
      function draw() {
        g.innerHTML = '';
        tiles.forEach((v, i) => {
          const b = document.createElement('button');
          b.className = 'stile' + (v ? '' : ' empty'); b.textContent = v || '';
          b.onclick = () => {
            const bi = tiles.indexOf(0);
            if (!nb(bi).includes(i)) return;
            [tiles[bi], tiles[i]] = [tiles[i], tiles[bi]];
            draw();
            if (tiles.join() === solved) done(true);
          };
          g.appendChild(b);
        });
      }
      draw();
      return timeBar(root, 120, () => done(false));
    },
  },

  // ----- social games: finished by scanning badges (handled by the engine + main.js) -----
  dare: { name: 'Dare', ic: 'zap', tag: 'Do something silly, get a witness', social: true },
  courier: { name: 'Courier', ic: 'package', tag: 'Deliver data to a player', social: true },
  handshake: { name: 'Handshake', ic: 'users', tag: 'Scan 2 players\' badges', social: true },
  vanish: { name: 'Hide & Seek', ic: 'eye', tag: 'Hide for 60 s — everyone hunts you', social: true },

  quiet: {
    name: 'Quiet Zone', ic: 'wifioff', tag: 'Escape everyone. Total silence.',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Walk AWAY from everyone and find a silent spot. The bar only fills while it\'s quiet around you. 15 seconds of silence.</p><div class="vu quietvu"><div class="lv"></div></div><div class="big-num fl">0%</div><p class="hint center qmsg">Listening…</p><button class="btn ghost skip hidden">My microphone doesn\'t work</button>');
      let stream, ctx, raf, held = 0, last = performance.now(), dead = false;
      const lv = $('.lv', root), fl = $('.fl', root), msg = $('.qmsg', root);
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          const an = ctx.createAnalyser(); an.fftSize = 1024;
          ctx.createMediaStreamSource(stream).connect(an);
          const buf = new Float32Array(an.fftSize);
          const loop = () => {
            if (dead) return;
            an.getFloatTimeDomainData(buf);
            let s = 0; for (const v of buf) s += v * v;
            const level = Math.min(1, Math.sqrt(s / buf.length) * 12);
            const t = performance.now();
            const quiet = level < 0.18;
            if (quiet) held += t - last; else held = Math.max(0, held - (t - last) * 0.5);
            last = t;
            lv.style.width = level * 100 + '%';
            msg.textContent = quiet ? '🤫 Shhh… good.' : '🔊 Too loud! Move away from people.';
            fl.textContent = Math.min(100, Math.round(held / 15000 * 100)) + '%';
            if (held >= 15000) return done(true);
            raf = requestAnimationFrame(loop);
          };
          loop();
        } catch { $('.skip', root).classList.remove('hidden'); }
      })();
      $('.skip', root).onclick = () => done('skip');
      const stop = timeBar(root, 40, () => done(false));
      return () => { dead = true; stop(); cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); ctx?.close(); };
    },
  },

  whack: {
    name: 'Whack-a-Hacker', ic: 'skull', tag: 'Bonk hackers, spare friends',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Bonk <b class="r">12 Hackers</b> (masks!). Don\'t bonk your friends — 3 lives.</p><div class="holes">' + Array.from({ length: 9 }, (_, i) => `<button class="hole" data-i="${i}"><span></span></button>`).join('') + '</div><div class="scorebar"><span class="sg">0/12</span><span class="sr">♥♥♥</span></div>');
      const holes = [...root.querySelectorAll('.hole')];
      let hits = 0, lives = 3; const T = timers();
      const upd = () => { $('.sg', root).textContent = `${hits}/12`; $('.sr', root).textContent = '♥'.repeat(lives) + '♡'.repeat(3 - lives); };
      const hacker = () => avatarSVG({ s: Math.floor(rnd() * 6), h: 7, hc: 0, e: 4, m: 0, c: 9, a: 6 }, 70);
      const friend = () => { const a = randomAvatar(); if (a.a === 6) a.a = 0; return avatarSVG(a, 70); };
      holes.forEach((h) => h.onpointerdown = () => {
        if (!h.classList.contains('up')) return;
        h.classList.remove('up'); h.classList.add('bonk');
        setTimeout(() => h.classList.remove('bonk'), 250);
        if (h.dataset.kind === 'h') { hits++; if (hits >= 12) return done(true); }
        else { lives--; shake(root.querySelector('.holes')); if (lives <= 0) return done(false); }
        upd();
      });
      T.every(() => {
        const free = holes.filter((h) => !h.classList.contains('up'));
        if (!free.length) return;
        const h = pick(free);
        const isH = rnd() < 0.62;
        h.dataset.kind = isH ? 'h' : 'f';
        h.firstChild.innerHTML = isH ? hacker() : friend();
        h.classList.add('up');
        setTimeout(() => h.classList.remove('up'), 900 + rnd() * 400);
      }, 560);
      const stop = timeBar(root, 40, () => done(false));
      return () => { T.clear(); stop(); };
    },
  },

  noise: {
    name: 'Noise Blast', ic: 'mic', tag: 'SCREAM. Everyone will hear.',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Make NOISE! Clap, shout, sing badly — until the bar is full. Warning: everyone will know where you are.</p><div class="vu"><div class="lv"></div></div><div class="big-num fl">0%</div><button class="btn ghost skip hidden">My microphone doesn\'t work</button>');
      let stream, ctx, raf, held = 0, last = performance.now(), dead = false;
      const lv = $('.lv', root), fl = $('.fl', root);
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          const an = ctx.createAnalyser(); an.fftSize = 1024;
          ctx.createMediaStreamSource(stream).connect(an);
          const buf = new Float32Array(an.fftSize);
          const loop = () => {
            if (dead) return;
            an.getFloatTimeDomainData(buf);
            let s = 0; for (const v of buf) s += v * v;
            const level = Math.min(1, Math.sqrt(s / buf.length) * 5);
            const t = performance.now();
            if (level > 0.5) held += t - last;
            last = t;
            lv.style.width = level * 100 + '%';
            fl.textContent = Math.min(100, Math.round(held / 3750 * 100)) + '%';
            if (held >= 3750) return done(true); // 50% longer than before
            raf = requestAnimationFrame(loop);
          };
          loop();
        } catch { $('.skip', root).classList.remove('hidden'); }
      })();
      $('.skip', root).onclick = () => done('skip');
      const stop = timeBar(root, 35, () => done(false));
      return () => { dead = true; stop(); cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); ctx?.close(); };
    },
  },

  colour: {
    name: 'Colour Hunt', ic: 'camera', tag: 'Photograph a colour',
    run(root, done) {
      const col = pick(COLOURS);
      root.insertAdjacentHTML('beforeend', `<p class="hint">Find something <b style="color:${col.c}">${col.n}</b> nearby. Fill the square with it and capture.</p><div class="cam"><video playsinline muted autoplay></video><div class="aim"></div></div><button class="btn cap">Capture</button><p class="hint msg"></p><button class="btn ghost skip hidden">My camera doesn't work</button>`);
      const video = $('video', root), msg = $('.msg', root);
      let stream, dead = false;
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
          video.srcObject = stream;
        } catch { $('.skip', root).classList.remove('hidden'); msg.textContent = 'Camera not available.'; }
      })();
      $('.skip', root).onclick = () => done('skip');
      $('.cap', root).onclick = () => {
        if (!video.videoWidth) return;
        const c = document.createElement('canvas'); const w = 64; c.width = w; c.height = w;
        const cx = c.getContext('2d');
        const side = Math.min(video.videoWidth, video.videoHeight) * 0.35;
        cx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, w, w);
        const d = cx.getImageData(0, 0, w, w).data;
        let hits = 0;
        for (let i = 0; i < d.length; i += 4) { const [h, s, v] = hsv(d[i], d[i + 1], d[i + 2]); if (col.test(h, s, v)) hits++; }
        const frac = hits / (w * w);
        if (frac > 0.45) {
          // a small snapshot goes to the live feed (180 px, so it stays light for the network)
          try {
            const p = document.createElement('canvas'); p.width = 180; p.height = 180;
            const big = Math.min(video.videoWidth, video.videoHeight) * 0.8;
            p.getContext('2d').drawImage(video, (video.videoWidth - big) / 2, (video.videoHeight - big) / 2, big, big, 0, 0, 180, 180);
            window.dispatchEvent(new CustomEvent('hpg-photo', { detail: { img: p.toDataURL('image/jpeg', 0.55), what: col.n } }));
          } catch { /* no photo, no problem */ }
          done(true);
        }
        else msg.textContent = `Only ${Math.round(frac * 100)}% ${col.n.toLowerCase()}. Get closer!`;
      };
      const stop = timeBar(root, 75, () => done(false));
      return () => { dead = true; stop(); stream?.getTracks().forEach((t) => t.stop()); };
    },
  },

  // ----- v0.8 brainrot games -----
  aura: {
    name: 'Aura Farm', ic: 'star', tag: 'Farm 1000 aura. Don\'t be cringe.',
    run(root, done) {
      const PLUS = ['walked away from an explosion', 'said "it is what it is"', 'didn\'t check your phone for 4 seconds', 'nodded at a stranger', 'wore sunglasses indoors', 'won an argument by staying silent', 'caught your phone mid-fall', 'left the group chat on read'];
      const MINUS = ['waved back at someone who wasn\'t waving at you', 'tripped on flat ground', 'laughed at your own joke', 'said "you too" to the waiter', 'liked a 3-year-old post', 'pushed a PULL door', 'your mic was on'];
      let av; try { av = JSON.parse(localStorage.getItem('av')); } catch { av = null; }
      root.insertAdjacentHTML('beforeend', `<p class="hint">Tap when the needle is in the <b class="g">AURA ZONE</b>. Perfect middle = double aura. Miss = cringe. Reach <b>1000 aura</b>.</p>
        <div class="aura-stage"><div class="aura-glow"></div><div class="aura-av">${avatarSVG(av || randomAvatar(), 110)}</div><div class="aura-pop"></div></div>
        <div class="aura-num">0 <small>aura</small></div><div class="aura-bar"><div class="aura-zone"></div><div class="aura-needle"></div></div>
        <button class="btn big hot aura-tap">😎 FARM</button>`);
      const zone = $('.aura-zone', root), needle = $('.aura-needle', root), num = $('.aura-num', root), popEl = $('.aura-pop', root), glow = $('.aura-glow', root);
      let aura = 0, x = 0, dir = 1, speed = 1.1, zStart = 0, zW = 26, raf, dead = false, last = performance.now();
      const newZone = () => { zW = Math.max(13, zW - 1.2); zStart = 4 + rnd() * (92 - zW); zone.style.left = zStart + '%'; zone.style.width = zW + '%'; };
      const say = (txt, good) => { popEl.textContent = txt; popEl.className = 'aura-pop show ' + (good ? 'good' : 'bad'); setTimeout(() => popEl.classList.remove('show'), 900); };
      const loop = (t) => {
        if (dead) return;
        const dt = Math.min(50, t - last); last = t;
        x += dir * speed * dt / 16; if (x > 100) { x = 100; dir = -1; } if (x < 0) { x = 0; dir = 1; }
        needle.style.left = x + '%';
        raf = requestAnimationFrame(loop);
      };
      $('.aura-tap', root).onclick = () => {
        const mid = zStart + zW / 2;
        if (x >= zStart && x <= zStart + zW) {
          const perfect = Math.abs(x - mid) < zW * 0.18;
          const g = perfect ? 250 : 150;
          aura += g; say(`+${g} aura — ${pick(PLUS)}`, true);
          speed += 0.07; newZone();
        } else { aura = Math.max(0, aura - 100); say(`-100 aura — ${pick(MINUS)}`, false); shake(num); }
        num.innerHTML = `${aura} <small>aura</small>`;
        glow.style.opacity = Math.min(1, aura / 1000); glow.style.transform = `scale(${0.6 + aura / 1000})`;
        if (aura >= 1000) { dead = true; say('∞ AURA. Main character unlocked.', true); setTimeout(() => done(true), 700); }
      };
      newZone(); raf = requestAnimationFrame(loop);
      const stop = timeBar(root, 45, () => done(false));
      return () => { dead = true; cancelAnimationFrame(raf); stop(); };
    },
  },

  sixseven: {
    name: 'Make 67', ic: 'binary', tag: 'Every road leads to 67',
    run(root, done) {
      let round = 0;
      root.insertAdjacentHTML('beforeend', '<p class="hint">Fill the blanks so the answer is <b>67</b>. Tap a number, it goes in the next blank. Round <b class="rn">1</b>/3</p><div class="six-box"></div><div class="six-meme hidden">6️⃣7️⃣</div>');
      const box = $('.six-box', root), meme = $('.six-meme', root);
      const next = () => eq67(box, make67(rnd, round >= 2), () => {
        round++; meme.classList.remove('hidden'); pop(meme); setTimeout(() => meme.classList.add('hidden'), 650);
        if (round >= 3) return setTimeout(() => done(true), 500);
        $('.rn', root).textContent = round + 1; setTimeout(next, 550);
      });
      next();
      return timeBar(root, 75, () => done(false));
    },
  },

  tungtung: {
    name: 'Tung Tung Escape', ic: 'alert', tag: 'Run from the angry log with a bat',
    run(root, done) {
      return tungRun(root, { lives: 3, secs: 25, text: 'Drag your finger to run. The angry log with a bat wants you. When you see <b>TUNG TUNG TUNG</b>, he dashes! Survive 25 s — 3 lives.', onEnd: (ms, all) => done(all) });
    },
  },

  // ----- v0.9 games -----
  brainrot: {
    name: 'Brainrot Translator', ic: 'type', tag: 'Translate Gen Alpha for the boomers',
    run(root, done) {
      const qs = shuffle(BRAINROT).slice(0, 8);
      let i = 0, miss = 0;
      root.insertAdjacentHTML('beforeend', '<p class="hint center">Word <b class="rn">1</b>/8 · 2 mistakes allowed · 6 s each</p><div class="qbar"><div></div></div><div class="br-box"></div>');
      const box = $('.br-box', root), qbar = $('.qbar div', root); const T = timers();
      let qT = null;
      function ask() {
        $('.rn', root).textContent = i + 1;
        clearTimeout(qT); qbar.style.transition = 'none'; qbar.style.width = '100%'; void qbar.offsetWidth; qbar.style.transition = 'width 6s linear'; qbar.style.width = '0%';
        qT = T.after(() => answer(false), 6000);
        slangQuestion(box, qs[i], rnd, answer);
      }
      function answer(ok) {
        clearTimeout(qT);
        if (!ok && ++miss > 2) return done(false);
        if (++i >= qs.length) return done(true);
        ask();
      }
      ask();
      return () => T.clear();
    },
  },

  sigma: {
    name: 'Sigma Grindset', ic: 'clock', tag: 'Remember the 4 AM routine',
    run(root, done) {
      const sizes = [4, 5, 6];
      let round = 0, miss = 0, order = [], pos = 0;
      root.insertAdjacentHTML('beforeend', '<div class="sig-alarm">⏰ 4:00 AM</div><p class="hint center sig-msg"></p><div class="sig-list"></div><p class="hint center">Round <b class="rn">1</b>/3 · 2 mistakes allowed</p>');
      const list = $('.sig-list', root), msg = $('.sig-msg', root), alarm = $('.sig-alarm', root); const T = timers();
      function show() {
        order = shuffle(SIGMA).slice(0, sizes[round]); pos = 0;
        $('.rn', root).textContent = round + 1;
        alarm.classList.add('ring'); msg.textContent = '🧠 Memorise the routine…';
        list.innerHTML = order.map((s, k) => `<div class="sig-step"><b>${k + 1}</b>${esc(s)}</div>`).join('');
        T.after(() => {
          alarm.classList.remove('ring'); msg.textContent = 'Now tap the steps in the right order!';
          list.innerHTML = '';
          for (const s of shuffle(order)) {
            const b = document.createElement('button'); b.className = 'btn sig-btn'; b.textContent = s;
            b.onclick = () => {
              if (s === order[pos]) { b.disabled = true; b.classList.add('right'); b.insertAdjacentHTML('afterbegin', `<b>${pos + 1}</b>`); pos++; if (pos >= order.length) { round++; if (round >= 3) return done(true); msg.textContent = '💪 Grindset complete. Next level…'; T.after(show, 900); } }
              else { shake(b); miss++; msg.textContent = `😴 You overslept until 11:00. Beta behaviour. (${miss}/2)`; if (miss > 2) return done(false); }
            };
            list.appendChild(b);
          }
        }, 2500 + sizes[round] * 600);
      }
      show();
      const stop = timeBar(root, 70, () => done(false));
      return () => { T.clear(); stop(); };
    },
  },

  fanum: {
    name: 'Fanum Tax', ic: 'shield', tag: 'Protect your snacks from the thieves',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Hands sneak in to steal your snacks. <b>Slap them away!</b> A <b class="g">green sleeve</b> is your friend bringing a snack — don\'t slap it. Survive 30 s.</p><div class="arena fanum-ar"><div class="snacks"></div></div><div class="scorebar"><span class="sg">0 slapped</span><span class="sr"></span></div>');
      const ar = $('.fanum-ar', root), sn = $('.snacks', root), sr = $('.sr', root);
      let snacks = 3, slapped = 0, over = false; const hands = []; const T = timers(); const start = Date.now();
      const FOOD = ['🍟', '🍔', '🍕', '🌮', '🍩'];
      const drawSnacks = () => { sn.innerHTML = Array.from({ length: snacks }, (_, k) => `<span>${FOOD[k]}</span>`).join(''); sr.textContent = `${snacks} snack${snacks === 1 ? '' : 's'} left`; };
      function spawn() {
        if (over) return;
        const friend = rnd() < 0.15 && snacks < 3;
        const ang = rnd() * Math.PI * 2;
        const h = { a: ang, r: 1, sp: 0.007 + rnd() * 0.004 + (Date.now() - start) / 4e6, friend, el: document.createElement('button') };
        h.el.className = 'hand' + (friend ? ' friend' : '');
        h.el.innerHTML = friend ? '<span>🤲</span><i>🍟</i>' : '<span>🫳</span>';
        h.el.style.setProperty('--rot', (ang * 180 / Math.PI + 90) + 'deg');
        h.el.onpointerdown = () => {
          hands.splice(hands.indexOf(h), 1); h.el.classList.add('slap'); setTimeout(() => h.el.remove(), 250);
          if (h.friend) { snacks = Math.max(0, snacks - 1); shake(ar); drawSnacks(); if (snacks <= 0) { over = true; done(false); } }
          else { slapped++; $('.sg', root).textContent = `${slapped} slapped 👋`; }
        };
        ar.appendChild(h.el); hands.push(h);
      }
      T.every(spawn, 800);
      T.every(() => {
        if (over) return;
        for (const h of [...hands]) {
          h.r -= h.sp;
          h.el.style.left = 50 + Math.cos(h.a) * h.r * 44 + '%';
          h.el.style.top = 50 + Math.sin(h.a) * h.r * 42 + '%';
          if (h.r <= 0.12) {
            hands.splice(hands.indexOf(h), 1); h.el.remove();
            if (h.friend) { snacks = Math.min(3, snacks + 1); drawSnacks(); }
            else { snacks--; drawSnacks(); sn.classList.remove('taxed'); void sn.offsetWidth; sn.classList.add('taxed'); if (snacks <= 0) { over = true; return done(false); } }
          }
        }
      }, 30);
      drawSnacks();
      const stop = timeBar(root, 30, () => { over = true; done(true); });
      return () => { over = true; T.clear(); stop(); };
    },
  },

  shake: {
    name: 'Shake to Charge', ic: 'zap', tag: 'Shake on SHAKE. Freeze on STOP.',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Shake your phone to charge the battery — but ONLY on <b class="g">SHAKE</b>. On <b class="r">STOP</b> freeze, or it drains!</p><div class="sh-light">GET READY…</div><div class="batt"><div></div><span>0%</span></div><button class="btn ghost skip hidden">My phone can\'t detect shaking</button>');
      const light = $('.sh-light', root), fill = $('.batt div', root), lbl = $('.batt span', root); const T = timers();
      let pct = 0, phase = 'wait', over = false;
      const upd = () => { fill.style.width = pct + '%'; lbl.textContent = Math.round(pct) + '%'; };
      const setPhase = (p) => {
        phase = p; light.className = 'sh-light ' + p; light.textContent = p === 'go' ? '📳 SHAKE!' : '🛑 STOP!';
        T.after(() => { if (!over) setPhase(p === 'go' ? 'stop' : 'go'); }, p === 'go' ? 2200 + rnd() * 2500 : 1200 + rnd() * 1800);
      };
      T.after(() => setPhase('go'), 1200);
      const sens = shakeSensor((j) => {
        if (over || j < 8) return;
        if (phase === 'go') pct = Math.min(100, pct + 0.55);
        else if (phase === 'stop') { pct = Math.max(0, pct - 1.2); light.classList.remove('caught'); void light.offsetWidth; light.classList.add('caught'); }
        upd();
        if (pct >= 100) { over = true; done(true); }
      });
      T.after(() => { if (!sens.got()) $('.skip', root).classList.remove('hidden'); }, 2500);
      $('.skip', root).onclick = () => done('skip');
      const stop = timeBar(root, 35, () => done(false));
      return () => { over = true; T.clear(); stop(); sens.stop(); };
    },
  },

  tilt: {
    name: 'Balance the Wifi', ic: 'radio', tag: 'Tilt the ball into the wifi',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Tilt your phone to roll the ball into the <b class="g">📶 wifi</b>. Avoid the <b class="r">lag holes</b> — they send you back. 2 levels, 3 lives.</p><div class="arena tilt-ar"><div class="tilt-goal">📶</div><div class="tilt-ball"></div></div><div class="scorebar"><span class="sg">Level 1/2</span><span class="sr">♥♥♥</span></div><button class="btn ghost skip hidden">My phone can\'t detect tilting</button>');
      const ar = $('.tilt-ar', root), ball = $('.tilt-ball', root), goal = $('.tilt-goal', root);
      let W = ar.clientWidth || 300, H = ar.clientHeight || 340;
      let level = 0, lives = 3, got = false, over = false, raf, last = performance.now(), tx = 0, ty = 0;
      const b = { x: 0, y: 0, vx: 0, vy: 0 }; let holes = [];
      function setup() {
        W = ar.clientWidth || W; H = ar.clientHeight || H;
        ar.querySelectorAll('.tilt-hole').forEach((h) => h.remove());
        b.x = W / 2; b.y = H - 30; b.vx = b.vy = 0;
        const g = { x: 30 + rnd() * (W - 60), y: 34 }; goal.style.left = g.x - 20 + 'px'; goal.style.top = g.y - 20 + 'px'; goal.dataset.x = g.x; goal.dataset.y = g.y;
        holes = [];
        const n = 4 + level * 2;
        for (let k = 0; k < 200 && holes.length < n; k++) {
          const h = { x: 26 + rnd() * (W - 52), y: 80 + rnd() * (H - 150), r: 17 };
          if (holes.some((o) => Math.hypot(o.x - h.x, o.y - h.y) < 52) || Math.hypot(h.x - g.x, h.y - g.y) < 60) continue;
          holes.push(h);
          const el = document.createElement('div'); el.className = 'tilt-hole'; el.style.left = h.x - h.r + 'px'; el.style.top = h.y - h.r + 'px'; ar.appendChild(el);
        }
      }
      const onTilt = (e) => { if (e.gamma == null) return; got = true; tx = Math.max(-30, Math.min(30, e.gamma)); ty = Math.max(-30, Math.min(30, e.beta - 25)); };
      requestMotion(() => window.addEventListener('deviceorientation', onTilt));
      const loop = (t) => {
        if (over) return;
        const dt = Math.min(50, t - last) / 16; last = t;
        b.vx = (b.vx + tx * 0.018 * dt) * 0.96; b.vy = (b.vy + ty * 0.018 * dt) * 0.96;
        b.x = Math.max(12, Math.min(W - 12, b.x + b.vx * dt)); b.y = Math.max(12, Math.min(H - 12, b.y + b.vy * dt));
        ball.style.transform = `translate(${b.x - 12}px, ${b.y - 12}px)`;
        if (holes.some((h) => Math.hypot(h.x - b.x, h.y - b.y) < h.r)) {
          lives--; shake(ar); $('.sr', root).textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(3 - Math.max(0, lives));
          if (lives <= 0) { over = true; return done(false); }
          b.x = W / 2; b.y = H - 30; b.vx = b.vy = 0;
        }
        if (Math.hypot(+goal.dataset.x - b.x, +goal.dataset.y - b.y) < 22) {
          level++; pop(goal);
          if (level >= 2) { over = true; return done(true); }
          $('.sg', root).textContent = `Level ${level + 1}/2`; setup();
        }
        raf = requestAnimationFrame(loop);
      };
      setup(); raf = requestAnimationFrame(loop);
      const T = timers();
      T.after(() => { if (!got) $('.skip', root).classList.remove('hidden'); }, 2500);
      $('.skip', root).onclick = () => done('skip');
      const stop = timeBar(root, 50, () => done(false));
      return () => { over = true; cancelAnimationFrame(raf); T.clear(); stop(); window.removeEventListener('deviceorientation', onTilt); };
    },
  },

  delulu: {
    name: 'Delulu Detector', ic: 'eye', tag: 'Real thought or pure delusion?',
    run(root, done) {
      const qs = shuffle(DELULU).slice(0, 10);
      let i = 0, miss = 0;
      root.insertAdjacentHTML('beforeend', '<p class="hint center">Message <b class="rn">1</b>/10 · 2 mistakes allowed</p><div class="dl-card"></div><div class="row dl-btns"><button class="btn dl-real">✅ REAL</button><button class="btn hot dl-delu">🦄 DELULU</button></div><p class="hint center dl-msg"></p>');
      const card = $('.dl-card', root), msg = $('.dl-msg', root);
      const show = () => { card.textContent = qs[i][0]; $('.rn', root).textContent = i + 1; pop(card); };
      const answer = (saysDelulu) => {
        const ok = saysDelulu === qs[i][1];
        msg.textContent = ok ? pick(['Correct. 🧠', 'Big brain.', 'Therapist approved.']) : (qs[i][1] ? 'That was 100% delulu. 🦄' : 'That one was actually reasonable. 😐');
        if (!ok) { shake(card); if (++miss > 2) return done(false); }
        if (++i >= qs.length) return done(true);
        show();
      };
      $('.dl-real', root).onclick = () => answer(false);
      $('.dl-delu', root).onclick = () => answer(true);
      show();
      return timeBar(root, 55, () => done(false));
    },
  },

  npc: {
    name: 'Spot the NPC', ic: 'users', tag: 'One of them is walking in a loop',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Everyone walks around randomly… except the <b>NPC</b>, who walks in a perfect square loop forever. Tap the NPC! 3 rounds, 2 mistakes allowed.</p><div class="arena npc-ar"></div><div class="scorebar"><span class="sg">Round 1/3</span><span class="sr"></span></div>');
      const ar = $('.npc-ar', root); const T = timers();
      let round = 0, miss = 0, walkers = [];
      function setup() {
        ar.innerHTML = ''; walkers = [];
        const W = ar.clientWidth || 300, H = ar.clientHeight || 320, n = [7, 9, 11][round];
        const npcI = Math.floor(rnd() * n);
        for (let k = 0; k < n; k++) {
          const w = { npc: k === npcI, x: 20 + rnd() * (W - 60), y: 20 + rnd() * (H - 60), vx: (rnd() - 0.5) * 2.4, vy: (rnd() - 0.5) * 2.4, t: 0, side: 55 + rnd() * 30, el: document.createElement('button') };
          if (w.npc) { w.x = rnd() * Math.max(10, W - 40 - w.side); w.y = rnd() * Math.max(10, H - 40 - w.side); w.t = rnd() * 4 * w.side; }
          w.el.className = 'walker'; w.el.innerHTML = avatarSVG(randomAvatar(), 38);
          w.el.onpointerdown = () => {
            if (w.npc) { round++; if (round >= 3) return done(true); $('.sg', root).textContent = `Round ${round + 1}/3`; setup(); }
            else { w.el.classList.add('wrong'); miss++; $('.sr', root).textContent = '❌'.repeat(miss) + ' that\'s a real person 😭'; if (miss > 2) done(false); }
          };
          ar.appendChild(w.el); walkers.push(w);
        }
      }
      T.every(() => {
        const W = ar.clientWidth || 300, H = ar.clientHeight || 320;
        for (const w of walkers) {
          if (w.npc) {
            // perfect square loop at constant speed
            w.t += 1.3; const s = w.side, p = w.t % (4 * s);
            const ox = p < s ? p : p < 2 * s ? s : p < 3 * s ? 3 * s - p : 0;
            const oy = p < s ? 0 : p < 2 * s ? p - s : p < 3 * s ? s : 4 * s - p;
            w.el.style.left = w.x + ox + 'px'; w.el.style.top = w.y + oy + 'px';
          } else {
            if (rnd() < 0.03) { w.vx = (rnd() - 0.5) * 2.6; w.vy = (rnd() - 0.5) * 2.6; }
            w.x += w.vx; w.y += w.vy;
            if (w.x < 0 || w.x > W - 40) w.vx *= -1;
            if (w.y < 0 || w.y > H - 40) w.vy *= -1;
            w.el.style.left = w.x + 'px'; w.el.style.top = w.y + 'px';
          }
        }
      }, 30);
      setup();
      const stop = timeBar(root, 50, () => done(false));
      return () => { T.clear(); stop(); };
    },
  },

  groupchat: {
    name: 'Group Chat Chaos', ic: 'news', tag: 'Only answer your mom',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Messages fly in. Tap ONLY the ones from your real <b>Mom</b> before they vanish. Careful: scammers pretend to be Mom! Get 8. 3 wrong taps = fail.</p><div class="chat-box"></div><div class="scorebar"><span class="sg">Mom: 0/8</span><span class="sr"></span></div>');
      const box = $('.chat-box', root); const T = timers();
      let got = 0, wrong = 0, missed = 0, n = 0, over = false;
      function spawn() {
        if (over) return;
        const isMom = rnd() < 0.42;
        const pool = CHAT.filter((c) => c[2] === isMom);
        const [from, text, real] = pick(pool);
        const life = Math.max(1500, 2600 - n * 40); n++;
        const m = document.createElement('button');
        m.className = 'chat-msg'; m.style.setProperty('--life', life + 'ms');
        m.innerHTML = `<b>${esc(from)}</b><span>${esc(text)}</span><i></i>`;
        let gone = false;
        m.onpointerdown = () => {
          if (gone) return; gone = true;
          if (real) { got++; m.classList.add('right'); $('.sg', root).textContent = `Mom: ${got}/8`; if (got >= 8) { over = true; return done(true); } }
          else { wrong++; m.classList.add('wrong'); shake(box); $('.sr', root).textContent = '❌'.repeat(wrong); if (wrong >= 3) { over = true; return done(false); } }
          setTimeout(() => m.remove(), 300);
        };
        box.prepend(m);
        while (box.children.length > 6) box.lastChild.remove();
        T.after(() => { if (!gone) { gone = true; m.classList.add('gone'); if (real) missed++; setTimeout(() => m.remove(), 300); } }, life);
      }
      T.every(spawn, 750);
      spawn();
      const stop = timeBar(root, 40, () => done(false));
      return () => { over = true; T.clear(); stop(); };
    },
  },

  stop67: {
    name: 'Stop at 67%', ic: 'activity', tag: 'Stop the loading bar at EXACTLY 67%',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">The loading bar races. Tap <b>STOP</b> when it\'s at exactly <b class="y">67%</b> (66–68 counts). Get it 3 times.</p><div class="ld-bar"><div></div><i class="ld-mark"></i></div><div class="big-num ld-num">0%</div><p class="hint center ld-msg"></p><button class="btn big hot ld-stop">✋ STOP</button><p class="hint center">Hits: <b class="ld-hits">0</b>/3</p>');
      const fill = $('.ld-bar div', root), num = $('.ld-num', root), msg = $('.ld-msg', root);
      let hits = 0, period = 1700, t0 = performance.now(), paused = false, val = 0, raf, over = false;
      const loop = (t) => {
        if (over) return;
        if (!paused) { val = ((t - t0) % period) / period * 100; fill.style.width = val + '%'; num.textContent = Math.floor(val) + '%'; }
        raf = requestAnimationFrame(loop);
      };
      $('.ld-stop', root).onclick = () => {
        if (paused) return;
        paused = true; const v = Math.floor(val);
        if (v >= 66 && v <= 68) {
          hits++; $('.ld-hits', root).textContent = hits; num.textContent = '67% 💀'; pop(num); msg.textContent = pick(['SIX SEVEN!! 🙌', '67 aura gained.', 'Mathematically perfect.']);
          if (hits >= 3) { over = true; return setTimeout(() => done(true), 600); }
          period *= 0.85;
        } else { msg.textContent = v < 66 ? `${v}%… too early. Not 67.` : `${v}%… too late. So close, yet so not 67.`; shake(num); }
        setTimeout(() => { paused = false; t0 = performance.now(); }, 700);
      };
      raf = requestAnimationFrame(loop);
      const stop = timeBar(root, 35, () => done(false));
      return () => { over = true; cancelAnimationFrame(raf); stop(); };
    },
  },

  cooked: {
    name: 'Don\'t Get Cooked', ic: 'zap', tag: 'Flip the burgers at the perfect moment',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Burgers cook on the grill. Flip each one when it turns <b class="y">GOLDEN</b>. Too early = raw 🤢, too late = burnt 💀. Flip 8 perfect ones · 3 mistakes max.</p><div class="grill"></div><div class="scorebar"><span class="sg">0/8 perfect</span><span class="sr"></span></div>');
      const grill = $('.grill', root); const T = timers();
      let good = 0, bad = 0, over = false;
      const slots = Array.from({ length: 4 }, () => { const el = document.createElement('button'); el.className = 'patty empty'; grill.appendChild(el); return { el, p: null }; });
      const mistake = (s, txt) => { bad++; s.el.dataset.t = txt; s.el.classList.add('oops'); $('.sr', root).textContent = '❌'.repeat(bad); shake(grill); if (bad >= 3) { over = true; done(false); } };
      slots.forEach((s) => s.el.onpointerdown = () => {
        if (over || !s.p) return;
        const st = stage(s.p);
        if (st === 'golden') { good++; s.el.dataset.t = 'PERFECT ✨'; $('.sg', root).textContent = `${good}/8 perfect`; if (good >= 8) { over = true; done(true); } }
        else mistake(s, st === 'raw' ? 'RAW 🤢' : 'BURNT 💀');
        clear(s);
      });
      const stage = (p) => { const a = Date.now() - p.at; return a < p.raw ? 'raw' : a < p.raw + 1100 ? 'golden' : 'burnt'; };
      const clear = (s) => { s.p = null; setTimeout(() => { s.el.className = 'patty empty'; s.el.dataset.t = ''; }, 450); s.el.classList.add('flip'); };
      T.every(() => {
        if (over) return;
        for (const s of slots) {
          if (!s.p) { if (!s.el.classList.contains('flip') && rnd() < 0.08) { s.p = { at: Date.now(), raw: 1600 + rnd() * 1600 }; s.el.className = 'patty raw'; } continue; }
          const st = stage(s.p);
          s.el.className = 'patty ' + st;
          if (st === 'burnt' && Date.now() - s.p.at > s.p.raw + 1600) { mistake(s, 'BURNT 💀'); clear(s); }
        }
      }, 100);
      const stop = timeBar(root, 45, () => done(false));
      return () => { over = true; T.clear(); stop(); };
    },
  },

  disco: {
    name: 'Silent Disco', ic: 'radio', tag: 'Tap exactly on the beat',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Listen (sound on!) and tap the big button EXACTLY on every beat. 16 beats — hit 11 to pass.</p><div class="disco-ball">🪩</div><div class="big-num disco-n">GET READY</div><button class="btn big hot disco-tap">TAP ON THE BEAT</button><p class="hint center">Good taps: <b class="disco-good">0</b>/11</p>');
      const ballEl = $('.disco-ball', root), n = $('.disco-n', root), tapB = $('.disco-tap', root); const T = timers();
      const BEAT = 0.56, COUNT_IN = 4, BEATS = 16;
      let ctx = null;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* silent */ }
      const t0 = (ctx ? ctx.currentTime : performance.now() / 1000) + 0.6;
      const nowS = () => ctx ? ctx.currentTime : performance.now() / 1000;
      if (ctx) for (let k = 0; k < COUNT_IN + BEATS; k++) {
        const at = t0 + k * BEAT, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(k < COUNT_IN ? 880 : 150, at); o.frequency.exponentialRampToValueAtTime(k < COUNT_IN ? 600 : 50, at + 0.12);
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.6, at + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.2);
      }
      for (let k = 0; k < COUNT_IN + BEATS; k++) {
        T.after(() => {
          ballEl.classList.remove('pulse'); void ballEl.offsetWidth; ballEl.classList.add('pulse');
          n.textContent = k < COUNT_IN ? String(COUNT_IN - k) : `${k - COUNT_IN + 1}/${BEATS}`;
        }, (t0 - nowS() + k * BEAT) * 1000);
      }
      const hit = new Set(); let good = 0;
      tapB.onpointerdown = (e) => {
        e.preventDefault();
        const rel = (nowS() - t0) / BEAT - COUNT_IN, k = Math.round(rel);
        if (k < 0 || k >= BEATS) return;
        const off = Math.abs(rel - k) * BEAT;
        if (off < 0.13 && !hit.has(k)) { hit.add(k); good++; $('.disco-good', root).textContent = good; tapB.classList.remove('miss'); pop(tapB); }
        else { tapB.classList.remove('miss'); void tapB.offsetWidth; tapB.classList.add('miss'); }
      };
      T.after(() => done(good >= 11), (t0 - nowS() + (COUNT_IN + BEATS) * BEAT + 0.4) * 1000);
      return () => { T.clear(); ctx?.close(); };
    },
  },

  unmute: {
    name: 'Unmute Yourself', ic: 'mic', tag: 'Shout ONLY when it says so',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Stay quiet… When the screen says <b class="g">SAY IT NOW!</b> shout "HERE!" within 1.5 s. Talking when you\'re muted = everyone heard you. 5 shouts to win, 2 mistakes allowed.</p><div class="um-box muted">🔇 MUTED</div><div class="vu"><div class="lv"></div></div><div class="scorebar"><span class="sg">0/5</span><span class="sr"></span></div><button class="btn ghost skip hidden">My microphone doesn\'t work</button>');
      const boxEl = $('.um-box', root), lv = $('.lv', root); const T = timers();
      let stream, ctx, raf, dead = false, live = false, liveUntil = 0, wins = 0, miss = 0, loudSince = 0, lastBlame = 0;
      const fail = (txt) => { miss++; $('.sr', root).textContent = '❌'.repeat(miss) + ' ' + txt; shake(boxEl); if (miss > 2) { dead = true; done(false); } };
      const prompt = () => { if (dead) return; live = true; liveUntil = performance.now() + 1500; boxEl.className = 'um-box live'; boxEl.textContent = '🎙️ SAY IT NOW!'; };
      const mute = () => { live = false; boxEl.className = 'um-box muted'; boxEl.textContent = '🔇 MUTED'; T.after(prompt, 2500 + rnd() * 3500); };
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          const an = ctx.createAnalyser(); an.fftSize = 1024;
          ctx.createMediaStreamSource(stream).connect(an);
          const buf = new Float32Array(an.fftSize);
          T.after(prompt, 2500 + rnd() * 2000);
          const loop = () => {
            if (dead) return;
            an.getFloatTimeDomainData(buf);
            let s = 0; for (const v of buf) s += v * v;
            const level = Math.min(1, Math.sqrt(s / buf.length) * 6), t = performance.now();
            lv.style.width = level * 100 + '%';
            const loud = level > 0.45;
            if (live) {
              if (loud) { wins++; $('.sg', root).textContent = `${wins}/5`; boxEl.textContent = '✅ HEARD YOU'; live = false; if (wins >= 5) { dead = true; return done(true); } T.after(mute, 700); }
              else if (t > liveUntil) { live = false; fail('too slow — you were AFK on the call'); T.after(mute, 400); }
            } else if (loud) {
              if (!loudSince) loudSince = t;
              if (t - loudSince > 300 && t - lastBlame > 2000 && boxEl.classList.contains('muted')) { lastBlame = t; fail('you were muted… but everyone heard that 💀'); }
            } else loudSince = 0;
            raf = requestAnimationFrame(loop);
          };
          loop();
        } catch { $('.skip', root).classList.remove('hidden'); }
      })();
      $('.skip', root).onclick = () => done('skip');
      const stop = timeBar(root, 45, () => done(false));
      return () => { dead = true; T.clear(); stop(); cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); ctx?.close(); };
    },
  },

  capnocap: {
    name: 'Cap or No Cap', ic: 'zap', tag: 'Weird facts: true or lie?',
    run(root, done) {
      const qs = shuffle(FACTS).slice(0, 8);
      let i = 0, miss = 0;
      root.insertAdjacentHTML('beforeend', '<p class="hint center">Fact <b class="rn">1</b>/8 · 2 mistakes allowed</p><div class="dl-card"></div><div class="row dl-btns"><button class="btn cap-cap">🧢 CAP</button><button class="btn hot cap-no">✅ NO CAP</button></div><p class="hint center dl-msg"></p>');
      const card = $('.dl-card', root), msg = $('.dl-msg', root);
      const show = () => { card.textContent = qs[i][0]; $('.rn', root).textContent = i + 1; pop(card); };
      const answer = (saysTrue) => {
        const ok = saysTrue === qs[i][1];
        msg.textContent = (ok ? '✅ ' : '❌ ') + (qs[i][1] ? 'No cap — that\'s actually true!' : 'Cap 🧢 — that\'s a myth.');
        if (!ok) { shake(card); if (++miss > 2) return done(false); }
        if (++i >= qs.length) return done(true);
        show();
      };
      $('.cap-cap', root).onclick = () => answer(false);
      $('.cap-no', root).onclick = () => answer(true);
      show();
      return timeBar(root, 60, () => done(false));
    },
  },

  maze: {
    name: 'Speedrun Any%', ic: 'activity', tag: 'Trace the path. Touch a wall = restart.',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Put your finger on <b class="g">START</b> and drag along the glowing path to the 🏁 — without lifting it or touching a wall. 2 mazes.</p><div class="maze"></div><div class="scorebar"><span class="sg">Maze 1/2</span><span class="sr"></span></div>');
      const mz = $('.maze', root);
      const C = 7, R = 9;
      let path = [], idx = -1, level = 0, cells = [], resets = 0;
      function gen() {
        for (let tries = 0; tries < 200; tries++) {
          const p = [[Math.floor(rnd() * C), 0]], seen = new Set([p[0].join()]);
          let ok = false;
          for (let s = 0; s < 80; s++) {
            const [x, y] = p[p.length - 1];
            if (y === R - 1) { ok = true; break; }
            const opts = [[x, y + 1], [x, y + 1], [x - 1, y], [x + 1, y]].filter(([a, b]) => a >= 0 && a < C && b < R && !seen.has(a + ',' + b)
              && ![[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]].some(([c, d]) => seen.has(c + ',' + d) && !(c === x && d === y)));
            if (!opts.length) break;
            const n = pick(opts); p.push(n); seen.add(n.join());
          }
          if (ok && p.length >= 12) return p;
        }
        return Array.from({ length: R }, (_, y) => [3, y]);
      }
      function setup() {
        path = gen(); idx = -1;
        mz.style.gridTemplateColumns = `repeat(${C}, 1fr)`;
        mz.innerHTML = ''; cells = [];
        const key = new Map(path.map((c, k) => [c.join(), k]));
        for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
          const k = key.get(x + ',' + y);
          const el = document.createElement('div');
          el.className = 'mz-cell ' + (k == null ? 'wall' : k === 0 ? 'path start' : k === path.length - 1 ? 'path goal' : 'path');
          el.dataset.k = k ?? -1;
          if (k === 0) el.textContent = 'START'; if (k === path.length - 1) el.textContent = '🏁';
          mz.appendChild(el); cells.push(el);
        }
      }
      const cellAt = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.classList.contains('mz-cell') ? el : null; };
      const reset = (why) => { if (idx < 0) return; idx = -1; resets++; mz.querySelectorAll('.done').forEach((c) => c.classList.remove('done')); shake(mz); $('.sr', root).textContent = why; };
      mz.addEventListener('pointerdown', (e) => { e.preventDefault(); const c = cellAt(e); if (c && +c.dataset.k === 0) { idx = 0; c.classList.add('done'); $('.sr', root).textContent = 'GO GO GO'; } try { mz.releasePointerCapture(e.pointerId); } catch { /* fine */ } });
      mz.addEventListener('pointermove', (e) => {
        if (idx < 0) return;
        const c = cellAt(e); if (!c) return;
        const k = +c.dataset.k;
        if (k < 0) return reset('💥 Wall! Back to START');
        if (k > idx && k <= idx + 2) { for (let j = idx + 1; j <= k; j++) cells.find((x) => +x.dataset.k === j)?.classList.add('done'); idx = k; }
        if (idx === path.length - 1) { level++; if (level >= 2) return done(true); $('.sg', root).textContent = 'Maze 2/2'; setup(); }
      });
      mz.addEventListener('pointerup', () => { if (idx >= 0) reset('✋ You lifted your finger. Back to START'); });
      setup();
      return timeBar(root, 50, () => done(false));
    },
  },
};

// ======================= DUEL GAMES =======================
export const DUEL = {
  quickdraw: {
    name: 'Quick Draw', ic: 'crosshair', desc: 'Tap the moment it turns green. Too early = instant loss.',
    run(root, r, done) {
      const delay = 1500 + r() * 3500;
      let state = 'wait', t0 = 0;
      root.insertAdjacentHTML('beforeend', '<button class="qd wait">WAIT FOR IT…</button>');
      const b = $('.qd', root); const T = timers();
      T.after(() => { if (state !== 'wait') return; state = 'go'; t0 = performance.now(); b.className = 'qd go'; b.textContent = 'TAP!!'; }, delay);
      b.onpointerdown = () => {
        if (state === 'wait') { state = 'done'; b.className = 'qd early'; b.textContent = 'TOO EARLY 😬'; T.after(() => done(99999), 900); }
        else if (state === 'go') { state = 'done'; const ms = Math.round(performance.now() - t0); b.textContent = `${ms} ms`; T.after(() => done(ms), 900); }
      };
      return () => T.clear();
    },
  },

  math: {
    name: 'Math Sprint', ic: 'hash', desc: 'First to solve 5 sums wins.',
    run(root, r, done) {
      const qs = Array.from({ length: 5 }, () => {
        const op = pick(['+', '−', '×'], r);
        let a, b;
        if (op === '×') { a = 2 + Math.floor(r() * 8); b = 2 + Math.floor(r() * 8); }
        else { a = 25 + Math.floor(r() * 70); b = 2 + Math.floor(r() * 20); }
        return { q: `${a} ${op} ${b}`, ans: String(op === '+' ? a + b : op === '−' ? a - b : a * b) };
      });
      let i = 0, cur = '';
      const start = performance.now();
      root.insertAdjacentHTML('beforeend', '<div class="mq"></div><div class="mm-cur single"></div>');
      const mq = $('.mq', root), ce = $('.mm-cur', root);
      const show = () => { mq.innerHTML = `<small>${i + 1}/5</small>${qs[i].q} = ?`; ce.textContent = cur || '_'; };
      root.appendChild(keypad((k) => {
        if (k === 'del') cur = cur.slice(0, -1);
        else if (k === 'ok') {
          if (cur === qs[i].ans) { i++; cur = ''; if (i >= 5) return done(Math.round(performance.now() - start)); pop(mq); }
          else { cur = ''; shake(ce); }
        } else if (cur.length < 4) cur += k;
        show();
      }));
      show();
      return timeBar(root, 60, () => done(999999));
    },
  },

  tug: {
    name: 'Tug of War', ic: 'zap', desc: 'Tap like your life depends on it. 8 seconds. Most taps wins.',
    run(root, r, done) {
      let n = 0, on = false, c = 3;
      root.insertAdjacentHTML('beforeend', '<button class="tap">3</button><div class="big-num n">0</div>');
      const b = $('.tap', root), num = $('.n', root); const T = timers();
      const iv = T.every(() => {
        c--;
        if (c > 0) b.textContent = c;
        else {
          clearInterval(iv);
          on = true; b.textContent = 'TAP TAP TAP!'; b.classList.add('go');
          T.after(() => { on = false; b.textContent = 'STOP'; b.classList.remove('go'); T.after(() => done(n), 700); }, 8000);
        }
      }, 700);
      b.onpointerdown = (e) => { e.preventDefault(); if (on) { n++; num.textContent = n; pop(num); } };
      return () => T.clear();
    },
  },

  memrace: {
    name: 'Memory Race', ic: 'cpu', desc: 'Same pattern for both. Whoever remembers longer wins.',
    run(root, r, done) {
      const s = simon(root, r, { target: 20, onWin: (l) => done(l), onFail: (l) => done(l) });
      const stop = timeBar(root, 120, () => done(s.level()));
      const c = () => { s.stop(); stop(); };
      c.level = () => s.level(); // live score, so the duel can end the moment you beat your opponent
      return c;
    },
  },

  hilo: {
    name: 'Higher or Lower', ic: 'activity', desc: 'Same cards for both. Guess if the next number is higher or lower. Longest streak wins.',
    run(root, r, done) {
      const deck = Array.from({ length: 40 }, () => 1 + Math.floor(r() * 13));
      let i = 0, streak = 0;
      root.insertAdjacentHTML('beforeend', '<div class="hl-card"></div><div class="row"><button class="btn hot hl-up">▲ HIGHER</button><button class="btn hl-dn">▼ LOWER</button></div><div class="big-num hl-s">0</div><p class="hint center">streak · equal counts as correct</p>');
      const card = $('.hl-card', root);
      const show = () => { card.textContent = deck[i]; pop(card); };
      const guess = (up) => {
        const a = deck[i], b = deck[i + 1];
        const ok = b === a || (up ? b > a : b < a);
        i++;
        if (!ok) { card.textContent = b; card.classList.add('bad'); return setTimeout(() => done(streak), 700); }
        streak++; $('.hl-s', root).textContent = streak;
        if (i >= deck.length - 1) return done(streak);
        show();
      };
      $('.hl-up', root).onclick = () => guess(true);
      $('.hl-dn', root).onclick = () => guess(false);
      show();
      const c = timeBar(root, 60, () => done(streak));
      c.level = () => streak;
      return c;
    },
  },

  rps: {
    name: 'Virus · Firewall · Patch', ic: 'shield', desc: 'Pick 3 moves in secret. Firewall blocks Virus, Virus infects Patch, Patch breaks Firewall. Best of 3.',
    run(root, r, done) {
      const MOVES = { v: ['🦠', 'VIRUS'], f: ['🧱', 'FIREWALL'], p: ['🩹', 'PATCH'] };
      let picks = '';
      root.insertAdjacentHTML('beforeend', '<p class="hint center">Choose your move for round <b class="rn">1</b> of 3 — your opponent can\'t see it.</p><div class="rps-picks"></div><div class="rps-opts">' + Object.entries(MOVES).map(([k, [e, n]]) => `<button class="rps" data-k="${k}"><span>${e}</span><b>${n}</b></button>`).join('') + '</div>');
      const show = () => { $('.rps-picks', root).innerHTML = [0, 1, 2].map((i) => `<span>${picks[i] ? MOVES[picks[i]][0] : '?'}</span>`).join(''); };
      root.querySelectorAll('.rps').forEach((b) => b.onclick = () => {
        picks += b.dataset.k; show();
        if (picks.length >= 3) return done(picks);
        $('.rn', root).textContent = picks.length + 1;
      });
      show();
      return timeBar(root, 30, () => done((picks + 'vfp').slice(0, 3)));
    },
  },

  coderace: {
    name: 'Code Race', ic: 'lock', desc: 'Same 3-digit code for both. Fastest crack wins.',
    run(root, r, done) {
      const code = shuffle('0123456789'.split(''), r).slice(0, 3).join('');
      const start = performance.now();
      mastermind(root, { digits: 3, code, maxTries: 10, onWin: () => done(Math.round(performance.now() - start)), onLose: () => done(999999) });
      return timeBar(root, 90, () => done(999999));
    },
  },
  // ----- v0.9 duels -----
  race67: {
    name: '67 Race', ic: 'binary', desc: 'The same 67 equation for both. Fastest to solve it wins.',
    run(root, r, done) {
      const start = performance.now();
      root.insertAdjacentHTML('beforeend', '<p class="hint center">Fill the blanks so it equals <b>67</b>! × goes before + and −.</p><div class="six-box"></div>');
      eq67($('.six-box', root), make67(r, true), () => done(Math.round(performance.now() - start)));
      return timeBar(root, 60, () => done(999999));
    },
  },

  quizrace: {
    name: 'Brainrot Quiz Race', ic: 'type', desc: 'The same 5 slang words for both. Most right answers wins — speed breaks a tie.',
    run(root, r, done) {
      const qs = shuffle(BRAINROT, r).slice(0, 5);
      let i = 0, right = 0, fin = false;
      const start = performance.now();
      root.insertAdjacentHTML('beforeend', '<p class="hint center">Word <b class="rn">1</b>/5</p><div class="br-box"></div>');
      const box = $('.br-box', root);
      const finish = () => { if (fin) return; fin = true; done(right * 1000 + Math.floor(Math.max(0, 30000 - (performance.now() - start)) / 100)); };
      const ask = () => { $('.rn', root).textContent = i + 1; slangQuestion(box, qs[i], r, (ok) => { if (ok) right++; if (++i >= qs.length) return finish(); ask(); }); };
      ask();
      const stop = timeBar(root, 30, finish);
      return () => { fin = true; stop(); };
    },
  },

  tungduel: {
    name: 'Tung Tung Survival', ic: 'alert', desc: 'The angry log chases you both. Whoever survives longer wins.',
    run(root, r, done) {
      return tungRun(root, { r, lives: 2, secs: 40, text: 'Drag your finger to run! 2 lives. Survive longer than your opponent.', onEnd: (ms) => done(ms) });
    },
  },

  shakeoff: {
    name: 'Shake Off', ic: 'zap', desc: 'Shake your phone as hard as you can for 20 seconds. Hold it TIGHT.',
    run(root, r, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint center">SHAKE IT! 📳 Hold your phone tight — 20 seconds.</p><div class="big-num so-n">0</div><div class="batt"><div></div><span>power</span></div><button class="btn big hot so-tap hidden">No shake sensor? TAP LIKE CRAZY</button>');
      const n = $('.so-n', root), fill = $('.batt div', root);
      let pts = 0, over = false;
      const add = (v) => { if (over) return; pts += v; n.textContent = Math.round(pts); fill.style.width = Math.min(100, pts / 8) + '%'; };
      const sens = shakeSensor((j) => { if (j >= 6) add(Math.min(j, 40) / 10); });
      const T = timers();
      T.after(() => { if (!sens.got()) $('.so-tap', root).classList.remove('hidden'); }, 2000);
      $('.so-tap', root).onpointerdown = (e) => { e.preventDefault(); add(1.5); };
      const stop = timeBar(root, 20, () => { over = true; sens.stop(); done(Math.round(pts)); });
      return () => { over = true; T.clear(); stop(); sens.stop(); };
    },
  },

  potato: {
    name: 'Hot Potato', ic: 'alert', desc: 'Pass the bomb! To pass it you must cut 3 wires first. Holding it when it explodes = you lose.',
    run(root, r, done, api) {
      root.insertAdjacentHTML('beforeend', '<div class="pot"><div class="pot-bomb">💣</div><div class="pot-status"></div><div class="pot-wires"></div><button class="btn big hot pot-pass" disabled>🔥 PASS IT!</button></div>');
      const pot = $('.pot', root), bomb = $('.pot-bomb', root), status = $('.pot-status', root), wires = $('.pot-wires', root), pass = $('.pot-pass', root);
      const T = timers();
      let since = null, cut = 0, passedAt = 0;
      const newWire = () => {
        wires.innerHTML = '';
        if (cut >= 3) { pass.disabled = false; status.textContent = '✂️ Wires cut — PASS IT!'; return; }
        const b = document.createElement('button');
        b.className = 'pot-wire'; b.textContent = '✂️';
        b.style.left = 6 + rnd() * 74 + '%'; b.style.top = 4 + rnd() * 70 + '%';
        b.onpointerdown = (e) => { e.preventDefault(); cut++; status.textContent = `✂️ Wire ${cut}/3 cut…`; newWire(); };
        wires.appendChild(b);
      };
      T.every(() => {
        const d = api?.get(); if (!d?.pot) return;
        const mine = d.pot.holder === api.me;
        pot.classList.toggle('mine', mine);
        if (mine && since !== d.pot.since) { since = d.pot.since; cut = 0; pass.disabled = true; status.textContent = '💣 YOU HAVE THE BOMB! Cut 3 wires!'; newWire(); }
        if (mine && cut >= 3 && pass.disabled && Date.now() - passedAt > 900) pass.disabled = false; // the pass didn't go through: try again
        if (!mine) { since = null; wires.innerHTML = ''; pass.disabled = true; status.textContent = `${api.otherName} has the bomb… 😈`; }
        const el = (api.now() - d.startAt) / 1000;
        bomb.style.animationDuration = Math.max(0.12, 0.9 - el * 0.025) + 's'; // ticks faster and faster
      }, 100);
      pass.onclick = () => { if (cut < 3) return; pass.disabled = true; passedAt = Date.now(); api.act({ type: 'potPass' }); };
      return () => T.clear();
    },
  },

  judge: {
    name: 'Aura Duel', ic: 'star', desc: 'A real-life aura challenge. A THIRD player is the judge and scans the winner\'s badge.',
    run(root, r, done, api) {
      const ch = pick(AURA_CHALLENGES, r);
      root.insertAdjacentHTML('beforeend', `<div class="judge"><small>BOTH OF YOU:</small><div class="judge-ch">${esc(ch)}</div><p class="hint center">Find a <b>third player</b> to be the judge. They watch you both, then scan the <b>winner's</b> badge with their SCAN button.</p><p class="hint center">No judge in 2 minutes = draw.</p>${api?.badge ? api.badge(170) : ''}</div>`);
      return () => {};
    },
  },
};
