// Shared settings and lists used by both the host's game engine and the screens.

// Solo games (keys must match the SOLO object in games.js).
export const SOLO_IDS = ['password', 'decrypt', 'memory', 'packets', 'oddone', 'binary', 'cipher', 'slider', 'noise', 'colour',
  'dare', 'courier', 'handshake', 'whack', 'vanish', 'quiet', 'aura', 'sixseven', 'tungtung',
  'brainrot', 'sigma', 'fanum', 'shake', 'tilt', 'delulu', 'npc', 'groupchat', 'stop67', 'cooked', 'disco', 'unmute', 'capnocap', 'maze'];

// "Social" games: finished by scanning badges with other players (makes people move and talk).
export const SOCIAL_IDS = ['dare', 'courier', 'handshake', 'vanish'];

// Games that need the microphone, camera or motion sensors (some phones/laptops can't do them).
export const SENSOR_IDS = ['noise', 'colour', 'quiet', 'shake', 'tilt', 'unmute'];

// Short games used for the emergency "you're being hacked" challenge and Dual Breach fixes.
export const EMERGENCY_IDS = ['decrypt', 'binary', 'oddone', 'packets', 'sixseven', 'delulu', 'capnocap', 'groupchat', 'stop67', 'brainrot'];

// Duel games and whether a LOW score (time) or HIGH score (count) wins.
// Special: 'rps' (rock-paper-scissors), 'potato' (whoever holds the bomb when it explodes loses), 'judge' (a third player scans the winner).
export const DUEL_BETTER = { quickdraw: 'low', math: 'low', tug: 'high', memrace: 'high', coderace: 'low', hilo: 'high', rps: 'rps',
  race67: 'low', quizrace: 'high', tungduel: 'high', shakeoff: 'high', potato: 'potato', judge: 'judge' };
export const DUEL_IDS = Object.keys(DUEL_BETTER);

// Every game happens somewhere: you have to walk there to play it.
export const ZONES = {
  house: ['Kitchen', 'Living room', 'Hallway', 'Bathroom door', 'Bedroom door', 'Front door', 'Balcony', 'Stairs'],
  dorm: ['Kitchen', 'Stairs', 'Hallway', 'Common room', 'Laundry room', 'Entrance', 'Bike shed', 'Another floor'],
  university: ['Cafeteria', 'Library entrance', 'Stairs', 'Vending machine', 'Main hall', 'Elevators', 'Toilets', 'Study area'],
  outside: ['Big tree', 'A bench', 'The gate', 'Bike rack', 'Corner of a building', 'Parking lot', 'Lamp post', 'Bus stop'],
};
// v0.8: every game spot also gets a silly "how" — easy to check by anyone who walks past
export const SPOT_TWISTS = ['standing on one leg 🦩', 'sitting on the floor', 'with your back against a wall', 'where nobody can see your screen', 'next to something green',
  'touching a door handle', 'facing a window', 'next to a light switch', 'next to a plant (a dead one counts)', 'under a lamp', 'on a step or a chair', 'squatting like a frog 🐸',
  'next to something that makes noise', 'next to a mirror (check your aura)', 'in a corner, like a villain', 'as far from the host as possible'];

// How each place looks (the whole app changes colour) and what it says
export const PLACES = {
  house: { ic: 'home', name: 'House', vibe: 'Cozy chaos at home — warm lights, snacks, nowhere to hide.' },
  dorm: { ic: 'building', name: 'Dorm', vibe: 'Neon dorm night — hallways, kitchens and too many stairs.' },
  university: { ic: 'cap', name: 'University', vibe: 'Campus lockdown — big halls, long corridors, suspicious students.' },
  outside: { ic: 'tree', name: 'Outside', vibe: 'Night mission outdoors — trees, benches and street lights.' },
};

export const DARES = [
  'Do your best robot dance in front of someone for 10 seconds.',
  'Sing the chorus of any song to someone. Loud.',
  'Do 10 squats while someone counts out loud.',
  'Tell someone a joke until they groan.',
  'Talk like a pirate to someone for 20 seconds.',
  'Give someone a dramatic slow-motion high-five.',
  'Convince someone that you are secretly a robot.',
  'Do your best villain laugh at someone.',
  'Speak only in rhymes to someone for 3 sentences.',
  'Moonwalk past someone (badly is fine).',
  'Give someone a 10-second motivational speech about cleaning the kitchen.',
  'Do your best impression of the host. To their face.',
  'Narrate what someone is doing like a nature documentary for 15 seconds.',
  'Propose to someone with an imaginary ring. On one knee.',
  'Do 5 jumping jacks while making dinosaur noises.',
  'Explain to someone why pineapple on pizza is a crime.',
  'Walk like a penguin next to someone for 10 steps.',
  'Pretend to be a GPS and guide someone to the nearest door.',
];

