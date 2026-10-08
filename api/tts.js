// POST /api/tts: { text, lang } → spoken audio (MP3/WAV), clear and at a medium pace.
// Uses Sarvam AI when configured, otherwise Gemini. The X-Voice-Provider header says which.
import { handle, preflight, binary, HttpError, readJson } from '../lib/http.js';
import { synthesize } from '../lib/speech.js';
import { normalizeLang } from '../lib/i18n.js';

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const text = String(body.text || '').trim();
  if (!text) throw new HttpError(400, 'NO_TEXT', 'Send the "text" to speak');
  if (text.length > 800) throw new HttpError(413, 'TOO_LONG', 'Text is too long to speak (max 800 characters)');

  const { audio, mimeType, provider } = await synthesize(text, normalizeLang(body.lang));
  return binary(audio, mimeType, { 'X-Voice-Provider': provider });
});

export const OPTIONS = preflight;
