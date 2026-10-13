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

export async function loadLesson(id) {
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
export function lessonStates(course, doneIds) {
  const done = new Set(doneIds);
  const states = {};
  let currentAssigned = false;
  for (const unit of course.units) {
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
