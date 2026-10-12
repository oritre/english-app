// App shell is cache-first; course data is network-first so new lessons show up
// as soon as they're deployed, and still work offline afterwards.
const CACHE_NAME = 'english-app-v1';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/check.js', './js/course.js', './js/dates.js', './js/db.js',
  './js/progress.js', './js/speech.js', './js/streak.js', './js/util.js',
  './js/screens/path.js', './js/screens/lesson.js', './js/screens/complete.js',
  './js/exercises/index.js', './js/exercises/choose.js', './js/exercises/wordBank.js',
  './js/exercises/matchPairs.js', './js/exercises/fillBlank.js', './js/exercises/listenType.js',
  './data/course.json', './icons/icon-192.png', './icons/icon-512.png',
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
  const isData = new URL(req.url).pathname.includes('/data/');
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
