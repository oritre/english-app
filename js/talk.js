// Spoken conversation with an AI English tutor (Gemini Live API). Audio goes
// both ways in real time: the microphone is streamed as 16kHz PCM, the tutor's
// voice comes back as 24kHz PCM and is played as it arrives. Nothing is shown
// as text; transcripts are only kept for the weekly review.
// The Gemini key is typed into this device's settings and never synced.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@google/genai@2.28.0/dist/web/index.mjs/+esm';
const KEY = 'english_app_gemini_key';
const MODEL_KEY = 'english_app_gemini_model';
const DEFAULT_MODEL = 'gemini-3.8-live';
const IN_RATE = 16000;
const OUT_RATE = 24000;

export function getTalkKey() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function setTalkKey(k) { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } }
const model = () => { try { return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; } };

export const talkSupported = () => !!navigator.mediaDevices?.getUserMedia && typeof AudioContext === 'function' && typeof WebSocket === 'function';

export const TOPICS = [
  { id: 'free', he: 'שיחה חופשית', en: 'a free conversation: start by asking how the student\'s day was' },
  { id: 'school', he: 'בית ספר וחברים', en: 'school, subjects, teachers and friends' },
  { id: 'hobbies', he: 'תחביבים וספורט', en: 'hobbies, sports and free time' },
  { id: 'past', he: 'מה עשיתי בסוף השבוע', en: 'what the student did last weekend (practice the past simple)' },
  { id: 'future', he: 'תוכניות וחלומות', en: 'plans for the future and dreams (practice will / going to)' },
  { id: 'movies', he: 'סרטים, סדרות ומשחקים', en: 'movies, series, books and video games the student likes' },
  { id: 'restaurant', he: 'משחק תפקידים: במסעדה', en: 'a role-play: you are a waiter in a restaurant in London and the student orders food' },
  { id: 'travel', he: 'משחק תפקידים: בשדה התעופה', en: 'a role-play: the student arrives at an airport abroad and asks for directions and help' },
];

function instructions({ name, grade, topic, focus }) {
  return `You are Sam, a warm, patient English speaking tutor for ${name}, an Israeli student in ${grade} whose first language is Hebrew. This is a spoken conversation lesson about ${topic.en}.

Goals: get ${name} talking as much as possible, build vocabulary, and use correct grammar in speech.

How to run the conversation:
- Speak simple, natural English at about A2-B1 level, a little slowly and clearly. Raise the level if ${name} answers easily, lower it if they struggle.
- Keep your turns short (one to three sentences) and almost always end with a question, so ${name} speaks more than you.
- Correct mistakes right away, kindly: say the correct version ("We say: I went to the beach"), give a very short reason when it helps ("went is the past of go"), and ask ${name} to say the sentence again. Correct at most one or two things per turn; let small slips pass when the message was clear and praise good sentences.
- Teach two or three useful new words or phrases during the lesson, explain each one simply, and try to get ${name} to use them.
- If ${name} speaks Hebrew, seems stuck, or doesn't understand, switch to Hebrew briefly: find out what they wanted to say or explain the word or rule in Hebrew, then go back to English with the right way to say it.
- When you receive a note in square brackets, it comes from the app, not from ${name}: follow it.
${focus ? `- This week, pay special attention to: ${focus}.\n` : ''}
Safety: ${name} is a young teenager. Keep every topic age-appropriate and friendly. Don't ask for private details like their address, phone number or school name. If they bring up something unsafe or upsetting, respond kindly, suggest talking to a parent, and steer back to the lesson.

Start now: greet ${name} by name in English, say what today's topic is in one sentence, and ask the first easy question.`;
}

