// The parents' area: for every learner, active time per tab, how well they
// really worked (quality), progress, and the goals the parent set. Behind a
// PIN so the kids can't change their own goals. Numbers come from
// js/insights.js; nothing here needs a server, so it works offline too.
import { el } from '../util.js';
import { listProfiles, reportData, updateProfile } from '../progress.js';
import { newId } from '../db.js';
import { localISO, addDays } from '../dates.js';
import { SUBJECTS, insights, periodRange, previousRange, goalStatus, lastPeriodStatus, goalLabel, GOAL_KINDS, MIN_FOR_QUALITY } from '../insights.js';
import { pct } from '../report.js';

// ---- PIN ----
// Kept (hashed) on every learner's synced profile, so one PIN works on all the family's devices.
const UNLOCK_MS = 10 * 60 * 1000;
let unlockedAt = 0;

async function hashPin(pin) {
  const bytes = new TextEncoder().encode(`english-app-parent:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function savePin(profiles, pin) {
  const h = await hashPin(pin);
  for (const p of profiles) { p.parent_pin = h; await updateProfile(p); }
}

function pinGate(root, nav, profiles, onOpen) {
  const known = profiles.map((p) => p.parent_pin).find(Boolean);
  const input = el('input', { class: 'text-input pin-input', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, placeholder: '••••', dir: 'ltr', 'aria-label': 'קוד הורים' });
  const msg = el('p', { class: 'pin-msg muted' }, known ? 'הקלידו את קוד ההורים.' : 'בוחרים קוד הורים (4 עד 8 ספרות). בלעדיו הילדים לא יוכלו לשנות יעדים.');
  const go = el('button', { class: 'btn primary wide', type: 'button' }, known ? 'כניסה' : 'שמירת הקוד');
  const submit = async () => {
    const pin = input.value.trim();
    if (!/^\d{4,8}$/.test(pin)) { msg.textContent = 'הקוד צריך להיות 4 עד 8 ספרות.'; return; }
    if (known && (await hashPin(pin)) !== known) { msg.textContent = 'הקוד לא נכון, נסו שוב.'; input.value = ''; input.focus(); return; }
    if (!known) await savePin(profiles, pin);
    unlockedAt = Date.now();
    onOpen();
  };
  go.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  root.replaceChildren(el('div', { class: 'screen parent pin-gate' },
    topBar(nav, 'אזור הורים', 'profiles'),
    el('div', { class: 'pin-box' },
      el('div', { class: 'pin-lock', 'aria-hidden': 'true' }, '🔒'), msg, input, go)));
  input.focus();
}

function topBar(nav, title, back, params) {
  return el('div', { class: 'form-top' },
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav(back, params) }, '→'),
    el('h1', {}, title));
}

const GRADES = [null, "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'", "ח'", "ט'", "י'", "י\"א", "י\"ב"];
const mins = (m) => (m < 1 && m > 0 ? '<1' : String(Math.round(m)));
const lessonsText = (n) => (n === 1 ? 'שיעור אחד' : `${n} שיעורים`);
const PERIODS = [['day', 'היום'], ['week', 'השבוע'], ['lastweek', 'שבוע שעבר']];
const PERIOD_WORD = { day: 'היום', week: 'השבוע', lastweek: 'בשבוע שעבר' };
let period = 'week';

function periodSwitch(onChange) {
  return el('div', { class: 'seg period-switch', role: 'group', 'aria-label': 'תקופה' }, PERIODS.map(([id, label]) =>
    el('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(period === id), onclick: () => { period = id; onChange(); } }, label)));
}

// The 0–100 quality score as a labelled pill, so a glance says what the number is.
function qualityBadge(q, big = false) {
  const tone = q == null ? 'none' : q >= 80 ? 'good' : q >= 60 ? 'ok' : 'weak';
  return el('span', { class: `quality-badge ${tone}${big ? ' big' : ''}`, title: 'ציון איכות הלמידה, 0 עד 100' },
    el('span', { class: 'qb-v' }, q == null ? '—' : String(q)), el('span', { class: 'qb-l' }, 'איכות'));
}

function subjectBars(data, range) {
  const rows = SUBJECTS.map((s) => ({ s, x: insights(data, range, s.id) }));
  const max = Math.max(1, ...rows.map((r) => r.x.activeMin));
  return el('div', { class: 'subj-rows' }, rows.map(({ s, x }) => el('div', { class: `subj-row subj-${s.id}${x.activeMin || x.answers ? '' : ' empty'}` },
    el('span', { class: 'subj-name' }, s.icon, ' ', s.name),
    el('span', { class: 'subj-bar' }, el('span', { style: `width:${Math.round((100 * x.activeMin) / max)}%` })),
    el('span', { class: 'subj-val' }, `${mins(x.activeMin)} דק'`),
    el('span', { class: 'subj-meta muted' },
      x.answers ? `${pct(x.firstTry)} נכון בניסיון ראשון · ${lessonsText(x.progress)}` : 'אין פעילות'))));
}

