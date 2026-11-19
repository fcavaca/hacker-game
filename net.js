// Networking. The HOST's phone runs the game engine; everyone else sends "actions" to it
// and receives the game "state" back.
//  - Local test mode: browser tabs on one device talk through a BroadcastChannel.
//  - Online mode (when firebase-config.js is filled in): phones talk through Firebase Realtime Database.

import { firebaseConfig } from './firebase-config.js?v=13';

export const ONLINE = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL);

export function connect(code, handlers) {
  return ONLINE ? connectFirebase(code, handlers) : connectLocal(code, handlers);
}

function connectLocal(code, { isHost, onState, onAction }) {
  const ch = new BroadcastChannel('hpg-' + code);
  let gotState = false;
  const waiters = [];
  ch.onmessage = (e) => {
    const m = e.data;
    if (isHost) {
      if (m.kind === 'action') onAction(m.from, m.action);
      else if (m.kind === 'ping') onAction(null, { type: '_ping' });
    } else if (m.kind === 'state') {
      gotState = true;
      waiters.splice(0).forEach((f) => f(true));
      onState(JSON.parse(m.s));
    }
  };
  return {
    sendAction: (from, action) => ch.postMessage({ kind: 'action', from, action }),
    publish: (s) => ch.postMessage({ kind: 'state', s }),
    exists: () => gotState ? Promise.resolve(true) : new Promise((res) => {
      waiters.push(res);
      ch.postMessage({ kind: 'ping' });
      setTimeout(() => res(gotState), 1500);
    }),
    close: () => ch.close(),
  };
}

async function connectFirebase(code, { isHost, onState, onAction }) {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const { initializeApp, getApps } = await import(base + 'firebase-app.js');
  const db = await import(base + 'firebase-database.js');
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const d = db.getDatabase(app);
  const stateRef = db.ref(d, `rooms/${code}/state`);
  const actRef = db.ref(d, `rooms/${code}/actions`);
  const offs = [];
  if (isHost) {
    offs.push(db.onChildAdded(actRef, (snap) => {
      const v = snap.val();
      db.remove(snap.ref);
      if (v && v.action) onAction(v.from, v.action);
    }));
  } else {
    offs.push(db.onValue(stateRef, (snap) => {
      const v = snap.val();
      if (v) onState(JSON.parse(v));
    }));
  }
  return {
    sendAction: (from, action) => db.push(actRef, { from, action, t: Date.now() }),
    publish: (s) => db.set(stateRef, s),
    exists: async () => (await db.get(stateRef)).exists(),
    close: () => offs.forEach((off) => off()),
  };
}
