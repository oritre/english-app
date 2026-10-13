// Placement test logic, kept free of DOM so it can be unit tested.
//
// The test walks the course in order, one question per lesson, unit by unit.
// A unit is passed with at most one miss. The test stops at the first failed
// unit, and the learner starts at the first lesson they missed in it.

export const TEST_TYPES = ['choose', 'fill_blank', 'translate_he_en', 'translate_en_he'];
export const MAX_MISSES_PER_UNIT = 1;

// lessonsById: { id: lesson }. rand: () => [0,1), injectable for tests.
export function buildTest(course, lessonsById, rand = Math.random) {
  return course.units.map((unit) => ({
    unitId: unit.id,
    items: unit.lessons.map((lessonId) => {
      const pool = lessonsById[lessonId].exercises.filter((e) => TEST_TYPES.includes(e.type));
      return { lessonId, exercise: pool[Math.floor(rand() * pool.length)] };
    }).filter((i) => i.exercise),
  }));
}

// answers: [{ lessonId, unitId, correct }] in the order asked.
// Returns { done, startLessonId (null = finished whole course), skipLessonIds }.
export function evaluate(course, answers) {
  const order = course.units.flatMap((u) => u.lessons);
  for (const unit of course.units) {
    const inUnit = answers.filter((a) => a.unitId === unit.id);
    const misses = inUnit.filter((a) => !a.correct);
    const unitComplete = inUnit.length === unit.lessons.length;
    if (misses.length > MAX_MISSES_PER_UNIT) {
      const start = misses[0].lessonId;
      return { done: true, startLessonId: start, skipLessonIds: order.slice(0, order.indexOf(start)) };
    }
    if (!unitComplete) return { done: false };
  }
  return { done: true, startLessonId: null, skipLessonIds: order };
}
