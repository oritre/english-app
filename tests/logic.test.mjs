import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, normalize } from '../js/check.js';
import { computeStreak, xpForLesson } from '../js/streak.js';
import { addDays } from '../js/dates.js';
import { readFileSync, readdirSync } from 'node:fs';

test('normalize strips punctuation, case, contractions, niqqud and final letters', () => {
  assert.equal(normalize("I'm Dana!"), 'i am dana');
  assert.equal(normalize('שָׁלוֹם'), 'שלומ');
  assert.equal(normalize('Hello,  thank you.'), 'hello thank you');
});

test('checkAnswer: exact, alternative, typo, wrong', () => {
  assert.equal(checkAnswer('i am dana', 'I am Dana.').result, 'correct');
  assert.equal(checkAnswer("I'm Dana", 'I am Dana.').result, 'correct');
  assert.equal(checkAnswer('It is a dog', 'This is a dog.', ['It is a dog.']).result, 'correct');
  assert.equal(checkAnswer('Thnk you', 'Thank you', [], { allowTypos: true }).result, 'typo');
  assert.equal(checkAnswer('Thnk you', 'Thank you').result, 'wrong');
  assert.equal(checkAnswer('Good night', 'Thank you', [], { allowTypos: true }).result, 'wrong');
  assert.equal(checkAnswer('', 'Hello', [], { allowTypos: true }).result, 'wrong');
});

test('streak counts back from today or yesterday', () => {
  const t = '2026-10-12';
  const day = (d) => ({ date: d, goal_met: true });
  assert.equal(computeStreak([], t), 0);
  assert.equal(computeStreak([day(t)], t), 1);
  assert.equal(computeStreak([day(addDays(t, -1)), day(addDays(t, -2))], t), 2);
  assert.equal(computeStreak([day(t), day(addDays(t, -2))], t), 1);
  assert.equal(computeStreak([day(addDays(t, -2))], t), 0);
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('xp', () => {
  assert.equal(xpForLesson({ mistakes: 0, total: 12 }), 19);
  assert.equal(xpForLesson({ mistakes: 2, total: 12 }), 14);
});

test('every lesson is well formed and its answers can be built from its tiles', () => {
  const course = JSON.parse(readFileSync(new URL('../data/course.json', import.meta.url)));
  const ids = course.units.flatMap((u) => u.lessons);
  assert.deepEqual(ids.sort(), readdirSync(new URL('../data/lessons/', import.meta.url)).map((f) => f.replace('.json', '')).sort());
  for (const id of ids) {
    const lesson = JSON.parse(readFileSync(new URL(`../data/lessons/${id}.json`, import.meta.url)));
    for (const ex of lesson.exercises) {
      const where = `${id} ${ex.id}`;
      if (ex.type.startsWith('translate')) {
        assert.equal(checkAnswer(normalize(ex.answer).split(' ').join(' '), ex.answer).result, 'correct', where);
        const bank = normalize(ex.bank.join(' ')).split(' ');
        for (const w of normalize(ex.answer).split(' ')) assert.ok(bank.includes(w), `${where}: tile missing for "${w}"`);
      }
      if (ex.type === 'choose') assert.ok(ex.options.some((o) => o.en === ex.answer), where);
      if (ex.type === 'fill_blank') {
        assert.ok(ex.options.includes(ex.answer), where);
        assert.equal(ex.sentence.split('___').length, 2, where);
      }
      if (ex.type === 'match_pairs') assert.ok(ex.pairs.length >= 3, where);
    }
  }
});

import { buildTest, evaluate } from '../js/placement.js';

test('placement: stops at the first failed unit and starts at its first miss', () => {
  const course = { units: [{ id: 'u1', lessons: ['a', 'b', 'c'] }, { id: 'u2', lessons: ['d', 'e', 'f'] }] };
  const ans = (lessonId, unitId, correct) => ({ lessonId, unitId, correct });
  assert.deepEqual(evaluate(course, [ans('a', 'u1', true)]), { done: false });
  assert.deepEqual(evaluate(course, [ans('a', 'u1', false), ans('b', 'u1', false)]),
    { done: true, startLessonId: 'a', skipLessonIds: [] });
  const r = evaluate(course, [ans('a', 'u1', true), ans('b', 'u1', false), ans('c', 'u1', true),
    ans('d', 'u2', true), ans('e', 'u2', false), ans('f', 'u2', false)]);
  assert.deepEqual(r, { done: true, startLessonId: 'e', skipLessonIds: ['a', 'b', 'c', 'd'] });
  const all = ['a', 'b', 'c', 'd', 'e', 'f'].map((l) => ans(l, 'abc'.includes(l) ? 'u1' : 'u2', true));
  assert.deepEqual(evaluate(course, all), { done: true, startLessonId: null, skipLessonIds: ['a', 'b', 'c', 'd', 'e', 'f'] });
});

test('placement: builds one testable question per lesson from the real course', () => {
  const course = JSON.parse(readFileSync(new URL('../data/course.json', import.meta.url)));
  const lessons = {};
  for (const id of course.units.flatMap((u) => u.lessons)) lessons[id] = JSON.parse(readFileSync(new URL(`../data/lessons/${id}.json`, import.meta.url)));
  const t = buildTest(course, lessons, () => 0.5);
  assert.equal(t.length, course.units.length);
  t.forEach((u, i) => assert.equal(u.items.length, course.units[i].lessons.length));
});
