// Speech-to-text inside the app, for phones whose Google speech service
// returns nothing (and browsers without one, like Brave). Whisper runs on the
// device through transformers.js: the model downloads once (about 65MB), is
// kept in the browser's cache, and audio never leaves the phone.
const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODEL = 'Xenova/whisper-tiny.en';
const READY_KEY = 'english_app_local_asr_ready';
const RATE = 16000;

let asrPromise = null;

export const localAsrSupported = () => typeof WebAssembly === 'object' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder === 'function';

export function localAsrDownloaded() {
  try { return localStorage.getItem(READY_KEY) === '1'; } catch { return false; }
}

// onProgress(fraction 0..1) while model files download.
export function loadLocalAsr(onProgress) {
  if (!asrPromise) {
    asrPromise = (async () => {
      const tf = await import(TF_URL);
      tf.env.allowLocalModels = false;
      const files = {};
      const asr = await tf.pipeline('automatic-speech-recognition', MODEL, {
        device: 'wasm',
        // A full-precision encoder keeps recognition accurate; the quantized decoder keeps the download small.
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
        progress_callback: (p) => {
          if (p.status !== 'progress' || !p.total) return;
          files[p.file] = [p.loaded, p.total];
          const [l, t] = Object.values(files).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
          onProgress?.(t ? l / t : 0);
        },
      });
      try { localStorage.setItem(READY_KEY, '1'); } catch { /* storage blocked */ }
      return asr;
    })().catch((e) => { asrPromise = null; throw e; });
  }
  return asrPromise;
}

export async function transcribe(audio) {
  const asr = await loadLocalAsr();
  const out = await asr(audio);
  return String(out?.text || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').trim();
}

// Records one utterance. Stops by itself after a pause once speech was heard,
// after maxSec, or when stop() is called. Resolves to 16kHz mono samples.
export function recordUtterance({ onLevel, onSpeech, maxSec = 8, silenceSec = 1.3, threshold = 0.02 } = {}) {
  let stopFn = () => {};
  const done = (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });
    rec.start();
    const buf = new Float32Array(an.fftSize);
    const started = Date.now();
    let heardAt = 0;
    let lastLoud = 0;
    let finished = false;
    const finish = () => { if (!finished) { finished = true; rec.stop(); } };
    stopFn = finish;
    const tick = () => {
      if (finished) return;
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      onLevel?.(rms);
      const now = Date.now();
      if (rms > threshold) { lastLoud = now; if (!heardAt) { heardAt = now; onSpeech?.(); } }
      if (now - started > maxSec * 1000 || (heardAt && now - lastLoud > silenceSec * 1000)) finish();
      else requestAnimationFrame(tick);
    };
    tick();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: rec.mimeType });
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close().catch(() => {});
    return { audio: await toMono16k(decoded), heard: !!heardAt };
  })();
  return { stop: () => stopFn(), done };
}

async function toMono16k(buffer) {
  const frames = Math.ceil(buffer.duration * RATE);
  const off = new OfflineAudioContext(1, frames, RATE);
  const src = off.createBufferSource();
  src.buffer = buffer;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}
