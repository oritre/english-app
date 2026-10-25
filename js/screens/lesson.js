import { el, mixed } from '../util.js';
import { loadLesson, loadThink, loadKnow } from '../course.js';
import { rendererFor, isSupported } from '../exercises/index.js';
import { forGrade } from '../storyLogic.js';
import { withoutTyping } from '../typing.js';
import { checkAnswer } from '../check.js';
import { diagnose } from '../grammar.js';
import { glossify, closePop } from '../gloss.js';
import { speak, speakSequence, canSpeakLang } from '../speech.js';
import { getSettings, setSetting, RATE_CHOICES } from '../settings.js';
import { xpForLesson } from '../streak.js';
import { saveLessonResult, logAttempt, getProfile } from '../progress.js';
import { COACH_LESSON, coachLesson } from '../coach.js';
import { THINK_TYPES, txt, setReadAloud } from '../exercises/think.js';

// Runs one lesson: every exercise once, wrong ones re-queued at the end until
// answered right. Progress bar counts first-time-right plus fixed mistakes.
const answerIsHebrew = (ex) => ex.type === 'translate_en_he' || (ex.type === 'listen_translate' && ex.lang === 'en')
  || (ex.type === 'read' && /[\u0590-\u05FF]/.test(ex.answer));

export async function renderLesson(root, nav, { lessonId, module = 0 }) {
  const profile = await getProfile();
  if (profile?.asr && getSettings().asr !== profile.asr) setSetting('asr', profile.asr);
  const lesson = lessonId === COACH_LESSON ? coachLesson(profile, module) : await loadLesson(lessonId);
  if (lessonId === COACH_LESSON) lessonId = lesson.id;
  const exercises = withoutTyping(forGrade(lesson.exercises, profile?.grade), profile).filter(isSupported);
  const voiceTyping = !!profile?.voice_typing;
  // Young readers (grades 1-2) hear every question unless turned off in settings.
  setReadAloud(profile?.read_aloud ?? (parseInt(profile?.grade, 10) <= 2));
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
  // Reading speed, changeable mid-lesson: the choice is kept for the next lessons too.
  const speedRow = el('div', { class: 'speed-row', hidden: true }, RATE_CHOICES.map(([id, label]) => {
    const b = el('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(getSettings().rate === id) }, label);
    b.addEventListener('click', () => {
      setSetting('rate', id);
      speedRow.querySelectorAll('.seg-btn').forEach((x, i) => x.setAttribute('aria-pressed', String(RATE_CHOICES[i][0] === id)));
      speak('This is the new speed.');
    });
    return b;
  }));
  const speedBtn = el('button', { class: 'icon-btn speed-btn', type: 'button', 'aria-label': 'מהירות ההקראה', onclick: () => { speedRow.hidden = !speedRow.hidden; } }, '🐢');
  const body = el('main', { class: 'ex-body' });
  const checkBtn = el('button', { class: 'btn primary wide', type: 'button', disabled: true }, 'בדיקה');
  const footer = el('footer', { class: 'lesson-footer' }, checkBtn);
  const screen = el('div', { class: `screen lesson ${lesson.course ? 'think-lesson' : ''}` },
    el('div', { class: 'lesson-top' }, quit, el('div', { class: 'progress' }, bar), speedBtn, homeBtn),
    speedRow, body, footer, quitDialog);
  root.replaceChildren(screen);
  // A think lesson borrows its course's colour for the manipulatives and the progress bar.
  if (lesson.course) Promise.all([loadThink(), loadKnow()]).then((cats) => { const c = cats.flatMap((t) => t.courses || []).find((x) => x.id === lesson.course); if (c) screen.style.setProperty('--course', c.color); }).catch(() => {});

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
    let retried = false;
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
    // A cartoon (story / video) holds the button until it has played to the end.
    if (api.info) {
      checkBtn.textContent = api.nextLabel || 'הבנתי, ממשיכים';
      checkBtn.disabled = !!api.gated && !api.ready?.();
      checkBtn.onclick = () => { solved++; next(); };
      return;
    }

    checkBtn.onclick = () => {
      if (handled) return;
      if (api.selfChecking) return;
      handled = true;
      const given = api.getAnswer();
      // Math and logic exercises check themselves (numbers, fractions, positions).
      if (api.check) {
        const right = api.check();
        log(right ? 'correct' : 'wrong', given);
        if (right) { showFeedback(ex, retried ? 'correct-after-tries' : 'correct', api.expectedText()); return; }
        mistakes.add(ex.id);
        // One more go before the answer is shown: the exercise stays as it is, so the learner can fix it.
        const reveal = () => { queue.push(ex); body.classList.add('revealed'); api.reveal?.(); showFeedback(ex, 'wrong', api.expectedText()); };
        if (!retried) {
          retried = true;
          showRetry(ex, () => {
            handled = false; footer.replaceChildren(checkBtn); footer.className = 'lesson-footer';
            // A wrong choice stays greyed out with ✗, so the next pick is a different one.
            body.querySelectorAll('.choice-card.selected').forEach((c) => { c.classList.remove('selected'); c.classList.add('was-wrong'); c.disabled = true; });
          }, reveal);
          return;
        }
        reveal();
        return;
      }
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

  // A wrong answer on a think exercise: a nudge (and the hint, if there is one), then "try again".
  function showRetry(ex, again, reveal) {
    const sheet = el('div', { class: 'feedback bad retry' },
      el('div', { class: 'feedback-title' }, '💪 ', 'לא בדיוק'),
      el('div', { class: 'feedback-explain' }, ex.hint_he ? ['💡 ', ...mixed(ex.hint_he)] : 'אפשר לנסות שוב, או לראות את הפתרון.'));
    const tryBtn = el('button', { class: 'btn primary wide', type: 'button', onclick: again }, '🔁 נסו שוב');
    const showBtn = el('button', { class: 'btn wide', type: 'button', onclick: reveal }, '👀 הראו לי');
    footer.replaceChildren(sheet, el('div', { class: 'retry-row' }, tryBtn, showBtn));
    footer.className = 'lesson-footer bad';
  }

  // Splits an explanation into short steps of one or two sentences.
  const pageSentences = (text) => {
    const parts = String(text).match(/[^.!?]+[.!?]*\s*/g) || [String(text)];
    if (text.length < 90 || parts.length < 2) return [String(text).trim()];
    const steps = [];
    for (const part of parts) {
      const last = steps[steps.length - 1];
      if (last && (last + part).length <= 90) steps[steps.length - 1] = last + part;
      else steps.push(part);
    }
    return steps.map((x) => x.trim()).filter(Boolean);
  };

  const PRAISE = ['מעולה!', 'כל הכבוד!', 'בדיוק!', 'יפה מאוד!', 'נכון!'];
  const sparkles = () => el('div', { class: 'sparkles', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) =>
    el('i', { style: `--i: ${i}; --l: ${Math.round(4 + Math.random() * 92)}%; --d: ${Math.round(Math.random() * 180)}ms; --h: ${Math.round(Math.random() * 360)}` })));

  function showFeedback(ex, result, expected, grammarNote = null) {
    const ok = result !== 'wrong';
    if (ok) solved++;
    if (result === 'correct-after-tries') mistakes.add(ex.id);
    setProgress();
    const think = THINK_TYPES.has(ex.type);
    const title = result === 'wrong' ? 'לא בדיוק' : result === 'typo' ? 'כמעט! שימו לב לאיות'
      : think ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : 'מעולה!';
    // The explanation can be read aloud when the device has a Hebrew voice.
    const readBtn = (text) => (text && canSpeakLang('he-IL') ? el('button', {
      class: 'speaker small read-explain', type: 'button', 'aria-label': 'הקראת ההסבר',
      onclick: () => speakSequence([{ text, lang: 'he-IL' }]),
    }, '🔊') : null);
    // Think track: the explanation opens on demand ("למה?"), a sentence or two at a time, with read-aloud.
    const why = (text) => {
      const steps = pageSentences(text);
      let at = 0;
      const page = el('div', { class: 'why-text' });
      const dots = el('span', { class: 'why-dots' });
      const nextBtn = el('button', { class: 'btn small why-next', type: 'button' }, 'הבא ←');
      const show = () => {
        page.replaceChildren(...[...mixed(steps[at]), readBtn(steps[at])].filter(Boolean));
        dots.textContent = steps.length > 1 ? `${at + 1}/${steps.length}` : '';
        nextBtn.hidden = at >= steps.length - 1;
      };
      nextBtn.addEventListener('click', () => { at++; show(); });
      const box = el('div', { class: 'why-box', hidden: true }, page, steps.length > 1 ? el('div', { class: 'why-nav' }, dots, nextBtn) : null);
      const btn = el('button', { class: 'why-btn', type: 'button', onclick: () => { btn.hidden = true; box.hidden = false; show(); record('why', ''); } }, '🤔 למה?');
      return el('div', { class: 'why' }, btn, box);
    };
    if (ok) body.classList.add('solved');
    const sheet = el('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
      ok ? sparkles() : null,
      el('div', { class: 'feedback-title' }, think ? (ok ? '🎉 ' : '🤔 ') : ok ? '✔ ' : '✘ ', title),
      (result === 'wrong' || result === 'typo') && expected
        ? el('div', { class: 'feedback-answer' }, 'התשובה הנכונה: ',
            el('span', { dir: THINK_TYPES.has(ex.type) ? 'auto' : answerIsHebrew(ex) ? 'rtl' : 'ltr' }, ...(THINK_TYPES.has(ex.type) ? txt(expected) : [expected])))
        : null,
      ex.type === 'listen_translate' && result !== 'correct'
        ? el('div', { class: 'feedback-explain' }, 'נאמר: ', el('span', { dir: ex.lang === 'he' ? 'rtl' : 'ltr' }, ex.audio_text))
        : null,
      grammarNote ? el('div', { class: 'feedback-explain grammar' }, '📘 ', ...mixed(grammarNote))
        : think && ex.explain_he ? why(ex.explain_he)
        : ex.explain_he && result !== 'correct' ? el('div', { class: 'feedback-explain grammar' }, '📘 ', ...mixed(ex.explain_he), readBtn(ex.explain_he))
          : ex.explain_he ? el('div', { class: 'feedback-explain' }, ...mixed(ex.explain_he), readBtn(ex.explain_he)) : null);
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
    nav('complete', { xp, accuracy, durationS, ...streakInfo, lessonTitle: lesson.title_he, lessonId, course: lesson.course || null });
  }

  next();
}
