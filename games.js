// MINI-GAMES.
// Solo game: run(root, done) -> cleanup function. done(true) = win, done(false) = fail,
//            done('skip') = this phone can't do it (no mic / camera).
// Duel game: run(root, rand, done) -> cleanup. rand() is shared so both players get the SAME challenge.
//            Call done(score).

import { avatarSVG, randomAvatar } from './avatar.js?v=11';

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
const ODD_PAIRS = [['O', '0'], ['l', '1'], ['S', '5'], ['B', '8'], ['Z', '2'], ['E', 'F'], ['M', 'N'], ['6', '9'], ['b', 'd'], ['q', 'p'], ['u', 'v'], ['C', 'G']];
const CIPHER_WORDS = ['HACKER', 'NOOB', 'PING', 'LOBBY', 'GLITCH', 'VIRUS', 'PATCH', 'ADMIN', 'LOGIN', 'WIFI', 'AFK', 'LAGGING', 'TOUCHGRASS', 'SUS', 'GGWP'];
const COMMANDS = ['sudo make me a sandwich', 'rm -rf /homework', 'ping mom.home', 'git commit -m "fixed everything"', 'npm install friends',
  'chmod 777 my_life', 'kill -9 monday', 'ssh admin@fridge', 'apt install motivation', 'cat secrets.txt | grep crush', 'sudo reboot --now', 'shutdown -h never'];
const FOLDERS = [
  { k: 'img', n: 'Images', ext: ['png', 'jpg', 'gif'] }, { k: 'music', n: 'Music', ext: ['mp3', 'wav'] },
  { k: 'docs', n: 'Docs', ext: ['pdf', 'docx', 'txt'] }, { k: 'virus', n: '☣ Quarantine', ext: ['exe', 'bat', 'scr'] },
];
const FILE_NAMES = {
  img: ['ugly_selfie', 'meme_v3', 'cat_in_box', 'screenshot_final', 'party_evidence'],
  music: ['lofi_beats', 'shower_song', 'rage_playlist', 'ringtone_2009'],
  docs: ['exam_notes', 'cv_FINAL_final', 'homework_copy', 'secret_diary', 'budget'],
  virus: ['free_vbucks', 'totally_not_a_virus', 'hot_singles', 'antivirus_real', 'click_me'],
};
const CAPTCHAS = [
  { t: '🤖', n: 'robots. Be honest.', d: ['🧑', '👩', '🐶', '🧔', '👵', '🐱'] },
  { t: '🍕', n: 'pizza. Pineapple does NOT count.', d: ['🍍', '🌮', '🍟', '🥗', '🍩', '🌭'] },
  { t: '🚦', n: 'traffic lights (classic)', d: ['🚗', '🚲', '🛴', '🚌', '🏍️', '🛵'] },
  { t: '🐈', n: 'cats. Dogs are not cats.', d: ['🐕', '🐇', '🐹', '🦊', '🐻', '🐼'] },
  { t: '🦆', n: 'ducks. Why? Don\'t ask.', d: ['🐔', '🐧', '🦢', '🦉', '🐦', '🦩'] },
];
const SPAM = ['🎉 You WON a free iPhone 17! Click here', 'Your Netflix will EXPLODE unless you log in now', 'Hot singles in your dorm want to meet you',
  'A prince needs your bank details (urgent)', 'Your package is stuck. Pay 1 kr to release it', 'CONGRATS visitor #1,000,000!!!',
  'Your PC has 47 viruses. Download CleanerPro.exe', 'Crypto: 10000% guaranteed profit 🚀🚀', 'Mom (new number): send me your password pls',
  'Your password expires today — type it here', 'You have (1) unclaimed V-Bucks gift 🎁'];
const LEGIT = ['Mom: dinner is ready', 'Lecturer: the exam room moved to U45', 'Ana: are you coming to the party?', 'Bank: card used at Netto, 54 kr',
  'Jonas: bro where are you', 'Dorm: laundry room closed on Friday', 'Mia: can I borrow your charger?', 'Library: your book is due tomorrow',
  'Group chat: who stole my yoghurt??', 'Coach: training at 18:00'];