// ---------------- ROLES ----------------
// team: gamer | hacker | npc. Players get a role at random from the ones the host switched ON.
export const ROLE_INFO = {
  gamer: { team: 'gamer', ic: 'gamepad', name: 'Gamer', text: 'Run around and smash your games to fill the Network bar before the timer hits zero. Win duels for bonus progress. Sniff out the Hackers and Vote Kick them!' },
  itguy: { team: 'gamer', ic: 'tool', name: 'IT Guy', text: 'Scan someone\'s badge — if they were hacked, you wipe the virus before they go AFK.' },
  firewall: { team: 'gamer', ic: 'shield', name: 'Firewall', text: 'Put a shield on someone (or yourself) by scanning their badge. The shield blocks the next hack on them.' },
  honeypot: { team: 'gamer', ic: 'zap', name: 'Catfish', text: 'You are a trap. The first Hacker who hacks you FAILS — and their phone starts screaming an alarm so everyone hears it.' },
  streamer: { team: 'gamer', ic: 'radio', name: 'Streamer', text: 'Go LIVE for 2 minutes. If anyone hacks you while you\'re live, everyone sees who did it.' },
  healer: { team: 'gamer', ic: 'star', name: 'Respawner', text: 'Revive an AFK player: find them and scan their AFK QR code with your Revive button.' },
  tank: { team: 'gamer', ic: 'shield', name: 'Tank', text: 'You survive the first hack on you. The Hacker thinks it worked… and you know someone is after you.' },
  scout: { team: 'gamer', ic: 'radio', name: 'Spidey Sense', text: 'You get a ping every time ANY hack happens. You don\'t know who or where — but you know when to call a Lobby.' },
  debugger: { team: 'gamer', ic: 'bug', name: 'Debugger', text: 'Pick a player: you learn if they won a duel in the last 3 minutes. (Hackers get remote hacks from duel wins…)' },
  captain: { team: 'gamer', ic: 'crown', name: 'Pro Player', text: 'You are the secret tie-breaker: if a Vote Kick ends in a TIE, the side you voted for wins. Nobody sees it was you.' },
  patcher: { team: 'gamer', ic: 'tool', name: 'Patcher', text: 'When the Hackers start a Dual Breach, you can fix it alone with one tap — and it adds +10% to the Network bar.' },
  clutch: { team: 'gamer', ic: 'trophy', name: 'Clutch', text: 'Once per game: if a Lobby starts while you\'re hacked, you DON\'T go AFK — and you find out who hacked you.' },
  hacker: { team: 'hacker', ic: 'skull', name: 'Hacker', text: 'Stay close to a Gamer for {hack} s (it adds up) to hack them silently — they drop {afk} s later. Win duels to earn remote hacks. Your games are fake, but play them so nobody gets suspicious.' },
  trojan: { team: 'hacker', ic: 'package', name: 'Malware', text: 'A Hacker with a trick: if you LOSE a duel against a Gamer, the winner gets hacked. Losing on purpose is allowed. 😈' },
  ddos: { team: 'hacker', ic: 'wifioff', name: 'DDoS', text: 'A Hacker who can freeze a player\'s phone for 60 seconds. No games, no duels, no scans.' },
  insider: { team: 'hacker', ic: 'eye', name: 'Trojan', text: 'You are on the Hackers\' team and know who they are, but you CAN\'T hack. Lie, protect them and vote with them.' },
  troll: { team: 'npc', ic: 'zap', name: 'Troll', text: 'You WIN if you get Vote Kicked. Act as suspicious as you can.' },
  bounty: { team: 'npc', ic: 'crosshair', name: 'Rage Baiter', text: 'You WIN if your secret target gets Vote Kicked. Bait everyone into blaming them.' },
  bug: { team: 'npc', ic: 'bug', name: 'Bug', text: 'Halfway through the game your role GLITCHES into a random new one — maybe even a Hacker. Survive until then.' },
  ragequit: { team: 'npc', ic: 'alert', name: 'Rage Quitter', text: 'You WIN if you get hacked in the first 10 minutes. If you survive that long, you become a normal Gamer.' },
  fanboy: { team: 'npc', ic: 'star', name: 'Fanboy', text: 'Pick your idol (Me tab). You WIN if your idol\'s team wins the game.' },
};
export const GAMER_ROLES = ['itguy', 'firewall', 'honeypot', 'streamer', 'healer', 'tank', 'scout', 'debugger', 'captain', 'patcher', 'clutch'];
export const HACKER_ROLES = ['trojan', 'ddos', 'insider'];
export const NPC_ROLES = ['troll', 'bounty', 'bug', 'ragequit', 'fanboy'];
export const ALL_SPECIAL = [...GAMER_ROLES, ...HACKER_ROLES, ...NPC_ROLES];

