import { el, en } from '../util.js';
import { getProfile, logTalk } from '../progress.js';
import { startTalk, loadTalkKey, talkSupported, TOPICS } from '../talk.js';
import { micErrorTip } from '../micTest.js';

// A spoken lesson with Sam, the AI tutor. Deliberately no transcript on screen:
// the learner listens and answers aloud, and asks for Hebrew help when stuck.
const MAX_SEC = 12 * 60;
let active = null;

// Called by the router when the learner leaves the screen some other way.
export function leaveTalk() { active?.stop(); }

function errorText(err) {
  const msg = String(err?.message || err || '');
  if (err?.code === 'no-key') return 'עוד לא הוכנס מפתח Gemini במכשיר הזה. אפשר להוסיף אותו בהגדרות.';
  if (err?.name === 'NotAllowedError' || err?.name === 'NotFoundError') return micErrorTip(err);
  if (/api key|API_KEY|permission|401|403/i.test(msg)) return 'המפתח של Gemini לא התקבל. בדקו בהגדרות שהעתקתם אותו במלואו.';
  if (/quota|429|exhausted|rate/i.test(msg)) return 'נגמרה המכסה של Gemini להיום. אפשר לנסות שוב מחר.';
  if (/import|fetch|network|Failed to/i.test(msg)) return 'לא הצלחתי להתחבר למורה. בדקו את החיבור לאינטרנט (ושהאתר לא חסום בסינון).';
  return `משהו השתבש בשיחה. נסו שוב. (${msg.slice(0, 120)})`;
}

export async function renderTalk(root, nav) {
  const profile = await getProfile();
  const home = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'מסך הבית', onclick: () => { leaveTalk(); nav('back'); } }, '🏠');
  const screen = el('div', { class: 'screen talk' });
  root.replaceChildren(screen);

  const show = (...children) => screen.replaceChildren(
    el('div', { class: 'talk-top' }, el('h1', {}, '🗣️ שיחה עם ', en('Sam')), home), ...children);

  if (!talkSupported()) {
    show(el('p', {}, 'הדפדפן הזה לא תומך בשיחה קולית. נסו ב־Chrome.'));
    return;
  }
  if (!(await loadTalkKey())) {
    show(el('p', {}, 'כדי לדבר עם המורה צריך פעם אחת להכניס מפתח Gemini במכשיר הזה.'),
      el('button', { class: 'btn primary wide', type: 'button', onclick: () => nav('settings') }, '⚙️ להגדרות'));
    return;
  }

  // Step 1: choose what to talk about.
  const pick = () => show(
    el('p', { class: 'muted' }, 'בוחרים נושא, ו־Sam מתחיל לדבר. עונים בקול, באנגלית. אם משהו לא ברור, לוחצים על "הסבר בעברית" או פשוט אומרים בעברית.'),
    el('div', { class: 'talk-topics' }, TOPICS.map((t) => el('button', {
      class: 'talk-topic', type: 'button', onclick: () => run(t),
    }, t.he))));

  // Step 2: the conversation itself.
  async function run(topic) {
    const avatar = el('div', { class: 'talk-avatar connecting' }, '🧑‍🏫');
    const state = el('p', { class: 'talk-state', 'aria-live': 'polite' }, 'מתחבר למורה...');
    const level = el('div', { class: 'talk-level' }, el('span'));
    const clock = el('span', { class: 'talk-clock', dir: 'ltr' }, '0:00');
    const helpBtn = el('button', { class: 'btn', type: 'button', disabled: true }, '🇮🇱 הסבר בעברית');
    const slowBtn = el('button', { class: 'btn', type: 'button', disabled: true }, '🐢 שוב, לאט');
    const endBtn = el('button', { class: 'btn primary wide', type: 'button', disabled: true }, '⏹️ סיום השיחה');
    show(el('p', { class: 'muted talk-topic-now' }, topic.he), avatar, state, level, clock,
      el('div', { class: 'row-btns' }, helpBtn, slowBtn), endBtn);

    let talk = null;
    let started = 0;
    let timer = 0;
    let lock = null;
    let saved = false;
    const setState = (s) => {
      avatar.className = `talk-avatar ${s}`;
      state.textContent = s === 'speaking' ? 'Sam מדבר...' : s === 'listening' ? 'תורך לדבר 🎤' : s === 'ending' ? 'Sam מסכם את השיחה...' : 'מתחבר למורה...';
    };
    const save = async () => {
      if (saved || !talk || !started) return;
      saved = true;
      const sec = Math.round((Date.now() - started) / 1000);
      await logTalk({ topic: topic.id, sec, transcript: talk.transcript });
      return sec;
    };
    const release = () => {
      clearInterval(timer);
      lock?.release?.().catch(() => {});
      if (active === handle) active = null;
    };
    const done = (sec, note) => {
      const mins = Math.max(1, Math.round((sec || 0) / 60));
      show(el('div', { class: 'celebrate' }, '🎉'),
        el('h2', {}, sec ? `דיברת באנגלית ${mins} ${mins === 1 ? 'דקה' : 'דקות'}!` : 'השיחה הסתיימה'),
        note ? el('p', { class: 'muted' }, note) : null,
        el('div', { class: 'row-btns' },
          el('button', { class: 'btn', type: 'button', onclick: pick }, '🔁 עוד שיחה'),
          el('button', { class: 'btn primary', type: 'button', onclick: () => nav('back') }, 'לדף הבית')));
    };
    const handle = {
      // Leaving mid-talk: hang up at once and keep what was said.
      stop() { release(); talk?.close(); save(); },
    };
    active = handle;

    const finish = async () => {
      if (!talk) return;
      endBtn.disabled = helpBtn.disabled = slowBtn.disabled = true;
      setState('ending');
      clearInterval(timer);
      await talk.finish();
      release();
      done(await save());
    };

    try {
      talk = await startTalk({
        name: profile.name,
        grade: profile.grade || 8,
        topic,
        focus: profile.talk_focus || '',
        on: {
          state: setState,
          level: (rms) => { level.firstChild.style.width = `${Math.min(100, Math.round(rms * 400))}%`; },
          error: (e) => console.warn('talk error', e),
          closed: async () => {
            if (active !== handle) return;
            release();
            done(await save(), 'השיחה נותקה. אפשר להתחיל שיחה חדשה.');
          },
        },
      });
    } catch (err) {
      release();
      console.warn(err);
      show(el('p', { class: 'talk-error' }, errorText(err)),
        el('div', { class: 'row-btns' },
          el('button', { class: 'btn primary', type: 'button', onclick: () => run(topic) }, 'נסו שוב'),
          err?.code === 'no-key' || /api key|401|403/i.test(String(err?.message))
            ? el('button', { class: 'btn', type: 'button', onclick: () => nav('settings') }, '⚙️ להגדרות') : null));
      return;
    }
    if (active !== handle) { talk.close(); return; }
    started = Date.now();
    try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ }
    timer = setInterval(() => {
      const sec = Math.round((Date.now() - started) / 1000);
      clock.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (sec >= MAX_SEC) finish();
    }, 1000);
    helpBtn.disabled = slowBtn.disabled = endBtn.disabled = false;
    helpBtn.onclick = () => talk.helpHebrew();
    slowBtn.onclick = () => talk.repeatSlowly();
    endBtn.onclick = finish;
  }

  pick();
}
