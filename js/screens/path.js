import { el, en, mixed } from '../util.js';
import { loadCourse, loadThink, lessonStates } from '../course.js';
import { doneLessonIds, stats, getProfile, settleLeagues, setCurrentProfile, updateProfile } from '../progress.js';
import { TIERS } from '../league.js';
import { APP_VERSION } from '../version.js';
import { COACH_LESSON, hasCoach, coachModules } from '../coach.js';
import { talkSupported } from '../talk.js';

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
  const [course, think, done, s, profile] = await Promise.all([loadCourse(), loadThink(), doneLessonIds(), stats(), getProfile()]);
  // Two subjects share the learner, the streak and the weekly coach: English,
  // and the Brilliant-style courses ("think": math, logic, code, science...).
  // The chosen subject and open course are kept on the profile, so they sync.
  const courses = think.courses || [];
  const subject = profile.subject === 'think' && courses.length ? 'think' : 'english';
  const openCourse = subject === 'think' ? courses.find((c) => c.id === profile.think_course) : null;
  const states = subject === 'english' ? lessonStates(course, done, { starter: !!profile.starter })
    : openCourse ? lessonStates(openCourse, done) : {};
  const titles = { ...(course.lesson_titles || {}), ...(think.lesson_titles || {}) };
  const setProfile = async (patch) => { Object.assign(profile, patch); await updateProfile(profile); nav('path'); };
  const switcher = courses.length ? el('div', { class: 'subject-switch', role: 'tablist' },
    [['english', '🔤', 'אנגלית'], ['think', '🧠', 'חשיבה ומדעים']].map(([id, icon, name]) => el('button', {
      class: `subject-tab ${subject === id ? 'on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(subject === id),
      onclick: () => { if (subject !== id) setProfile({ subject: id }); },
    }, el('span', { class: 'subject-icon' }, icon), name))) : null;

  const renderUnit = (unit, ui, starter, kind = 'english') => {
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
        el('div', { class: 'unit-kicker' }, starter ? `ABC · שלב ${ui + 1}` : kind === 'think' ? `יחידה ${ui + 1}` : [`יחידה ${ui + 1} · `, en(unit.cefr)]),
        el('h2', {}, unit.title_he),
        kind === 'think' ? el('p', {}, unit.about_he || '') : el('p', {}, en(unit.title_en))),
      el('div', { class: 'nodes' }, nodes));
  };
  const starterUnits = (course.starter_units || []).map((u, i) => renderUnit(u, i, true));
  const mainUnits = course.units.map((u, i) => renderUnit(u, i, false));
  // Learners who know their letters see the ABC units folded at the bottom, open for practice.
  const units = profile.starter ? [...starterUnits, ...mainUnits]
    : [...mainUnits, starterUnits.length ? el('details', { class: 'starter-fold' },
      el('summary', {}, '🔤 אותיות וצלילים: יחידות ABC לתרגול'), starterUnits) : null];

  // This week's personal practice, written by the weekly review of the learner's log.
  const mods = coachModules(profile);
  const coachDone = mods.length > 0 && mods.every((m) => done.includes(m.id));
  const list = (title, items) => (items?.length ? el('div', { class: 'coach-list' }, el('h3', {}, title), el('ul', {}, items.map((t) => el('li', {}, ...mixed(t))))) : null);
  const coach = hasCoach(profile) ? el('section', { class: 'coach-card' },
    el('div', { class: 'coach-kicker' }, coachDone ? '✓ סיימת את התרגול של השבוע · אפשר שוב' : '🎯 תרגול אישי לשבוע הזה'),
    el('h2', {}, ...mixed(profile.coach.title_he || 'תרגול אישי')),
    profile.coach.note_he ? el('p', {}, ...mixed(profile.coach.note_he)) : null,
    list('💪 במה אני כבר טוב', profile.coach.strengths),
    list('🎯 במה כדאי להתחזק', profile.coach.work_on),
    el('div', { class: 'coach-modules' }, mods.map((m, i) => el('button', {
      class: `coach-module ${done.includes(m.id) ? 'done' : ''}`, type: 'button',
      onclick: () => nav('lesson', { lessonId: COACH_LESSON, module: i }),
    }, el('span', { class: 'coach-mod-mark' }, done.includes(m.id) ? '✓' : String(i + 1)),
    el('span', {}, el('span', { class: 'coach-mod-title' }, ...mixed(m.title_he || 'תרגול')),
      m.about_he ? el('span', { class: 'muted coach-mod-about' }, ...mixed(m.about_he)) : null))))) : null;

  // Middle-school extras: a spoken lesson with the AI tutor, and unseen reading passages.
  const talk = profile.talk && talkSupported() ? el('button', { class: 'talk-card', type: 'button', onclick: () => nav('talk') },
    el('span', { class: 'talk-card-icon' }, '🗣️'),
    el('span', {}, el('span', { class: 'talk-card-title' }, 'שיחה באנגלית עם ', en('Sam')),
      el('span', { class: 'muted' }, 'מדברים בקול, והמורה מתקן ומסביר תוך כדי'))) : null;
  const unseenIds = course.unseen || [];
  const unseenList = unseenIds.length ? el('div', { class: 'unseen-list' }, unseenIds.map((id) => el('button', {
    class: `unseen-item ${done.includes(id) ? 'done' : ''}`, type: 'button', onclick: () => nav('lesson', { lessonId: id }),
  }, el('span', { class: 'coach-mod-mark' }, done.includes(id) ? '✓' : '📖'), ...mixed((titles[id] || id).replace(/^אנסין: /, ''))))) : null;
  const unseen = !unseenList ? null : profile.unseen
    ? el('section', { class: 'unseen-card' }, el('h2', {}, '📖 אנסינים: קריאה והבנה'), unseenList)
    : el('details', { class: 'starter-fold' }, el('summary', {}, '📖 אנסינים: קטעי קריאה לחטיבת ביניים'), unseenList);

  const test = el('button', { class: 'retest', type: 'button', onclick: () => nav('placement') },
    '🎯 ', profile.placement ? 'לעשות שוב את מבחן הרמה' : 'מבחן רמה: לקפוץ קדימה');
  // Logging out clears the current learner, so the next open lands on the learner picker.
  const logout = el('button', { class: 'retest', type: 'button', onclick: () => { setCurrentProfile(null); nav('profiles'); } },
    '🚪 התנתקות (מעבר ללומד אחר)');
  const lessonsOf = (c) => c.units.flatMap((u) => u.lessons);
  const catalog = subject === 'think' && !openCourse ? el('section', { class: 'catalog' },
    el('h2', { class: 'catalog-title' }, 'מה בא לך ללמוד?'),
    el('div', { class: 'course-grid' }, courses.map((c) => {
      const ids = lessonsOf(c);
      const n = ids.filter((id) => done.includes(id)).length;
      return el('button', { class: `course-card ${n === ids.length ? 'complete' : ''}`, type: 'button', style: `--course: ${c.color}`, onclick: () => setProfile({ think_course: c.id }) },
        el('span', { class: 'course-icon' }, c.icon),
        el('span', { class: 'course-name' }, c.title_he),
        el('span', { class: 'course-about' }, c.about_he),
        el('span', { class: 'course-progress' }, el('span', { style: `width: ${Math.round((n / ids.length) * 100)}%` })),
        el('span', { class: 'course-count' }, n === 0 ? `${ids.length} שיעורים` : n === ids.length ? '✓ הושלם' : `${n} מתוך ${ids.length}`));
    }))) : null;
  const courseView = openCourse ? [
    el('header', { class: 'course-head' },
      el('button', { class: 'course-back', type: 'button', onclick: () => setProfile({ think_course: null }) }, '→ כל הקורסים'),
      el('div', { class: 'course-head-icon' }, openCourse.icon),
      el('h1', {}, openCourse.title_he),
      el('p', {}, openCourse.about_he)),
    ...openCourse.units.map((u, i) => renderUnit(u, i, false, 'think'))] : null;
  const content = subject === 'think' ? [coach, catalog, courseView]
    : [talk, coach, profile.unseen ? unseen : null, units, profile.unseen ? null : unseen, test];
  root.replaceChildren(el('div', { class: `screen path subject-${subject}`, style: openCourse ? `--course: ${openCourse.color}` : null }, topBar(s, profile, nav), switcher, ...content, logout,
    el('p', { class: 'app-version' }, `גרסה ${APP_VERSION}`)));
  // Learners on the talk / unseen track start at the top, where those cards are.
  const current = coach && !coachDone ? coach : subject === 'english' && (talk || profile.unseen) ? null : root.querySelector('.node.current');
  if (current) current.scrollIntoView({ block: 'center' });
}
