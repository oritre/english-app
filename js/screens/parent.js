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
  const input = el('input', { class: 'text-input pin-input', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, placeholder: '••••', dir: 'ltr' });
  const msg = el('p', { class: 'pin-msg muted' }, known ? 'קוד ההורים' : 'בוחרים קוד הורים (4 ספרות לפחות). הילדים לא יוכלו לשנות יעדים בלעדיו.');
  const go = el('button', { class: 'btn primary wide', type: 'button' }, known ? 'כניסה' : 'שמירת הקוד');
  const submit = async () => {
    const pin = input.value.trim();
    if (!/^\d{4,8}$/.test(pin)) { msg.textContent = 'הקוד צריך להיות 4 עד 8 ספרות.'; return; }
    if (known && (await hashPin(pin)) !== known) { msg.textContent = 'הקוד לא נכון.'; input.value = ''; input.focus(); return; }
    if (!known) await savePin(profiles, pin);
    unlockedAt = Date.now();
    onOpen();
  };
  go.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  root.replaceChildren(el('div', { class: 'screen parent pin-gate' },
    topBar(nav, 'אזור הורים', 'profiles'),
    el('div', { class: 'pin-lock', 'aria-hidden': 'true' }, '🔒'), msg, input, go));
  input.focus();
}

function topBar(nav, title, back, params) {
  return el('div', { class: 'form-top' },
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav(back, params) }, '→'),
    el('h1', {}, title));
}

const GRADES = [null, "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'", "ח'", "ט'", "י'", "י\"א", "י\"ב"];
const mins = (m) => (m < 1 && m > 0 ? '<1' : String(Math.round(m)));
const PERIODS = [['day', 'היום'], ['week', 'השבוע'], ['lastweek', 'שבוע שעבר']];
let period = 'week';

function periodSwitch(onChange) {
  return el('div', { class: 'seg period-switch', role: 'group', 'aria-label': 'תקופה' }, PERIODS.map(([id, label]) =>
    el('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(period === id), onclick: () => { period = id; onChange(); } }, label)));
}

function qualityBadge(q, big = false) {
  const tone = q == null ? 'none' : q >= 80 ? 'good' : q >= 60 ? 'ok' : 'weak';
  return el('span', { class: `quality-badge ${tone}${big ? ' big' : ''}`, title: 'ציון איכות הלמידה, 0 עד 100' },
    q == null ? '—' : String(q));
}

function subjectBars(data, range) {
  const rows = SUBJECTS.map((s) => ({ s, x: insights(data, range, s.id) }));
  const max = Math.max(1, ...rows.map((r) => r.x.activeMin));
  return el('div', { class: 'subj-rows' }, rows.map(({ s, x }) => el('div', { class: `subj-row subj-${s.id}${x.activeMin || x.answers ? '' : ' empty'}` },
    el('span', { class: 'subj-name' }, s.icon, ' ', s.name),
    el('span', { class: 'subj-bar' }, el('span', { style: `width:${Math.round((100 * x.activeMin) / max)}%` })),
    el('span', { class: 'subj-val' }, `${mins(x.activeMin)} דק'`),
    el('span', { class: 'subj-meta muted' },
      x.answers ? `${pct(x.firstTry)} נכון בניסיון ראשון · ${x.progress} שיעורים` : 'לא למד'))));
}

function goalRow(st, last) {
  const icon = st.state === 'met' ? '✅' : st.state === 'missed' ? '❌' : '⏳';
  const k = GOAL_KINDS[st.goal.kind];
  return el('li', { class: `goal-row ${st.state}` },
    el('span', { class: 'goal-icon', 'aria-hidden': 'true' }, icon),
    el('span', { class: 'goal-main' },
      el('span', { class: 'goal-label' }, goalLabel(st.goal)),
      el('span', { class: 'goal-bar' }, el('span', { style: `width:${Math.round(st.share * 100)}%` })),
      el('span', { class: 'goal-meta muted' },
        st.actual == null ? `עוד אין מספיק תשובות לציון (${MIN_FOR_QUALITY} לפחות)` : `${st.actual} ${k.unit === 'מתוך 100' ? '' : k.unit} מתוך ${st.goal.target}`.replace('  ', ' '),
        last ? ` · ${st.goal.period === 'day' ? 'אתמול' : 'בשבוע שעבר'}: ${last.met ? 'הושג ✔' : 'לא הושג'}` : '')));
}

function kidCard(nav, p, data, today, range) {
  const x = insights(data, range);
  const prev = insights(data, previousRange(range));
  const goals = p.goals || [];
  const trend = x.firstTry != null && prev.firstTry != null && prev.items >= MIN_FOR_QUALITY
    ? Math.round((x.firstTry - prev.firstTry) * 100) : null;
  return el('section', { class: 'card kid-card' },
    el('div', { class: 'kid-head' },
      el('span', { class: 'avatar sm' }, p.avatar),
      el('span', { class: 'kid-name' }, el('strong', {}, p.name), GRADES[p.grade] ? el('span', { class: 'muted' }, ` · כיתה ${GRADES[p.grade]}`) : null),
      qualityBadge(x.quality)),
    el('div', { class: 'kid-kpis' },
      el('div', { class: 'kk' }, el('span', { class: 'kk-v' }, mins(x.activeMin)), el('span', { class: 'kk-l' }, "דק' פעילות"),
        x.openMin - x.activeMin >= 3 ? el('span', { class: 'kk-n' }, `ועוד ${mins(x.openMin - x.activeMin)} מסך פתוח בלי פעילות`) : null),
      el('div', { class: 'kk' }, el('span', { class: 'kk-v' }, String(x.progress)), el('span', { class: 'kk-l' }, 'שיעורים'),
        x.mastered ? el('span', { class: 'kk-n' }, `${x.mastered} בשליטה (80%+)`) : null),
      el('div', { class: 'kk' }, el('span', { class: 'kk-v' }, pct(x.firstTry)), el('span', { class: 'kk-l' }, 'נכון בניסיון ראשון'),
        trend ? el('span', { class: `kk-n ${trend > 0 ? 'up' : 'down'}` }, `${trend > 0 ? '▲' : '▼'} ${Math.abs(trend)}% מהתקופה הקודמת`) : null)),
    subjectBars(data, range),
    x.guessShare >= 0.2 && x.answers >= 10 ? el('p', { class: 'tip warn' }, `${pct(x.guessShare)} מהתשובות נראות כמו ניחוש (מהירות מדי או ניסוי וטעייה).`) : null,
    x.quit >= 2 ? el('p', { class: 'tip info' }, `${x.quit} שיעורים נעזבו באמצע.`) : null,
    goals.length ? el('ul', { class: 'goal-list' }, goals.map((g) => goalRow(goalStatus(g, data, today), period === 'lastweek' ? null : lastPeriodStatus(g, data, today))))
      : el('p', { class: 'muted small-l' }, 'עוד אין יעדים.'),
    el('button', { class: 'btn wide', type: 'button', onclick: () => nav('parentKid', { profileId: p.id }) }, 'פירוט ויעדים ←'));
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
      el('p', { class: 'muted small-l parent-note' }, 'זמן פעיל = רק כשהילד נוגע במסך, מקליד, צופה בסרטון או מדבר עם המורה. מסך שנשאר פתוח לא נספר. ', helpLink()),
      profiles.length ? profiles.map((p, i) => kidCard(nav, p, all[i], today, range)) : el('p', {}, 'עוד אין לומדים.'),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => nav('reports') }, '📊 הדוחות המפורטים (אנגלית)'),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => { unlockedAt = 0; pinGate(root, nav, profiles.map((p) => ({ ...p, parent_pin: null })), () => renderParent(root, nav)); } }, '🔑 החלפת קוד ההורים')));
  };
  draw();
}

