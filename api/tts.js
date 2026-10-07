// POST /api/tts: { text, lang } → audio/wav, spoken slowly for elderly listeners.
import { handle, preflight, binary, HttpError, readJson } from '../lib/http.js';
import { speech } from '../lib/gemini.js';
import { pcmToWav } from '../lib/wav.js';
import { LANG_NAMES, normalizeLang } from '../lib/i18n.js';

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const text = String(body.text || '').trim();
  if (!text) throw new HttpError(400, 'NO_TEXT', 'Send the "text" to speak');
  if (text.length > 800) throw new HttpError(413, 'TOO_LONG', 'Text is too long to speak (max 800 characters)');

  const lang = LANG_NAMES[normalizeLang(body.lang)];
  const { audio, mimeType, sampleRate } = await speech(`Say this slowly, clearly and warmly in ${lang}, like talking to an elderly grandparent: ${text}`);
  if (/wav|mpeg|mp3|ogg/.test(mimeType)) return binary(audio, mimeType.split(';')[0]);
  return binary(pcmToWav(audio, sampleRate), 'audio/wav');
});

export const OPTIONS = preflight;
