import { renderPath } from './screens/path.js';
import { renderLesson } from './screens/lesson.js';
import { renderComplete } from './screens/complete.js';
import { renderProfiles, renderProfileCreate, renderStartChoice } from './screens/profiles.js';
import { renderPlacement } from './screens/placement.js';
import { renderLeague } from './screens/league.js';
import { getProfile, setCurrentProfile } from './progress.js';

const routes = {
  profiles: renderProfiles,
  profileCreate: renderProfileCreate,
  startChoice: renderStartChoice,
  placement: renderPlacement,
  league: renderLeague,
  path: renderPath,
  lesson: renderLesson,
  complete: renderComplete,
};
const root = document.getElementById('app');

async function home() {
  const p = await getProfile();
  if (!p) { setCurrentProfile(null); return 'profiles'; }
  return p.start_choice ? 'path' : 'startChoice';
}

function nav(route, params = {}) {
  window.scrollTo(0, 0);
  Promise.resolve(route === 'back' ? home() : route)
    .then((r) => routes[r](root, nav, params))
    .catch((err) => {
      console.error(err);
      root.textContent = 'משהו השתבש בטעינה. נסו לרענן.';
    });
}

nav('back');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e));
}
