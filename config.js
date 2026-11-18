// Shared settings and lists used by both the host's game engine and the screens.

// Solo games (keys must match the SOLO object in games.js).
export const SOLO_IDS = ['password', 'decrypt', 'memory', 'packets', 'bugs', 'oddone', 'binary',
  'cipher', 'slider', 'terminal', 'filesort', 'captcha', 'spam', 'noise', 'colour',
  'dare', 'courier', 'handshake', 'whack', 'pwpick', 'vanish', 'quiet', 'mainframe', 'defender'];

// "Social" games: finished by scanning badges with other players (makes people move and talk).
export const SOCIAL_IDS = ['dare', 'courier', 'handshake', 'vanish'];

// Games that need the microphone or camera (some phones/laptops can't do them).
export const SENSOR_IDS = ['noise', 'colour', 'quiet'];

// Short games used for the emergency "you're being hacked" challenge and Dual Breach fixes.
export const EMERGENCY_IDS = ['decrypt', 'binary', 'oddone', 'packets', 'bugs', 'filesort', 'captcha', 'terminal', 'spam', 'mainframe'];

// Duel games and whether a LOW score (time) or HIGH score (count) wins. 'rps' is special (rock-paper-scissors).
export const DUEL_BETTER = { quickdraw: 'low', math: 'low', tug: 'high', memrace: 'high', coderace: 'low', hilo: 'high', rps: 'rps' };
export const DUEL_IDS = Object.keys(DUEL_BETTER);

// Every game happens somewhere: you have to walk there to play it.
export const ZONES = {
  house: ['Kitchen', 'Living room', 'Hallway', 'Bathroom door', 'Bedroom door', 'Front door', 'Balcony', 'Stairs'],
  dorm: ['Kitchen', 'Stairs', 'Hallway', 'Common room', 'Laundry room', 'Entrance', 'Bike shed', 'Another floor'],
  university: ['Cafeteria', 'Library entrance', 'Stairs', 'Vending machine', 'Main hall', 'Elevators', 'Toilets', 'Study area'],
  outside: ['Big tree', 'A bench', 'The gate', 'Bike rack', 'Corner of a building', 'Parking lot', 'Lamp post', 'Bus stop'],
};

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
  captain: { team: 'gamer', ic: 'crown', name: 'Pro Player', text: 'Your Vote Kick secretly counts DOUBLE. Use your power well.' },
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
  bugs: 'Bugs crawl around the box. Tap 15 of them before time runs out. They speed up!',
  oddone: 'A grid full of the same symbol — but ONE is slightly different (like O vs 0). Find it 4 times.',
  binary: 'Each switch has a value (32, 16, 8, 4, 2, 1). Turn switches ON so they add up to the target number. 4 rounds.',
  cipher: 'An alien word is written in weird symbols. Use the key below it (symbol = letter) to decode it and type the word.',
  slider: 'Slide the numbered tiles into the empty spot until they read 1 to 8 in order.',
  terminal: 'Type the command shown and press Run. Capitals and symbols don\'t matter — just the letters and numbers.',
  filesort: 'Files appear one by one: tap the right folder. Virus files (.exe, .bat…) go to Quarantine!',
  captcha: 'Prove you\'re human: tap every square that shows the thing asked, then Verify. 4 rounds.',
  spam: 'Messages arrive: decide if each one is SPAM (a scam) or LEGIT (a real message). 12 messages.',
  noise: 'Make noise into your microphone (shout, clap, sing) until the bar fills. Everyone will hear you!',
  colour: 'Point your camera at something of the asked colour so it fills the square, then tap Capture.',
  whack: 'People pop out of holes. Tap the HACKERS (black hoodie + mask). Don\'t tap your friends!',
  pwpick: 'Three passwords appear. Pick the strongest one (or the weakest, read the question!). 5 rounds.',
  quiet: 'Get AWAY from everyone and find a silent spot. Stay quiet for 15 seconds (you have 40) — talking or noise nearby stops the bar.',
  mainframe: 'Hack like in the movies: tap the keyboard as fast as you can to fill the bar. Close the ACCESS DENIED pop-ups fast!',
  defender: 'Viruses fly towards your core in the middle. Tap them before they hit it. Survive 30 seconds.',
};