// One goal: label, actual/target, a bar, and how the previous day/week went.
function goalRow(st, last, onDelete) {
  const icon = st.state === 'met' ? '✅' : st.state === 'missed' ? '❌' : '⏳';
  const k = GOAL_KINDS[st.goal.kind];
  const unit = k.unit === 'מתוך 100' ? '' : ` ${k.unit}`;
  const when = st.goal.period === 'day' ? 'אתמול' : 'בשבוע שעבר';
  return el('li', { class: `goal-row ${st.state}` },
    el('span', { class: 'goal-icon', 'aria-hidden': 'true' }, icon),
    el('span', { class: 'goal-main' },
      el('span', { class: 'goal-top' },
        el('span', { class: 'goal-label' }, goalLabel(st.goal)),
        el('span', { class: 'goal-val' }, st.actual == null ? '—' : [el('bdi', { dir: 'ltr' }, `${st.actual}/${st.goal.target}`), unit])),
      el('span', { class: 'goal-bar' }, el('span', { style: `width:${Math.round(st.share * 100)}%` })),
      st.actual == null ? el('span', { class: 'goal-meta muted' }, `צריך עוד תשובות לציון (לפחות ${MIN_FOR_QUALITY})`)
        : last ? el('span', { class: `goal-meta ${last.met ? 'good' : 'muted'}` }, `${when}: ${last.met ? 'הושג ✔' : 'לא הושג'}`) : null),
    onDelete ? el('button', { class: 'icon-btn small goal-del', type: 'button', 'aria-label': 'מחיקת היעד', onclick: onDelete }, '🗑️') : null);
}

// "2/3 יעדים" chip for the card header: the one thing a parent wants to know first.
function goalSummary(sts) {
  if (!sts.length) return el('span', { class: 'goal-sum none' }, 'אין יעדים');
  const met = sts.filter((s) => s.met).length;
  const tone = met === sts.length ? 'good' : sts.some((s) => s.state === 'missed') ? 'weak' : 'open';
  return el('span', { class: `goal-sum ${tone}` }, met === sts.length ? '✔ כולם הושגו' : `${met}/${sts.length} הושגו`);
}

function kidCard(nav, p, data, today, range) {
  const x = insights(data, range);
  const prev = insights(data, previousRange(range));
  const goals = p.goals || [];
  const sts = goals.map((g) => goalStatus(g, data, today));
  const idle = !x.activeMin && !x.answers && !x.progress;
  const trend = x.firstTry != null && prev.firstTry != null && prev.items >= MIN_FOR_QUALITY
    ? Math.round((x.firstTry - prev.firstTry) * 100) : null;
  const flags = [
    x.guessShare >= 0.2 && x.answers >= 10 ? el('span', { class: 'flag warn' }, `🎲 ${pct(x.guessShare)} מהתשובות נראות כמו ניחוש`) : null,
    x.quit >= 2 ? el('span', { class: 'flag info' }, `🚪 ${x.quit} שיעורים נעזבו באמצע`) : null,
  ].filter(Boolean);
  return el('section', { class: `card kid-card${idle ? ' idle' : ''}` },
    el('div', { class: 'kid-head' },
      el('span', { class: 'avatar sm' }, p.avatar),
      el('span', { class: 'kid-name' }, el('strong', {}, p.name), GRADES[p.grade] ? el('span', { class: 'muted' }, ` · כיתה ${GRADES[p.grade]}`) : null),
      qualityBadge(x.quality)),
    idle ? el('p', { class: 'kid-idle muted' }, `עדיין אין פעילות ${PERIOD_WORD[period]}.`)
      : el('div', { class: 'kid-kpis' },
        el('div', { class: 'kk' }, el('span', { class: 'kk-v' }, mins(x.activeMin)), el('span', { class: 'kk-l' }, "דק' פעילות"),
          x.openMin - x.activeMin >= 3 ? el('span', { class: 'kk-n' }, `+${mins(x.openMin - x.activeMin)} דק' מסך פתוח בלי פעילות`) : null),
        el('div', { class: 'kk' }, el('span', { class: 'kk-v' }, String(x.progress)), el('span', { class: 'kk-l' }, 'שיעורים'),
          x.mastered ? el('span', { class: 'kk-n' }, `${x.mastered} בשליטה (80%+)`) : null),
        el('div', { class: 'kk' }, el('span', { class: 'kk-v' }, pct(x.firstTry)), el('span', { class: 'kk-l' }, 'נכון בניסיון ראשון'),
          trend ? el('span', { class: `kk-n ${trend > 0 ? 'up' : 'down'}` }, `${trend > 0 ? '▲' : '▼'} ${Math.abs(trend)}% לעומת הקודם`) : null)),
    idle ? null : subjectBars(data, range),
    flags.length ? el('div', { class: 'kid-flags' }, flags) : null,
    el('div', { class: 'kid-goals' },
      el('div', { class: 'kid-goals-head' }, el('span', { class: 'kid-goals-title' }, '🎯 יעדים'), goalSummary(sts)),
      sts.length ? el('ul', { class: 'goal-list' }, sts.map((st) => goalRow(st, period === 'lastweek' ? null : lastPeriodStatus(st.goal, data, today)))) : null),
    el('button', { class: 'link-btn kid-more', type: 'button', onclick: () => nav('parentKid', { profileId: p.id }) }, 'פירוט ויעדים ←'));
}

