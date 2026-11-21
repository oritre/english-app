// Every video in the app on one page, for the parents (ori, 2026-11-21): the
// animated general-knowledge films made here (lessons k-…-fN, played by the same
// storybook player as in a lesson), the general-knowledge videos and the weekly
// parasha videos (data/videos.json, streamed from the home Pi like everywhere
// else, so it works with HomeGuard's internet off), and the parasha puppet film
// that the tab no longer shows. Watch one, or a whole topic in a row: when one
// ends the next one starts. Nothing here counts as a learner's progress.
import { el } from '../util.js';
import { loadKnow, loadParasha, loadLesson } from '../course.js';
import { videoUrl } from '../media.js';
import { renderParashaFilm } from '../exercises/parasha.js';

const FILM_ID = /-f\d+$/;
const KINDS = [['all', 'הכול'], ['film', '🎞️ סרטים שיצרנו'], ['video', '🎬 סרטונים']];
const LEVELS = [[1, "א'–ג'"], [2, "ד'–ו'"], [3, "ז' ומעלה"]];
const PUPPETS = { kind: 'film', id: 'p-vayetze-puppets', src: 'tests/fixtures/p-vayetze-film.json', title: 'סרט הבובות: פרשת ויצא', note: 'הכנו, ולא מוצג לילדים' };
let kind = 'all';
let level = 2;
let auto = true;