// PCM helpers
function downsample(input, fromRate) {
  if (fromRate === IN_RATE) return input;
  const ratio = fromRate / IN_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function toBase64Pcm(float32) {
  const bytes = new Uint8Array(float32.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64Pcm(b64) {
  const bin = atob(b64);
  const view = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) view.setUint8(i, bin.charCodeAt(i));
  const out = new Float32Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

const WORKLET = `class Tap extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor('mic-tap', Tap);`;

// Starts a conversation. on: {state(s), level(rms), error(err), closed()}
// state is 'connecting' | 'listening' | 'speaking'.
export async function startTalk({ name, grade = '8th grade', topic, focus = '', on = {} }) {
  const key = getTalkKey();
  if (!key) throw Object.assign(new Error('no key'), { code: 'no-key' });
  on.state?.('connecting');
  // Both audio contexts are made before the first await, while the tap that
  // started the talk still counts as a user gesture; otherwise phones keep them muted.
  const out = new AudioContext({ sampleRate: OUT_RATE });
  const mic = new AudioContext();
  out.resume().catch(() => {});
  mic.resume().catch(() => {});
  let stream = null;
  let session = null;
  try {
    const { GoogleGenAI, Modality } = await import(SDK_URL);
    const transcript = [];
    const push = (who, text) => {
      if (!text) return;
      const last = transcript[transcript.length - 1];
      if (last && last.who === who) last.text += text; else transcript.push({ who, text });
    };

    // Playback: queue the tutor's audio chunks back to back.
    let playAt = 0;
    const playing = new Set();
    const play = (b64) => {
      const data = fromBase64Pcm(b64);
      const buf = out.createBuffer(1, data.length, OUT_RATE);
      buf.copyToChannel(data, 0);
      const src = out.createBufferSource();
      src.buffer = buf;
      src.connect(out.destination);
      playAt = Math.max(playAt, out.currentTime + 0.05);
      src.start(playAt);
      playAt += buf.duration;
      playing.add(src);
      on.state?.('speaking');
      src.onended = () => { playing.delete(src); if (!playing.size) on.state?.('listening'); };
    };
    const stopPlayback = () => { for (const s of playing) { try { s.stop(); } catch { /* already stopped */ } } playing.clear(); playAt = 0; };

    let turnDone = null;
    let closed = false;
    const ai = new GoogleGenAI({ apiKey: key });
    session = await ai.live.connect({
      model: model(),
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: instructions({ name, grade, topic, focus }) }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
      },
      callbacks: {
        onmessage: (m) => {
          const c = m.serverContent;
          if (!c) return;
          if (c.interrupted) stopPlayback();
          for (const p of c.modelTurn?.parts || []) if (p.inlineData?.data) play(p.inlineData.data);
          push('student', c.inputTranscription?.text);
          push('tutor', c.outputTranscription?.text);
          if (c.turnComplete) { turnDone?.(); turnDone = null; }
        },
        onerror: (e) => on.error?.(e),
        onclose: () => { if (!closed) { closed = true; cleanup(); on.closed?.(); } },
      },
    });

    // Microphone: stream 16kHz PCM in ~100ms chunks.
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const source = mic.createMediaStreamSource(stream);
    let pending = [];
    let pendingLen = 0;
    const onFrame = (frame) => {
      let sum = 0;
      for (const v of frame) sum += v * v;
      on.level?.(Math.sqrt(sum / frame.length));
      pending.push(frame);
      pendingLen += frame.length;
      if (pendingLen < mic.sampleRate / 10) return;
      const all = new Float32Array(pendingLen);
      let o = 0;
      for (const f of pending) { all.set(f, o); o += f.length; }
      pending = [];
      pendingLen = 0;
      if (!closed) session.sendRealtimeInput({ audio: { data: toBase64Pcm(downsample(all, mic.sampleRate)), mimeType: `audio/pcm;rate=${IN_RATE}` } });
    };
    let tap;
    if (mic.audioWorklet) {
      await mic.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
      tap = new AudioWorkletNode(mic, 'mic-tap');
      tap.port.onmessage = (e) => onFrame(e.data);
    } else {
      tap = mic.createScriptProcessor(4096, 1, 1);
      tap.onaudioprocess = (e) => onFrame(e.inputBuffer.getChannelData(0).slice(0));
    }
    source.connect(tap);
    // The worklet must be pulled by the graph to run; a muted gain keeps it silent.
    const mute = mic.createGain();
    mute.gain.value = 0;
    tap.connect(mute).connect(mic.destination);
    on.state?.('listening');

    function cleanup() {
      stream?.getTracks().forEach((t) => t.stop());
      mic.close().catch(() => {});
      setTimeout(() => out.close().catch(() => {}), 300);
    }

    // A note from the app (in square brackets) the tutor follows, e.g. "explain in Hebrew".
    const note = (text) => { if (!closed) session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: `[${text}]` }] }], turnComplete: true }); };

    return {
      transcript,
      helpHebrew: () => note('The student pressed the "help in Hebrew" button. Explain in short, simple Hebrew what you just said or asked, then repeat your question in easy English.'),
      repeatSlowly: () => note('The student asked you to say that again, slowly and with simpler words.'),
      // Asks for a spoken summary, waits for it to finish playing, then hangs up.
      async finish() {
        if (closed) return transcript;
        const done = new Promise((r) => { turnDone = r; });
        note('The lesson is over. In English, with one or two sentences in Hebrew, tell the student briefly what they did well and one or two things to practice, then say goodbye. Keep it under 30 seconds.');
        await Promise.race([done, new Promise((r) => setTimeout(r, 25000))]);
        while (playing.size) await new Promise((r) => setTimeout(r, 200));
        this.close();
        return transcript;
      },
      close() {
        if (closed) return;
        closed = true;
        stopPlayback();
        try { session.close(); } catch { /* already closed */ }
        cleanup();
      },
    };
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    try { session?.close(); } catch { /* not open */ }
    out.close().catch(() => {});
    mic.close().catch(() => {});
    throw err;
  }
}