export async function renderParent(root, nav) {
  const profiles = await listProfiles();
  if (Date.now() - unlockedAt > UNLOCK_MS) return pinGate(root, nav, profiles, () => renderParent(root, nav));
  unlockedAt = Date.now();
  const today = localISO();
  const all = await Promise.all(profiles.map((p) => reportData(p.id)));
  const draw = () => {
    const range = periodRange(period, today);
    root.replaceChildren(el('div', { class: 'screen parent' },
      topBar(nav, 'אזור הורים', 'profiles'),
      periodSwitch(draw),
      el('p', { class: 'muted small-l parent-note' }, 'זמן פעיל נספר רק כשנוגעים במסך, מקלידים, צופים בסרטון או מדברים עם המורה. מסך שנשאר פתוח לא נספר. ', helpLink()),
      profiles.length ? profiles.map((p, i) => kidCard(nav, p, all[i], today, range)) : el('p', {}, 'עוד אין לומדים.'),
      el('div', { class: 'parent-foot' },
        el('button', { class: 'btn ghost', type: 'button', onclick: () => nav('reports') }, '📊 הדוחות המפורטים (אנגלית)'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => { unlockedAt = 0; pinGate(root, nav, profiles.map((p) => ({ ...p, parent_pin: null })), () => renderParent(root, nav)); } }, '🔑 החלפת קוד ההורים'))));
  };
  draw();
}

function helpLink() {
  const box = el('span', { class: 'quality-help', hidden: true },
    'ציון האיכות (0–100) משקלל: דיוק בניסיון הראשון (45%), כמה מעט ניחושים (25%), ריכוז, כלומר זמן פעיל מתוך הזמן שהמסך היה פתוח (15%), ותיקון טעויות (15%).');
  const b = el('button', { class: 'link-btn', type: 'button', 'aria-expanded': 'false', onclick: () => { box.hidden = !box.hidden; b.setAttribute('aria-expanded', String(!box.hidden)); } }, 'מה זה ציון איכות?');
  return el('span', {}, b, box);
}

// ---- one learner: 14 days, quality in detail, goals editor ----

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids);
  return n;
}