export const MODIFIERS = {
  vpn: { ic: 'lock', name: 'VPN', text: 'IT Guy scans and Debugger checks on you fail ("VPN detected").' },
  nointernet: { ic: 'wifioff', name: 'No Internet', text: 'You can\'t report AFK players.' },
  lowbattery: { ic: 'clock', name: 'Low Battery', text: 'Your role power has half the uses / double the cooldown.' },
  noob: { ic: 'gamepad', name: 'Noob', text: 'Duels are harder for you — but a Hacker who beats you gets no remote hack.' },
};

// default chance (%) that each special role appears in a game (host changes it from 0% to 100%)
const CHANCE = { itguy: 100 }; // every other role: 20%

export const DEFAULT_SETTINGS = {
  place: 'house',
  hackers: 1,
  timerMin: 25,
  gamesPerPlayer: 8,
  hackSec: 60,         // close hack: seconds near the victim in total
  afkDelay: 60,        // seconds between being hacked and going AFK
  itScans: 4,
  powerCd: 5,          // minutes between uses of role powers
  cooldownSec: 30,     // wait between games
  penaltySec: 120,     // no games after failing/refusing
  gatherSec: 60,
  talkSec: 120,
  voteSec: 60,
  reveal: 'team',
  hackersKnow: true,
  keyMoveMin: 5,
  meetMax: 2,          // how many Lobbies each player can call with the key per game
  walkSteps: 15,       // steps to walk before each game unlocks (0 = off)
  duelTimeout: 90,
  forcedDuelMin: 4,    // every X minutes two random players are forced into a duel (2–10)
  npcs: 1,             // max NPC players (only with 5+ players)
  events: 'rare',      // off | rare | normal
  sabotage: true,
  modifiers: true,
  ...Object.fromEntries(ALL_SPECIAL.map((r) => ['r_' + r, CHANCE[r] ?? 20])),
};

// Host settings screen. step = + / − buttons, toggle = switch, seg = choose one, roles = role chips.
export const SETTINGS_UI = [
  { head: 'Game' },
  { k: 'place', label: 'Place', type: 'seg', opts: [['house', 'House'], ['dorm', 'Dorm'], ['university', 'Uni'], ['outside', 'Outside']] },
  { k: 'timerMin', label: 'Game timer', type: 'step', min: 5, max: 45, step: 5, unit: 'min' },
  { k: 'gamesPerPlayer', label: 'Games per player', type: 'step', min: 4, max: 14, step: 2 },
  { k: 'forcedDuelMin', label: 'Forced duel every', type: 'step', min: 2, max: 10, step: 1, unit: 'min' },
  { k: 'walkSteps', label: 'Steps to walk before each game', type: 'step', min: 0, max: 40, step: 5, zero: 'Off', hint: 'The phone counts your steps before a game unlocks, so people really spread out. 0 = off.' },
  { head: 'Hackers' },
  { k: 'hackers', label: 'Number of Hackers', type: 'step', min: 1, max: 3, step: 1 },
  { k: 'hackSec', label: 'Close hack time', type: 'step', min: 10, max: 120, step: 10, unit: 's' },
  { k: 'hackersKnow', label: 'Hackers know each other', type: 'toggle' },
  { k: 'sabotage', label: 'Hacker sabotages', type: 'toggle' },
  { head: 'Roles' },
  { type: 'rolesbtn' },
  { k: 'npcs', label: 'Max NPCs (play for themselves)', type: 'step', min: 0, max: 2, step: 1 },
  { k: 'itScans', label: 'IT Guy scans', type: 'step', min: 1, max: 8, step: 1 },
  { k: 'powerCd', label: 'Role power cooldown', type: 'step', min: 2, max: 10, step: 1, unit: 'min' },
  { head: 'Chaos' },
  { k: 'events', label: 'Random events', type: 'seg', opts: [['off', 'Off'], ['rare', 'Rare'], ['normal', 'Often']], hint: 'Rare = about every 7–10 min · Often = about every 4–6 min. Never in the first 5 minutes.' },
  { k: 'modifiers', label: 'Modifiers (VPN, Noob…)', type: 'toggle' },
  { head: 'Lobby' },
  { k: 'meetMax', label: 'Key Lobbies per player', type: 'step', min: 1, max: 3, step: 1, hint: 'How many times each player can call a Lobby with the key in one game. After that, the key still moves to you — but it does nothing.' },
  { k: 'gatherSec', label: 'Time to reach the Lobby', type: 'step', min: 10, max: 120, step: 10, unit: 's' },
  { k: 'talkSec', label: 'Lobby talk time', type: 'step', min: 20, max: 300, step: 20, unit: 'time' },
  { k: 'voteSec', label: 'Lobby vote time', type: 'step', min: 20, max: 180, step: 10, unit: 's' },
  { k: 'reveal', label: 'When someone is kicked, show', type: 'seg', opts: [['none', 'Nothing'], ['team', 'Team'], ['role', 'Role']] },
];

