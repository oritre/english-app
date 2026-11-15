import { mixed, el } from '../util.js';
import { loadThink, loadKnow } from '../course.js';
import { requiredLessons } from '../thinkLogic.js';
import { WEAK } from '../learnRules.js';
import { roundNow, isLocked } from '../rotation.js';
import { roundCard } from './round.js';
import { subjectOf } from '../insights.js';

// Confetti for the lesson-complete screen: a handful of coloured bits that fall once (CSS does the motion).
const confetti = (n = 24) => el('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) =>
  el('i', { style: `--l: ${Math.round((i / n) * 100 + Math.random() * 4)}%; --d: ${Math.round(Math.random() * 600)}ms; --h: ${Math.round(Math.random() * 360)}; --r: ${Math.round(Math.random() * 360)}deg` })));

export async function renderComplete(root, nav, p) {
  const { leagueView, getProfile, updateProfile, doneLessonIds } = await import('../progress.js');
  const league = await leagueView();
  const mins = Math.floor(p.durationS / 60);
  const secs = String(p.durationS % 60).padStart(2, '0');
  const streakUp = p.streakAfter > p.streakBefore;

  // The round: if this lesson used up the subject's minutes, the way on is another subject.
  let roundRow = null;
  try {
    const profile = await getProfile();
    const round = await roundNow(profile);
    if (isLocked(round, p.lessonId)) {
      roundRow = roundCard(round, subjectOf(p.lessonId), async (id) => { const fresh = await getProfile(); fresh.subject = id; await updateProfile(fresh); nav('path'); });
    }
  } catch { roundRow = null; }

  // After a think lesson: straight on to the next lesson of the course, or to the catalog when the course is done.
  let nextRow = null;
  if (p.course) {
    try {
      const [thinkData, know, done, profile] = await Promise.all([loadThink(), loadKnow(), doneLessonIds(), getProfile()]);
      // The lesson's course is in one of the two catalogs; general knowledge has no practice rounds.
      const subject = (know.courses || []).some((c) => c.id === p.course) ? 'know' : 'think';
      const think = subject === 'know' ? know : thinkData;
      const course = (think.courses || []).find((c) => c.id === p.course);
      const ids = !course ? [] : subject === 'think' ? requiredLessons(course, profile) : course.units.flatMap((u) => u.lessons);
      const next = ids.find((id) => !done.includes(id));
      const titles = think.lesson_titles || {};
      const goCatalog = async () => { Object.assign(profile, { subject, [`${subject}_course`]: null }); await updateProfile(profile); nav('path'); };
      const goNext = async () => { Object.assign(profile, { subject, [`${subject}_course`]: course.id, [`${subject}_last`]: course.id }); await updateProfile(profile); nav('lesson', { lessonId: next }); };
      if (course) {
        nextRow = el('div', { class: 'next-up', style: `--course: ${course.color}` },
          next
            ? el('button', { class: 'next-lesson', type: 'button', onclick: goNext },
              el('span', { class: 'next-icon' }, course.icon),
              el('span', { class: 'next-text' }, el('span', { class: 'next-kicker' }, 'השיעור הבא'), el('span', { class: 'next-title' }, ...mixed(titles[next] || ''))),
              el('span', { class: 'next-arrow' }, '←'))
            : subject === 'know' ? el('div', { class: 'next-lesson done-course' },
              el('span', { class: 'next-icon' }, '🏆'),
              el('span', { class: 'next-text' }, el('span', { class: 'next-kicker' }, `סיימת את "${course.title_he}"!`), el('span', { class: 'next-title' }, 'אפשר לבחור נושא חדש')))
            : el('button', { class: 'next-lesson', type: 'button', onclick: () => nav('lesson', { lessonId: `tp-${course.id}` }) },
              el('span', { class: 'next-icon' }, p.lessonId?.startsWith('tp-') ? '🔁' : '🏆'),
              el('span', { class: 'next-text' }, el('span', { class: 'next-kicker' }, p.lessonId?.startsWith('tp-') ? 'עוד סיבוב?' : `סיימת את "${course.title_he}"!`), el('span', { class: 'next-title' }, 'תרגול עם שאלות חדשות')),
              el('span', { class: 'next-arrow' }, '←')),
          el('button', { class: 'btn ghost', type: 'button', onclick: goCatalog }, next ? 'לכל הקורסים' : '🧭 לבחור קורס חדש'));
      }
    } catch { nextRow = null; }
  }

  // Short full-screen beats first (XP flying in, then the streak), one "המשך" each, then the summary.
  const stars = () => el('span', { class: 'stars', 'aria-hidden': 'true' }, Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return el('i', { style: `--dx: ${Math.round(Math.cos(a) * 90)}px; --dy: ${Math.round(Math.sin(a) * 70)}px; --d: ${i * 40}ms` }, '⭐');
  }));
  // A replay of a mastered lesson goes straight to the summary: nothing to celebrate there.
  const beats = [
    p.repeat === 'mastered' ? null : () => el('div', { class: 'screen complete beat' },
      el('div', { class: 'beat-big' }, p.accuracy === 100 ? '🏆' : '🎉'),
      el('h1', {}, p.accuracy === 100 ? 'שיעור מושלם!' : 'סיימתם את השיעור!'),
      el('div', { class: 'xp-fly', dir: 'ltr' }, `+${p.xp} XP`, stars()),
      el('p', {}, ...mixed(p.lessonTitle))),
    streakUp ? () => el('div', { class: 'screen complete beat' },
      el('div', { class: 'streak-fire' }, '🔥'),
      el('h1', {}, `רצף של ${p.streakAfter} ${p.streakAfter === 1 ? 'יום' : 'ימים'}!`),
      el('p', {}, p.streakAfter === 1 ? 'התחלתם רצף. מחר שוב?' : 'כל יום שלומדים, הרצף גדל.')) : null,
  ].filter(Boolean);
  let at = 0;
  const showBeat = () => {
    if (at >= beats.length) return showSummary();
    const view = beats[at++]();
    view.append(el('button', { class: 'btn primary wide', type: 'button', onclick: showBeat }, 'המשך'));
    root.replaceChildren(view);
    window.scrollTo(0, 0);
  };
  showBeat();

  function showSummary() {
  root.replaceChildren(el('div', { class: 'screen complete' },
    confetti(),
    el('div', { class: 'celebrate' }, p.accuracy === 100 ? '🏆' : '🎉'),
    el('h1', {}, p.accuracy === 100 ? 'שיעור מושלם!' : 'סיימתם את השיעור!'),
    el('p', { class: 'muted' }, ...mixed(p.lessonTitle)),
    el('div', { class: 'result-cards' },
      el('div', { class: 'result xp' }, el('div', { class: 'label' }, 'XP'), el('div', { class: 'value', dir: 'ltr' }, `+${p.xp}`)),
      el('div', { class: 'result acc' }, el('div', { class: 'label' }, 'דיוק'), el('div', { class: 'value' }, `${p.accuracy}%`)),
      el('div', { class: 'result time' }, el('div', { class: 'label' }, 'זמן'), el('div', { class: 'value', dir: 'ltr' }, `${mins}:${secs}`))),
    streakUp ? el('div', { class: 'streak-banner' }, `🔥 רצף של ${p.streakAfter} ${p.streakAfter === 1 ? 'יום' : 'ימים'}!`) : null,
    league.myRow ? el('button', { class: 'league-note', type: 'button', onclick: () => nav('league') },
      `${league.tier.icon} מקום ${league.myRow.rank} בליגת ${league.tier.name}`) : null,
    p.goalMetNow ? el('p', { class: 'goal-met' }, 'עמדתם ביעד היומי ✔') : null,
    // Repeats: a mastered lesson earns nothing, a better score on a known lesson is celebrated,
    // and a low score is marked for another try.
    p.repeat === 'mastered' ? el('p', { class: 'repeat-done' }, '🔁 כבר שלטת בשיעור הזה, אז החזרה לא נתנה XP. הנקודות מחכות בשיעור חדש!')
      : p.repeat !== 'new' && p.repeat && p.accuracy > p.prevBest ? el('p', { class: 'repeat-better' }, `📈 שיפור! מ־${p.prevBest}% ל־${p.accuracy}%`) : null,
    !roundRow && p.accuracy < WEAK && !String(p.lessonId).startsWith('tp-') && !String(p.lessonId).startsWith('coach') ? el('div', { class: 'retry-row' },
      el('p', {}, '↻ השיעור הזה מסומן במסלול "לחזק". כשחוזרים עליו ומשתפרים, מקבלים שוב XP.'),
      el('button', { class: 'btn', type: 'button', onclick: () => nav('lesson', { lessonId: p.lessonId }) }, 'לנסות שוב עכשיו')) : null,
    // Think lessons: a recap of the ideas the lesson taught (the concept cards' titles).
    p.concepts?.length ? el('div', { class: 'recap' },
      el('div', { class: 'recap-head' }, '📚 מה למדנו'),
      el('ul', { class: 'recap-list' }, p.concepts.map((t) => el('li', {}, el('span', { class: 'recap-check' }, '✓'), ...mixed(t))))) : null,
    roundRow || nextRow,
    el('button', { class: `btn ${nextRow || roundRow ? '' : 'primary'} wide`, type: 'button', onclick: () => nav('path') }, nextRow ? 'חזרה למסלול' : 'המשך')));
  }
}