// Stacked bars, one per day, same frame as the report's activity chart.
function dailyChart(data, today) {
  const rows = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, -i);
    return { d, by: SUBJECTS.map((s) => insights(data, { from: d, to: d }, s.id).activeMin) };
  });
  // Like the report's chart, plus a right margin so the axis numbers never sit behind a bar.
  const W = 340, H = 140, padB = 22, padT = 18, padR = 30;
  const max = Math.max(5, ...rows.map((r) => r.by.reduce((a, b) => a + b, 0)));
  const top = Math.ceil(max);
  const step = (W - padR) / rows.length, bw = Math.min(16, step - 6);
  const scale = (m) => ((H - padB - padT) * m) / max;
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart day-chart', direction: 'ltr', role: 'img', 'aria-label': 'דקות פעילות בכל יום לפי לשונית, 14 ימים אחרונים' });
  for (const v of [0, Math.round(top / 2), top]) {
    const y = H - padB - scale(v);
    g.append(svg('line', { x1: 0, x2: W, y1: y, y2: y, class: 'grid' }));
    g.append(svg('text', { x: W - 2, y: y - 3, class: 'axis', 'text-anchor': 'end' }, v === top ? `${v} דק'` : `${v}`));
  }
  rows.forEach((r, i) => {
    // Right-to-left like the rest of the app: today is the leftmost bar.
    const x = i * step + (step - bw) / 2;
    let y = H - padB;
    const total = r.by.reduce((a, b) => a + b, 0);
    if (!total) g.append(svg('rect', { x, y: y - 1, width: bw, height: 1, class: 'bar-zero' }));
    r.by.forEach((m, j) => {
      if (!m) return;
      const h = Math.max(1.5, scale(m));
      y -= h;
      g.append(svg('rect', { x, y, width: bw, height: h, class: `bar subj-${SUBJECTS[j].id}` }));
    });
    const label = `${r.d.slice(8)}/${r.d.slice(5, 7)}: ${SUBJECTS.map((s, j) => `${s.name} ${mins(r.by[j])}`).join(', ')}`;
    g.append(svg('rect', { x: x - (step - bw) / 2, y: 0, width: step, height: H - padB, class: 'hit' }, svg('title', {}, label)));
    if (i === 0 || i === 7 || i === rows.length - 1) {
      // The two edge labels hug their bar so they don't run off the frame.
      const anchor = i === 0 ? 'start' : i === 7 ? 'middle' : 'end';
      g.append(svg('text', { x: i === 0 ? x : i === 7 ? x + bw / 2 : x + bw, y: H - 6, class: 'axis', 'text-anchor': anchor }, i === 0 ? 'היום' : `${Number(r.d.slice(8))}/${Number(r.d.slice(5, 7))}`));
    }
  });
  return el('div', { class: 'day-chart-wrap' }, g,
    el('div', { class: 'chart-legend' }, SUBJECTS.map((s) => el('span', {}, el('i', { class: `subj-${s.id}` }), s.name))));
}

function qualityDetail(x) {
  const line = (label, v, note) => el('li', {}, el('span', { class: 'qd-l' }, label), el('strong', {}, v), el('span', { class: 'muted small-l' }, note));
  return el('ul', { class: 'quality-detail' },
    line('דיוק בניסיון ראשון', pct(x.firstTry), 'מתוך כל השאלות, כמה נענו נכון כבר בפעם הראשונה'),
    line('תיקון טעויות', pct(x.fixRate), 'אחרי טעות, כמה פעמים היה ניסיון חוזר שהגיע לתשובה הנכונה'),
    line('ניחושים', pct(x.guessShare), 'תשובה שגויה תוך פחות משנייה וחצי, או 3 כרטיסים ומעלה באותה שאלה'),
    line('ריכוז', pct(x.focus), 'זמן פעיל מתוך הזמן שהמסך היה פתוח'),
    line('שיעורים בשליטה', `${x.mastered}/${x.newLessons}`, 'שיעורים חדשים שהסתיימו ב־80% ומעלה'),
    line('חזרות ותרגול', `${x.repeats + x.practice}`, 'שיעורים שנעשו שוב וסבבי תרגול'),
    x.quit ? line('נעזבו באמצע', String(x.quit), 'שיעורים שהתחילו ולא הסתיימו') : null);
}

