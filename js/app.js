import { renderPath } from './screens/path.js';
import { renderLesson } from './screens/lesson.js';
import { renderComplete } from './screens/complete.js';
import { renderProfiles, renderProfileCreate, renderStartChoice } from './screens/profiles.js';
import { renderPlacement } from './screens/placement.js';
import { renderLeague } from './screens/league.js';
import { renderReports, renderReport } from './screens/report.js';
import { renderSync, syncOnLoad } from './screens/syncSetup.js';
import { renderSettings } from './screens/settings.js';
import { getProfile, setCurrentProfile } from './progress.js';
import { el } from './util.js';

const routes = {
  profiles: renderProfiles,
  profileCreate: renderProfileCreate,
  startChoice: renderStartChoice,
  placement: renderPlacement,
  league: renderLeague,
  reports: renderReports,
  report: renderReport,
  sync: renderSync,
  path: renderPath,
  lesson: renderLesson,
  complete: renderComplete,
  settings: renderSettings,
};
// Lesson-like screens have their own footer and a 🏠 in their top bar instead.
const NO_TABS = new Set(['lesson', 'placement']);
const root = document.getElementById('app');

async function home() {
  const p = await getProfile();
  if (!p) { setCurrentProfile(null); return 'profiles'; }
  return p.start_choice ? 'path' : 'startChoice';
}

// Bottom bar on every screen: home (the learner's path, or the learner picker) and settings.
const tabs = el('nav', { class: 'tab-bar', hidden: true },
  el('button', { class: 'tab', type: 'button', 'data-tab': 'home', onclick: () => nav('back') }, el('span', { class: 'tab-icon' }, '🏠'), 'בית'),
  el('button', { class: 'tab', type: 'button', 'data-tab': 'settings', onclick: () => nav('settings') }, el('span', { class: 'tab-icon' }, '⚙️'), 'הגדרות'));
document.body.append(tabs);

function showTabs(r) {
  tabs.hidden = NO_TABS.has(r);
  document.body.classList.toggle('has-tabs', !tabs.hidden);
  tabs.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', String(t.dataset.tab === (r === 'settings' ? 'settings' : r === 'path' || r === 'profiles' ? 'home' : ''))));
}

let screen = null;
let updateReady = false;

function nav(route, params = {}) {
  window.scrollTo(0, 0);
  Promise.resolve(route === 'back' ? home() : route)
    .then((r) => {
      // A new version waiting from earlier loads as soon as the learner leaves a lesson.
      if (updateReady && !NO_TABS.has(r)) { location.reload(); return null; }
      screen = r;
      showTabs(r);
      return routes[r](root, nav, params);
    })
    .catch((err) => {
      console.error(err);
      showLoadError(err);
    });
}

// The error itself is shown, so a screenshot says what failed (e.g. a blocked site on a filtered device).
function showLoadError(err) {
  const reset = async () => {
    try {
      for (const r of await navigator.serviceWorker?.getRegistrations?.() || []) await r.unregister();
      for (const n of await caches.keys()) if (n.startsWith('english-app-')) await caches.delete(n);
    } catch { /* best effort */ }
    location.reload();
  };
  root.replaceChildren(el('div', { class: 'screen load-error' },
    el('h1', {}, 'משהו השתבש בטעינה'),
    el('p', {}, 'אם האינטרנט במכשיר מסונן, ייתכן שאתר שהאפליקציה צריכה חסום.'),
    el('pre', { class: 'error-detail', dir: 'ltr' }, `${err?.name || 'Error'}: ${err?.message || err}\n${navigator.userAgent}`),
    el('div', { class: 'row-btns' },
      el('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, 'נסו שוב'),
      el('button', { class: 'btn', type: 'button', onclick: reset }, 'ניקוי ורענון'))));
}
window.addEventListener('unhandledrejection', (e) => console.warn('unhandled', e.reason));

syncOnLoad().finally(() => nav('back'));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // A new version installs in the background; without a reload the open app
  // keeps running the old files. Reload when it takes over, but never mid-lesson.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    if (NO_TABS.has(screen)) updateReady = true;
    else location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // An installed app is often resumed rather than relaunched, so check for updates on return too.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((e) => console.warn('SW failed', e));
}
