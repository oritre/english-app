// App shell is cache-first; course data and the Firebase config are network-first
// so new lessons (or turning sync on) show up as soon as they're deployed, and
// still work offline afterwards.
const CACHE_NAME = 'english-app-v17';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/check.js', './js/course.js', './js/dates.js', './js/db.js',
  './js/progress.js', './js/placement.js', './js/league.js', './js/report.js', './js/grammar.js', './js/gloss.js', './js/sync.js', './js/firebaseConfig.js', './js/speech.js', './js/streak.js', './js/util.js', './js/settings.js', './js/version.js', './js/micTest.js',
  './js/screens/path.js', './js/screens/lesson.js', './js/screens/complete.js',
  './js/screens/profiles.js', './js/screens/placement.js', './js/screens/league.js', './js/screens/report.js', './js/screens/syncSetup.js', './js/screens/settings.js',
  './js/exercises/index.js', './js/exercises/choose.js', './js/exercises/wordBank.js',
  './js/exercises/matchPairs.js', './js/exercises/fillBlank.js', './js/exercises/listenType.js', './js/exercises/listenTranslate.js', './js/exercises/speak.js', './js/exercises/typeTranslate.js', './js/exercises/read.js', './js/exercises/teach.js', './js/exercises/pick.js', './js/exercises/spell.js',
  './data/course.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/favicon-32.png', './icons/apple-touch-icon.png', './favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const path = new URL(req.url).pathname;
  const isData = path.includes('/data/') || path.endsWith('/firebaseConfig.js');
  const put = (res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); }
    return res;
  };
  if (isData) {
    event.respondWith(fetch(req).then(put).catch(() => caches.match(req)));
  } else {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(put)));
  }
});
