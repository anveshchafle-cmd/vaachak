import { tts } from './api';
import { LANG_TAGS } from './i18n';

let current = null;
// iPhone Safari only lets audio play without a tap on an element that already played during a tap.
// So one player is unlocked on the first touch and reused for every voice clip after that.
let player = null;
let unlocked = false;

// Called on every tap until it works once: playing a short silent clip inside a tap unlocks the player.
export function unlockAudio() {
  if (unlocked || (player && !player.paused)) return;
  player ||= new Audio();
  player.src = '/silence.wav';
  player.play().then(() => (unlocked = true)).catch(() => {});
  // The phone's own voice has the same rule on iPhone.
  try {
    globalThis.speechSynthesis?.speak(new SpeechSynthesisUtterance(' '));
  } catch {}
}

// Wakes the voice server while the document is still being read, so the first words come sooner.
export function warmVoice() {
  fetch('/api/tts', { method: 'OPTIONS' }).catch(() => {});
}

// Bumped by stopVoice, so a reading that is still downloading knows it was cancelled.
let session = 0;

export function stopVoice() {
  session++;
  if (current) {
    current.pause();
    current = null;
  }
  globalThis.speechSynthesis?.cancel();
}

function browserSpeak(text, lang) {
  if (!globalThis.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG_TAGS[lang] || 'mr-IN';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

// Plays one clip and resolves when it finishes (or is stopped).
function play(src) {
  return new Promise((resolve, reject) => {
    const audio = player || new Audio();
    audio.onended = audio.onpause = audio.onerror = null;
    audio.src = src;
    current = audio;
    audio.onended = resolve;
    audio.onpause = resolve;
    audio.onerror = reject;
    audio.play().then(() => (unlocked = true), reject);
  });
}

// The first sentence is short, so its voice comes back in about a second while the rest is
// still being made. Abbreviations like "डॉ." and amounts like "₹1,740.00" are not split.
function splitFirst(text) {
  const m = /^(.{12,}?[.!?।])\s+(.{20,})$/s.exec(text);
  return m ? [m[1], m[2]] : [text];
}

// Natural Sarvam voice from the backend; if offline or it fails, a pre-recorded clip; last, the phone's own voice.
export async function speak(text, lang, clip = null) {
  stopVoice();
  if (!text) return;
  const mine = session;
  const parts = splitFirst(text);
  let played = 0;
  try {
    if (!navigator.onLine) throw new Error('offline');
    const blobs = parts.map((p) => tts(p, lang));
    blobs.forEach((b) => b.catch(() => {}));
    for (const b of blobs) {
      const blob = await b;
      if (mine !== session) return;
      await play(URL.createObjectURL(blob));
      if (mine !== session) return;
      played++;
    }
  } catch {
    if (mine !== session) return;
    if (clip && played === 0) {
      try {
        await play(clip);
        return;
      } catch {}
    }
    browserSpeak(parts.slice(played).join(' '), lang);
  }
}

// Pre-recorded warnings that work with no internet at all.
export function offlineClip(card, lang) {
  const l = lang === 'hi' ? 'hi' : 'mr';
  if (card.flags.includes('SCAM')) return `/samples/audio/scam.${l}.wav`;
  if (card.flags.includes('EXPIRED')) return `/samples/audio/expired.${l}.wav`;
  if (card.flags.includes('LOW_CONFIDENCE')) return `/samples/audio/low-confidence.${l}.wav`;
  return null;
}
