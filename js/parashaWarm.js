// Asks the home Pi to prepare this week's film ahead: every picture (painted
// once by Gemini, 10-40 s each), every frame of every character, and every
// line in its voice, one at a time, so the film plays at once when a child
// opens it. Runs once per app load per parasha.
import { loadLesson } from './course.js';
import { imageUrl, spriteUrl, characterLineUrl } from './media.js';
import { piLineUrl } from './speech.js';
import { sayLine, framePlan } from './parashaLogic.js';

const started = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PIC_PAUSE = 20000; // Google limits how often pictures may be asked for
const VOICE_PAUSE = 3000;
const BUSY_WAIT = 60000;

// One request to the Pi. Resolves to 'ok', 'skip' (this one can't be made now;
// go on to the next) or 'stop' (the Pi can't do this kind of work at all).
// A busy Pi (503) is asked again after a minute, up to three times. After
// something that was really made now (not just found ready) comes a pause.
async function ask(url, pause) {
  for (let tries = 0; ; tries++) {
    const t0 = Date.now();
    const res = await fetch(`${url}&warm=1`).catch(() => null);
    if (!res || res.status === 404 || res.status === 403) return 'stop'; // unreachable / no key / old add-on
    if (res.status === 503 && tries < 3) { await sleep(BUSY_WAIT); continue; }
    if (Date.now() - t0 > 1500) await sleep(pause);
    return res.ok ? 'ok' : 'skip';
  }
}

export function warmParasha(lessonId) {
  if (!lessonId || started.has(lessonId)) return;
  started.add(lessonId);
  (async () => {
    const lesson = await loadLesson(lessonId);
    const films = lesson.exercises.filter((e) => e.type === 'parasha_film');
    const prompts = [...new Set(films.flatMap((f) => f.scenes.map((s) => s.img)))];
    for (const p of prompts) {
      const url = await imageUrl(p);
      if (!url) return; // no family code on this device
      if (await ask(url, PIC_PAUSE) === 'stop') break;
    }

    // The characters: every base first, then the frames edited from it, then gesture_talk.
    const hashes = new Map(); // "who/frame" -> the hash of a frame that is painted
    const seen = new Set();
    sprites: for (const film of films) {
      for (const job of framePlan(film.cast)) {
        const ref = job.ref ? hashes.get(`${job.who}/${job.ref}`) : '';
        if (job.ref && !ref) continue; // what it is edited from was not painted
        const got = await spriteUrl(job.p, ref);
        if (!got) return;
        if (!seen.has(got.hash)) {
          seen.add(got.hash);
          const how = await ask(got.url, PIC_PAUSE);
          if (how === 'stop') break sprites;
          if (how !== 'ok') continue;
        }
        hashes.set(`${job.who}/${job.name}`, got.hash);
      }
    }

    // The voices, in the order of the film: the narrator's lines and each character's own.
    const done = new Set();
    for (const film of films) {
      const cast = film.cast || {};
      for (const ln of film.scenes.flatMap((s) => (s.say || []).map(sayLine))) {
        if (!ln.text) continue;
        const base = await piLineUrl(ln.text, 'he-IL');
        if (!base) return;
        const ch = cast[ln.who];
        const url = ch ? await characterLineUrl(ln.text, ch.voice, [ch.style, ln.tone].filter(Boolean).join(' ')) : base;
        if (!url || done.has(url)) continue;
        done.add(url);
        if (await ask(url, VOICE_PAUSE) === 'stop') return;
      }
    }
  })().catch(() => {});
}
