import { el, mixed } from '../util.js';
import { loadLesson } from '../course.js';
import { rendererFor, isSupported } from '../exercises/index.js';
import { checkAnswer } from '../check.js';
import { diagnose } from '../grammar.js';
import { glossify, closePop } from '../gloss.js';
import { speak } from '../speech.js';
import { xpForLesson } from '../streak.js';
import { saveLessonResult, logAttempt } from '../progress.js';

// Runs one lesson: every exercise once, wrong ones re-queued at the end until
// answered right. Progress bar counts first-time-right plus fixed mistakes.
const answerIsHebrew = (ex) => ex.type === 'translate_en_he' || (ex.type === 'listen_translate' && ex.lang === 'en')
  || (ex.type === 'read' && /[\u0590-\u05FF]/.test(ex.answer));

export async function renderLesson(root, nav, { lessonId }) {
  const lesson = await loadLesson(lessonId);
  const exercises = lesson.exercises.filter(isSupported);
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
  const body = el('main', { class: 'ex-body' });
  const checkBtn = el('button', { class: 'btn primary wide', type: 'button', disabled: true }, 'בדיקה');
  const footer = el('footer', { class: 'lesson-footer' }, checkBtn);
  root.replaceChildren(el('div', { class: 'screen lesson' },
    el('div', { class: 'lesson-top' }, quit, el('div', { class: 'progress' }, bar)),
    body, footer, quitDialog));

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
    const log = (outcome) => logAttempt({ lessonId, exercise: ex, outcome, ms: Date.now() - shownAt });

    closePop();
    const api = rendererFor(ex)(body, ex, {
      gloss: (text) => glossify(text, lesson.new_words),
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

    checkBtn.onclick = () => {
      if (handled) return;
      if (api.selfChecking) return;
      handled = true;
      const { result, expected } = checkAnswer(api.getAnswer(), ex.answer, ex.alternatives || [], { allowTypos: !!api.allowTypos });
      log(result === 'wrong' ? 'wrong' : result === 'typo' ? 'typo' : 'correct');
      if (result === 'wrong') {
        mistakes.add(ex.id);
        queue.push(ex);
      }
      const englishOut = ex.type === 'translate_en_he' ? ex.prompt
        : ex.type === 'listen_translate' ? (ex.lang === 'en' ? ex.audio_text : expected)
        : ex.type === 'fill_blank' ? api.fullSentence() : expected;
      if (result !== 'wrong' && englishOut && ex.type !== 'choose' && ex.type !== 'read') speak(englishOut);
      // Grammar explanation for English answers that are wrong for a grammar reason.
      const grammarNote = result === 'wrong' && !answerIsHebrew(ex) && !['choose', 'fill_blank', 'read'].includes(ex.type)
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
