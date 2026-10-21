// The weekly personal practice. Claude reviews each learner's log every week
// and writes a plan to their synced profile as `coach`: a note, the focus
// points and a short lesson built from what they got wrong or hesitated on.
export const COACH_LESSON = 'coach';

export const coachLesson = (profile) => ({
  id: COACH_LESSON, week: profile.coach.week, title_he: profile.coach.title_he || 'תרגול אישי',
  exercises: profile.coach.exercises || [], new_words: profile.coach.new_words || [],
});

export const hasCoach = (profile) => !!profile?.coach?.exercises?.length;

export const lessonTitle = (titles, id) => titles[id] || (String(id).startsWith('coach') ? 'תרגול אישי' : id);
