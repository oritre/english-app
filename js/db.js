// IndexedDB wrapper, same shape as reading-practice-app's store.
const DB_NAME = 'english_app';
const DB_VERSION = 2;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        db.createObjectStore('profiles', { keyPath: 'id' });
        const progress = db.createObjectStore('progress', { keyPath: 'id' });
        progress.createIndex('profile_id', 'profile_id');
        const results = db.createObjectStore('results', { keyPath: 'id' });
        results.createIndex('profile_id', 'profile_id');
        const days = db.createObjectStore('days', { keyPath: 'id' });
        days.createIndex('profile_id', 'profile_id');
      }
      if (event.oldVersion < 2) {
        // One row per answer, for the progress report.
        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('profile_id', 'profile_id');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function os(name, mode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export const store = {
  async put(name, value) { return wrap((await os(name, 'readwrite')).put(value)); },
  async all(name) { return wrap((await os(name, 'readonly')).getAll()); },
  async get(name, id) { return wrap((await os(name, 'readonly')).get(id)); },
  async byIndex(name, index, value) { return wrap((await os(name, 'readonly')).index(index).getAll(value)); },
};

export function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
