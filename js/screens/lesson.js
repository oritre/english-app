import { el } from '../util.js';
import { loadLesson } from '../course.js';
import { RENDERERS, isSupported } from '../exercises/index.js';
import { checkAnswer } from '../check.js';
import { speak } from '../speech.js';
import { xpForLesson } from '../streak.js';
import { saveLessonResult } from '../progress.js';

// Runs one lesson: every exercise once, wrong ones re-queued at the end until
// answered right. Progress bar counts first-time-right plus fixed mistakes.
export async function renderLesson(root, nav, { lessonId }) {
  const lesson = await loadLesson(lessonId);
  const exercises = lesson.exercises.filter(isSupported);
  const queue = exercises.slice();
  const mistakes = new Set();
  const total = exercises.length;
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
    if (queue.length === 0) return finishLesson();
    const ex = queue.shift();
    body.replaceChildren();
    checkBtn.textContent = 'בדיקה';
    checkBtn.disabled = true;
    let handled = false;

    const api = RENDERERS[ex.type](body, ex, {
      setReady: (ok) => { checkBtn.disabled = !ok; },
      finish: (clean) => { handled = true; showFeedback(ex, clean ? 'correct' : 'correct-after-tries', null); },
    });

    checkBtn.onclick = () => {
      if (handled) return;
      if (api.selfChecking) return;
      handled = true;
      const { result, expected } = checkAnswer(api.getAnswer(), ex.answer, ex.alternatives || [], { allowTypos: !!api.allowTypos });
      if (result === 'wrong') {
        mistakes.add(ex.id);
        queue.push(ex);
      }
      const englishOut = ex.type === 'translate_en_he' ? ex.prompt
        : ex.type === 'fill_blank' ? api.fullSentence() : expected;
      if (result !== 'wrong' && englishOut && ex.type !== 'choose') speak(englishOut);
      showFeedback(ex, result, expected);
    };
  }

  function showFeedback(ex, result, expected) {
    const ok = result !== 'wrong';
    if (ok) solved++;
    if (result === 'correct-after-tries') mistakes.add(ex.id);
    setProgress();
    const title = result === 'wrong' ? 'לא בדיוק' : result === 'typo' ? 'כמעט! שימו לב לאיות' : 'מעולה!';
    const sheet = el('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
      el('div', { class: 'feedback-title' }, ok ? '✔ ' : '✘ ', title),
      (result === 'wrong' || result === 'typo') && expected
        ? el('div', { class: 'feedback-answer' }, 'התשובה הנכונה: ',
            el('span', { dir: ex.type === 'translate_en_he' ? 'rtl' : 'ltr' }, expected))
        : null,
      ex.explain_he ? el('div', { class: 'feedback-explain' }, ex.explain_he) : null);
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
