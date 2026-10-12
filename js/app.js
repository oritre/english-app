import { renderPath } from './screens/path.js';
import { renderLesson } from './screens/lesson.js';
import { renderComplete } from './screens/complete.js';

const routes = { path: renderPath, lesson: renderLesson, complete: renderComplete };
const root = document.getElementById('app');

function nav(route, params = {}) {
  window.scrollTo(0, 0);
  Promise.resolve().then(() => routes[route](root, nav, params)).catch((err) => {
    console.error(err);
    root.textContent = 'משהו השתבש בטעינה. נסו לרענן.';
  });
}

nav('path');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e));
}
