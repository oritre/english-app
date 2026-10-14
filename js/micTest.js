// Records a few seconds straight from the microphone, without speech
// recognition, and reports the loudest level heard (0 to 1).
export const HEARD_LEVEL = 0.02;

export async function measureMic(seconds, onLevel) {
  let stream = null;
  let ctx = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0;
    const end = Date.now() + seconds * 1000;
    await new Promise((done) => {
      const tick = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        peak = Math.max(peak, rms);
        onLevel?.(rms);
        if (Date.now() < end) requestAnimationFrame(tick); else done();
      };
      tick();
    });
    return peak;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => {});
  }
}

export function micMeter() {
  const fill = document.createElement('div');
  fill.className = 'mic-meter-fill';
  const meter = document.createElement('div');
  meter.className = 'mic-meter';
  meter.hidden = true;
  meter.append(fill);
  return { meter, show: (rms) => { meter.hidden = false; fill.style.width = `${Math.min(100, rms * 400)}%`; }, hide: () => { meter.hidden = true; } };
}

export const MIC_OK_TIP = 'המיקרופון קולט. אם התמלול עדיין לא עובד, הבעיה בשירות התמלול של הטלפון. בהגדרות אנדרואיד: אפליקציות > Google > הרשאות > מיקרופון > לאפשר.';
export const MIC_SILENT_TIP = 'המיקרופון לא קלט קול. בדקו שאין אוזניות Bluetooth מחוברות, ושל־Chrome יש הרשאת מיקרופון בהגדרות אנדרואיד.';
export const micErrorTip = (err) => `אין גישה למיקרופון (${err?.name || 'שגיאה'}). אשרו ל־Chrome גישה למיקרופון בהגדרות האתר.`;
