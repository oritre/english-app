import { el, mixed } from '../util.js';
import { canSpeakLang, utterance } from '../speech.js';
import { rateFactor } from '../settings.js';
import { parseArt, sceneMs } from '../storyLogic.js';
import { videoUrl } from '../media.js';

// General knowledge ("ידע כללי", after BrainPOP): every lesson opens with a
// short cartoon, then a quiz. The cartoon is our own: scenes drawn from emoji
// on a painted backdrop, narrated in Hebrew by the device's voice, with the
// narration as subtitles. It plays by itself like a video; the lesson's
// button opens only once it has reached the end.
//
// A scene is {bg, art, text_he, tag?}. art is emoji separated by spaces: the
// first one is the star of the scene, the rest stand around it. A token may
// carry a motion after "~" (🚢~sail, ☀️~spin); see MOTIONS below.

const hasHebrewVoice = () => canSpeakLang('he-IL');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Says one line and calls done() when it ends; returns a cancel function.
// Chrome sometimes never fires onend, so a generous timer backs it up.
// onWord(charIndex) fires at each word on voices that report boundaries.
function sayLine(text, done, onWord) {
  let over = false;
  const finish = () => { if (!over) { over = true; clearTimeout(safety); done(); } };
  const safety = setTimeout(finish, String(text).length * 160 + 4000);
  try {
    speechSynthesis.cancel();
    // Through speech.js, so an online voice that fails offline falls back to one on the device.
    speechSynthesis.speak(utterance(text, 'he-IL', 0.95 * rateFactor(), {
      onend: finish,
      onerror: finish,
      onboundary: (e) => { if (!over && e.name === 'word') onWord?.(e.charIndex); },
    }));
  } catch { finish(); }
  return () => { over = true; clearTimeout(safety); try { speechSynthesis.cancel(); } catch { /* none */ } };
}

// A scene: a painted backdrop in three layers (sky, drifting clouds or stars,
// hills or waves in front) inside a "camera" that zooms slowly, then the emoji.
// Backdrops the stylesheet does not know fall back to the plain sky.
function sceneView(scene, i = 0) {
  const pieces = parseArt(scene.art).map((p, k) => el('span', {
    class: `story-piece m-${p.motion}`, 'aria-hidden': 'true',
    style: `--x: ${p.x}%; --y: ${p.y}%; --s: ${p.size}em; --d: ${k * 160}ms`,
  }, p.e));
  return el('div', { class: `story-scene bg-${scene.bg || 'sky'}${i % 2 ? ' alt' : ''}` },
    el('div', { class: 'story-cam', 'aria-hidden': 'true' },
      el('div', { class: 'story-sky' }), el('div', { class: 'story-far' }), el('div', { class: 'story-near' }), ...pieces),
    scene.tag ? el('div', { class: 'story-tag' }, ...mixed(scene.tag)) : null);
}

// Confetti for the end card: a few coloured bits that fall twice and stop.
const confetti = () => el('div', { class: 'story-confetti', 'aria-hidden': 'true' },
  Array.from({ length: 14 }, (_, i) => el('i', { style: `--l: ${(i * 53) % 100}%; --h: ${(i * 47) % 360}; --d: ${(i % 7) * 180}ms` })));

