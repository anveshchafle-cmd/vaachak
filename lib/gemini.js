import { HttpError } from './http.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Comma-separated; tried in order when the main model is overloaded.
export const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash,gemini-3.1-flash-lite')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
export const TTS_FALLBACK_MODEL = process.env.GEMINI_TTS_FALLBACK_MODEL || 'gemini-3.8-flash-lite-tts';
export const TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';

// Stay under Vercel's 60 s function limit across all retries.
const TOTAL_BUDGET_MS = 50_000;
const PER_CALL_MS = 25_000;
const RETRYABLE = new Set([500, 502, 503, 504]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOnce(model, body, timeoutMs) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(500, 'NO_API_KEY', 'GEMINI_API_KEY is not set on the server');

  let res;
  try {
    res = await fetch(`${BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = new HttpError(504, 'GEMINI_UNREACHABLE', `Could not reach Gemini (${e.name})`);
    err.retryable = true;
    throw err;
  }

  if (res.status === 429) throw new HttpError(429, 'QUOTA', 'Gemini quota reached. Switch to demo mode.');
  if (!res.ok) {
    console.error(`Gemini error ${res.status} from ${model}:`, (await res.text()).slice(0, 300));
    const err = new HttpError(502, 'GEMINI_ERROR', `Gemini returned ${res.status}`);
    err.retryable = RETRYABLE.has(res.status);
    throw err;
  }
  return res.json();
}

// The free tier often answers 503 "overloaded". Retry the main model once, then try each backup.
// `makeBody(model)` builds the request, since settings like thinking differ per model.
async function call(models, makeBody) {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const [main, ...backups] = [...new Set(models)];
  const attempts = [main, main, ...backups];
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    const left = deadline - Date.now();
    if (left < 3_000) break;
    try {
      return await callOnce(model, makeBody(model), Math.min(PER_CALL_MS, left));
    } catch (e) {
      if (!e.retryable) throw e;
      console.warn(`Gemini ${model} failed (${e.message})${i < attempts.length - 1 ? ', trying again' : ''}`);
      if (i === 0) await sleep(700);
    }
  }
  throw new HttpError(503, 'GEMINI_BUSY', 'Gemini is busy right now. Try again in a minute or use demo mode.');
}

// Flash models "think" by default; keeping it low makes the card come back much faster.
function thinkingConfig(model) {
  if (model.startsWith('gemini-2.5-flash')) return { thinkingConfig: { thinkingBudget: 0 } };
  if (/^gemini-3/.test(model) && model.includes('flash')) return { thinkingConfig: { thinkingLevel: 'low' } };
  return {};
}

export async function generateJson({ system, parts, schema }) {
  const data = await call([MODEL, ...FALLBACK_MODELS], (model) => ({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: schema,
      ...thinkingConfig(model),
    },
  }));

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
  if (!text) throw new HttpError(502, 'GEMINI_EMPTY', 'Gemini returned an empty answer');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'GEMINI_BAD_JSON', 'Gemini returned invalid JSON');
  }
}

// Returns { audio, mimeType, sampleRate }. Newer TTS models send ready WAV; older ones send raw 16-bit PCM.
export async function speech(text) {
  const data = await call([TTS_MODEL, TTS_FALLBACK_MODEL], () => ({
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
    },
  }));

  const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline) throw new HttpError(502, 'TTS_EMPTY', 'Gemini returned no audio');
  const mimeType = inline.mimeType || '';
  const sampleRate = Number(/rate=(\d+)/.exec(mimeType)?.[1]) || 24_000;
  return { audio: Buffer.from(inline.data, 'base64'), mimeType, sampleRate };
}

export function inlinePart(base64, mimeType) {
  return { inlineData: { mimeType, data: base64 } };
}
