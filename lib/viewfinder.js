// Audio-assisted viewfinder for the browser (frontend only; the server never imports this).
// Watches the camera, says "light is low" and switches on the phone's torch in the dark,
// says "hold steady" when the picture is blurry, and takes the photo by itself once the
// frame is bright and sharp, so the person never has to aim and press a tiny button.
//
//   import { startViewfinder } from '../lib/viewfinder.js';
//   const stop = await startViewfinder(videoEl, { lang: 'mr', onCapture: (blob) => sendToApi(blob) });
//
// Torch control works on Android Chrome; other browsers just skip it.
import { messages } from './i18n.js';

export const THRESHOLDS = { dark: 60, blurry: 60, steadyFrames: 3 };

// Mean brightness (0-255) and sharpness (variance of the Laplacian) of an ImageData-like
// { data, width, height }. Pure function, so it can be unit-tested without a camera.
export function analyzeFrame({ data, width, height }) {
  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const y = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    gray[i] = y;
    sum += y;
  }
  let n = 0;
  let mean = 0;
  let m2 = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      n++;
      const d = lap - mean;
      mean += d / n;
      m2 += d * (lap - mean);
    }
  }
  return { brightness: sum / gray.length, sharpness: n > 1 ? m2 / (n - 1) : 0 };
}

export function assessFrame({ brightness, sharpness }, t = THRESHOLDS) {
  if (brightness < t.dark) return 'dark';
  if (sharpness < t.blurry) return 'blurry';
  return 'ok';
}

function browserSay(text, lang) {
  if (!globalThis.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = { mr: 'mr-IN', hi: 'hi-IN', en: 'en-IN' }[lang] || 'mr-IN';
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

export async function startViewfinder(video, { lang = 'mr', onCapture, onStatus = () => {}, say = (text) => browserSay(text, lang), thresholds = THRESHOLDS, maxWidth = 1600 } = {}) {
  const t = messages(lang);
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  await video.play();

  const track = stream.getVideoTracks()[0];
  const canTorch = Boolean(track.getCapabilities?.().torch);
  let torchOn = false;
  const small = document.createElement('canvas');
  small.width = 160;
  small.height = 120;
  const ctx = small.getContext('2d', { willReadFrequently: true });

  let steady = 0;
  let lastSpoken = { text: '', at: 0 };
  let stopped = false;
  const speakOnce = (text) => {
    const now = Date.now();
    if (text === lastSpoken.text && now - lastSpoken.at < 4000) return;
    lastSpoken = { text, at: now };
    say(text);
  };

  const stop = () => {
    stopped = true;
    clearInterval(timer);
    stream.getTracks().forEach((tr) => tr.stop());
  };

  const capture = async () => {
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const full = document.createElement('canvas');
    full.width = Math.round(video.videoWidth * scale);
    full.height = Math.round(video.videoHeight * scale);
    full.getContext('2d').drawImage(video, 0, 0, full.width, full.height);
    const blob = await new Promise((resolve) => full.toBlob(resolve, 'image/jpeg', 0.85));
    stop();
    onCapture?.(blob);
  };

  const timer = setInterval(async () => {
    if (stopped || video.readyState < 2) return;
    ctx.drawImage(video, 0, 0, small.width, small.height);
    const stats = analyzeFrame(ctx.getImageData(0, 0, small.width, small.height));
    const status = assessFrame(stats, thresholds);
    onStatus(status, stats);

    if (status === 'dark') {
      steady = 0;
      if (canTorch && !torchOn) {
        torchOn = true;
        await track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => (torchOn = false));
      }
      speakOnce(t.camDark);
    } else if (status === 'blurry') {
      steady = 0;
      speakOnce(t.camBlurry);
    } else if (++steady >= thresholds.steadyFrames) {
      say(t.camReady);
      await capture();
    }
  }, 400);

  return stop;
}