export function renderStory(root, ex, { setReady, track }) {
  const scenes = ex.scenes || [];
  let at = -1;
  let playing = false;
  let finished = false;
  let cancel = null;
  let voiceOn = true;
  const lesson = root.closest('.lesson');
  // The quiz that follows keeps the subject's look (one column, a "quiz" kicker).
  lesson?.classList.add('know-lesson');

  const stage = el('div', { class: 'story-stage' });
  const caption = el('div', { class: 'story-caption', 'aria-live': 'polite' });
  const count = el('span', { class: 'story-count', dir: 'ltr' });
  const segs = el('div', { class: 'story-segs', dir: 'rtl' }, scenes.map((_, i) => el('button', {
    class: 'story-seg', type: 'button', 'aria-label': `סצנה ${i + 1}`, onclick: () => { track?.('scene', i + 1); go(i, true); },
  }, el('span'))));
  const playBtn = el('button', { class: 'story-btn play', type: 'button', 'aria-label': 'ניגון' }, '▶');
  // In RTL the story runs right to left, so "previous" points right and "next" points left.
  const prevBtn = el('button', { class: 'story-btn', type: 'button', 'aria-label': 'סצנה קודמת' }, '⏭');
  const nextBtn = el('button', { class: 'story-btn', type: 'button', 'aria-label': 'סצנה הבאה' }, '⏮');
  const voiceBtn = el('button', { class: 'story-btn voice', type: 'button', 'aria-label': 'הקראה', 'aria-pressed': 'true' }, '🔊');
  if (!hasHebrewVoice()) { voiceOn = false; voiceBtn.hidden = true; }
  const frame = el('div', { class: 'story-frame' }, stage, caption);
  const controls = el('div', { class: 'story-controls' },
    el('div', { class: 'story-bar' }, segs, count),
    el('div', { class: 'story-buttons' }, prevBtn, playBtn, nextBtn, voiceBtn));

  // The title and end cards sit on a dimmed still of the first / last scene.
  const still = (scene) => { const v = sceneView(scene || { bg: ex.bg }); v.classList.add('story-preview'); return v; };
  const titleCard = () => el('button', { class: 'story-scene story-title', type: 'button', 'aria-label': 'לצפות בסרטון', onclick: () => start() },
    still(scenes[0]), el('div', { class: 'story-scrim', 'aria-hidden': 'true' }),
    el('div', { class: 'story-card-body' },
      el('span', { class: 'story-kicker' }, `🎬 סרטון קצר · ${scenes.length} סצנות`),
      el('span', { class: 'story-title-icon', 'aria-hidden': 'true' }, ex.icon || '🎬'),
      el('span', { class: 'story-title-text' }, ...mixed(ex.title_he || '')),
      el('span', { class: 'story-play-big', 'aria-hidden': 'true' }, '▶'),
      el('span', { class: 'story-title-hint' }, 'לחצו לצפייה')));
  const endCard = () => el('div', { class: 'story-scene story-end' },
    still(scenes[scenes.length - 1]), el('div', { class: 'story-scrim', 'aria-hidden': 'true' }), reducedMotion() ? null : confetti(),
    el('div', { class: 'story-card-body' },
      el('span', { class: 'story-title-icon story-end-icon', 'aria-hidden': 'true' }, '🏆'),
      el('span', { class: 'story-title-text' }, 'כל הכבוד, צפיתם בסרטון!'),
      el('span', { class: 'story-end-sub' }, 'עכשיו חידון קצר על מה שראינו'),
      el('button', { class: 'btn small story-replay', type: 'button', onclick: () => { track?.('replay', ''); go(0, true); } }, '↺ לצפות שוב'),
      el('span', { class: 'story-title-hint' }, 'הכפתור "לחידון" למטה נפתח 👇')));

  // Swaps the picture with a crossfade: the old scene fades out over the new one.
  const show = (node) => {
    const old = stage.querySelector('.story-scene:not(.out)');
    stage.append(node);
    if (!old) return;
    if (reducedMotion()) { old.remove(); return; }
    old.classList.add('out');
    setTimeout(() => old.remove(), 500);
  };

  // The subtitle is one span per word, so the word being spoken can light up.
  let unhighlight = null;
  const setCaption = (text) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    caption.replaceChildren(el('span', { class: 'story-line' }, ...words.flatMap((w, i) => [i ? ' ' : null, el('span', { class: 'w', 'data-at': words.slice(0, i).join(' ').length + (i ? 1 : 0) }, ...mixed(w))])));
  };
  const markWord = (n) => { caption.querySelectorAll('.w').forEach((w, k) => { w.classList.toggle('on', k === n); w.classList.toggle('said', k < n); }); };
  const markAt = (charIndex) => {
    const ws = [...caption.querySelectorAll('.w')];
    let n = 0;
    ws.forEach((w, k) => { if (Number(w.dataset.at) <= charIndex) n = k; });
    markWord(n);
  };
  // Without boundary events the words light up on a timer, paced by their length.
  const highlightByTimer = (ms) => {
    const ws = [...caption.querySelectorAll('.w')];
    const total = ws.reduce((n, w) => n + w.textContent.length + 1, 0) || 1;
    let t = 0;
    const timers = ws.map((w, k) => { const id = setTimeout(() => markWord(k), t); t += (ms * (w.textContent.length + 1)) / total; return id; });
    return () => timers.forEach(clearTimeout);
  };

  const stop = () => { cancel?.(); cancel = null; unhighlight?.(); unhighlight = null; };
  const setPlaying = (on) => {
    playing = on;
    playBtn.textContent = on ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', on ? 'השהיה' : 'ניגון');
    frame.classList.toggle('paused', !on && at >= 0 && !finished);
  };
  const end = () => {
    stop();
    at = scenes.length;
    setPlaying(false);
    show(endCard());
    caption.replaceChildren();
    count.textContent = '';
    segs.querySelectorAll('.story-seg').forEach((s) => { s.classList.add('seen'); s.classList.remove('now'); });
    // The lesson's button opens; a small nudge shows where to go next.
    lesson?.classList.add('story-done');
    if (!finished) { finished = true; setReady(true); }
  };
  // Shows scene i; while playing, narrates it and moves on when the line ends.
  const go = (i, play = playing) => {
    stop();
    if (!root.isConnected && at >= 0) return;
    if (i >= scenes.length) { end(); return; }
    at = Math.max(0, i);
    const scene = scenes[at];
    show(sceneView(scene, at));
    setCaption(scene.text_he);
    count.textContent = `${at + 1}/${scenes.length}`;
    segs.querySelectorAll('.story-seg').forEach((s, k) => { s.classList.toggle('seen', k < at); s.classList.toggle('now', k === at); });
    setPlaying(play);
    if (play) narrate();
  };
  const narrate = () => {
    const scene = scenes[at];
    const seg = segs.children[at];
    const ms = sceneMs(scene.text_he);
    seg?.style.setProperty('--ms', `${ms}ms`);
    const after = () => { cancel = null; unhighlight?.(); unhighlight = null; markWord(-1); if (!root.isConnected) return; const t = setTimeout(() => go(at + 1), 650); cancel = () => clearTimeout(t); };
    unhighlight = highlightByTimer(ms);
    if (voiceOn) {
      // The first boundary event means the voice keeps time itself; the timer steps aside.
      cancel = sayLine(scene.text_he, after, (ci) => { unhighlight?.(); unhighlight = null; markAt(ci); });
    } else {
      const t = setTimeout(after, ms);
      cancel = () => clearTimeout(t);
    }
  };
  const start = () => { track?.('play', ''); go(0, true); };

  playBtn.addEventListener('click', () => {
    if (at < 0 || at >= scenes.length) { start(); return; }
    if (playing) { stop(); setPlaying(false); } else { setPlaying(true); narrate(); }
  });
  prevBtn.addEventListener('click', () => { track?.('back', ''); go(Math.max(0, at - 1)); });
  nextBtn.addEventListener('click', () => { track?.('skip', ''); go(at + 1); });
  voiceBtn.addEventListener('click', () => {
    voiceOn = !voiceOn;
    voiceBtn.textContent = voiceOn ? '🔊' : '🔇';
    voiceBtn.setAttribute('aria-pressed', String(voiceOn));
    voiceBtn.classList.toggle('off', !voiceOn);
    if (playing) { stop(); narrate(); }
  });

  stage.append(titleCard());
  root.append(el('div', { class: 'story' }, frame, controls,
    ex.source_he ? el('p', { class: 'muted small story-source' }, ...mixed(ex.source_he)) : null));
  // Leaving the cartoon stops the voice and the nudge on the lesson's button.
  const watch = setInterval(() => { if (!root.isConnected) { stop(); lesson?.classList.remove('story-done'); clearInterval(watch); } }, 1000);
  return { getAnswer: () => null, info: true, gated: true, ready: () => finished, nextLabel: 'לחידון ←' };
}

