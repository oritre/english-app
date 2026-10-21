import { el, en, mixed } from '../util.js';
import { loadCourse, lessonStates } from '../course.js';
import { doneLessonIds, stats, getProfile, settleLeagues, setCurrentProfile } from '../progress.js';
import { TIERS } from '../league.js';
import { APP_VERSION } from '../version.js';
import { COACH_LESSON, hasCoach } from '../coach.js';

export function topBar(s, profile, nav) {
  return el('div', { class: 'top-stats' },
    el('button', { class: 'stat who', type: 'button', title: 'החלפת לומד', onclick: () => nav('profiles') },
      profile.avatar, ' ', profile.name),
    el('span', { class: `stat streak ${s.streak > 0 ? 'on' : ''}`, title: 'רצף ימים' }, '🔥 ', s.streak),
    el('span', { class: 'stat xp', title: 'XP היום / יעד' }, '⭐ ', `${s.todayXp}/${s.goalXp}`),
    el('button', { class: 'stat league-btn', type: 'button', title: 'הליגה שלי', onclick: () => nav('league') },
      TIERS[profile.league.tier].icon, ' ', TIERS[profile.league.tier].name));
}

export async function renderPath(root, nav) {
  await settleLeagues();
  const [course, done, s, profile] = await Promise.all([loadCourse(), doneLessonIds(), stats(), getProfile()]);
  const states = lessonStates(course, done, { starter: !!profile.starter });
  const titles = course.lesson_titles || {};

  const renderUnit = (unit, ui, starter) => {
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
        el('div', { class: 'node-label', style: `transform: translateX(${offset}px)` }, ...mixed(titles[id] || '')));
    });
    if (unit.bonus) {
      const state = states[unit.bonus];
      const bonus = el('button', {
        class: `node reading ${state}`, type: 'button', disabled: state === 'locked',
        'aria-label': titles[unit.bonus] || 'בונוס',
      }, state === 'done' ? '✓' : '📖');
      bonus.addEventListener('click', () => nav('lesson', { lessonId: unit.bonus }));
      nodes.push(el('div', { class: 'node-row' }, bonus,
        el('div', { class: 'node-label' }, '⭐ בונוס · ', titles[unit.bonus] || '',
          state === 'locked' ? el('span', { class: 'muted' }, ' (נפתח בסוף היחידה)') : null)));
    }
    return el('section', { class: 'unit' },
      el('header', { class: `unit-header c${ui % 4} ${starter ? 'starter' : ''}` },
        el('div', { class: 'unit-kicker' }, starter ? `ABC · שלב ${ui + 1}` : [`יחידה ${ui + 1} · `, en(unit.cefr)]),
        el('h2', {}, unit.title_he),
        el('p', {}, en(unit.title_en))),
      el('div', { class: 'nodes' }, nodes));
  };
  const starterUnits = (course.starter_units || []).map((u, i) => renderUnit(u, i, true));
  const mainUnits = course.units.map((u, i) => renderUnit(u, i, false));
  // Learners who know their letters see the ABC units folded at the bottom, open for practice.
  const units = profile.starter ? [...starterUnits, ...mainUnits]
    : [...mainUnits, starterUnits.length ? el('details', { class: 'starter-fold' },
      el('summary', {}, '🔤 אותיות וצלילים: יחידות ABC לתרגול'), starterUnits) : null];

  // This week's personal practice, written by the weekly review of the learner's log.
  const coach = hasCoach(profile) ? el('section', { class: 'coach-card' },
    el('div', { class: 'coach-kicker' }, done.includes(`coach-${profile.coach.week}`) ? '✓ תרגלת השבוע · אפשר שוב' : '🎯 תרגול אישי לשבוע הזה'),
    el('h2', {}, ...mixed(profile.coach.title_he || 'תרגול אישי')),
    profile.coach.note_he ? el('p', {}, ...mixed(profile.coach.note_he)) : null,
    el('button', { class: 'btn primary', type: 'button', onclick: () => nav('lesson', { lessonId: COACH_LESSON }) },
      `להתחיל (${profile.coach.exercises.length} תרגילים)`)) : null;

  const test = el('button', { class: 'retest', type: 'button', onclick: () => nav('placement') },
    '🎯 ', profile.placement ? 'לעשות שוב את מבחן הרמה' : 'מבחן רמה: לקפוץ קדימה');
  // Logging out clears the current learner, so the next open lands on the learner picker.
  const logout = el('button', { class: 'retest', type: 'button', onclick: () => { setCurrentProfile(null); nav('profiles'); } },
    '🚪 התנתקות (מעבר ללומד אחר)');
  root.replaceChildren(el('div', { class: 'screen path' }, topBar(s, profile, nav), coach, units, test, logout,
    el('p', { class: 'app-version' }, `גרסה ${APP_VERSION}`)));
  const current = coach && !done.includes(`coach-${profile.coach.week}`) ? coach : root.querySelector('.node.current');
  if (current) current.scrollIntoView({ block: 'center' });
}
