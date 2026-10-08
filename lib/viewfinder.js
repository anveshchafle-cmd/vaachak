// Audio-assisted viewfinder for the browser (frontend only; the server never imports this).
// Watches the camera, says "light is low" and switches on the phone's torch in the dark,
// says "hold steady" while the picture is blurry or moving, and takes the photo by itself once
// the paper is bright, sharp and still, so the person never has to aim and press a tiny button.
//
//   import { startViewfinder } from '../lib/viewfinder.js';
//   const { stop, snap } = await startViewfinder(videoEl, { lang: 'mr', onCapture: (blob) => sendToApi(blob) });
//
// Torch control works on Android Chrome; other browsers just skip it.
import { messages } from './i18n.js';

// Sharpness is the variance of the Laplacian on a 320x240 sample of the middle of the frame.
// A sharp bill scores in the thousands; at ~250 small print is already smudged.
export const THRESHOLDS = {
  dark: 60,
  blurry: 250,
  // After this long without a photo, accept a little less sharpness (dim rooms, faint print).
  relaxedBlurry: 120,
  relaxAfterMs: 8000,
  // Average brightness change between two looks (0-255); above this the hand is still moving.
  moving: 8,
  // Must also be close to the sharpest frame seen recently, i.e. the lens has finished focusing.
  peakShare: 0.5,
  // Wait for autofocus and exposure to settle, then for the picture to stay good this many looks in a row.
  warmupMs: 1500,
  steadyFrames: 4,
};
const LOOK_MS = 250;
const SAMPLE = { w: 320, h: 240 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Average change of the green channel between two same-size frames: high while the phone moves.
export function frameMotion(a, b) {
  if (!a || !b || a.data.length !== b.data.length) return 0;
  let diff = 0;
  let n = 0;
  for (let p = 1; p < a.data.length; p += 16) {
    diff += Math.abs(a.data[p] - b.data[p]);
    n++;
  }
  return n ? diff / n : 0;
}

// `minSharp` lets the caller raise the bar while the lens is still hunting for focus.
export function assessFrame({ brightness, sharpness, motion = 0 }, t = THRESHOLDS, minSharp = t.blurry) {
  if (brightness < t.dark) return 'dark';
  if (motion > t.moving || sharpness < minSharp) return 'blurry';
  return 'ok';
}

// Draws the middle of the picture (where the paper usually is) at a fixed size. Shrinking the
// whole frame instead would hide blur, because downscaling makes any picture look crisp.
function sampleCenter(ctx, source, width, height) {
  ctx.drawImage(source, width * 0.15, height * 0.15, width * 0.7, height * 0.7, 0, 0, SAMPLE.w, SAMPLE.h);
  return ctx.getImageData(0, 0, SAMPLE.w, SAMPLE.h);
}

function browserSay(text, lang) {
  if (!globalThis.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = { mr: 'mr-IN', hi: 'hi-IN', en: 'en-IN' }[lang] || 'mr-IN';
  u.rate = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// Returns { stop, snap }: `snap()` is the shutter button. It waits a moment (the tap itself
// shakes the phone) and keeps the sharpest of several frames, not the one under the finger.
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
  const caps = track.getCapabilities?.() || {};
  const canTorch = Boolean(caps.torch);
  // Keep refocusing as the paper moves closer (Android Chrome; others ignore it).
  if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
  let torchOn = false;
  const small = document.createElement('canvas');
  small.width = SAMPLE.w;
  small.height = SAMPLE.h;
  const ctx = small.getContext('2d', { willReadFrequently: true });

  const started = Date.now();
  let steady = 0;
  let peak = 0;
  let prev = null;
  let busy = false;
  let stopped = false;
  let lastSpoken = { text: '', at: 0 };
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

  // Grabs `count` full-size frames a little apart and keeps the sharpest one.
  const capture = async (count, gapMs) => {
    const scale = Math.min(1, maxWidth / Math.max(video.videoWidth, video.videoHeight));
    let best = null;
    for (let i = 0; i < count && !stopped; i++) {
      if (i) await sleep(gapMs);
      const full = document.createElement('canvas');
      full.width = Math.round(video.videoWidth * scale);
      full.height = Math.round(video.videoHeight * scale);
      full.getContext('2d').drawImage(video, 0, 0, full.width, full.height);
      const { sharpness } = analyzeFrame(sampleCenter(ctx, full, full.width, full.height));
      if (!best || sharpness > best.sharpness) best = { canvas: full, sharpness };
    }
    if (stopped || !best) return;
    const blob = await new Promise((resolve) => best.canvas.toBlob(resolve, 'image/jpeg', 0.9));
    stop();
    onCapture?.(blob);
  };

  const snap = async () => {
    if (busy || stopped || !video.videoWidth) return;
    busy = true;
    await sleep(300);
    await capture(5, 120);
  };

  const timer = setInterval(async () => {
    if (stopped || busy || video.readyState < 2 || !video.videoWidth) return;
    const frame = sampleCenter(ctx, video, video.videoWidth, video.videoHeight);
    const stats = { ...analyzeFrame(frame), motion: frameMotion(prev, frame) };
    prev = frame;
    // The bar fades quickly (halves in ~1.6 s), so reframing the paper doesn't block the photo for long.
    peak = Math.max(peak * 0.9, stats.sharpness);
    const elapsed = Date.now() - started;
    const floor = elapsed > thresholds.relaxAfterMs ? thresholds.relaxedBlurry : thresholds.blurry;
    const status = assessFrame(stats, thresholds, Math.max(floor, peak * thresholds.peakShare));
    onStatus(status, stats);
    if (elapsed < thresholds.warmupMs) return;

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
      busy = true;
      say(t.camReady);
      await capture(3, 100);
    }
  }, LOOK_MS);

  return { stop, snap };
}
