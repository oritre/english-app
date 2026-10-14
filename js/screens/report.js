import { el, en } from '../util.js';
import { listProfiles, reportData } from '../progress.js';
import { loadCourse, loadLesson } from '../course.js';
import { skillStats, summarize, suggestions, minutesByDay, hardestItems, pct } from '../report.js';
import { computeStreak } from '../streak.js';
import { localISO } from '../dates.js';
import { TIERS } from '../league.js';

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids);
  return n;
}

export async function renderReports(root, nav) {
  const profiles = await listProfiles();
  const today = localISO();
  const cards = [];
  for (const p of profiles) {
    const data = await reportData(p.id);
    const sum = summarize(data, today);
    cards.push(el('button', { class: 'report-card', type: 'button', onclick: () => nav('report', { profileId: p.id }) },
      el('span', { class: 'avatar sm' }, p.avatar),
      el('span', { class: 'rc-main' }, el('strong', {}, p.name),
        el('span', { class: 'muted' }, `${sum.lessonsDone} שיעורים · ${sum.totalMinutes} דק' · ${sum.activeDays7}/7 ימים השבוע`)),
      el('span', { class: 'rc-acc' }, pct(sum.accuracy))));
  }
  root.replaceChildren(el('div', { class: 'screen report-list' },
    el('div', { class: 'form-top' },
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav('profiles') }, '→'),
      el('h1', {}, 'דוחות התקדמות')),
    el('p', { class: 'muted' }, 'תמונת מצב לכל לומד במכשיר הזה: זמן לימוד, חוזקות, חולשות והמלצות.'),
    cards.length ? cards : el('p', {}, 'עוד אין לומדים.')));
}

function activityChart(days) {
  const W = 340, H = 140, padB = 22, padT = 18, max = Math.max(5, ...days.map((d) => d.minutes));
  const step = W / days.length, bw = Math.min(16, step - 6);
  const scale = (m) => ((H - padB - padT) * m) / max;
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', direction: 'ltr', role: 'img', 'aria-label': 'דקות לימוד בכל יום, 14 ימים אחרונים' });
  const top = Math.ceil(max);
  for (const v of [0, Math.round(top / 2), top]) {
    const y = H - padB - scale(v);
    g.append(svg('line', { x1: 0, x2: W, y1: y, y2: y, class: 'grid' }));
    g.append(svg('text', { x: W - 2, y: y - 3, class: 'axis', 'text-anchor': 'end' }, v === top ? `${v} דק'` : `${v}`));
  }
  days.forEach((d, i) => {
    // Bars read right-to-left like the rest of the app: today is on the left.
    const x = W - (i + 1) * step + (step - bw) / 2;
    const h = scale(d.minutes);
    const label = `${d.date.slice(8)}/${d.date.slice(5, 7)}: ${d.minutes} דקות, ${d.lessons} שיעורים`;
    const bar = h > 0
      ? svg('path', { d: `M${x},${H - padB} v${-(h - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${h - 4} z`, class: 'bar' })
      : svg('rect', { x, y: H - padB - 1, width: bw, height: 1, class: 'bar-zero' });
    const hit = svg('rect', { x: x - (step - bw) / 2, y: 0, width: step, height: H - padB, class: 'hit' }, svg('title', {}, label));
    g.append(bar, hit);
    if (i === days.length - 1 || i === days.length - 8 || i === 0) {
      g.append(svg('text', { x: x + bw / 2, y: H - 6, class: 'axis', 'text-anchor': 'middle' }, i === days.length - 1 ? 'היום' : `${Number(d.date.slice(8))}/${Number(d.date.slice(5, 7))}`));
    }
  });
  return g;
}

function exerciseText(ex) {
  if (!ex) return '';
  if (ex.type === 'match_pairs') return ex.pairs.map((p) => p[0]).join(', ');
  return ex.prompt || ex.prompt_he || ex.sentence || ex.audio_text || ex.text || '';
}

