import { LANG_TAGS } from './i18n';

// Hears one spoken question and stops by itself when the person stops talking.
// Uses the phone's own speech recognition when it has one: the words appear on screen as they
// are spoken and the question is ready the moment they finish. Otherwise (or if it fails) it
// records the voice, ends after a short silence, and the server works out the words.
//
//   const session = listen({ lang, onWords });   // session.stop() ends early
//   const { text, audio } = await session.result;
export function listen({ lang, onWords = () => {} }) {
  let stopNow = () => {};
  const result = new Promise((resolve, reject) => {
    const fallback = () => {
      const rec = record();
      stopNow = rec.stop;
      rec.result.then(resolve, reject);
    };
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SR) return fallback();

    const sr = new SR();
    sr.lang = LANG_TAGS[lang] || 'mr-IN';
    sr.interimResults = true;
    sr.continuous = false;
    sr.maxAlternatives = 1;
    let words = '';
    let failed = false;
    sr.onresult = (e) => {
      words = Array.from(e.results, (r) => r[0].transcript).join(' ').trim();
      onWords(words);
    };
    sr.onerror = (e) => {
      // No microphone permission, no network for recognition, or language not supported: record instead.
      if (!['no-speech', 'aborted'].includes(e.error)) failed = true;
    };
    sr.onend = () => (failed && !words ? fallback() : resolve({ text: words }));
    stopNow = () => sr.stop();
    try {
      sr.start();
    } catch {
      fallback();
    }
  });
  return { result, stop: () => stopNow() };
}

// Records until 1.2 s of quiet after speech (or 6 s of nothing, or 15 s in all).
function record() {
  let stopNow = () => {};
  const result = (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));

    let ctx;
    let timer;
    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const start = Date.now();
      let heard = false;
      let quietSince = start;
      timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
        const now = Date.now();
        if (rms > 0.02) {
          heard = true;
          quietSince = now;
        }
        if ((heard && now - quietSince > 1200) || (!heard && now - start > 6000)) stopNow();
      }, 100);
    } catch {}

    stopNow = () => rec.state === 'recording' && rec.stop();
    rec.start();
    const cap = setTimeout(stopNow, 15000);
    await done;
    clearTimeout(cap);
    clearInterval(timer);
    ctx?.close().catch(() => {});
    stream.getTracks().forEach((tr) => tr.stop());
    return { audio: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) };
  })();
  return { result, stop: () => stopNow() };
}
