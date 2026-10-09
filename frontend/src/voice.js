import { tts } from './api';
import { LANG_TAGS } from './i18n';
import { forSpeech } from '../../lib/speech-text.js';

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

// ---- The phone's own voice (no internet, or the voice server is down / out of quota) ----

// Voices load a moment after the page opens (Chrome gives an empty list at first).
function voicesReady() {
  const synth = globalThis.speechSynthesis;
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, 1200);
  });
}
voicesReady();

// The best installed voice for the language. Marathi falls back to a Hindi voice (same script, it
// reads Marathi well); Devanagari text must never go to an English voice, which reads nothing.
export function pickVoice(voices, lang) {
  const norm = (v) => String(v.lang || '').replace('_', '-').toLowerCase();
  const wanted = { mr: ['mr-in', 'mr', 'hi-in', 'hi'], hi: ['hi-in', 'hi'], en: ['en-in', 'en-gb', 'en-us', 'en'] }[lang] || ['mr-in'];
  for (const w of wanted) {
    const matches = voices.filter((v) => norm(v) === w || norm(v).startsWith(`${w}-`));
    if (matches.length) return matches.find((v) => v.localService) || matches[0];
  }
  return null;
}

// Whether the phone can speak this language itself.
async function phoneCanSpeak(lang) {
  if (!globalThis.speechSynthesis) return false;
  const voices = await voicesReady();
  // Some Android phones list no voices at all but still speak the requested language: trust them.
  return !voices.length || Boolean(pickVoice(voices, lang));
}

// Speaks sentence by sentence: Chrome silently stops one long utterance after about 15 seconds.
async function browserSpeak(text, lang, mine) {
  const synth = globalThis.speechSynthesis;
  if (!synth || !text) return;
  const voice = pickVoice(await voicesReady(), lang);
  if (mine !== session) return;
  synth.cancel();
  // Chrome drops a speak() that comes right after cancel().
  await new Promise((r) => setTimeout(r, 60));
  if (mine !== session) return;
  for (const part of splitSpeech(text, 200)) {
    const u = new SpeechSynthesisUtterance(part);
    u.lang = voice?.lang || LANG_TAGS[lang] || 'mr-IN';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    synth.speak(u);
  }
  synth.resume?.();
}

// ---- Natural voice from the server ----

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

// Short pieces come back from the voice server faster, so the text is cut at sentence ends:
// the first sentence alone (it starts playing in about a second), then pieces of up to ~160
// characters, all made at the same time while the first one plays.
// Abbreviations like "डॉ." and amounts like "1,740.50" are not split (a break needs a space after it).
// A sentence with no full stop is cut at a comma or space, so no piece is ever too long to speak.
export function splitSpeech(text, max = 160) {
  const sentences = (text.match(/.{12,}?[.!?।](?=\s|$)|.+$/gs) || [text])
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => cutLong(s, max));
  if (!sentences.length) return [];
  const parts = [sentences[0]];
  for (const s of sentences.slice(1)) {
    const last = parts.length - 1;
    if (last > 0 && parts[last].length + s.length < max) parts[last] += ` ${s}`;
    else parts.push(s);
  }
  return parts;
}

function cutLong(s, max) {
  const out = [];
  while (s.length > max) {
    const head = s.slice(0, max);
    const at = Math.max(head.lastIndexOf(', '), head.lastIndexOf(' '));
    const cut = at > max / 3 ? at + 1 : max;
    out.push(s.slice(0, cut).trim());
    s = s.slice(cut).trim();
  }
  if (s) out.push(s);
  return out;
}

// If the voice server just failed (no quota, no credits), the next readings go straight to the
// phone's voice for a while instead of making the person wait in silence each time.
const SERVER_RETRY_MS = 90_000;
let serverDownUntil = 0;
const CLIP_TIMEOUT_MS = 12_000;
// Silence feels broken, so when the phone has its own voice for the language the natural voice
// gets only this long to start, and this long to fill a gap between pieces; after that the
// phone's voice reads the rest right away (the natural clips still finish into the cache).
const START_WAIT_MS = 2_000;
const GAP_WAIT_MS = 1_200;
const late = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('voice too slow')), ms));