function helpLink() {
  const box = el('span', { class: 'quality-help', hidden: true },
    ' ציון האיכות (0–100) משקלל: דיוק בניסיון הראשון (45%), כמה מעט ניחושים (25%), ריכוז, כלומר זמן פעיל מתוך הזמן שהמסך היה פתוח (15%), ותיקון טעויות (15%).');
  const b = el('button', { class: 'link-btn', type: 'button', onclick: () => { box.hidden = !box.hidden; } }, 'מה זה ציון איכות?');
  return el('span', {}, b, box);
}

// ---- one learner: 14 days, quality in detail, goals editor ----

function dailyChart(data, today) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const rows = days.map((d) => ({ d, by: SUBJECTS.map((s) => insights(data, { from: d, to: d }, s.id).activeMin) }));
  const max = Math.max(10, ...rows.map((r) => r.by.reduce((a, b) => a + b, 0)));
  return el('div', { class: 'day-chart', role: 'img', 'aria-label': 'דקות פעילות בכל יום, 14 ימים אחרונים' },
    rows.map((r, i) => el('div', { class: 'day-col', title: `${r.d.slice(8)}/${r.d.slice(5, 7)}: ${SUBJECTS.map((s, j) => `${s.name} ${mins(r.by[j])}`).join(', ')}` },
      el('div', { class: 'day-stack' }, SUBJECTS.map((s, j) => (r.by[j] ? el('span', { class: `subj-${s.id}`, style: `height:${(100 * r.by[j]) / max}%` }) : null))),
      el('span', { class: 'day-label' }, i === 13 ? 'היום' : i % 3 === 1 ? `${Number(r.d.slice(8))}/${Number(r.d.slice(5, 7))}` : ''))),
    el('div', { class: 'chart-legend' }, SUBJECTS.map((s) => el('span', {}, el('i', { class: `subj-${s.id}` }), s.name))));
}

