// Text-to-speech: Sarvam AI Bulbul v3 (natural Indian voices, handles Marathi-English mixing)
// when SARVAM_API_KEY is set, with Gemini TTS as the backup.
import { HttpError } from './http.js';
import { speech as geminiSpeech } from './gemini.js';
import { pcmToWav } from './wav.js';
import { forSpeech } from './speech-text.js';

const SARVAM_URL = 'https://api.sarvam.ai/text-to-speech';
const SARVAM_LANG = { mr: 'mr-IN', hi: 'hi-IN', en: 'en-IN' };
// Out of credits or a bad key won't fix itself in a minute, so Sarvam is skipped for a while
// instead of adding a failed call in front of every clip.
const SARVAM_COOLDOWN_MS = { account: 10 * 60_000, other: 30_000 };
let sarvamOffUntil = 0;

async function sarvam(text, lang) {
  let res;
  try {
    res = await fetch(SARVAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': process.env.SARVAM_API_KEY },
      body: JSON.stringify({
        text,
        language_code: SARVAM_LANG[lang],
        model: process.env.SARVAM_MODEL || 'bulbul:v3',
        speaker: process.env.SARVAM_SPEAKER || 'shubh',
        pace: Number(process.env.SARVAM_PACE) || 1, // natural medium speed: clear, but not dragging
        speech_sample_rate: 24000,
        output_audio_codec: 'mp3', // ~3x smaller than WAV, so it starts playing sooner on a phone
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    sarvamOffUntil = Date.now() + SARVAM_COOLDOWN_MS.other;
    throw new HttpError(504, 'SARVAM_UNREACHABLE', `Could not reach Sarvam (${e.name})`);
  }
  if (!res.ok) {
    // 401/403 bad key, 402 no credits, 429 rate limit.
    sarvamOffUntil = Date.now() + ([401, 402, 403].includes(res.status) ? SARVAM_COOLDOWN_MS.account : SARVAM_COOLDOWN_MS.other);
    throw new HttpError(502, 'SARVAM_ERROR', `Sarvam returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.audios?.[0]) throw new HttpError(502, 'SARVAM_EMPTY', 'Sarvam returned no audio');
  return { audio: Buffer.from(data.audios[0], 'base64'), mimeType: 'audio/mpeg', provider: 'sarvam' };
}

// Gemini gets the bare sentence. Any instruction around it ("say this warmly in Marathi: ...") was
// sometimes read out loud, and made the clip two to three times longer with long pauses. The words
// themselves tell it the language (the card text is already in the chosen language).
async function gemini(text) {
  const { audio, mimeType, sampleRate } = await geminiSpeech(text);
  if (/wav|mpeg|mp3|ogg/.test(mimeType)) return { audio, mimeType: mimeType.split(';')[0], provider: 'gemini' };
  return { audio: pcmToWav(audio, sampleRate), mimeType: 'audio/wav', provider: 'gemini' };
}

export async function synthesize(text, lang) {
  text = forSpeech(text, lang);
  if (!text) throw new HttpError(400, 'NO_TEXT', 'Nothing to speak');
  if (process.env.SARVAM_API_KEY && Date.now() > sarvamOffUntil) {
    try {
      return await sarvam(text, lang);
    } catch (e) {
      console.warn(`Sarvam TTS failed, using Gemini: ${e.message}`);
    }
  }
  return gemini(text);
}
