import { el, mixed } from '../util.js';
import { loadLesson } from '../course.js';
import { rendererFor, isSupported } from '../exercises/index.js';
import { checkAnswer } from '../check.js';
import { diagnose } from '../grammar.js';
import { glossify, closePop } from '../gloss.js';
import { speak } from '../speech.js';
import { getSettings } from '../settings.js';
import { xpForLesson } from '../streak.js';
import { saveLessonResult, logAttempt, getProfile } from '../progress.js';

// Runs one lesson: every exercise once, wrong ones re-queued at the end until
// answered right. Progress bar counts first-time-right plus fixed mistakes.
const answerIsHebrew = (ex) => ex.type === 'translate_en_he' || (ex.type === 'listen_translate' && ex.lang === 'en')
  || (ex.type === 'read' && /[\u0590-\u05FF]/.test(ex.answer));

export async function renderLesson(root, nav, { lessonId }) {
  const lesson = await loadLesson(lessonId);
  const exercises = lesson.exercises.filter(isSupported);
  const voiceTyping = !!(await getProfile())?.voice_typing;
  const queue = exercises.slice();
  const mistakes = new Set();
  let total = exercises.length;
  let solved = 0;
  const started = Date.now();

  const bar = el('div', { class: 'progress-fill' });
  const quit = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'יציאה' }, '✕');
  const quitDialog = el('div', { class: 'quit-dialog', hidden: true },
    el('p', {}, 'לצאת מהשיעור? ההתקדמות בשיעור הזה לא תישמר.'),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', type: 'button', onclick: () => { quitDialog.hidden = true; } }, 'להמשיך ללמוד'),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => nav('path') }, 'יציאה')));
  quit.addEventListener('click', () => { quitDialog.hidden = false; });
  const homeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'מסך הבית', onclick: () => { quitDialog.hidden = false; } }, '🏠');
  const body = el('main', { class: 'ex-body' });
  const checkBtn = el('button', { class: 'btn primary wide', type: 'button', disabled: true }, 'בדיקה');
  const footer = el('footer', { class: 'lesson-footer' }, checkBtn);
  root.replaceChildren(el('div', { class: 'screen lesson' },
    el('div', { class: 'lesson-top' }, quit, el('div', { class: 'progress' }, bar), homeBtn),
    body, footer, quitDialog));

  // Every tap inside an exercise is kept with its answer: which cards were
  // tried before the final one, audio replays, meanings looked up. The report
  // turns this into confusions and hesitations.
  let shownCount = 0;
  let taps = [];
  let tapStart = Date.now();
  const record = (k, v) => { if (taps.length < 40) taps.push({ k, v: String(v ?? '').slice(0, 60), t: Date.now() - tapStart }); };
  const TAP_KINDS = [['.speaker.slow', 'slow'], ['.speaker', 'play'], ['.gloss', 'gloss'], ['.mic', 'mic'],
    ['.spell-slot', 'unplace'], ['.spell-tile', 'letter'], ['.choice-card, .read-option', 'choice'], ['.tile', 'tile']];
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !body.contains(btn)) return;
    const kind = TAP_KINDS.find(([sel]) => btn.matches(sel));
    if (kind) record(kind[1], btn.dataset.value ?? btn.textContent.trim());
  }, true);

  const setProgress = () => { bar.style.width = `${Math.round((solved / total) * 100)}%`; };

  function next() {
    setProgress();
    footer.className = 'lesson-footer';
    if (queue.length === 0) {
      // Clear the last exercise while the result saves, so nothing can be tapped twice.
      body.replaceChildren();
      footer.replaceChildren();
      return finishLesson();
    }
    const ex = queue.shift();
    body.replaceChildren();
    checkBtn.textContent = 'בדיקה';
    checkBtn.disabled = true;
    let handled = false;
    const shownAt = Date.now();
    shownCount++;
    taps = [];
    tapStart = shownAt;
    const log = (outcome, given) => logAttempt({
      lessonId, exercise: ex, outcome, ms: Date.now() - shownAt,
      given: given == null ? null : String(given), expected: ex.answer ?? null,
      taps: taps.slice(), pos: shownCount, lessonSec: Math.round((shownAt - started) / 1000),
    });

    closePop();
    const api = rendererFor(ex)(body, ex, {
      gloss: (text) => glossify(text, lesson.new_words),
      track: (k, v) => record(k, v),
      voiceTyping,
      setReady: (ok) => { checkBtn.disabled = !ok; },
      finish: (clean) => {
        handled = true;
        log(clean ? 'correct' : 'retry');
        showFeedback(ex, clean ? 'correct' : 'correct-after-tries', null);
      },
      // Speaking can be paused ("can't talk now"): drop every speaking exercise
      // left in this lesson without counting it as a mistake.
      skip: () => {
        log('skipped');
        const before = queue.length;
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].type === 'speak') queue.splice(i, 1);
        total -= 1 + (before - queue.length);
        next();
      },
    });

    // Explanation cards: nothing to check, just move on.
    if (api.info) {
      checkBtn.textContent = 'הבנתי, ממשיכים';
      checkBtn.disabled = false;
      checkBtn.onclick = () => { solved++; next(); };
      return;
    }

    checkBtn.onclick = () => {
      if (handled) return;
      if (api.selfChecking) return;
      handled = true;
      const given = api.getAnswer();
      const { result, expected } = checkAnswer(given, ex.answer, ex.alternatives || [], { allowTypos: !!api.allowTypos });
      log(result === 'wrong' ? 'wrong' : result === 'typo' ? 'typo' : 'correct', given);
      if (result === 'wrong') {
        mistakes.add(ex.id);
        queue.push(ex);
      }
      const englishOut = ex.type === 'translate_en_he' ? ex.prompt
        : ex.type === 'listen_translate' ? (ex.lang === 'en' ? ex.audio_text : expected)
        : ex.type === 'fill_blank' ? api.fullSentence() : expected;
      if (result !== 'wrong' && englishOut && getSettings().autoplay && !['choose', 'read', 'pick', 'spell'].includes(ex.type)) speak(englishOut);
      // Grammar explanation for English answers that are wrong for a grammar reason.
      const grammarNote = result === 'wrong' && !answerIsHebrew(ex) && !['choose', 'fill_blank', 'read', 'pick', 'spell'].includes(ex.type)
        ? diagnose(api.getAnswer(), expected) : null;
      showFeedback(ex, result, expected, grammarNote);
    };
  }

  function showFeedback(ex, result, expected, grammarNote = null) {
    const ok = result !== 'wrong';
    if (ok) solved++;
    if (result === 'correct-after-tries') mistakes.add(ex.id);
    setProgress();
    const title = result === 'wrong' ? 'לא בדיוק' : result === 'typo' ? 'כמעט! שימו לב לאיות' : 'מעולה!';
    const sheet = el('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
      el('div', { class: 'feedback-title' }, ok ? '✔ ' : '✘ ', title),
      (result === 'wrong' || result === 'typo') && expected
        ? el('div', { class: 'feedback-answer' }, 'התשובה הנכונה: ',
            el('span', { dir: answerIsHebrew(ex) ? 'rtl' : 'ltr' }, expected))
        : null,
      ex.type === 'listen_translate' && result !== 'correct'
        ? el('div', { class: 'feedback-explain' }, 'נאמר: ', el('span', { dir: ex.lang === 'he' ? 'rtl' : 'ltr' }, ex.audio_text))
        : null,
      grammarNote ? el('div', { class: 'feedback-explain grammar' }, '📘 ', ...mixed(grammarNote))
        : ex.explain_he && result !== 'correct' ? el('div', { class: 'feedback-explain grammar' }, '📘 ', ...mixed(ex.explain_he))
          : ex.explain_he ? el('div', { class: 'feedback-explain' }, ...mixed(ex.explain_he)) : null);
    footer.replaceChildren(sheet, checkBtn);
    footer.className = `lesson-footer ${ok ? 'good' : 'bad'}`;
    checkBtn.disabled = false;
    checkBtn.textContent = 'המשך';
    checkBtn.onclick = () => { footer.replaceChildren(checkBtn); next(); };
  }

  async function finishLesson() {
    const durationS = Math.round((Date.now() - started) / 1000);
    const accuracy = Math.round(((total - mistakes.size) / total) * 100);
    const xp = xpForLesson({ mistakes: mistakes.size, total });
    const streakInfo = await saveLessonResult({ lessonId, xp, accuracy, durationS, mistakes: [...mistakes] });
    nav('complete', { xp, accuracy, durationS, ...streakInfo, lessonTitle: lesson.title_he });
  }

  next();
}
