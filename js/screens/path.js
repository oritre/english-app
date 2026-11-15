import { el, en, mixed } from '../util.js';
import { loadCourse, loadThink, loadKnow, loadParasha, lessonStates } from '../course.js';
import { parashaOfWeek, hebrewShabbat } from '../parashaWeek.js';
import { warmParasha } from '../parashaWarm.js';
import { doneLessonIds, bestByLesson, stats, getProfile, settleLeagues, setCurrentProfile, updateProfile } from '../progress.js';
import { WEAK, gradeFit } from '../learnRules.js';
import { TIERS } from '../league.js';
import { APP_VERSION } from '../version.js';
import { COACH_LESSON, coachModules, moduleSubject } from '../coach.js';
import { talkSupported } from '../talk.js';
import { courseLevel, skipUnits, requiredLessons, LEVEL_NAMES } from '../thinkLogic.js';
import { goalStrip } from './parent.js';
import { roundNow } from '../rotation.js';
import { roundStrip, roundCard } from './round.js';

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
  const [course, thinkData, know, parasha, done, best, s, profile] = await Promise.all([loadCourse(), loadThink(), loadKnow(), loadParasha(), doneLessonIds(), bestByLesson(), stats(), getProfile()]);
  // A lesson done with a low score is marked for practice (redoing it earns XP again).
  const weak = (id) => best[id] != null && best[id] < WEAK;
  // Three subjects share the learner, the streak and the weekly coach: English,
  // the Brilliant-style courses ("think": math, logic, code, science...) and
  // BrainPOP-style general knowledge ("know": a narrated cartoon, then a quiz).
  // The two catalogs work the same way; each keeps its open course, last course
  // and weekly plan on the profile under its own prefix, so they sync.
  // The weekly parasha ("parasha") is a fourth catalog of the same shape.
  const catalogs = { think: thinkData, know, parasha };
  const subject = ['think', 'know', 'parasha'].includes(profile.subject) && catalogs[profile.subject].courses?.length ? profile.subject : 'english';
  const think = catalogs[subject] || thinkData;
  const courses = think.courses || [];
  const key = (k) => `${subject}_${k}`;
  const openCourse = subject !== 'english' ? courses.find((c) => c.id === profile[key('course')]) : null;
  const states = subject === 'english' ? lessonStates(course, done, { starter: !!profile.starter })
    : openCourse ? lessonStates(openCourse, done, { skipUnits: subject === 'think' ? skipUnits(openCourse, profile) : 0 }) : {};
  const titles = { ...(course.lesson_titles || {}), ...(thinkData.lesson_titles || {}), ...(know.lesson_titles || {}), ...(parasha.lesson_titles || {}) };
  // The day's round: after 20 minutes in one subject it waits until the others had theirs.
  const round = await roundNow(profile).catch(() => null);
  const locked = (id) => !!round?.locked.includes(id);
  const setProfile = async (patch) => { Object.assign(profile, patch); await updateProfile(profile); nav('path'); };
  const subjects = [['english', '🔤', 'אנגלית'], ['think', '🧠', 'חשיבה ומדעים'], ['know', '🌍', 'ידע כללי'], ['parasha', '📜', 'פרשת שבוע']]
    .filter(([id]) => id === 'english' || catalogs[id].courses?.length);
  const switcher = subjects.length > 1 ? el('div', { class: 'subject-switch', role: 'tablist' },
    subjects.map(([id, icon, name]) => el('button', {
      class: `subject-tab ${subject === id ? 'on' : ''}${locked(id) ? ' locked' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(subject === id),
      onclick: () => { if (subject !== id) setProfile({ subject: id }); },
    }, el('span', { class: 'subject-icon' }, locked(id) ? '🔒' : icon), name))) : null;

  // Think course map: tapping a stop selects it and a bottom sheet offers to start it (the current one is pre-selected).
  const rows = new Map();
  const sheet = el('div', { class: 'lesson-sheet', hidden: true });
  let screenEl = null;
  const selectLesson = (id) => {
    const state = states[id];
    rows.forEach((row, rid) => { row.classList.toggle('selected', rid === id); row.querySelector('.node').classList.toggle('selected', rid === id); });
    const go = () => (openCourse ? startLesson(openCourse, id) : nav('lesson', { lessonId: id }));
    sheet.replaceChildren(
      el('span', { class: 'lesson-sheet-icon' }, state === 'done' ? (weak(id) ? '↻' : '✓') : '★'),
      el('span', { class: 'lesson-sheet-text' },
        el('span', { class: 'lesson-sheet-kicker' }, state !== 'done' ? 'השיעור הבא שלך'
          : weak(id) ? `כדאי לחזק · קיבלת ${best[id]}%` : best[id] >= 90 ? 'כבר שולט בזה · חזרה בלי XP' : 'שיעור שסיימת · אפשר לחזור עליו'),
        el('span', { class: 'lesson-sheet-title' }, ...mixed(titles[id] || ''))),
      el('button', { class: 'btn primary', type: 'button', onclick: go }, state === 'done' ? 'שוב' : 'התחלה'));
    sheet.hidden = false;
    screenEl?.classList.add('has-sheet');
  };
  const renderUnit = (unit, ui, starter, kind = 'english') => {
    const nodes = unit.lessons.map((id, li) => {
      const state = states[id];
      const offset = [0, 1, 2, 1, 0, -1, -2, -1][li % 8] * 48;
      const isWeak = state === 'done' && weak(id);
      const label = isWeak ? '↻' : state === 'done' ? '✓' : state === 'locked' ? '🔒' : state === 'bonus' && kind === 'think' ? '▶' : '★';
      const node = el('button', {
        class: `node ${state}${isWeak ? ' weak' : ''}`, type: 'button', style: `transform: translateX(${offset}px)`,
        disabled: state === 'locked', 'aria-label': titles[id] || id,
        title: state === 'locked' ? 'נפתח כשמסיימים את השיעור שלפניו' : isWeak ? `כדאי לחזק: ${best[id]}%` : null,
      }, label);
      node.addEventListener('click', () => (kind === 'think' ? selectLesson(id) : nav('lesson', { lessonId: id })));
      const row = el('div', { class: 'node-row' },
        node,
        el('div', { class: 'node-label', style: `transform: translateX(${offset}px)` }, ...mixed(titles[id] || ''),
          isWeak ? el('span', { class: 'weak-chip' }, ' לחזק') : null,
          kind === 'think' && state === 'locked' ? el('span', { class: 'muted small-l' }, ' 🔒') : null));
      if (kind === 'think') rows.set(id, row);
      return row;
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
  // English practice stays on the English tab; a module the review tagged (or
  // that is all think exercises) shows only on its own tab, without the feedback lists.
  const mods = coachModules(profile).map((m, i) => ({ ...m, index: i })).filter((m) => m.exercises?.length && moduleSubject(m) === subject);
  const coachDone = mods.length > 0 && mods.every((m) => done.includes(m.id));
  const onEnglish = subject === 'english';
  const list = (title, items) => (items?.length ? el('div', { class: 'coach-list' }, el('h3', {}, title), el('ul', {}, items.map((t) => el('li', {}, ...mixed(t))))) : null);
  const coach = mods.length ? el('section', { class: `coach-card${onEnglish ? '' : ' compact'}` },
    el('div', { class: 'coach-kicker' }, coachDone ? '✓ סיימת את התרגול של השבוע · אפשר שוב' : '🎯 תרגול אישי לשבוע הזה'),
    onEnglish ? el('h2', {}, ...mixed(profile.coach.title_he || 'תרגול אישי')) : null,
    onEnglish && profile.coach.note_he ? el('p', {}, ...mixed(profile.coach.note_he)) : null,
    onEnglish ? list('💪 במה אני כבר טוב', profile.coach.strengths) : null,
    onEnglish ? list('🎯 במה כדאי להתחזק', profile.coach.work_on) : null,
    el('div', { class: 'coach-modules' }, mods.map((m, i) => el('button', {
      class: `coach-module ${done.includes(m.id) ? 'done' : ''}`, type: 'button',
      onclick: () => nav('lesson', { lessonId: COACH_LESSON, module: m.index }),
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
  // Course progress: how many lessons are done and which one comes next.
  // Think courses fit the learner's level: units they are past don't count toward progress.
  const lessonsOf = (c) => (subject === 'think' ? requiredLessons(c, profile) : c.units.flatMap((u) => u.lessons));
  const progressOf = (c) => {
    const ids = lessonsOf(c);
    const n = ids.filter((id) => done.includes(id)).length;
    return { ids, n, pct: ids.length ? Math.round((n / ids.length) * 100) : 0, next: ids.find((id) => !done.includes(id)) || null };
  };
  // Opening a course remembers it as the last one, so the catalog can offer to continue it.
  const openCourseId = (id) => setProfile({ [key('course')]: id, [key('last')]: id });
  const startLesson = async (c, lessonId) => {
    Object.assign(profile, { [key('course')]: c.id, [key('last')]: c.id });
    await updateProfile(profile);
    nav('lesson', { lessonId });
  };
  const courseCard = (c) => {
    const { ids, n, pct, next } = progressOf(c);
    const state = n === ids.length ? 'complete' : n > 0 ? 'started' : 'fresh';
    return el('button', { class: `course-card ${state}`, type: 'button', style: `--course: ${c.color}`, onclick: () => openCourseId(c.id) },
      el('span', { class: 'course-card-top' },
        el('span', { class: 'course-icon' }, c.icon),
        el('span', { class: 'course-badge' }, state === 'complete' ? '✓ הושלם' : state === 'started' ? `${pct}%` : 'חדש')),
      el('span', { class: 'course-name' }, c.title_he),
      el('span', { class: 'course-about' }, c.about_he),
      c.moe ? el('span', { class: 'course-moe', title: 'תואם לתוכנית הלימודים של משרד החינוך' }, '🏫 תוכנית משרד החינוך') : null,
      el('span', { class: 'course-progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('span', { style: `width: ${pct}%` })),
      el('span', { class: 'course-count' }, state === 'complete' ? `${ids.length} שיעורים ✓`
        : state === 'started' ? `${n} מתוך ${ids.length} · הבא: ${titles[next] || ''}` : `${ids.length} שיעורים`));
  };
  // "Continue where you left off": the last course the learner opened, if it still has lessons.
  const lastCourse = courses.find((c) => c.id === profile[key('last')] && progressOf(c).next);
  const hero = lastCourse ? (() => {
    const { n, ids, pct, next } = progressOf(lastCourse);
    return el('section', { class: 'continue-card', style: `--course: ${lastCourse.color}` },
      el('div', { class: 'continue-kicker' }, n ? '▶ ממשיכים מאיפה שעצרת' : '▶ התחלת ללמוד'),
      el('div', { class: 'continue-main' },
        el('span', { class: 'continue-icon' }, lastCourse.icon),
        el('div', { class: 'continue-text' },
          el('h2', {}, lastCourse.title_he),
          el('p', {}, 'השיעור הבא: ', el('strong', {}, titles[next] || ''))),
        el('span', { class: 'continue-ring', style: `--pct: ${pct}` }, el('span', {}, `${n}/${ids.length}`))),
      el('div', { class: 'continue-actions' },
        el('button', { class: 'btn continue-go', type: 'button', onclick: () => startLesson(lastCourse, next) }, 'המשך שיעור'),
        el('button', { class: 'btn ghost continue-open', type: 'button', onclick: () => openCourseId(lastCourse.id) }, 'למסלול הקורס')));
  })() : null;
  // Recommended first: this week's plan from the weekly review, or else the
  // courses whose grade band covers the learner's school grade.
  const grade = parseInt(profile.grade, 10) || null;
  const gradeName = grade >= 13 ? 'מבוגרים' : grade ? `כיתה ${['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'][grade - 1]}'` : '';
  const plan = profile[key('plan')]?.courses?.length ? profile[key('plan')] : null;
  const picks = plan ? plan.courses.map((id) => courses.find((c) => c.id === id)).filter(Boolean)
    : grade ? courses.filter((c) => c.grades && grade >= c.grades[0] && grade <= c.grades[1])
      // Curriculum courses first, then the ones aimed most tightly at this grade.
      .map((c, i) => ({ c, key: [c.moe ? 0 : 1, c.grades[1] - c.grades[0], i] }))
      .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2])
      .slice(0, 8).map((x) => x.c) : [];
  // Courses far above or below the learner's grade wait in their own folds, so
  // the main catalog holds what fits (a course already started stays in view).
  const started = (c) => progressOf(c).n > 0 && progressOf(c).next;
  const fit = (c) => gradeFit(c, grade);
  const others = courses.filter((c) => !picks.includes(c));
  const rest = others.filter((c) => fit(c) === 'fit' || started(c));
  const above = others.filter((c) => fit(c) === 'above' && !started(c));
  const below = others.filter((c) => fit(c) === 'below' && !started(c));
  const fold = (title, note, list) => (list.length ? el('details', { class: 'course-fold' },
    el('summary', {}, title, el('span', { class: 'area-count' }, String(list.length))),
    el('p', { class: 'muted area-note' }, note),
    el('div', { class: 'course-grid' }, list.map(courseCard))) : null);
  const recommended = picks.length ? el('div', { class: 'course-area recommended' },
    el('h3', { class: 'area-title' }, el('span', { class: 'area-icon' }, '🎯'), plan ? 'נבחר בשבילך השבוע' : `מומלץ ל${gradeName}`),
    plan?.note_he ? el('p', { class: 'muted area-note' }, ...mixed(plan.note_he)) : null,
    el('div', { class: 'course-grid' }, picks.map(courseCard))) : null;
  const areas = (think.areas || []).filter((a) => rest.some((c) => c.area === a.id));
  const ungrouped = rest.filter((c) => !areas.some((a) => a.id === c.area));
  const group = (title, icon, list) => el('div', { class: 'course-area' },
    el('h3', { class: 'area-title' }, el('span', { class: 'area-icon' }, icon), title,
      el('span', { class: 'area-count' }, `${list.filter((c) => progressOf(c).n === lessonsOf(c).length).length}/${list.length}`)),
    el('div', { class: 'course-grid' }, list.map(courseCard)));
  // The parasha tab opens on this week's parasha, when its film is ready.
  const week = subject === 'parasha' ? parashaOfWeek(parasha) : null;
  const weekCourse = week && courses.find((c) => c.units.some((u) => u.lessons.includes(week.lesson)));
  if (weekCourse) warmParasha(week.lesson);
  const weekHero = weekCourse ? el('section', { class: 'continue-card parasha-week', style: `--course: ${weekCourse.color}` },
    el('div', { class: 'continue-kicker' }, `📜 פרשת השבוע · ${hebrewShabbat(week.shabbat)}`),
    el('div', { class: 'continue-main' },
      el('span', { class: 'continue-icon' }, done.includes(week.lesson) ? '✓' : '🎬'),
      el('div', { class: 'continue-text' },
        el('h2', {}, titles[week.lesson] || ''),
        el('p', {}, parasha.about?.[week.lesson] || ''))),
    el('div', { class: 'continue-actions' },
      el('button', { class: 'btn continue-go', type: 'button', onclick: () => startLesson(weekCourse, week.lesson) }, done.includes(week.lesson) ? 'לצפות שוב' : '▶ לסרט ולשאלות'))) : null;
  const catalog = subject !== 'english' && !openCourse ? el('section', { class: 'catalog' },
    weekHero,
    weekHero ? null : hero,
    el('h2', { class: 'catalog-title' }, lastCourse ? 'או משהו אחר?' : 'מה בא לך ללמוד?'),
    recommended,
    recommended ? el('h2', { class: 'catalog-title' }, 'עוד נושאים') : null,
    ...areas.map((a) => group(a.title_he, a.icon, rest.filter((c) => c.area === a.id))),
    ungrouped.length ? group('עוד', '✨', ungrouped) : null,
    fold('🚀 לכיתות גבוהות יותר', 'נושאים שבדרך כלל לומדים בכיתות גבוהות. אפשר לנסות, אבל כדאי קודם את מה שמתאים לכיתה שלך.', above),
    fold('🔙 קל לכיתה שלך', 'נושאים של כיתות נמוכות יותר. טובים לחזרה, אבל הם כנראה כבר קלים לך.', below)) : null;
  const courseView = openCourse ? (() => {
    const { n, ids, pct, next } = progressOf(openCourse);
    const finished = !next;
    return [
      el('header', { class: 'course-head' },
        el('button', { class: 'course-back', type: 'button', onclick: () => setProfile({ [key('course')]: null }) }, '→ כל הקורסים'),
        el('div', { class: 'course-head-card' },
          el('div', { class: 'course-head-icon' }, openCourse.icon),
          el('h1', {}, openCourse.title_he),
          el('p', {}, openCourse.about_he),
          el('div', { class: 'course-head-progress' },
            el('span', { class: 'course-progress' }, el('span', { style: `width: ${pct}%` })),
            el('span', { class: 'course-head-count' }, finished ? '🏆 הקורס הושלם' : `${n} מתוך ${ids.length} שיעורים`)),
          subject === 'think' ? (() => {
            const { level, measured, auto } = courseLevel(openCourse, profile);
            return el('p', { class: 'course-level' }, `${'⭐'.repeat(level)} רמה: ${LEVEL_NAMES[level]}`,
              el('span', {}, auto === 'up' ? ' · עלית רמה! שלושה סבבים חזקים ברצף' : auto === 'down' ? ' · ירדנו רמה כדי לחזק' : measured ? ' · לפי איך שהלך לך' : ' · לפי הכיתה'),
              skipUnits(openCourse, profile) ? el('span', {}, ' · אפשר לדלג על ההתחלה') : null);
          })() : null,
          n && subject === 'think' ? el('button', { class: `btn course-practice${finished ? ' main' : ''}`, type: 'button', onclick: () => nav('lesson', { lessonId: `tp-${openCourse.id}` }) },
            finished ? '🔁 תרגול: שאלות חדשות בכל פעם' : '🔁 תרגול חופשי') : null,
          finished
            ? el('button', { class: 'btn course-cta', type: 'button', onclick: () => setProfile({ [key('course')]: null }) }, '🧭 לבחור קורס חדש')
            : null)),
      ...openCourse.units.map((u, i) => renderUnit(u, i, false, 'think')),
      el('p', { class: 'path-note muted' }, finished ? (subject === 'think' ? 'בתרגול יש בכל פעם שאלות חדשות, ואפשר גם לחזור על כל שיעור.' : 'אפשר לחזור על כל שיעור ולראות שוב את הסרטון.') : 'שיעור נעול 🔒 נפתח כשמסיימים את השיעור שלפניו.'),
      el('button', { class: 'to-current', type: 'button', hidden: true, onclick: () => rows.get(next)?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, '★ לשיעור הנוכחי'),
      sheet];
  })() : null;
  const content = locked(subject) ? [roundCard(round, subject, (id) => setProfile({ subject: id }))]
    : subject !== 'english' ? [coach, catalog, courseView]
      : [talk, coach, profile.unseen ? unseen : null, units, profile.unseen ? null : unseen, test];
  screenEl = el('div', { class: `screen path subject-${subject}${subject === 'know' || subject === 'parasha' ? ' subject-think' : ''}`, style: openCourse ? `--course: ${openCourse.color}` : null }, topBar(s, profile, nav), switcher, roundStrip(round), ...content, logout,
    el('p', { class: 'app-version' }, `גרסה ${APP_VERSION}`));
  root.replaceChildren(screenEl);
  // The goals a parent set, with how far along they are.
  goalStrip(profile).then((strip) => { if (strip) screenEl.querySelector('.top-stats')?.after(strip); }).catch(() => {});
  if (openCourse && !locked(subject)) {
    const { next, ids } = progressOf(openCourse);
    selectLesson(next || ids[0]);
    // A floating button brings the current stop back into view when it is scrolled away.
    const target = rows.get(next);
    const toCurrent = screenEl.querySelector('.to-current');
    if (target && toCurrent && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { toCurrent.hidden = e.intersectionRatio >= 0.5; }, { threshold: [0, 0.5, 1] }).observe(target.querySelector('.node'));
    }
  }
  // Learners on the talk / unseen track start at the top, where those cards are.
  const current = coach && !coachDone ? coach : subject === 'english' && (talk || profile.unseen) ? null : root.querySelector('.node.current');
  if (current) current.scrollIntoView({ block: 'center' });
}
