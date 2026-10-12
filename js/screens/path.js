import { el, en } from '../util.js';
import { loadCourse, lessonStates } from '../course.js';
import { doneLessonIds, stats } from '../progress.js';

export function topBar(s) {
  return el('div', { class: 'top-stats' },
    el('span', { class: `stat streak ${s.streak > 0 ? 'on' : ''}`, title: 'רצף ימים' }, '🔥 ', s.streak),
    el('span', { class: 'stat xp', title: 'XP היום / יעד' }, '⭐ ', `${s.todayXp}/${s.goalXp}`),
    el('span', { class: 'stat total', title: 'סה"כ XP' }, `${s.totalXp} XP`));
}

export async function renderPath(root, nav) {
  const [course, done, s] = await Promise.all([loadCourse(), doneLessonIds(), stats()]);
  const states = lessonStates(course, done);
  const titles = course.lesson_titles || {};

  const units = course.units.map((unit, ui) => {
    const nodes = unit.lessons.map((id, li) => {
      const state = states[id];
      const offset = [0, 1, 2, 1, 0, -1, -2, -1][li % 8] * 48;
      const label = state === 'done' ? '✓' : state === 'locked' ? '🔒' : '★';
      const node = el('button', {
        class: `node ${state}`, type: 'button', style: `transform: translateX(${offset}px)`,
        disabled: state === 'locked', 'aria-label': titles[id] || id,
      }, label);
      node.addEventListener('click', () => nav('lesson', { lessonId: id }));
      return el('div', { class: 'node-row' },
        node,
        el('div', { class: 'node-label', style: `transform: translateX(${offset}px)` }, titles[id] || ''));
    });
    return el('section', { class: 'unit' },
      el('header', { class: `unit-header c${ui % 4}` },
        el('div', { class: 'unit-kicker' }, `יחידה ${ui + 1} · `, en(unit.cefr)),
        el('h2', {}, unit.title_he),
        el('p', {}, en(unit.title_en))),
      el('div', { class: 'nodes' }, nodes));
  });

  root.replaceChildren(el('div', { class: 'screen path' }, topBar(s), units));
  const current = root.querySelector('.node.current');
  if (current) current.scrollIntoView({ block: 'center' });
}
