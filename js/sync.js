// Optional sync between devices through Firebase Firestore, same model as
// reading-practice-app: every local write is mirrored to the cloud, and on
// load the cloud copy is pulled in. A family code groups the devices; anyone
// with the code shares the same learners.
//
// Best-effort by design: no config, no code or no network means the app just
// keeps working from IndexedDB on this device.

export const SYNC_STORES = ['profiles', 'progress', 'results', 'days', 'attempts'];
const CODE_KEY = 'english_app_family_code';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I
const SDK = '10.13.2';

let fs = null;
let fdb = null;
let initPromise = null;

export function getFamilyCode() {
  try { return localStorage.getItem(CODE_KEY); } catch { return null; }
}

export function setFamilyCode(code) {
  try { code ? localStorage.setItem(CODE_KEY, code) : localStorage.removeItem(CODE_KEY); } catch { /* storage blocked */ }
}

export function newFamilyCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function normalizeCode(text) {
  return String(text || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export async function syncConfigured() {
  try {
    const { firebaseConfig } = await import('./firebaseConfig.js');
    return !!firebaseConfig;
  } catch { return false; }
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { firebaseConfig } = await import('./firebaseConfig.js');
    if (!firebaseConfig) return null;
    const app = await import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`);
    fs = await import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-firestore.js`);
    fdb = fs.getFirestore(app.initializeApp(firebaseConfig));
    return fdb;
  })().catch((err) => {
    console.warn('Sync disabled: Firebase failed to load', err);
    return null;
  });
  return initPromise;
}

export async function mirrorWrite(storeName, record) {
  if (!SYNC_STORES.includes(storeName)) return;
  const code = getFamilyCode();
  if (!code) return;
  try {
    if (!(await init())) return;
    // Firestore rejects undefined fields; a JSON round-trip drops them.
    await fs.setDoc(fs.doc(fdb, 'families', code, storeName, String(record.id)), JSON.parse(JSON.stringify(record)));
  } catch (err) {
    console.warn('Sync: write stays on this device for now', err);
  }
}

// Firestore's free plan allows 50,000 reads a day, and every record fetched is
// a read. So a device fetches everything once a day, and in between only the
// records changed since the newest one it has seen (with an hour of overlap,
// since each device stamps updated_at with its own clock).
const SEEN_KEY = 'english_app_pull_seen';
const FULL_EVERY_MS = 24 * 3600 * 1000;
const OVERLAP_MS = 3600 * 1000;

function pullState(code) {
  try { const s = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); return s.code === code ? s : { code }; } catch { return { code }; }
}

// Pulls every synced store and keeps the newer copy of each record. Returns
// the number of records that changed locally, or null when sync is off.
export async function pullAll(store) {
  const code = getFamilyCode();
  if (!code) return null;
  if (!(await init())) return null;
  const state = pullState(code);
  const full = !state.full || Date.now() - state.full > FULL_EVERY_MS;
  let changed = 0;
  for (const name of SYNC_STORES) {
    const col = fs.collection(fdb, 'families', code, name);
    const since = !full && state[name] ? state[name] - OVERLAP_MS : 0;
    const snap = await fs.getDocs(since ? fs.query(col, fs.where('updated_at', '>=', since)) : col);
    for (const d of snap.docs) {
      const remote = d.data();
      state[name] = Math.max(state[name] || 0, remote.updated_at || 0);
      const local = await store.get(name, remote.id);
      if (!local || (remote.updated_at || 0) > (local.updated_at || 0)) {
        await store.putLocal(name, remote);
        changed++;
      }
    }
  }
  if (full) state.full = Date.now();
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  return changed;
}

// Pushes everything on this device, used when a device first joins a family.
export async function pushAll(store) {
  if (!getFamilyCode() || !(await init())) return 0;
  let n = 0;
  for (const name of SYNC_STORES) {
    for (const r of await store.all(name)) { await mirrorWrite(name, r); n++; }
  }
  return n;
}
