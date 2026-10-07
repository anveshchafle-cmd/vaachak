import { tts } from './api';
import { LANG_TAGS } from './i18n';

let current = null;

export function stopVoice() {
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

async function play(src) {
  stopVoice();
  current = new Audio(src);
  await current.play();
}

// Natural Sarvam voice from the backend; if offline or it fails, a pre-recorded clip; last, the phone's own voice.
export async function speak(text, lang, clip = null) {
  stopVoice();
  if (!text) return;
  try {
    if (!navigator.onLine) throw new Error('offline');
    const blob = await tts(text, lang);
    await play(URL.createObjectURL(blob));
  } catch {
    if (clip) {
      try {
        await play(clip);
        return;
      } catch {}
    }
    browserSpeak(text, lang);
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
