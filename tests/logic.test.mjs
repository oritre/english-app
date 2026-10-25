import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, normalize, checkSpeech } from '../js/check.js';
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
  const ids = [...course.starter_units, ...course.units].flatMap((u) => (u.bonus ? [...u.lessons, u.bonus] : u.lessons)).concat(course.unseen || []);
  const think = JSON.parse(readFileSync(new URL('../data/think.json', import.meta.url)));
  const thinkIds = think.courses.flatMap((c) => c.units.flatMap((u) => u.lessons));
  const know = JSON.parse(readFileSync(new URL('../data/know.json', import.meta.url)));
  const knowIds = know.courses.flatMap((c) => c.units.flatMap((u) => u.lessons));
  assert.deepEqual([...ids, ...thinkIds, ...knowIds].sort(), readdirSync(new URL('../data/lessons/', import.meta.url)).map((f) => f.replace('.json', '')).sort());
  for (const id of ids) {
    const lesson = JSON.parse(readFileSync(new URL(`../data/lessons/${id}.json`, import.meta.url)));
    for (const ex of lesson.exercises) {
      const where = `${id} ${ex.id}`;
      if (ex.type.startsWith('translate') || ex.type === 'listen_translate') {
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
      if (ex.type === 'pick') {
        const values = ex.options.map((o) => o.value);
        assert.ok(values.includes(ex.answer) && new Set(values).size === values.length, where);
        assert.ok(ex.options.length >= 2 && ex.options.length <= 4, `${where}: 2-4 choices for young learners`);
        assert.ok(ex.audio || ex.show, `${where}: something to hear or see`);
      }
      if (ex.type === 'spell') assert.ok(ex.answer.length >= 2 && ex.answer.length <= 5 && /^[a-z]+$/.test(ex.answer), where);
      if (ex.type === 'teach') assert.ok(ex.title_he && ex.body_he.length, where);
      if (ex.type === 'read') {
        assert.ok(ex.passage && ex.question && ex.explain_he, where);
        assert.ok(ex.options.includes(ex.answer) && new Set(ex.options).size === ex.options.length, where);
      }
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

import { weekStart, simulatedLearner, simulatedXp, buildBoard, nextTier, zoneFor, LEAGUE_SIZE } from '../js/league.js';

test('league: week starts on Sunday', () => {
  assert.equal(weekStart(new Date(2026, 9, 13, 15)), '2026-10-11'); // Tuesday
  assert.equal(weekStart(new Date(2026, 9, 11, 0, 5)), '2026-10-11'); // Sunday
  assert.equal(weekStart(new Date(2026, 9, 17, 23)), '2026-10-11'); // Saturday
});

test('league: simulated learners are stable, grow over the week and differ from each other', () => {
  const a = simulatedLearner('2026-10-11', 0, 3);
  assert.deepEqual(a, simulatedLearner('2026-10-11', 0, 3));
  const mid = new Date(2026, 9, 14, 12).getTime(), end = new Date(2026, 9, 18).getTime();
  assert.ok(simulatedXp(a, mid) <= simulatedXp(a, end));
  const totals = Array.from({ length: 40 }, (_, i) => simulatedXp(simulatedLearner('2026-10-11', 0, i), end));
  assert.ok(new Set(totals).size > 20, 'totals vary');
  assert.ok(Math.max(...totals) > 150 && Math.min(...totals) < 100, `spread ${Math.min(...totals)}-${Math.max(...totals)}`);
  const avg = (t) => Array.from({ length: 60 }, (_, i) => simulatedXp(simulatedLearner('2026-10-11', t, i), end)).reduce((x, y) => x + y) / 60;
  assert.ok(avg(4) > avg(0), 'higher tiers are busier');
});

test('league: board fills to size, ranks, zones', () => {
  const now = new Date(2026, 9, 15).getTime();
  const b = buildBoard('2026-10-11', 1, [{ id: 'me', name: 'אורי', avatar: '🦊', xp: 99999 }], now);
  assert.equal(b.length, LEAGUE_SIZE);
  assert.equal(b[0].id, 'me');
  assert.equal(b[0].zone, 'up');
  assert.equal(b[LEAGUE_SIZE - 1].zone, 'down');
  assert.equal(new Set(b.map((r) => r.name)).size, LEAGUE_SIZE);
  assert.equal(zoneFor(15, 0), 'stay'); // no demotion from the lowest tier
  assert.equal(zoneFor(1, 4), 'stay'); // no promotion from the top
  assert.equal(nextTier(0, 'up'), 1);
  assert.equal(nextTier(0, 'down'), 0);
});

test('speech: word-level match with numbers, contractions and a missed word', () => {
  assert.equal(checkSpeech(['this is a cat'], 'This is a cat.').pass, true);
  assert.equal(checkSpeech(['I wake up at 7'], 'I wake up at seven.').pass, true);
  assert.equal(checkSpeech(["I'm fine thank you"], 'I am fine, thank you.').pass, true);
  const r = checkSpeech(['this is the dog'], 'This is a cat.');
  assert.equal(r.pass, false);
  assert.deepEqual(r.words.map((w) => w.ok), [true, true, false, false]);
  assert.equal(r.words[3].word, 'cat');
  const best = checkSpeech(['this is a hat', 'this is a cat'], 'This is a cat.');
  assert.equal(best.score, 1);
  assert.equal(checkSpeech(['nice to meet'], 'Nice to meet you.').pass, false); // 3 of 4 words
  assert.equal(checkSpeech(['my name is dana and'], 'My name is Dana.').pass, true); // extra word is fine
  assert.equal(checkSpeech(['my name is dana'], 'My name is Dana.').pass, true);
});

import { skillStats, summarize, suggestions, minutesByDay, hardestItems } from '../js/report.js';

test('report: skills, summary and suggestions from attempts', () => {
  const A = (type, outcome, ms = 4000, exercise_id = type + outcome) => ({ type, outcome, ms, exercise_id, lesson_id: 'u1l1' });
  const attempts = [
    ...Array(6).fill(0).map(() => A('choose', 'correct')),
    ...Array(3).fill(0).map(() => A('fill_blank', 'correct')), ...Array(3).fill(0).map((_, i) => A('fill_blank', 'wrong', 9000, 'fb' + (i % 2))),
    A('speak', 'skipped'), A('speak', 'skipped'), A('speak', 'skipped'),
  ];
  const skills = skillStats(attempts);
  const vocab = skills.find((s) => s.id === 'vocab');
  assert.equal(vocab.accuracy, 1);
  assert.equal(skills.find((s) => s.id === 'grammar').accuracy, 0.5);
  assert.equal(skills.find((s) => s.id === 'speaking').skipped, 3);
  const today = '2026-10-13';
  const results = [{ date: today, duration_s: 240, lesson_id: 'u1l1' }, { date: '2026-10-12', duration_s: 300, lesson_id: 'u1l2' }];
  const sum = summarize({ profile: { daily_goal_xp: 10 }, attempts, results, days: [], progress: [{ status: 'done', lesson_id: 'u1l1', best_accuracy: 60 }] }, today);
  assert.equal(sum.totalMinutes, 9);
  assert.equal(sum.activeDays7, 2);
  assert.deepEqual(sum.weakLessons, ['u1l1']);
  const tips = suggestions(sum, skills, { u1l1: 'שלום!' }).map((t) => t.text).join('\n');
  assert.match(tips, /דקדוק/);
  assert.match(tips, /אוצר מילים/);
  assert.match(tips, /3 דילוגים על תרגילי דיבור/);
  assert.match(tips, /"שלום!"/);
  assert.equal(minutesByDay(results, today).length, 14);
  assert.equal(minutesByDay(results, today).at(-1).minutes, 4);
  assert.equal(hardestItems(attempts)[0].wrong, 2);
  assert.equal(suggestions({ sessions: 0 }, skills).length, 1);
});

import { diagnose } from '../js/grammar.js';

test('grammar: explains common Hebrew-speaker mistakes', () => {
  assert.match(diagnose('This is dog', 'This is a dog.'), /a או an/);
  assert.match(diagnose('The dog big', 'The dog is big.'), /פועל עזר/);
  assert.match(diagnose('I is Dana', 'I am Dana.'), /עם i משתמשים ב־am/);
  assert.match(diagnose('She have a cat', 'She has a cat.'), /has/);
  assert.match(diagnose('She like books', 'She likes books.'), /s בסוף "likes"/);
  assert.match(diagnose('I eat a apple', 'I eat an apple.'), /an/);
  assert.match(diagnose('I can to swim', 'I can swim.'), /can לא כותבים to/);
  assert.match(diagnose('The big is dog', 'The dog is big.'), /הסדר/);
  assert.match(diagnose('I am in home', 'I am at home.'), /at home/);
  assert.match(diagnose('dog is cat', 'The dog and the cat.'), /the/);
  assert.equal(diagnose('I eat a banana', 'I eat an apple.'), null);
  assert.equal(diagnose('Hello', 'Hello'), null);
});

import { lessonStates } from '../js/course.js';

test('reading bonus opens only after every lesson in its unit and never blocks the path', () => {
  const course = { units: [{ id: 'u1', lessons: ['a', 'b'], bonus: 'ar' }, { id: 'u2', lessons: ['c'] }] };
  assert.deepEqual(lessonStates(course, ['a']), { a: 'done', b: 'current', ar: 'locked', c: 'locked' });
  assert.deepEqual(lessonStates(course, ['a', 'b']), { a: 'done', b: 'done', ar: 'bonus', c: 'current' });
  assert.deepEqual(lessonStates(course, ['a', 'b', 'ar']), { a: 'done', b: 'done', ar: 'done', c: 'current' });
});

test('starter units lead the path only for ABC learners', () => {
  const course = { starter_units: [{ id: 's1', lessons: ['s1', 's2'] }], units: [{ id: 'u1', lessons: ['a', 'b'] }] };
  assert.deepEqual(lessonStates(course, [], { starter: true }), { s1: 'current', s2: 'locked', a: 'locked', b: 'locked' });
  assert.deepEqual(lessonStates(course, ['s1', 's2'], { starter: true }), { s1: 'done', s2: 'done', a: 'current', b: 'locked' });
  assert.deepEqual(lessonStates(course, ['s1']), { s1: 'done', s2: 'bonus', a: 'current', b: 'locked' });
});

import { confusions, byDayPart, byLessonStage, habits } from '../js/report.js';

test('report: confusions from wrong answers, mismatched pairs and hesitations', () => {
  const at = new Date('2026-10-14T09:00:00').getTime();
  const attempts = [
    { type: 'pick', outcome: 'wrong', given: 'd', expected: 'b', taps: [{ k: 'choice', v: 'd' }], pos: 1, at, hour: 9 },
    { type: 'pick', outcome: 'wrong', given: 'd', expected: 'b', taps: [], pos: 2, at, hour: 9 },
    { type: 'match_pairs', outcome: 'retry', taps: [{ k: 'mismatch', v: 'cat|כלב' }], pos: 3, at, hour: 20 },
    { type: 'choose', outcome: 'correct', given: 'dog', expected: 'dog', taps: [{ k: 'choice', v: 'cat' }, { k: 'choice', v: 'dog' }], pos: 12, at, hour: 20 },
    { type: 'listen_type', outcome: 'correct', taps: [{ k: 'play', v: '🔊' }, { k: 'slow', v: '🐢' }, { k: 'gloss', v: 'wakes' }], pos: 13, at, hour: 23 },
  ];
  const c = confusions(attempts);
  assert.deepEqual(c[0], { kind: 'wrong', expected: 'b', given: 'd', count: 2 });
  assert.ok(c.some((r) => r.kind === 'match' && r.expected === 'cat' && r.given === 'כלב'));
  assert.ok(c.some((r) => r.kind === 'hesitate' && r.expected === 'dog' && r.given === 'cat'));
  const parts = Object.fromEntries(byDayPart(attempts).map((p) => [p.id, p.count]));
  assert.deepEqual(parts, { morning: 2, noon: 0, afternoon: 0, evening: 2, night: 1 });
  assert.deepEqual(byLessonStage(attempts).map((s) => s.count), [3, 0, 2]);
  const h = habits(attempts);
  assert.equal(h.replaysPerListen, 2 / 3); // two picks without replays, one listening exercise with two
  assert.deepEqual(h.lookedUp, [['wakes', 1]]);
});

test('coach plan: modules get week-based ids, an old single-lesson plan still works', async () => {
  const { coachModules, coachLesson, hasCoach, lessonTitle } = await import('../js/coach.js');
  const p = { coach: { week: '2026-10-21', modules: [{ title_he: 'א', exercises: [{ id: 'x', type: 'choose' }] }, { title_he: 'ב', exercises_json: '[]' }] } };
  assert.deepEqual(coachModules(p).map((m) => m.id), ['coach-2026-10-21-1', 'coach-2026-10-21-2']);
  assert.equal(coachLesson(p, 0).exercises.length, 1);
  assert.ok(hasCoach(p));
  const old = { coach: { week: '2026-10-21', title_he: 'ישן', exercises: [{ id: 'y', type: 'choose' }] } };
  assert.equal(coachLesson(old).id, 'coach-2026-10-21');
  assert.ok(!hasCoach({}));
  assert.equal(lessonTitle({}, 'coach-2026-10-21-1'), 'תרגול אישי');
});

import { parseNum, sameNumber, runRobot } from '../js/thinkLogic.js';

test('think: numbers and fractions compare by value', () => {
  assert.equal(parseNum('3/4'), 0.75);
  assert.equal(parseNum('-2'), -2);
  assert.equal(parseNum('1/0'), null);
  assert.equal(parseNum('abc'), null);
  assert.ok(sameNumber('6/8', '3/4'));
  assert.ok(!sameNumber('6/8', '3/4', { exact: true }));
  assert.ok(sameNumber('12', '12'));
  assert.ok(!sameNumber('', '0'));
});

test('think: the robot runs, repeats and crashes into walls', () => {
  assert.ok(runRobot(['R..*'], ['right', 'x3']).ok);
  assert.ok(!runRobot(['R..*'], ['right', 'x2']).ok);
  assert.ok(runRobot(['R#*'], ['right']).crash);
  assert.ok(runRobot(['R.'], ['left']).crash);
});

test('every think exercise is solvable as written', () => {
  const think = JSON.parse(readFileSync(new URL('../data/think.json', import.meta.url)));
  assert.ok(think.courses.length >= 6);
  // Every school grade from 1 to 8 has at least three courses to pick from.
  for (let g = 1; g <= 8; g++) assert.ok(think.courses.filter((c) => g >= c.grades[0] && g <= c.grades[1]).length >= 3, `grade ${g}`);
  for (const c of think.courses) {
    assert.ok(c.id && c.icon && /^#[0-9a-f]{6}$/i.test(c.color) && c.title_he && c.about_he, c.id);
    assert.ok(Array.isArray(c.grades) && c.grades[0] >= 1 && c.grades[0] <= c.grades[1] && c.grades[1] <= 13, `${c.id}: grade band`);
    for (const id of c.units.flatMap((u) => u.lessons)) {
      const lesson = JSON.parse(readFileSync(new URL(`../data/lessons/${id}.json`, import.meta.url)));
      assert.ok(think.lesson_titles[id] && lesson.exercises.length >= 4, id);
      for (const ex of lesson.exercises) {
        const where = `${id} ${ex.id}`;
        if (!['teach', 'sim'].includes(ex.type) && !ex.explore) assert.ok(ex.explain_he, `${where}: explanation`);
        if (ex.type === 'mcq') {
          const labels = ex.options.map((o) => (typeof o === 'object' ? o.label : o));
          assert.ok(labels.includes(ex.answer) && new Set(labels).size === labels.length, where);
        }
        if (ex.type === 'number') assert.ok(parseNum(ex.answer) != null, where);
        if (ex.type === 'balance') {
          const w = (side) => side.reduce((s, it) => s + (it.w ?? 0) * (it.adjustable ? Number(ex.answer) : it.n), 0);
          assert.equal(w(ex.left), w(ex.right), `${where}: the answer balances`);
          assert.equal([...ex.left, ...ex.right].filter((it) => it.adjustable).length, 1, where);
        }
        if (ex.type === 'fraction' && !ex.explore) {
          const a = String(ex.answer).includes('/') ? parseNum(ex.answer) * ex.parts : Number(ex.answer);
          assert.ok(Number.isInteger(Math.round(a * 1e9) / 1e9) && a >= 0 && a <= ex.parts, `${where}: can be coloured`);
        }
        if (ex.type === 'numberline') {
          const a = parseNum(ex.answer);
          assert.ok(a >= ex.min && a <= ex.max, where);
          assert.ok(Math.abs(Math.round((a - ex.min) / ex.step) * ex.step + ex.min - a) < 1e-9, `${where}: on a step`);
        }
        if (ex.type === 'robot') {
          assert.ok(runRobot(ex.grid, ex.solution).ok, `${where}: solution reaches the star`);
          if (ex.max) assert.ok(ex.solution.length <= ex.max, where);
          if (ex.commands) assert.ok(ex.solution.every((t) => ex.commands.includes(t)), `${where}: solution uses the given tiles`);
          assert.equal(new Set(ex.grid.map((r) => r.length)).size, 1, `${where}: rectangular grid`);
        }
        if (ex.type === 'buckets') {
          const ids = ex.buckets.map((b) => b.id);
          assert.ok(ex.items.every((it) => ids.includes(it.in)), where);
        }
        if (ex.type === 'angle') assert.ok(ex.answer >= 0 && ex.answer <= 180, where);
        if (ex.type === 'order') assert.ok(ex.items.length >= 3 && new Set(ex.items).size === ex.items.length, where);
      }
    }
  }
});

test('every generated practice problem is well formed and solvable', async () => {
  const { GENERATORS, practiceLesson } = await import('../js/thinkPractice.js');
  const { sameNumber } = await import('../js/thinkLogic.js');
  const think = JSON.parse(readFileSync(new URL('../data/think.json', import.meta.url)));
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const [id, gens] of Object.entries(GENERATORS)) {
    assert.ok(think.courses.some((c) => c.id === id), `generator for unknown course ${id}`);
    for (const g of gens) for (let i = 0; i < 150; i++) {
      const ex = g(r, (i % 3) + 1);
      const where = `${id}: ${ex.prompt_he}`;
      assert.ok(ex.prompt_he && ex.explain_he && !/undefined|NaN/.test(ex.prompt_he + ex.explain_he), where);
      if (ex.type === 'number') {
        assert.ok(/^-?\d+$/.test(ex.answer), `${where} -> ${ex.answer}`);
        if (ex.answer.startsWith('-')) assert.ok(ex.negative, `${where} needs the minus key`);
        assert.ok(sameNumber(ex.answer, ex.answer), where);
      } else if (ex.type === 'mcq') {
        assert.ok(ex.options.length >= 2 && ex.options.includes(ex.answer) && new Set(ex.options).size === ex.options.length, where);
      } else if (ex.type === 'fraction') {
        const [k, n] = ex.answer.split('/').map(Number);
        assert.ok(n === ex.parts && k > 0 && k < n, where);
      } else if (ex.type === 'numberline') {
        const a = Number(ex.answer), steps = (a - ex.min) / ex.step;
        assert.ok(a >= ex.min && a <= ex.max && Math.abs(steps - Math.round(steps)) < 1e-9, where);
      } else if (ex.type === 'angle') {
        assert.ok(ex.answer > 0 && ex.answer < 180, where);
      } else assert.fail(`${where}: unexpected type ${ex.type}`);
    }
  }
  // Every course gets a practice round of at least 6 exercises.
  for (const c of think.courses) {
    const lessons = c.units.flatMap((u) => u.lessons).map((l) => JSON.parse(readFileSync(new URL(`../data/lessons/${l}.json`, import.meta.url))));
    const p = practiceLesson(c, lessons, r);
    assert.ok(p.exercises.length >= 6, `${c.id}: only ${p.exercises.length} practice exercises`);
    assert.equal(new Set(p.exercises.map((e) => e.id)).size, p.exercises.length);
  }
});

import { parseArt, sceneMs, forGrade } from '../js/storyLogic.js';

test('general knowledge: every lesson is a real video, then a quiz for the learner\'s grade', () => {
  const know = JSON.parse(readFileSync(new URL('../data/know.json', import.meta.url)));
  const videos = JSON.parse(readFileSync(new URL('../data/videos.json', import.meta.url)));
  assert.ok(know.courses.length > 0);
  for (const c of know.courses) {
    assert.ok(c.id && c.icon && /^#[0-9a-f]{6}$/i.test(c.color) && c.title_he && c.about_he && know.areas.some((a) => a.id === c.area), c.id);
    const ids = c.units.flatMap((u) => u.lessons);
    assert.ok(ids.length > 0, `${c.id}: a topic shows only with videos`);
    for (const id of ids) {
      const lesson = JSON.parse(readFileSync(new URL(`../data/lessons/${id}.json`, import.meta.url)));
      const [first, ...quiz] = lesson.exercises;
      assert.ok(first.type === 'video' && know.lesson_titles[id], id);
      assert.match(first.youtube, /^[\w-]{11}$/, id);
      assert.ok(videos.some((v) => v.youtube === first.youtube && v.lesson === id), `${id}: listed for the Pi`);
      for (const q of quiz) {
        assert.equal(q.type, 'mcq', id);
        assert.ok(q.options.includes(q.answer) && new Set(q.options).size === q.options.length && q.explain_he, `${id} ${q.id}`);
        if (q.grades) assert.ok(q.grades[0] >= 1 && q.grades[1] <= 12 && q.grades[0] <= q.grades[1], `${id} ${q.id}: band`);
      }
      // Every grade the topic is for gets a short quiz of its own.
      for (let g = c.grades[0]; g <= c.grades[1]; g++) {
        const mine = forGrade(lesson.exercises, g).filter((e) => e.type === 'mcq');
        assert.ok(mine.length >= 3 && mine.length <= 6, `${id}: grade ${g} gets ${mine.length}`);
      }
    }
  }
  assert.equal(parseArt('🚢~sail 🌊 🐟')[0].motion, 'sail');
  assert.ok(sceneMs('קצר') >= 3000);
});

test('quiz questions fitted to the grade, or the nearest band', () => {
  const ex = [{ type: 'video' }, { id: 'a', grades: [1, 2] }, { id: 'b', grades: [3, 4] }, { id: 'c', grades: [7, 8] }, { id: 'all' }];
  const ids = (g) => forGrade(ex, g).map((e) => e.id || e.type);
  assert.deepEqual(ids(1), ['video', 'a', 'all']);
  assert.deepEqual(ids(3), ['video', 'b', 'all']);
  assert.deepEqual(ids(6), ['video', 'c', 'all']);
  assert.deepEqual(ids(5), ['video', 'b', 'all']);
  assert.deepEqual(ids(null), ['video', 'c', 'all']);
  assert.deepEqual(forGrade([{ id: 'x' }], 3), [{ id: 'x' }]);
});

test('an open unit (videos) never locks and is never the current lesson', () => {
  const course = { units: [{ id: 'u1', lessons: ['a', 'b'] }, { id: 'v', open: true, lessons: ['v1', 'v2'] }] };
  assert.deepEqual(lessonStates(course, ['v2']), { a: 'current', b: 'locked', v1: 'bonus', v2: 'done' });
});

test('think level follows the weekly review, else the school grade', async () => {
  const { courseLevel, skipUnits, requiredLessons } = await import('../js/thinkLogic.js');
  const c = { id: 'x', grades: [3, 8], units: [{ lessons: ['a', 'b'] }, { lessons: ['c'] }, { lessons: ['d'] }] };
  assert.deepEqual(courseLevel(c, { grade: 3 }), { level: 1, measured: false });
  assert.equal(courseLevel(c, { grade: 6 }).level, 2);
  assert.equal(courseLevel(c, { grade: 8 }).level, 3);
  assert.equal(courseLevel(c, { grade: 1 }).level, 1);
  assert.deepEqual(courseLevel(c, { grade: 3, think_level: { x: 3 } }), { level: 3, measured: true });
  // Grade-based levels never skip units inside the band; the review's measured level does.
  assert.equal(skipUnits(c, { grade: 8 }), 0);
  assert.equal(skipUnits(c, { grade: 9 }), 1);
  assert.equal(skipUnits(c, { grade: 3, think_level: { x: 3 } }), 2);
  assert.deepEqual(requiredLessons(c, { grade: 3, think_level: { x: 2 } }), ['c', 'd']);
  // A one-unit course can't be skipped.
  assert.equal(skipUnits({ grades: [1, 2], units: [{ lessons: ['a'] }] }, { grade: 9 }), 0);
});

test('young learners get no free typing', async () => {
  const { withoutTyping } = await import('../js/typing.js');
  const exs = [{ type: 'listen_type', text: 'a' }, { type: 'translate_he_en', input: 'type', bank: ['a'] }, { type: 'translate_he_en', input: 'type' }, { type: 'choose' }];
  const young = withoutTyping(exs, { grade: 1 });
  assert.deepEqual(young.map((e) => [e.type, e.input]), [['translate_he_en', undefined], ['choose', undefined]]);
  assert.equal(withoutTyping(exs, { grade: 6 }).length, 4);
  assert.equal(withoutTyping(exs, { grade: 6, no_typing: true }).length, 2);
  assert.equal(withoutTyping(exs, { grade: 2, no_typing: false }).length, 4);
});

test('spokenLines lists a lesson\'s spoken lines once, auto-read first, English without Hebrew', async () => {
  const { spokenLines } = await import('../js/spoken.js');
  const lines = spokenLines([
    { type: 'teach', say_he: 'שלום', say: 'Hello', examples: [{ en: 'Hello, Dana!' }] },
    { type: 'pick', audio: 'Hello', options: [{ en: 'cat', say: 'a cat' }] },
    { type: 'speak', text: 'I like cats.' },
    { type: 'think_choice', prompt_he: 'כמה?', audio: 'מה' },
  ], { thinkAloud: true });
  assert.deepEqual(lines.map((l) => `${l.lang}:${l.text}`), [
    'he-IL:שלום', 'en-US:Hello', 'he-IL:כמה?', 'en-US:Hello, Dana!', 'en-US:a cat', 'en-US:cat', 'en-US:I like cats.']);
});

// ---- parent view: active time, quality, goals ----
import { subjectOf, periodRange, previousRange, insights, isGuess, qualityScore, goalStatus, lastPeriodStatus, goalLabel } from '../js/insights.js';

test('subjectOf maps lesson ids to the three tabs', () => {
  assert.equal(subjectOf('k-ani-v1'), 'know');
  assert.equal(subjectOf('t-frac-1'), 'think');
  assert.equal(subjectOf('tp-frac'), 'think');
  assert.equal(subjectOf('u1-l1'), 'english');
  assert.equal(subjectOf('coach-2026-10-20-1'), 'english');
  assert.equal(subjectOf('talk'), 'english');
});

test('periodRange: day, Sunday-to-Saturday week, last week', () => {
  assert.deepEqual(periodRange('day', '2026-10-25'), { from: '2026-10-25', to: '2026-10-25' });
  assert.deepEqual(periodRange('week', '2026-10-28'), { from: '2026-10-25', to: '2026-10-31' });
  assert.deepEqual(periodRange('lastweek', '2026-10-28'), { from: '2026-10-18', to: '2026-10-24' });
  assert.deepEqual(previousRange({ from: '2026-10-25', to: '2026-10-31' }), { from: '2026-10-18', to: '2026-10-24' });
});

const T = '2026-10-27';
const sess = (lesson, active, open, extra = {}) => ({ type: 'session', lesson_id: lesson, date: T, active_s: active, open_s: open, finished: true, ...extra });
const ans = (lesson, ex, outcome, ms = 4000, extra = {}) => ({ lesson_id: lesson, exercise_id: ex, type: 'choose', outcome, ms, date: T, at: ++ans.n, sid: 's1', ...extra });
ans.n = 0;

test('insights: active vs open time per tab, first try, fixes, guesses, new lessons', () => {
  const data = {
    sessions: [sess('u1-l1', 600, 900), sess('t-a-1', 300, 300), sess('k-x-1', 120, 600, { finished: false })],
    attempts: [
      ans('u1-l1', 'e1', 'correct'), ans('u1-l1', 'e2', 'wrong', 500), ans('u1-l1', 'e2', 'correct'),
      ans('u1-l1', 'e3', 'wrong'), ans('t-a-1', 'q1', 'correct', 3000, { type: 'mcq' }),
    ],
    results: [
      { id: 'r0', lesson_id: 'u1-l1', date: '2026-10-01', accuracy: 60 },
      { id: 'r1', lesson_id: 'u1-l1', date: T, accuracy: 90 },
      { id: 'r2', lesson_id: 't-a-1', date: T, accuracy: 85 },
      { id: 'r3', lesson_id: 'tp-a', date: T, accuracy: 70 },
    ],
  };
  const range = { from: T, to: T };
  const all = insights(data, range);
  assert.equal(Math.round(all.activeMin), 17);
  assert.equal(Math.round(all.openMin), 30);
  assert.equal(all.items, 4);
  assert.equal(all.firstTry, 0.5);
  assert.equal(all.fixRate, 0.5);
  assert.equal(all.guessShare, 1 / 5);
  assert.equal(all.newLessons, 1); // u1-l1 was first done earlier: a repeat
  assert.equal(all.repeats, 1);
  assert.equal(all.practice, 1);
  assert.equal(all.progress, 2);
  assert.equal(all.quit, 1);
  const en = insights(data, range, 'english');
  assert.equal(en.activeMin, 10);
  assert.equal(insights(data, range, 'know').activeMin, 2);
  assert.equal(all.quality, null); // fewer than 8 questions
});

test('isGuess: too-fast wrong answers and trial-and-error, never typed answers', () => {
  assert.ok(isGuess({ type: 'choose', outcome: 'wrong', ms: 600 }));
  assert.ok(!isGuess({ type: 'choose', outcome: 'wrong', ms: 5000 }));
  assert.ok(isGuess({ type: 'mcq', outcome: 'correct', ms: 5000, taps: [{ k: 'choice' }, { k: 'choice' }, { k: 'choice' }] }));
  assert.ok(!isGuess({ type: 'translate_he_en', outcome: 'wrong', ms: 300 }));
});

test('qualityScore weighs first try most and skips missing parts', () => {
  assert.equal(qualityScore({ items: 3 }), null);
  assert.equal(qualityScore({ items: 10, firstTry: 1, guessShare: 0, focus: 1, fixRate: null }), 100);
  assert.equal(qualityScore({ items: 10, firstTry: 0.5, guessShare: 0.5, focus: null, fixRate: 0 }), Math.round((100 * (0.225 + 0.125)) / 0.85));
});

test('goalStatus: met, open and missed; last period', () => {
  const data = { sessions: [sess('u1-l1', 1500, 1600), { ...sess('u1-l1', 300, 300), date: '2026-10-26' }], attempts: [], results: [] };
  const daily = { id: 'g1', kind: 'minutes', subject: 'all', target: 20, period: 'day' };
  assert.equal(goalStatus(daily, data, T).state, 'met');
  assert.equal(goalStatus(daily, data, '2026-10-28').state, 'open');
  assert.equal(lastPeriodStatus(daily, data, '2026-10-28').met, true);
  assert.equal(lastPeriodStatus(daily, data, T).state, 'missed'); // only 5 minutes on the 26th
  const weekly = { id: 'g2', kind: 'lessons', subject: 'think', target: 3, period: 'week' };
  assert.equal(goalStatus(weekly, data, T).actual, 0);
  assert.equal(goalLabel(weekly), '3 שיעורים בשבוע בחשיבה ומדעים');
});