const COLOURS = [
  { n: 'RED', c: '#ff3b5c', test: (h, s, v) => s > 0.4 && v > 0.25 && (h < 18 || h > 335) },
  { n: 'BLUE', c: '#3b8bff', test: (h, s, v) => s > 0.35 && v > 0.2 && h > 195 && h < 255 },
  { n: 'GREEN', c: '#2ee88f', test: (h, s, v) => s > 0.3 && v > 0.2 && h > 85 && h < 165 },
  { n: 'YELLOW', c: '#ffd400', test: (h, s, v) => s > 0.4 && v > 0.4 && h > 42 && h < 70 },
];

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
      root.insertAdjacentHTML('beforeend', '<p class="hint">Word <b class="wn">1</b> of 2 — tap the letters in the right order.</p><div class="answer"></div><div class="tiles"></div><button class="btn small ghost clr">Clear</button>');
      const ans = $('.answer', root), tiles = $('.tiles', root);
      let w, letters, typed, used;
      function newWord() {
        w = pick(WORDS);
        letters = shuffle(w.split(''));
        while (letters.join('') === w) letters = shuffle(w.split(''));
        typed = ''; used = new Set(); draw();
      }
      function draw() {
        ans.innerHTML = w.split('').map((_, i) => `<span>${typed[i] ?? ''}</span>`).join('');
        tiles.innerHTML = '';
        letters.forEach((c, i) => {
          const b = document.createElement('button');
          b.className = 'tile'; b.textContent = c; b.disabled = used.has(i);
          b.onclick = () => {
            used.add(i); typed += c;
            if (typed.length === w.length) {
              if (typed === w) { solved++; if (solved >= 2) return done(true); $('.wn', root).textContent = 2; pop(ans); return newWord(); }
              typed = ''; used.clear(); shake(ans);
            }
            draw();
          };
          tiles.appendChild(b);
        });
      }
      $('.clr', root).onclick = () => { typed = ''; used.clear(); draw(); };
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

  bugs: {
    name: 'Bug Squash', ic: 'bug', tag: 'Squash 15 bugs',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Squash 15 bugs. They get faster. They get angrier.</p><div class="arena"></div><div class="scorebar"><span class="sg">0/15</span></div>');
      const ar = $('.arena', root);
      let n = 0; const bugs = []; const T = timers();
      function spawn() {
        const sp = 1.4 + n * 0.12;
        const b = { x: rnd() * 85, y: rnd() * 80, vx: (rnd() - 0.5) * sp * 2, vy: (rnd() - 0.5) * sp * 2, el: document.createElement('button') };
        b.el.className = 'bug';
        b.el.innerHTML = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="5" ry="7" fill="#7dff4d" stroke="#05080a" stroke-width="1.5"/><circle cx="12" cy="6" r="3" fill="#05080a"/><path d="M7 10L3 8M7 14H3M7 18l-4 2M17 10l4-2M17 14h4M17 18l4 2M10 4L8 1M14 4l2-3" stroke="#7dff4d" stroke-width="1.5" stroke-linecap="round"/></svg>';
        b.el.onpointerdown = () => {
          b.el.classList.add('splat'); setTimeout(() => b.el.remove(), 200);
          bugs.splice(bugs.indexOf(b), 1); n++;
          $('.sg', root).textContent = `${n}/15`;
          if (n >= 15) return done(true);
          spawn();
        };
        ar.appendChild(b.el); bugs.push(b);
      }
      for (let i = 0; i < 4; i++) spawn();
      T.every(() => {
        for (const b of bugs) {
          b.x += b.vx; b.y += b.vy;
          if (b.x < 0 || b.x > 88) b.vx *= -1;
          if (b.y < 0 || b.y > 84) b.vy *= -1;
          if (rnd() < 0.02) { b.vx = (rnd() - 0.5) * 3; b.vy = (rnd() - 0.5) * 3; }
          b.el.style.left = b.x + '%'; b.el.style.top = b.y + '%';
        }
      }, 40);
      const stop = timeBar(root, 40, () => done(false));
      return () => { T.clear(); stop(); };
    },
  },

  oddone: {
    name: 'Odd One Out', ic: 'eye', tag: 'Spot the impostor symbol',
    run(root, done) {
      let round = 0, miss = 0;
      root.insertAdjacentHTML('beforeend', '<p class="hint">Find the ONE symbol that\'s different. Round <b class="rn">1</b>/4 · 3 mistakes max</p><div class="gridx"></div>');
      const g = $('.gridx', root);
      function draw() {
        const size = round < 2 ? 6 : 7;
        const [a, b] = shuffle(pick(ODD_PAIRS));
        const odd = Math.floor(rnd() * size * size);
        g.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        g.innerHTML = '';
        for (let i = 0; i < size * size; i++) {
          const c = document.createElement('button');
          c.className = 'cell'; c.textContent = i === odd ? b : a;
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
      const w = pick(CIPHER_WORDS);
      const letters = [...new Set(w.split(''))];
      const decoys = shuffle('ABCDEFGHIJKLMNOPRSTUVWY'.split('').filter((c) => !letters.includes(c))).slice(0, 7);
      const legend = shuffle([...letters, ...decoys]);
      const map = {}, seen = new Set();
      for (const c of legend) { let g; do { g = glyph(rnd); } while (seen.has(g.key)); seen.add(g.key); map[c] = g.svg; }
      root.insertAdjacentHTML('beforeend', `<p class="hint">An alien sent a secret word. Use the key to decode it.</p><div class="cipher">${w.split('').map((c) => map[c]).join('')}</div><div class="legend">${legend.map((c) => `<span>${map[c]}<b>${c}</b></span>`).join('')}</div><input class="inp" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Type the word"><button class="btn ok-btn">Decode</button>`);
      const inp = $('.inp', root);
      const check = () => { if (normalize(inp.value) === w.toLowerCase()) done(true); else shake(inp); };
      $('.ok-btn', root).onclick = check;
      inp.onkeydown = (e) => { if (e.key === 'Enter') check(); };
      return timeBar(root, 75, () => done(false));
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

  terminal: {
    name: 'Terminal', ic: 'terminal', tag: 'Type a command like a pro',
    run(root, done) {
      const c = pick(COMMANDS);
      root.insertAdjacentHTML('beforeend', '<p class="hint">Type the command after the <b>$</b> and press Run. Capitals and symbols don\'t matter.</p><div class="term"><span class="prompt">root@lobby:~$</span> <span class="cmd"></span><span class="caret">█</span></div><input class="inp mono" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="type here…"><button class="btn ok-btn">Run ⏎</button>');
      const inp = $('.inp', root);
      $('.cmd', root).textContent = c;
      // only letters and numbers count (some phone keyboards hide symbols), and typing the prompt too is fine
      const letters = (s) => s.toLowerCase().replace(/^.*\$/, '').replace(/[^a-z0-9]/g, '');
      const check = () => { if (letters(inp.value) === letters(c)) done(true); else shake(inp); };
      $('.ok-btn', root).onclick = check;
      inp.onkeydown = (e) => { if (e.key === 'Enter') check(); };
      return timeBar(root, 30, () => done(false));
    },
  },

  filesort: {
    name: 'File Sort', ic: 'folder', tag: 'Sort files, catch the viruses',
    run(root, done) {
      let n = 0, bad = 0, cur = '';
      root.insertAdjacentHTML('beforeend', `<p class="hint">Sort 14 files. Viruses go to Quarantine! Max 2 mistakes.</p><div class="file"></div><div class="folders">${FOLDERS.map((f) => `<button class="btn folder ${f.k}" data-k="${f.k}">${f.n}</button>`).join('')}</div><div class="scorebar"><span class="sg"></span><span class="sr"></span></div>`);
      const fileEl = $('.file', root);
      const next = () => {
        const f = pick(FOLDERS); cur = f.k;
        fileEl.textContent = `${pick(FILE_NAMES[f.k])}.${pick(f.ext)}`; pop(fileEl);
        $('.sg', root).textContent = `${n}/14`; $('.sr', root).textContent = '♥'.repeat(3 - bad) + '♡'.repeat(bad);
      };
      root.querySelectorAll('.folder').forEach((b) => b.onclick = () => {
        if (b.dataset.k === cur) { n++; if (n >= 14) return done(true); }
        else { bad++; shake(fileEl); if (bad > 2) return done(false); }
        next();
      });
      next();
      return timeBar(root, 55, () => done(false));
    },
  },

  captcha: {
    name: 'Captcha', ic: 'robot', tag: 'Prove you\'re not a robot',
    run(root, done) {
      let round = 0, ans = new Set(), sel = new Set();
      root.insertAdjacentHTML('beforeend', '<div class="cap-head"><small>Select all squares with</small><b class="q"></b></div><div class="grid3"></div><button class="btn ok-btn">Verify</button><p class="hint center">Round <b class="rn">1</b>/4 · I\'m not a robot™</p>');
      const q = $('.q', root), g = $('.grid3', root);
      function draw() {
        const c = pick(CAPTCHAS);
        const k = 2 + Math.floor(rnd() * 3);
        const cells = shuffle([...Array(k).fill(c.t), ...Array.from({ length: 9 - k }, () => pick(c.d))]);
        ans = new Set(cells.map((v, i) => v === c.t ? i : -1).filter((i) => i >= 0));
        sel = new Set();
        q.textContent = c.n;
        g.innerHTML = '';
        cells.forEach((v, i) => {
          const b = document.createElement('button');
          b.className = 'cell big'; b.textContent = v;
          b.onclick = () => { if (sel.has(i)) sel.delete(i); else sel.add(i); b.classList.toggle('sel'); };
          g.appendChild(b);
        });
      }
      $('.ok-btn', root).onclick = () => {
        const ok = sel.size === ans.size && [...sel].every((i) => ans.has(i));
        if (ok) { round++; if (round >= 4) return done(true); $('.rn', root).textContent = round + 1; draw(); }
        else { q.textContent = '🤖 Suspicious… try again.'; shake(g); setTimeout(draw, 700); }
      };
      draw();
      return timeBar(root, 60, () => done(false));
    },
  },

  spam: {
    name: 'Spam Filter', ic: 'mail', tag: 'Spam or legit? Decide fast',
    run(root, done) {
      let n = 0, bad = 0, isSpam = false;
      root.insertAdjacentHTML('beforeend', '<p class="hint">Sort 12 messages. One wrong click on a scam and… you know. 2 mistakes max.</p><div class="msg-card"><small class="from">New message</small><div class="mtext"></div></div><div class="row"><button class="btn danger sp-spam">🚫 SPAM</button><button class="btn sp-ok">✅ LEGIT</button></div><div class="scorebar"><span class="sg"></span><span class="sr"></span></div>');
      const card = $('.msg-card', root);
      const used = new Set();
      const next = () => {
        isSpam = rnd() < 0.5;
        const pool = (isSpam ? SPAM : LEGIT).filter((m) => !used.has(m));
        const m = pick(pool.length ? pool : (isSpam ? SPAM : LEGIT)); used.add(m);
        $('.mtext', root).textContent = m; pop(card);
        $('.sg', root).textContent = `${n}/12`; $('.sr', root).textContent = '♥'.repeat(3 - bad) + '♡'.repeat(bad);
      };
      const answer = (saysSpam) => {
        if (saysSpam === isSpam) { n++; if (n >= 12) return done(true); }
        else { bad++; shake(card); if (bad > 2) return done(false); }
        next();
      };
      $('.sp-spam', root).onclick = () => answer(true);
      $('.sp-ok', root).onclick = () => answer(false);
      next();
      return timeBar(root, 55, () => done(false));
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

  mainframe: {
    name: 'Hack the Mainframe', ic: 'terminal', tag: 'Smash keys like a movie hacker',
    run(root, done) {
      const CODE = ['bypass_firewall(0x1F);', 'inject --payload=pizza', 'decrypt(mainframe.key)', 'sudo rm -rf /lobby/rules', 'while(true){ hack(); }', 'upload virus.exe', 'override SECURITY_LEVEL=0', 'ping 127.0.0.1 -t', 'download more RAM', 'enhance(); enhance(); ENHANCE();', 'grant_admin("me")', 'disable(cameras)'];
      let pct = 0, blocked = 0; const T = timers();
      root.insertAdjacentHTML('beforeend', '<div class="mf-screen"><div class="mf-lines"></div><div class="mf-pop hidden"><b>ACCESS DENIED</b><button class="btn danger small mf-x">CLOSE ✕</button></div></div><div class="hn-bar mf-bar"><div style="width:0%"></div></div><div class="mf-keys">' + 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').map((k) => `<button class="mfk">${k}</button>`).join('') + '</div>');
      const lines = $('.mf-lines', root), bar = $('.mf-bar div', root), pop = $('.mf-pop', root);
      const add = () => {
        if (!pop.classList.contains('hidden')) { blocked++; shake(pop); return; }
        pct = Math.min(100, pct + 1.4);
        bar.style.width = pct + '%';
        const l = document.createElement('div'); l.textContent = '> ' + pick(CODE); lines.appendChild(l);
        while (lines.children.length > 7) lines.firstChild.remove();
        if (pct >= 100) return done(true);
      };
      root.querySelectorAll('.mfk').forEach((k) => k.onpointerdown = (e) => { e.preventDefault(); k.classList.remove('hit'); void k.offsetWidth; k.classList.add('hit'); add(); });
      $('.mf-x', root).onclick = () => pop.classList.add('hidden');
      T.every(() => { if (rnd() < 0.5 && pop.classList.contains('hidden')) { pop.classList.remove('hidden'); pop.style.top = 10 + rnd() * 40 + '%'; } }, 2200);
      const stop = timeBar(root, 40, () => done(false));
      return () => { T.clear(); stop(); };
    },
  },

  defender: {
    name: 'Firewall Defender', ic: 'shield', tag: 'Protect the core from viruses',
    run(root, done) {
      root.insertAdjacentHTML('beforeend', '<p class="hint">Tap the viruses before they reach the core! Survive 30 seconds. The core has 3 lives.</p><div class="arena def"><div class="core">CORE</div></div><div class="scorebar"><span class="sg">0 zapped</span><span class="sr">♥♥♥</span></div>');
      const ar = $('.arena', root), core = $('.core', root);
      let lives = 3, zapped = 0, over = false; const T = timers(); const vs = [];
      const start = Date.now();
      function spawn() {
        const ang = rnd() * Math.PI * 2;
        const v = { a: ang, r: 1, sp: 0.006 + rnd() * 0.004 + (Date.now() - start) / 3e6, el: document.createElement('button') };
        v.el.className = 'virus';
        v.el.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="#ff2d55"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" stroke="#ff2d55" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="11" r="1.3" fill="#fff"/><circle cx="14" cy="11" r="1.3" fill="#fff"/></svg>';
        v.el.onpointerdown = () => { v.el.classList.add('splat'); setTimeout(() => v.el.remove(), 200); vs.splice(vs.indexOf(v), 1); zapped++; $('.sg', root).textContent = `${zapped} zapped`; };
        ar.appendChild(v.el); vs.push(v);
      }
      T.every(spawn, 650);
      T.every(() => {
        if (over) return;
        for (const v of [...vs]) {
          v.r -= v.sp;
          v.el.style.left = 50 + Math.cos(v.a) * v.r * 46 + '%';
          v.el.style.top = 50 + Math.sin(v.a) * v.r * 44 + '%';
          if (v.r <= 0.08) {
            v.el.remove(); vs.splice(vs.indexOf(v), 1); lives--;
            core.classList.remove('hit'); void core.offsetWidth; core.classList.add('hit');
            $('.sr', root).textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(3 - Math.max(0, lives));
            if (lives <= 0) { over = true; return done(false); }
          }
        }
      }, 30);
      const stop = timeBar(root, 30, () => { over = true; done(true); });
      return () => { T.clear(); stop(); };
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

  pwpick: {
    name: 'Password Picker', ic: 'lock', tag: 'Which password survives?',
    run(root, done) {
      const WEAK = ['password123', 'qwerty', 'ilovepizza', '123456', 'letmein', 'admin', 'monkey', 'iloveyou', 'football1', 'MyDogsName', 'summer2026', 'abc123', 'pa$$word'];
      const STRONG = ['v7#Qp!2zLm9$', 'Tr0mb0ne!Pizza#42', 'correct-horse-battery-staple-99', 'X9!kd#2Lp@qz', 'Sp@ghetti_Volcano_7!', 'm3!Rk#Zq8&Wp', 'Purple-Cactus-Dances-2187!'];
      let round = 0, miss = 0, answer = '';
      root.insertAdjacentHTML('beforeend', '<div class="pw-q"></div><div class="pw-opts"></div><p class="hint center">Round <b class="rn">1</b>/5 · 1 mistake allowed</p>');
      const q = $('.pw-q', root), opts = $('.pw-opts', root);
      function draw() {
        const askStrong = rnd() < 0.65;
        const list = askStrong ? [pick(STRONG), ...shuffle(WEAK).slice(0, 2)] : [pick(WEAK), ...shuffle(STRONG).slice(0, 2)];
        answer = list[0];
        q.innerHTML = askStrong ? 'Which password is the <b class="g">STRONGEST</b>?' : 'Which password gets hacked <b class="r">FIRST</b>?';
        opts.innerHTML = '';
        for (const pw of shuffle(list)) {
          const b = document.createElement('button');
          b.className = 'btn pw'; b.textContent = pw;
          b.onclick = () => {
            if (pw === answer) { b.classList.add('right'); round++; if (round >= 5) return done(true); $('.rn', root).textContent = round + 1; setTimeout(draw, 350); }
            else { b.classList.add('wrong'); miss++; if (miss > 1) return done(false); setTimeout(draw, 500); }
          };
          opts.appendChild(b);
        }
      }
      draw();
      return timeBar(root, 45, () => done(false));
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
};
