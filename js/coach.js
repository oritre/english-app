// The weekly personal practice. Claude reviews each learner's log every week
// and writes a plan to their synced profile as `coach`: feedback (what is going
// well, what to work on) and a few short modules, each an explanation read
// aloud in Hebrew followed by a small quiz on the learner's own mistakes.
export const COACH_LESSON = 'coach';

export function coachModules(profile) {
  const c = profile?.coach;
  if (!c) return [];
  const mods = c.modules?.length ? c.modules : c.exercises?.length ? [{ title_he: c.title_he, exercises: c.exercises }] : [];
  // Exercises arrive as JSON text: Firestore can't store the arrays inside arrays some exercises have.
  return mods.map((m, i) => ({
    ...m, exercises: m.exercises_json ? JSON.parse(m.exercises_json) : m.exercises,
    id: c.modules?.length ? `coach-${c.week}-${i + 1}` : `coach-${c.week}`,
  }));
}

export function coachLesson(profile, i = 0) {
  const m = coachModules(profile)[i];
  return { id: m.id, title_he: m.title_he || 'תרגול אישי', exercises: m.exercises || [], new_words: m.new_words || [] };
}

export const hasCoach = (profile) => coachModules(profile).some((m) => m.exercises?.length);

export const lessonTitle = (titles, id) => titles[id] || (String(id).startsWith('coach') ? 'תרגול אישי' : id);

// Which home tab a module belongs to: the review's `subject` tag, or 'think'
// when every exercise in it is a think-track exercise (robot, fractions...),
// else English. The weekly card shows each module only on its own tab.
const THINK_ONLY = new Set(['number', 'balance', 'fraction', 'numberline', 'robot', 'buckets', 'angle', 'sim', 'plot', 'pyth', 'blitz']);
export function moduleSubject(m) {
  if (['english', 'think', 'know'].includes(m?.subject)) return m.subject;
  const exs = (m?.exercises || []).filter((e) => e.type !== 'teach');
  return exs.length && exs.every((e) => THINK_ONLY.has(e.type) || (e.type === 'mcq' && !/[A-Za-z]/.test(String(e.answer ?? '')))) ? 'think' : 'english';
}