// Voice clips already made in this visit, so "Listen again" plays instantly.
const clips = new Map();
const ready = new Set();
function voiceClip(text, lang) {
  const key = `${lang}|${text}`;
  if (!clips.has(key)) {
    const p = Promise.race([
      tts(text, lang),
      new Promise((_, reject) => setTimeout(() => reject(new Error('voice timeout')), CLIP_TIMEOUT_MS)),
    ]);
    p.then(
      () => ready.add(key),
      () => {
        clips.delete(key);
        serverDownUntil = Date.now() + SERVER_RETRY_MS;
      },
    );
    clips.set(key, p);
    if (clips.size > 40) {
      const oldest = clips.keys().next().value;
      clips.delete(oldest);
      ready.delete(oldest);
    }
  }
  return clips.get(key);
}

const serverUsable = () => navigator.onLine && Date.now() > serverDownUntil;

// Starts making the voice early (e.g. while the screen changes), without playing it.
export function preloadVoice(text, lang) {
  text = forSpeech(text, lang);
  if (text && serverUsable()) splitSpeech(text).forEach((p) => voiceClip(p, lang).catch(() => {}));
}

// Natural voice from the backend (Sarvam, else Gemini); if offline or it fails, the phone's own
// voice in the same language; a pre-recorded warning clip only when the phone has no such voice.
// `lang` must be the language the text is written in (for a card, card.lang).
export async function speak(text, lang, clip = null) {
  stopVoice();
  text = forSpeech(text, lang);
  if (!text) return;
  const mine = session;
  const parts = splitSpeech(text);
  let played = 0;
  try {
    // Clips already made ("Listen again") play even while the server is skipped.
    if (!serverUsable() && !parts.every((p) => ready.has(`${lang}|${p}`))) throw new Error('voice server unavailable');
    const blobs = parts.map((p) => voiceClip(p, lang));
    blobs.forEach((b) => b.catch(() => {}));
    const fallbackReady = phoneCanSpeak(lang);
    for (const [i, b] of blobs.entries()) {
      const wait = (await fallbackReady) ? (i === 0 ? START_WAIT_MS : GAP_WAIT_MS) : CLIP_TIMEOUT_MS;
      let blob;
      try {
        blob = await Promise.race([b, late(wait)]);
      } catch (e) {
        // Too slow today (e.g. the free voice): the next readings use the phone's voice at once.
        if (e.message === 'voice too slow') serverDownUntil = Date.now() + SERVER_RETRY_MS;
        throw e;
      }
      if (mine !== session) return;
      const url = URL.createObjectURL(blob);
      try {
        await play(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      if (mine !== session) return;
      played++;
    }
  } catch {
    if (mine !== session) return;
    if (clip && played === 0 && !(await phoneCanSpeak(lang))) {
      if (mine !== session) return;
      try {
        await play(clip);
        return;
      } catch {}
    }
    if (mine !== session) return;
    await browserSpeak(parts.slice(played).join(' '), lang, mine);
  }
}

// Pre-recorded warnings that work with no internet at all.
export function offlineClip(card, lang) {
  // Clips exist in Marathi and Hindi; for English the phone's own voice is better.
  if (lang === 'en') return null;
  const l = lang === 'hi' ? 'hi' : 'mr';
  if (card.flags.includes('SCAM')) return `/samples/audio/scam.${l}.wav`;
  if (card.flags.includes('EXPIRED')) return `/samples/audio/expired.${l}.wav`;
  if (card.flags.includes('LOW_CONFIDENCE')) return `/samples/audio/low-confidence.${l}.wav`;
  return null;
}