export async function renderReport(root, nav, { profileId }) {
  const data = await reportData(profileId);
  const today = localISO();
  const course = await loadCourse();
  const titles = course.lesson_titles;
  const sum = summarize(data, today);
  const skills = skillStats(data.attempts);
  const tips = suggestions(sum, skills, titles);
  const hard = hardestItems(data.attempts);
  const streak = computeStreak(data.days, today);
  const p = data.profile;
  const done = new Set(data.progress.filter((r) => r.status === 'done').map((r) => r.lesson_id));
  const starterUnits = p.starter ? course.starter_units || [] : [];
  const order = [...starterUnits, ...course.units].flatMap((u) => u.lessons);
  const nextId = order.find((id) => !done.has(id));
  const starterIndex = (id) => starterUnits.findIndex((u) => u.lessons.includes(id));
  const unitOf = (id) => (starterIndex(id) >= 0 ? `ABC ${starterIndex(id) + 1}`
    : course.units.findIndex((u) => u.lessons.includes(id)) + 1);

  const tile = (label, value, note) => el('div', { class: 'kpi' }, el('div', { class: 'kpi-label' }, label), el('div', { class: 'kpi-value' }, value), note ? el('div', { class: 'kpi-note' }, note) : null);

  const skillRows = skills.map((s) => {
    const state = !s.enough ? 'none' : s.accuracy >= 0.9 ? 'good' : s.accuracy < 0.75 ? 'weak' : 'ok';
    const badge = { none: 'מעט נתונים', good: '✔ חזק', weak: '▲ לחזק', ok: 'בסדר' }[state];
    return el('div', { class: `skill ${state}` },
      el('div', { class: 'skill-head' }, el('span', { class: 'skill-name' }, s.name), el('span', { class: 'skill-badge' }, badge)),
      el('div', { class: 'skill-bar' }, el('div', { class: 'skill-fill', style: `width: ${s.accuracy == null ? 0 : Math.round(s.accuracy * 100)}%` })),
      el('div', { class: 'skill-meta' },
        `${pct(s.accuracy)} הצלחה · ${s.count} תשובות`,
        s.medianSec != null ? ` · ${Math.round(s.medianSec)} שנ' לתשובה` : '',
        s.skipped ? ` · ${s.skipped} דילוגים` : ''));
  });

  const hardRows = [];
  for (const h of hard) {
    const lesson = await loadLesson(h.lesson_id).catch(() => null);
    const ex = lesson && lesson.exercises.find((e) => e.id === h.exercise_id);
    if (!ex) continue;
    hardRows.push(el('li', { class: 'hard' },
      el('div', { class: 'hard-q', dir: 'auto' }, exerciseText(ex)),
      ex.answer ? el('div', { class: 'hard-a' }, 'תשובה: ', el('span', { dir: 'auto' }, ex.answer)) : null,
      el('div', { class: 'muted small-l' }, `${titles[h.lesson_id]} · ${h.wrong} טעויות מתוך ${h.total} ניסיונות`)));
  }

  root.replaceChildren(el('div', { class: 'screen report' },
    el('div', { class: 'form-top' },
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav('reports') }, '→'),
      el('span', { class: 'avatar sm' }, p.avatar), el('h1', {}, p.name)),
    el('p', { class: 'muted report-where' },
      nextId ? `עכשיו ביחידה ${unitOf(nextId)}, שיעור "${titles[nextId]}"` : 'כל השיעורים הקיימים הושלמו',
      ` · ליגת ${TIERS[p.league?.tier ?? 0].name}`,
      p.placement ? ` · מבחן רמה: ${p.placement.correct}/${p.placement.asked}` : ''),
    el('div', { class: 'kpis' },
      tile('זמן לימוד', `${sum.totalMinutes} דק'`, sum.avgLessonMin ? `${sum.avgLessonMin.toFixed(1)} דק' לשיעור` : null),
      tile('שיעורים', `${sum.lessonsDone}`, sum.skipped ? `ועוד ${sum.skipped} דרך מבחן הרמה` : null),
      tile('דיוק', pct(sum.accuracy), `${data.attempts.filter((a) => a.outcome !== 'skipped').length} תשובות`),
      tile('רצף', `${streak} 🔥`, `${sum.activeDays7}/7 ימים השבוע`)),
    el('section', { class: 'card' }, el('h2', {}, 'המלצות'),
      el('ul', { class: 'tips' }, tips.map((t) => el('li', { class: `tip ${t.tone}` }, t.text)))),
    el('section', { class: 'card' }, el('h2', {}, 'דקות לימוד ב־14 הימים האחרונים'), activityChart(minutesByDay(data.results, today))),
    el('section', { class: 'card' }, el('h2', {}, 'לפי מיומנות'), el('div', { class: 'skills' }, skillRows)),
    hardRows.length ? el('section', { class: 'card' }, el('h2', {}, 'מה הכי קשה'), el('ol', { class: 'hard-list' }, hardRows)) : null));
}
