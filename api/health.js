// GET /api/health: quick check that the server is up and the Gemini key is set.
import { json, preflight } from '../lib/http.js';
import { MODEL, TTS_MODEL } from '../lib/gemini.js';

export function GET() {
  return json({ ok: true, model: MODEL, ttsModel: TTS_MODEL, hasKey: Boolean(process.env.GEMINI_API_KEY) });
}

export const OPTIONS = preflight;
