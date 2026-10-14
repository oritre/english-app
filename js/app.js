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

function nav(route, params = {}) {
  window.scrollTo(0, 0);
  Promise.resolve(route === 'back' ? home() : route)
    .then((r) => { showTabs(r); return routes[r](root, nav, params); })
    .catch((err) => {
      console.error(err);
      root.textContent = 'משהו השתבש בטעינה. נסו לרענן.';
    });
}

syncOnLoad().finally(() => nav('back'));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e));
}