// Topics in the app's order, each with its playable items.
export async function videoCatalog() {
  const [know, parasha, vids] = await Promise.all([loadKnow(), loadParasha(),
    fetch('data/videos.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])]);
  const yt = new Map();
  for (const v of vids) if (!yt.has(v.lesson)) yt.set(v.lesson, v);
  const groups = [];
  const add = (tab, data, extra = []) => {
    for (const c of data.courses || []) {
      const items = (c.units || []).flatMap((u) => u.lessons || []).map((id) => {
        const v = yt.get(id);
        if (v) return { kind: 'video', id, youtube: v.youtube, title: v.title_he || data.lesson_titles?.[id] || id };
        if (tab === 'know' && FILM_ID.test(id)) return { kind: 'film', id, title: data.lesson_titles?.[id] || id };
        return null;
      }).filter(Boolean);
      if (c.id === 'bereshit' && tab === 'parasha') items.push(...extra);
      if (items.length) groups.push({ key: `${tab}-${c.id}`, tab, icon: c.icon || '🎬', color: c.color || '', title: c.title_he, items });
    }
  };
  add('know', know);
  add('parasha', parasha, [PUPPETS]);
  return groups;
}

// The cut of a film for the chosen level, or the nearest one it has.
export function filmCut(films, want) {
  return [...films].sort((a, b) => Math.abs((a.level || 2) - want) - Math.abs((b.level || 2) - want) || (b.level || 0) - (a.level || 0))[0] || null;
}

function topBar(nav) {
  return el('div', { class: 'form-top' },
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav('parent') }, '→'),
    el('h1', {}, 'כל הסרטונים'));
}

export async function renderVideos(root, nav) {
  const groups = await videoCatalog();
  const player = el('div', { class: 'vg-player', hidden: true });
  const list = el('div', { class: 'vg-list' });
  const counts = el('p', { class: 'muted small-l parent-note' });
  let queue = []; // the items playing in a row
  let at = -1;
  let token = 0;
  let nextTimer = 0;

  const shown = (g) => g.items.filter((it) => kind === 'all' || it.kind === kind);

  const stop = () => { token++; clearTimeout(nextTimer); player.replaceChildren(); };
  const next = () => { if (player.isConnected && at + 1 < queue.length) play(queue, at + 1); };
  const later = (ms) => { clearTimeout(nextTimer); if (auto && at + 1 < queue.length) nextTimer = setTimeout(next, ms); };

  async function play(items, i) {
    stop();
    queue = items; at = i;
    const it = items[i];
    const mine = token;
    const box = el('div', { class: 'vg-stage' });
    const msg = el('p', { class: 'muted small vg-msg', role: 'status' });
    const nav2 = el('div', { class: 'vg-nav' },
      el('button', { class: 'btn ghost', type: 'button', disabled: i === 0, onclick: () => play(queue, at - 1) }, '→ הקודם'),
      el('span', { class: 'vg-pos' }, `${i + 1} מתוך ${items.length}`),
      el('button', { class: 'btn ghost', type: 'button', disabled: i + 1 >= items.length, onclick: next }, 'הבא ←'));
    player.hidden = false;
    player.replaceChildren(el('h2', { class: 'vg-now' }, it.kind === 'film' ? '🎞️ ' : '🎬 ', it.title), box, msg, nav2);
    paintList();
    player.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (it.kind === 'video') {
      const src = await videoUrl(it.youtube);
      if (mine !== token) return;
      if (!src) { msg.textContent = 'כדי לראות סרטונים, צריך לחבר את המכשיר למשפחה (בהגדרות, סנכרון).'; return; }
      const video = el('video', { src, controls: '', autoplay: '', playsinline: '', preload: 'metadata', controlslist: 'nodownload' });
      video.addEventListener('ended', () => { if (mine === token) later(1500); });
      video.addEventListener('error', () => { if (mine !== token) return; msg.textContent = 'הסרטון לא נטען. אולי אין חיבור לשרת של הבית, או שהוא עוד יורד אליו.'; later(4000); });
      box.append(video);
      video.play?.()?.catch?.(() => { msg.textContent = 'לוחצים ▶ כדי להתחיל.'; });
      const off = setInterval(() => { if (!video.isConnected) { video.pause(); video.removeAttribute('src'); video.load(); clearInterval(off); } }, 1000);
      return;
    }
    let lesson;
    try { lesson = it.src ? await fetch(it.src).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }) : await loadLesson(it.id); }
    catch { if (mine === token) { msg.textContent = 'הסרט לא נטען. נסו שוב.'; later(3000); } return; }
    if (mine !== token) return;
    const ex = filmCut((lesson.exercises || []).filter((e) => e.type === 'parasha_film'), level);
    if (!ex) { msg.textContent = 'לא נמצא סרט בשיעור הזה.'; later(3000); return; }
    const lv = LEVELS.find(([n]) => n === ex.level);
    msg.textContent = [it.note, lv && `גרסה לכיתות ${lv[1]}`].filter(Boolean).join(' · ');
    renderParashaFilm(box, { ...ex, id: `gallery-${ex.id || it.id}` }, { setReady: () => {} });
    // The film opens on its title card; start it, since the parent already chose to watch.
    setTimeout(() => { if (mine === token) box.querySelector('.pf-title .pf-cta')?.click(); }, 400);
    const frame = box.querySelector('.pf-frame');
    if (frame) {
      const seen = new MutationObserver(() => { if (frame.classList.contains('at-end') && mine === token) { seen.disconnect(); later(5000); } });
      seen.observe(frame, { attributes: true, attributeFilter: ['class'] });
    }
  }

  const seg = (opts, cur, set, label) => el('div', { class: 'seg', role: 'group', 'aria-label': label }, opts.map(([id, text]) =>
    el('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(cur() === id), onclick: () => { set(id); draw(); } }, text)));

  function paintList() {
    const cur = queue[at];
    list.querySelectorAll('.vg-item').forEach((b) => b.setAttribute('aria-current', String(!!cur && b.dataset.id === cur.id)));
  }

  function draw() {
    const vis = groups.map((g) => ({ g, items: shown(g) })).filter((x) => x.items.length);
    const all = vis.flatMap((x) => x.items);
    const films = all.filter((x) => x.kind === 'film').length;
    counts.textContent = `${films} סרטים מונפשים שיצרנו ו־${all.length - films} סרטונים (ידע כללי ופרשת שבוע, מערוצים שאושרו). הם מגיעים מהשרת של הבית, וזה לא נספר כצפייה של אחד הילדים.`;
    list.replaceChildren(...vis.map(({ g, items }) => el('section', { class: 'card vg-group', style: g.color ? `--vg-c:${g.color}` : null },
      el('div', { class: 'vg-head' },
        el('h2', {}, `${g.icon} ${g.title}`),
        el('span', { class: 'muted small' }, String(items.length)),
        el('button', { class: 'btn small', type: 'button', onclick: () => play(items, 0) }, '▶ ברצף')),
      el('div', { class: 'vg-items' }, items.map((it, i) => el('button', {
        class: 'vg-item', type: 'button', 'data-id': it.id, onclick: () => play(items, i),
      }, el('span', { class: 'vg-ico', 'aria-hidden': 'true' }, it.kind === 'film' ? '🎞️' : '🎬'), el('span', {}, it.title)))))));
    controls.replaceChildren(
      seg(KINDS, () => kind, (v) => { kind = v; }, 'סוג'),
      kind !== 'video' ? el('div', { class: 'vg-level' }, el('span', { class: 'muted small' }, 'גרסת הסרטים:'), seg(LEVELS, () => level, (v) => { level = v; }, 'גרסה')) : null,
      el('label', { class: 'vg-auto' }, el('input', { type: 'checkbox', checked: auto, onchange: (e) => { auto = e.target.checked; if (!auto) clearTimeout(nextTimer); } }), ' כשנגמר, ממשיכים לבא'),
      all.length ? el('button', { class: 'btn primary', type: 'button', onclick: () => play(all, 0) }, '▶ לנגן הכול ברצף') : null);
    paintList();
  }

  const controls = el('div', { class: 'vg-controls' });
  root.replaceChildren(el('div', { class: 'screen parent videos' }, topBar(nav), counts, controls, player, list));
  draw();
}
