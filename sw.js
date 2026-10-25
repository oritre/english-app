// App shell is cache-first; course data and the Firebase config are network-first
// so new lessons (or turning sync on) show up as soon as they're deployed, and
// still work offline afterwards.
const CACHE_NAME = 'english-app-v53';
const ASR_CACHE = 'asr-lib-3.8.1';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/polyfills.js', './js/check.js', './js/course.js', './js/dates.js', './js/db.js',
  './js/progress.js', './js/placement.js', './js/league.js', './js/report.js', './js/grammar.js', './js/gloss.js', './js/sync.js', './js/firebaseConfig.js', './js/speech.js', './js/streak.js', './js/util.js', './js/settings.js', './js/version.js', './js/micTest.js', './js/localAsr.js', './js/voiceInput.js', './js/coach.js', './js/talk.js', './js/typing.js',
  './js/spoken.js',
  './js/screens/path.js', './js/screens/lesson.js', './js/screens/complete.js',
  './js/screens/profiles.js', './js/screens/placement.js', './js/screens/league.js', './js/screens/report.js', './js/screens/syncSetup.js', './js/screens/settings.js', './js/screens/talk.js',
  './js/exercises/index.js', './js/exercises/choose.js', './js/exercises/wordBank.js',
  './js/exercises/matchPairs.js', './js/exercises/fillBlank.js', './js/exercises/listenType.js', './js/exercises/listenTranslate.js', './js/exercises/speak.js', './js/exercises/typeTranslate.js', './js/exercises/read.js', './js/exercises/teach.js', './js/exercises/pick.js', './js/exercises/spell.js', './js/exercises/think.js', './js/exercises/story.js', './js/storyLogic.js', './js/media.js', './js/thinkLogic.js', './js/thinkPractice.js', './js/activity.js', './js/insights.js', './js/screens/parent.js',
  './data/course.json', './data/think.json', './data/know.json', './data/videos.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/favicon-32.png', './icons/apple-touch-icon.png', './favicon.ico',
];

self.addEventListener('install', (event) => {
  // GitHub Pages' CDN can serve the previous release for a few minutes after a
  // deploy, so each file is fetched past every cache (a ?v= query and no HTTP
  // cache) and stored under its plain URL. Otherwise old files would be kept
  // in the new version's cache until the next release.
  const fresh = (c, url) => fetch(new Request(`${url}?v=${CACHE_NAME}`, { cache: 'reload' })).then((res) => {
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return c.put(url, res);
  });
  event.waitUntil(caches.open(CACHE_NAME).then((c) => Promise.all(APP_SHELL.map((url) => fresh(c, url)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    // Only old app shells; the speech model's caches survive app updates.
    .then((names) => Promise.all(names.filter((n) => n.startsWith('english-app-v') && n !== CACHE_NAME).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Background check for a new version (registered by js/app.js on installed apps).
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'app-update') event.waitUntil(self.registration.update().catch(() => {}));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The speech model (huggingface) caches itself; its library and wasm (jsdelivr) go in a cache kept across versions.
  if (url.hostname.endsWith('huggingface.co') || url.hostname.endsWith('hf.co')) return;
  // Videos from the home Pi (js/media.js) stream straight from it, never cached here.
  if (url.hostname === 'english-media.tailafe754.ts.net') return;
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(caches.open(ASR_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  const path = url.pathname;
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
