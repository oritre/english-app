let coursePromise = null;
const lessonCache = new Map();

export function loadCourse() {
  // A bundled build (the artifact preview) inlines the course as window.__COURSE__.
  if (!coursePromise) {
    coursePromise = window.__COURSE__ ? Promise.resolve(window.__COURSE__.course)
      : fetch('data/course.json').then((r) => r.json());
  }
  return coursePromise;
}

// The math and logic track ("חשיבה ומתמטיקה") has its own course file; its
// lessons live with the English ones in data/lessons (ids start with "t").
let thinkPromise = null;
export function loadThink() {
  if (!thinkPromise) {
    thinkPromise = window.__COURSE__ ? Promise.resolve(window.__COURSE__.think || { units: [], lesson_titles: {} })
      : fetch('data/think.json').then((r) => r.json());
  }
  return thinkPromise;
}

// General knowledge ("ידע כללי", after BrainPOP): a narrated cartoon and a
// short quiz per lesson. Same catalog shape as think; lesson ids start with "k-".
let knowPromise = null;
export function loadKnow() {
  if (!knowPromise) {
    knowPromise = window.__COURSE__ ? Promise.resolve(window.__COURSE__.know || { courses: [], lesson_titles: {} })
      : fetch('data/know.json').then((r) => (r.ok ? r.json() : { courses: [], lesson_titles: {} })).catch(() => ({ courses: [], lesson_titles: {} }));
  }
  return knowPromise;
}

export async function loadLesson(id) {
  // "tp-<course>" is a practice round, built fresh every time.
  if (id.startsWith('tp-')) {
    const [think, { practiceLesson }] = await Promise.all([loadThink(), import('./thinkPractice.js')]);
    const course = think.courses.find((c) => `tp-${c.id}` === id);
    const lessons = await Promise.all(course.units.flatMap((u) => u.lessons).map((l) => loadLesson(l).catch(() => null)));
    return practiceLesson(course, lessons.filter(Boolean));
  }
  if (window.__COURSE__) return window.__COURSE__.lessons[id];
  if (!lessonCache.has(id)) {
    lessonCache.set(id, fetch(`data/lessons/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`lesson ${id} missing`);
      return r.json();
    }));
  }
  return lessonCache.get(id);
}

// Each lesson is 'done', 'current' (the first not done) or 'locked'.
// Starter (ABC) units lead the path for learners who start from zero; for
// everyone else they stay open as optional practice ('bonus').
export function lessonStates(course, doneIds, { starter = false } = {}) {
  const done = new Set(doneIds);
  const states = {};
  let currentAssigned = false;
  const starterUnits = course.starter_units || [];
  if (!starter) {
    for (const unit of starterUnits) for (const id of unit.lessons) states[id] = done.has(id) ? 'done' : 'bonus';
  }
  for (const unit of starter ? [...starterUnits, ...course.units] : course.units) {
    // An open unit (a course's videos) can be watched in any order, and never holds up the path.
    if (unit.open) {
      for (const id of unit.lessons) states[id] = done.has(id) ? 'done' : 'bonus';
      continue;
    }
    for (const id of unit.lessons) {
      if (done.has(id)) states[id] = 'done';
      else if (!currentAssigned) { states[id] = 'current'; currentAssigned = true; }
      else states[id] = 'locked';
    }
    // The unit's reading bonus opens when all its lessons are done; it is
    // optional, so it never becomes the path's 'current' lesson.
    if (unit.bonus) {
      states[unit.bonus] = done.has(unit.bonus) ? 'done'
        : unit.lessons.every((id) => done.has(id)) ? 'bonus' : 'locked';
    }
  }
  return states;
}
