import { el } from '../util.js';
import { loadCourse, loadLesson } from '../course.js';
import { rendererFor } from '../exercises/index.js';
import { checkAnswer } from '../check.js';
import { buildTest, evaluate } from '../placement.js';
import { getProfile, updateProfile, markSkipped } from '../progress.js';

export async function renderPlacement(root, nav) {
  const course = await loadCourse();
  const lessons = {};
  for (const id of course.units.flatMap((u) => u.lessons)) lessons[id] = await loadLesson(id);
  const queue = buildTest(course, lessons).flatMap((u) => u.items.map((i) => ({ ...i, unitId: u.unitId })));
  const totalPossible = queue.length;
  const answers = [];

  const bar = el('div', { class: 'progress-fill' });
  const body = el('main', { class: 'ex-body' });
  const dontKnow = el('button', { class: 'btn ghost wide', type: 'button' }, 'אני לא יודע');
  const checkBtn = el('button', { class: 'btn primary wide', type: 'button', disabled: true }, 'בדיקה');
  const footer = el('footer', { class: 'lesson-footer' }, checkBtn, dontKnow);
  const quit = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'יציאה', onclick: () => nav('back') }, '✕');
  root.replaceChildren(el('div', { class: 'screen lesson placement' },
    el('div', { class: 'lesson-top' }, quit, el('div', { class: 'progress' }, bar)),
    el('div', { class: 'test-tag' }, 'מבחן רמה'),
    body, footer));

  function record(item, correct) {
    answers.push({ lessonId: item.lessonId, unitId: item.unitId, correct });
    bar.style.width = `${Math.round((answers.length / totalPossible) * 100)}%`;
    footer.className = `lesson-footer ${correct ? 'good' : 'bad'} brief`;
    setTimeout(() => {
      const verdict = evaluate(course, answers);
      if (verdict.done) finish(verdict); else next();
    }, 650);
  }

  function next() {
    footer.className = 'lesson-footer';
    const item = queue.shift();
    if (!item) return finish(evaluate(course, answers));
    body.replaceChildren();
    checkBtn.disabled = true;
    const ex = item.exercise;
    const api = rendererFor(ex)(body, ex, { setReady: (ok) => { checkBtn.disabled = !ok; }, finish: () => {} });
    checkBtn.onclick = () => {
      checkBtn.disabled = true;
      record(item, checkAnswer(api.getAnswer(), ex.answer, ex.alternatives || []).result !== 'wrong');
    };
    dontKnow.onclick = () => record(item, false);
  }

  async function finish({ startLessonId, skipLessonIds }) {
    await markSkipped(skipLessonIds);
    const p = await getProfile();
    p.start_choice = p.start_choice || 'placement';
    p.placement = { date: new Date().toISOString(), start_lesson_id: startLessonId, correct: answers.filter((a) => a.correct).length, asked: answers.length };
    await updateProfile(p);
    const unitIndex = startLessonId ? course.units.findIndex((u) => u.lessons.includes(startLessonId)) : course.units.length;
    const unit = course.units[unitIndex];
    root.replaceChildren(el('div', { class: 'screen complete' },
      el('div', { class: 'celebrate' }, '🎯'),
      el('h1', {}, 'סיימתם את מבחן הרמה'),
      startLessonId
        ? el('p', {}, 'מתחילים מ', el('strong', {}, `יחידה ${unitIndex + 1}`), `: ${unit.title_he}, שיעור "${course.lesson_titles[startLessonId]}"`)
        : el('p', {}, 'עברתם את כל השיעורים שיש כרגע באפליקציה. שיעורים חדשים בדרך!'),
      skipLessonIds.length ? el('p', { class: 'muted' }, `${skipLessonIds.length} שיעורים סומנו כעבר. אפשר תמיד להיכנס אליהם ולתרגל.`) : null,
      el('button', { class: 'btn primary wide', type: 'button', onclick: () => nav('path') }, 'למסלול')));
  }

  next();
}
