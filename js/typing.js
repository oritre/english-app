// Young kids (grade 3 and below, or a learner with the no_typing switch) never
// type free text: typed translations become word tiles, typed dictation is left out.
export const noTyping = (profile) => profile?.no_typing ?? (parseInt(profile?.grade, 10) <= 3);

export function withoutTyping(exercises, profile) {
  if (!noTyping(profile)) return exercises;
  return exercises
    .map((ex) => (ex.input === 'type' && ex.bank?.length ? { ...ex, input: undefined } : ex))
    .filter((ex) => ex.type !== 'listen_type' && ex.input !== 'type');
}