// How each solo game is played (shown before the game starts).
export const HOW = {
  password: 'Guess the secret 4-digit code. After each guess the colours tell you: green = right digit in the right spot, yellow = right digit wrong spot, grey = not in the code.',
  decrypt: 'Tap the scrambled letters in the right order to spell the hacker word. Do it twice.',
  memory: 'Watch the buttons light up, then repeat the pattern. It gets longer every round — reach level 6.',
  packets: 'Squares pop up: tap the GREEN ones (gold = +3). Never tap RED ones — 3 reds and you fail.',
  oddone: 'A grid full of the same emoji — but ONE is sus: a near-twin, or flipped, turned or bigger. Read the hint and find it. 4 rounds.',
  brainrot: 'A slang word appears. Pick what it really means out of 3. 8 words, 6 seconds each, 2 mistakes allowed.',
  sigma: 'The 4 AM sigma routine shows for a few seconds. Then tap the steps back in the right order. 3 rounds (4, 5, 6 steps).',
  fanum: 'Thief hands sneak in to steal your snacks — tap them to slap them away. A green sleeve is a friend bringing a snack: don\'t slap it! Survive 30 s.',
  shake: 'Shake your phone to charge the battery, but ONLY when it says SHAKE. On STOP, freeze — shaking then drains the battery. Fill it to 100%.',
  tilt: 'Tilt your phone to roll the ball into the wifi symbol. Lag holes send you back to the start. 2 levels, 3 lives.',
  delulu: 'Read each message: is it a REAL thought or pure DELULU? 10 messages, 2 mistakes allowed.',
  npc: 'Characters walk around randomly. ONE is an NPC walking in a perfect square loop. Tap it! 3 rounds, 2 mistakes allowed.',
  groupchat: 'Messages fly in and disappear. Tap ONLY the ones from your real Mom (fake "Moms" are scams!). Get 8 — 3 wrong taps and you fail.',
  stop67: 'A loading bar races from 0 to 100%. Tap STOP when it shows exactly 67% (66–68 counts). Do it 3 times — it gets faster.',
  cooked: 'Burgers cook on 4 grills. Tap each one when it turns GOLDEN. Raw or burnt = a mistake. Flip 8 perfect ones, 3 mistakes max.',
  disco: 'Turn your sound on. Tap the button exactly on every beat. 16 beats — hit 11 to pass.',
  unmute: 'Stay quiet while you\'re muted. When it says SAY IT NOW, shout within 1.5 s. 5 shouts to win — talking while muted or being too slow is a mistake (2 allowed).',
  capnocap: 'A weird fact appears. Is it a lie (CAP 🧢) or true (NO CAP)? 8 facts, 2 mistakes allowed.',
  maze: 'Put your finger on START and drag along the glowing path to the flag without lifting it or touching a wall. 2 mazes.',
  binary: 'Each switch has a value (32, 16, 8, 4, 2, 1). Turn switches ON so they add up to the target number. 4 rounds.',
  cipher: 'Two alien words are written in weird symbols. Use the key below (symbol = letter) to decode them. Watch out: some symbols have a MIRRORED twin that means a different letter. 3 tries.',
  aura: 'A needle swings across a bar. Tap FARM when it\'s inside the green AURA ZONE (middle = double). Missing costs aura. Reach 1000 aura before time runs out.',
  sixseven: 'An equation with blanks. Tap number tiles to fill them so the answer is 67. × is done before + and −. 3 rounds.',
  tungtung: 'An angry wooden log with a bat chases you. Drag your finger to run away. When TUNG TUNG TUNG appears, he dashes! Survive 25 seconds with 3 lives.',
  slider: 'Slide the numbered tiles into the empty spot until they read 1 to 8 in order.',
  noise: 'Make noise into your microphone (shout, clap, sing) until the bar fills. Everyone will hear you!',
  colour: 'Point your camera at something of the asked colour so it fills the square, then tap Capture.',
  whack: 'People pop out of holes. Tap the HACKERS (black hoodie + mask). Don\'t tap your friends!',
  quiet: 'Get AWAY from everyone and find a silent spot. Stay quiet for 15 seconds (you have 40) — talking or noise nearby stops the bar.',
};
