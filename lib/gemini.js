import { HttpError } from './http.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Tried in this order. The quick preview and "lite" models answer a bill in about 3 s; the big
// flash models are slower and run out of free quota first, so they come last.
// Each model has its own free quota, so a longer list also means more free requests per day.
const DEFAULT_MODELS = 'gemini-3-flash-preview,gemini-3.1-flash-lite-preview,gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.8-flash,gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash';
// Questions are short, so the fastest models go first.
const DEFAULT_ASK_MODELS = 'gemini-3.1-flash-lite-preview,gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3-flash-preview,gemini-3.8-flash,gemini-3.5-flash';
const list = (s) => s.split(',').map((m) => m.trim()).filter(Boolean);
export const MODELS = list(process.env.GEMINI_MODELS || DEFAULT_MODELS);
export const ASK_MODELS = list(process.env.GEMINI_ASK_MODELS || DEFAULT_ASK_MODELS);
export const MODEL = MODELS[0];
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
export const TTS_FALLBACK_MODEL = process.env.GEMINI_TTS_FALLBACK_MODEL || 'gemini-3.8-flash-lite-tts';
export const TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';

// Stay under Vercel's 60 s function limit and the phone's wait across all attempts.
const TOTAL_BUDGET_MS = 35_000;
// A model silent for this long is treated as stuck (questions are short, so they give up sooner).
export const PER_CALL_MS = { read: 15_000, ask: 8_000 };
// Two models start together; if neither has answered after this long, the next one starts too.
// A model that fails (quota, overloaded) hands over to the next one at once.
export const HEDGE_MS = { read: 3_000, readText: 2_000, ask: 1_500, tts: 6_000 };
// A model that ran out of quota or kept failing is skipped by later requests for a while.
const COOLDOWN_MS = { quota: 10 * 60_000, busy: 60_000, broken: 30 * 60_000 };
const cooldown = new Map();
const coolingDown = (model) => (cooldown.get(model) || 0) > Date.now();
// How fast each model has been answering lately (free-tier speed swings from 1 s to 15 s),
// so the quickest one right now is tried first. A model that lost a race counts as slow.
const speed = new Map();
const noteSpeed = (model, ms) => speed.set(model, speed.has(model) ? 0.6 * speed.get(model) + 0.4 * ms : ms);
const fastestFirst = (models) =>
  models
    .map((m, i) => ({ m, score: speed.get(m) ?? 4_000 + i * 100 }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.m);
const RETRYABLE = new Set([500, 502, 503, 504]);

async function callOnce(model, body, timeoutMs, signal) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(500, 'NO_API_KEY', 'GEMINI_API_KEY is not set on the server');

  let res;
  try {
    res = await fetch(`${BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
  } catch (e) {
    const err = new HttpError(504, 'GEMINI_UNREACHABLE', `Could not reach Gemini (${e.name})`);
    err.retryable = true;
    throw err;
  }

  if (res.status === 429) {
    const err = new HttpError(429, 'QUOTA', 'Gemini quota reached. Switch to demo mode.');
    err.quota = true;
    throw err;
  }
  if (!res.ok) {
    console.error(`Gemini error ${res.status} from ${model}:`, (await res.text()).slice(0, 300));
    const err = new HttpError(502, 'GEMINI_ERROR', `Gemini returned ${res.status}`);
    err.retryable = RETRYABLE.has(res.status);
    throw err;
  }
  return res.json();
}

// Hedged calls: start the `width` fastest healthy models at once; when one fails, or nothing has
// answered after `hedgeMs`, start the next one as well. The first good answer wins and the others
// are cancelled. This keeps a read at a few seconds even though the free tier often answers 429
// "quota", 503 "overloaded", or just takes 10 s.
// `makeBody(model)` builds the request (thinking settings differ per model); `parse(data)` turns the
// reply into the result and throws if it is unusable, which counts as that model failing. An error
// carrying `spare` (e.g. an answer in the wrong language) is kept and used only if nothing better comes.
function call(models, makeBody, parse, { hedgeMs, perCallMs = PER_CALL_MS.read, width = 1 }) {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const unique = [...new Set(models)];
  // Healthy models first; ones cooling down stay at the end as a last resort.
  const queue = [...fastestFirst(unique.filter((m) => !coolingDown(m))), ...unique.filter(coolingDown)];
  return new Promise((resolve, reject) => {
    const inFlight = new Map();
    let settled = false;
    let busy = false;
    let quota = false;
    let spare;
    let hedge;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedge);
      inFlight.forEach(({ model, started }, c) => {
        noteSpeed(model, Date.now() - started);
        c.abort();
      });
      fn(value);
    };
    const launch = () => {
      clearTimeout(hedge);
      if (settled) return;
      const left = deadline - Date.now();
      const model = left > 2_000 ? queue.shift() : null;
      if (!model) {
        if (inFlight.size) return;
        if (spare !== undefined) return finish(resolve, spare);
        if (quota && !busy) return finish(reject, new HttpError(429, 'QUOTA', 'Gemini free quota is used up for today. Switch to demo mode.'));
        return finish(reject, new HttpError(503, 'GEMINI_BUSY', 'Gemini is busy right now. Try again in a minute or use demo mode.'));
      }
      const ctrl = new AbortController();
      const started = Date.now();
      inFlight.set(ctrl, { model, started });
      callOnce(model, makeBody(model), Math.min(perCallMs, left), ctrl.signal)
        .then(parse)
        .then((result) => {
          inFlight.delete(ctrl);
          if (!settled) {
            noteSpeed(model, Date.now() - started);
            console.info(`Gemini ${model} answered in ${Date.now() - started} ms`);
          }
          finish(resolve, result);
        })
        .catch((e) => {
          inFlight.delete(ctrl);
          if (settled) return;
          if (e.code === 'NO_API_KEY') return finish(reject, e);
          if (e.spare !== undefined) spare ??= e.spare;
          else if (e.quota) {
            quota = true;
            cooldown.set(model, Date.now() + COOLDOWN_MS.quota);
          } else {
            busy = true;
            // 400/404 (model retired, setting not supported) won't fix itself soon.
            const broken = e.code === 'GEMINI_ERROR' && !e.retryable;
            cooldown.set(model, Date.now() + (broken ? COOLDOWN_MS.broken : COOLDOWN_MS.busy));
          }
          console.warn(`Gemini ${model} failed (${e.message}), trying next`);
          launch();
        });
      if (queue.length) hedge = setTimeout(launch, hedgeMs);
    };
    for (let i = 0; i < width; i++) launch();
  });
}

// Flash models "think" by default; keeping it minimal makes the card come back much faster.
function thinkingConfig(model) {
  if (model.startsWith('gemini-2.5-flash')) return { thinkingConfig: { thinkingBudget: 0 } };
  if (model.includes('lite') || model === 'gemini-3-flash-preview') return { thinkingConfig: { thinkingLevel: 'minimal' } };
  if (/^gemini-3/.test(model) && model.includes('flash')) return { thinkingConfig: { thinkingLevel: 'low' } };
  return {};
}

function parseJsonReply(data) {
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
  if (!text) throw new HttpError(502, 'GEMINI_EMPTY', 'Gemini returned an empty answer');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'GEMINI_BAD_JSON', 'Gemini returned invalid JSON');
  }
}

// `check(result)` may return false for an answer that is valid JSON but not good enough (wrong language);
// another model is then tried, and that answer is used only if no other comes back.
export function generateJson({ system, parts, schema, models = MODELS, hedgeMs = HEDGE_MS.read, perCallMs = PER_CALL_MS.read, width = 2, check }) {
  return call(
    models,
    (model) => ({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: schema,
        ...thinkingConfig(model),
      },
    }),
    (data) => {
      const result = parseJsonReply(data);
      if (check && !check(result)) throw Object.assign(new Error('answer failed the check'), { spare: result });
      return result;
    },
    { hedgeMs, perCallMs, width },
  );
}

// Returns { audio, mimeType, sampleRate }. Newer TTS models send ready WAV; older ones send raw 16-bit PCM.
export function speech(text) {
  return call(
    [TTS_MODEL, TTS_FALLBACK_MODEL],
    () => ({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
      },
    }),
    (data) => {
      const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!inline) throw new HttpError(502, 'TTS_EMPTY', 'Gemini returned no audio');
      const mimeType = inline.mimeType || '';
      const sampleRate = Number(/rate=(\d+)/.exec(mimeType)?.[1]) || 24_000;
      return { audio: Buffer.from(inline.data, 'base64'), mimeType, sampleRate };
    },
    { hedgeMs: HEDGE_MS.tts },
  );
}

export function inlinePart(base64, mimeType) {
  return { inlineData: { mimeType, data: base64 } };
}