// ---- a video (from an approved Hebrew channel, served by the home Pi) ----

// {type: 'video', youtube: id, duration, title_he, source_he}. The file comes
// from our own server (see media.js), never from YouTube. When it ends the
// player is taken away and the quiz opens.
export function renderVideo(root, ex, { setReady, track }) {
  let finished = false;
  const done = () => { if (!finished) { finished = true; setReady(true); } };
  const box = el('div', { class: 'video-box' });
  const note = el('p', { class: 'muted small video-note' });
  root.append(el('div', { class: 'story video' },
    el('h2', { class: 'ex-title' }, '🎬 ', ...mixed(ex.title_he || '')), box, note,
    ex.source_he ? el('p', { class: 'muted small story-source' }, ...mixed(ex.source_he)) : null));
  const card = (icon, text) => box.replaceChildren(el('div', { class: 'story-scene story-end bg-night' },
    el('span', { class: 'story-title-icon' }, icon), el('span', { class: 'story-title-text' }, text)));
  // A video that can't play never holds up the quiz.
  const fail = (text) => { card('📵', text); done(); };
  videoUrl(ex.youtube).then((src) => {
    if (!root.isConnected) return;
    if (!src) { fail('כדי לראות סרטונים, צריך לחבר את המכשיר למשפחה (בהגדרות, סנכרון).'); return; }
    const video = el('video', {
      src, controls: '', playsinline: '', preload: 'metadata', controlslist: 'nodownload', disablepictureinpicture: '',
    });
    let started = false;
    video.addEventListener('play', () => { if (!started) { started = true; track?.('play', ''); } });
    video.addEventListener('ended', () => { card('🎬', 'סוף! עכשיו חידון קצר'); done(); });
    video.addEventListener('error', () => fail('הסרטון לא נטען. אולי אין חיבור לשרת של הבית, או שהסרטון עוד יורד אליו. אפשר לנסות שוב אחר כך.'));
    box.append(video);
    // Leaving the lesson stops the video.
    const watch = setInterval(() => { if (!root.isConnected) { video.pause(); video.removeAttribute('src'); video.load(); clearInterval(watch); } }, 1000);
    // If the end is somehow missed, the quiz opens a while after the video's length.
    setTimeout(() => { if (!finished && root.isConnected) { note.textContent = 'סיימתם לצפות? אפשר לעבור לחידון.'; done(); } }, Math.max(30, (ex.duration || 0) + 20) * 1000);
  });
  return { getAnswer: () => null, info: true, gated: true, ready: () => finished, nextLabel: 'לחידון ←' };
}