// A small form that reads like a sentence, with a live preview of the goal it will add.
function goalEditor(p, onSave) {
  const field = (cls, attrs, ...kids) => el(cls, { class: 'text-input', ...attrs }, ...kids);
  const kind = field('select', {}, Object.entries(GOAL_KINDS).map(([id, k]) => el('option', { value: id }, k.name)));
  const subject = field('select', {}, el('option', { value: 'all' }, 'כל הלשוניות'), SUBJECTS.map((s) => el('option', { value: s.id }, `${s.icon} ${s.name}`)));
  const target = field('input', { type: 'number', min: 1, max: 600, value: 20, inputmode: 'numeric', dir: 'ltr' });
  const per = field('select', {}, el('option', { value: 'day' }, 'בכל יום'), el('option', { value: 'week' }, 'בכל שבוע'));
  const preview = el('p', { class: 'goal-preview' });
  const pending = () => {
    const t = Math.round(Number(target.value));
    return { kind: kind.value, subject: subject.value, target: kind.value === 'quality' ? Math.min(100, t) : t, period: per.value };
  };
  const refresh = () => { const g = pending(); preview.textContent = g.target > 0 ? `🎯 ${goalLabel(g)}` : ' '; };
  kind.addEventListener('change', () => {
    target.value = { minutes: 20, lessons: 2, quality: 70 }[kind.value];
    target.max = kind.value === 'quality' ? 100 : 600;
    if (kind.value === 'quality') per.value = 'week';
    refresh();
  });
  for (const f of [subject, target, per]) { f.addEventListener('change', refresh); f.addEventListener('input', refresh); }
  refresh();
  const add = el('button', { class: 'btn primary', type: 'button' }, '➕ הוספת היעד');
  add.addEventListener('click', async () => {
    const g = pending();
    if (!(g.target > 0)) return;
    p.goals = [...(p.goals || []), { id: newId().slice(0, 8), ...g }];
    await updateProfile(p);
    onSave();
  });
  const lab = (text, input) => el('label', {}, el('span', {}, text), input);
  return el('div', { class: 'goal-editor' },
    el('h3', {}, 'יעד חדש'),
    el('div', { class: 'goal-form' },
      lab('מה מודדים', kind), lab('יעד', target), lab('תקופה', per), lab('באיזו לשונית', subject)),
    preview, add);
}

export async function renderParentKid(root, nav, { profileId }) {
  if (Date.now() - unlockedAt > UNLOCK_MS) return nav('parent');
  const today = localISO();
  const data = await reportData(profileId);
  const p = data.profile;
  const draw = () => {
    const range = periodRange(period, today);
    const x = insights(data, range);
    const goals = p.goals || [];
    const remove = (g) => async () => { p.goals = goals.filter((o) => o.id !== g.id); await updateProfile(p); draw(); };
    root.replaceChildren(el('div', { class: 'screen parent parent-kid' },
      el('div', { class: 'form-top' },
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav('parent') }, '→'),
        el('span', { class: 'avatar sm' }, p.avatar), el('h1', {}, p.name), qualityBadge(x.quality, true)),
      periodSwitch(draw),
      el('section', { class: 'card' }, el('h2', {}, 'דקות פעילות ב־14 הימים האחרונים'), dailyChart(data, today)),
      el('section', { class: 'card' }, el('h2', {}, `לפי לשונית, ${PERIOD_WORD[period]}`), subjectBars(data, range)),
      el('section', { class: 'card' }, el('h2', {}, `איכות הלמידה, ${PERIOD_WORD[period]}`), qualityDetail(x)),
      el('section', { class: 'card' }, el('h2', {}, 'יעדים'),
        goals.length ? el('ul', { class: 'goal-list' }, goals.map((g) => goalRow(goalStatus(g, data, today), lastPeriodStatus(g, data, today), remove(g))))
          : el('p', { class: 'muted small-l' }, 'עוד אין יעדים. יעד שתוסיפו כאן יופיע גם במסך הבית של הילד/ה.'),
        goalEditor(p, draw)),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => nav('report', { profileId }) }, '📊 הדוח המפורט (אנגלית)')));
  };
  draw();
}

// On the learner's own home screen: the parent's goals and how far along they are.
export async function goalStrip(profile) {
  const goals = (profile.goals || []).filter((g) => g.kind !== 'quality');
  if (!goals.length) return null;
  const data = await reportData(profile.id);
  const today = localISO();
  return el('div', { class: 'goal-strip', role: 'status', 'aria-label': 'היעדים שלי' },
    el('span', { class: 'goal-strip-title' }, '🎯 היעדים שלי'),
    goals.map((g) => {
      const st = goalStatus(g, data, today);
      const subj = SUBJECTS.find((s) => s.id === g.subject);
      return el('span', { class: `goal-chip ${st.met ? 'met' : ''}`, title: goalLabel(g) },
        subj ? `${subj.icon} ` : '', g.kind === 'minutes' ? '⏱ ' : '📚 ',
        el('b', {}, `${st.actual}/${g.target}`), g.kind === 'minutes' ? " דק'" : '', g.period === 'day' ? ' היום' : ' השבוע', st.met ? ' ✔' : '');
    }));
}