function qualityDetail(x) {
  const line = (label, v, note) => el('li', {}, el('span', { class: 'qd-l' }, label), el('strong', {}, v), el('span', { class: 'muted small-l' }, note));
  return el('ul', { class: 'quality-detail' },
    line('דיוק בניסיון ראשון', pct(x.firstTry), 'מתוך כל השאלות, כמה נענו נכון כבר בפעם הראשונה'),
    line('תיקון טעויות', pct(x.fixRate), 'אחרי טעות, כמה פעמים ניסה שוב והגיע לתשובה הנכונה'),
    line('ניחושים', pct(x.guessShare), 'תשובה שגויה תוך פחות משנייה וחצי, או 3 כרטיסים ומעלה באותה שאלה'),
    line('ריכוז', pct(x.focus), 'זמן פעיל מתוך הזמן שהמסך היה פתוח'),
    line('שיעורים בשליטה', `${x.mastered}/${x.newLessons}`, 'שיעורים חדשים שהסתיימו ב־80% ומעלה'),
    line('חזרות ותרגול', `${x.repeats + x.practice}`, 'שיעורים שנעשו שוב וסבבי תרגול'),
    x.quit ? line('נעזבו באמצע', String(x.quit), 'שיעורים שהתחיל ולא סיים') : null);
}

function goalEditor(p, onSave) {
  const kind = el('select', { class: 'text-input' }, Object.entries(GOAL_KINDS).map(([id, k]) => el('option', { value: id }, k.name)));
  const subject = el('select', { class: 'text-input' }, el('option', { value: 'all' }, 'כל הלשוניות'), SUBJECTS.map((s) => el('option', { value: s.id }, `${s.icon} ${s.name}`)));
  const target = el('input', { class: 'text-input', type: 'number', min: 1, max: 600, value: 20, inputmode: 'numeric', dir: 'ltr' });
  const per = el('select', { class: 'text-input' }, el('option', { value: 'day' }, 'ביום'), el('option', { value: 'week' }, 'בשבוע'));
  kind.addEventListener('change', () => {
    target.value = { minutes: 20, lessons: 2, quality: 70 }[kind.value];
    if (kind.value === 'quality') per.value = 'week';
  });
  const add = el('button', { class: 'btn primary', type: 'button' }, '➕ הוספת יעד');
  add.addEventListener('click', async () => {
    const t = Math.round(Number(target.value));
    if (!(t > 0)) return;
    p.goals = [...(p.goals || []), { id: newId().slice(0, 8), kind: kind.value, subject: subject.value, target: kind.value === 'quality' ? Math.min(100, t) : t, period: per.value }];
    await updateProfile(p);
    onSave();
  });
  const list = (p.goals || []).map((g) => el('li', { class: 'goal-edit' }, el('span', {}, goalLabel(g)),
    el('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'מחיקת היעד', onclick: async () => { p.goals = p.goals.filter((x) => x.id !== g.id); await updateProfile(p); onSave(); } }, '🗑️')));
  return el('div', { class: 'goal-editor' },
    list.length ? el('ul', { class: 'goal-edit-list' }, list) : null,
    el('div', { class: 'goal-form' },
      el('label', {}, 'מה מודדים', kind), el('label', {}, 'איפה', subject),
      el('label', {}, 'כמה', target), el('label', {}, 'כל', per)),
    add);
}

export async function renderParentKid(root, nav, { profileId }) {
  if (Date.now() - unlockedAt > UNLOCK_MS) return nav('parent');
  const today = localISO();
  const data = await reportData(profileId);
  const p = data.profile;
  const draw = () => {
    const range = periodRange(period, today);
    const x = insights(data, range);
    root.replaceChildren(el('div', { class: 'screen parent parent-kid' },
      el('div', { class: 'form-top' },
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav('parent') }, '→'),
        el('span', { class: 'avatar sm' }, p.avatar), el('h1', {}, p.name), qualityBadge(x.quality, true)),
      periodSwitch(draw),
      el('section', { class: 'card' }, el('h2', {}, 'דקות פעילות, 14 ימים'), dailyChart(data, today)),
      el('section', { class: 'card' }, el('h2', {}, 'לפי לשונית'), subjectBars(data, range)),
      el('section', { class: 'card' }, el('h2', {}, 'איכות הלמידה'), qualityDetail(x)),
      el('section', { class: 'card' }, el('h2', {}, 'יעדים'),
        (p.goals || []).length ? el('ul', { class: 'goal-list' }, p.goals.map((g) => goalRow(goalStatus(g, data, today), lastPeriodStatus(g, data, today)))) : null,
        goalEditor(p, draw)),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => nav('report', { profileId }) }, '📊 הדוח המפורט')));
  };
  draw();
}

// On the learner's own home screen: the parent's goals and how far along they are.
export async function goalStrip(profile) {
  const goals = (profile.goals || []).filter((g) => g.kind !== 'quality');
  if (!goals.length) return null;
  const data = await reportData(profile.id);
  const today = localISO();
  return el('div', { class: 'goal-strip', role: 'status' },
    el('span', { class: 'goal-strip-title' }, '🎯 היעדים שלי'),
    goals.map((g) => {
      const st = goalStatus(g, data, today);
      const subj = SUBJECTS.find((s) => s.id === g.subject);
      return el('span', { class: `goal-chip ${st.met ? 'met' : ''}`, title: goalLabel(g) },
        subj ? `${subj.icon} ` : '', g.kind === 'minutes' ? '⏱ ' : '📚 ',
        `${st.actual}/${g.target}`, g.kind === 'minutes' ? " דק'" : '', g.period === 'day' ? ' היום' : ' השבוע', st.met ? ' ✔' : '');
    }));
}
