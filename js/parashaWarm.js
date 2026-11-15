// Asks the home Pi to prepare this week's film ahead: every picture (painted
// once by Gemini, 10-40 s each) and every narration line, one at a time, so the
// film plays at once when a child opens it. Runs once per app load per parasha.
import { loadLesson } from './course.js';
import { imageUrl } from './media.js';
import { piLineUrl } from './speech.js';

const started = new Set();

export function warmParasha(lessonId) {
  if (!lessonId || started.has(lessonId)) return;
  started.add(lessonId);
  (async () => {
    const lesson = await loadLesson(lessonId);
    const films = lesson.exercises.filter((e) => e.type === 'parasha_film');
    const prompts = [...new Set(films.flatMap((f) => f.scenes.map((s) => s.img)))];
    const lines = [...new Set(films.flatMap((f) => f.scenes.flatMap((s) => s.say)))];
    for (const p of prompts) {
      const url = await imageUrl(p);
      if (!url) return; // no family code on this device
      const res = await fetch(`${url}&warm=1`).catch(() => null);
      if (!res || res.status === 404 || res.status === 403) break; // the Pi can't paint (no key / old add-on)
    }
    for (const t of lines) {
      const url = await piLineUrl(t, 'he-IL');
      if (!url) return;
      const res = await fetch(`${url}&warm=1`).catch(() => null);
      if (!res || res.status === 404) return;
    }
  })().catch(() => {});
}
