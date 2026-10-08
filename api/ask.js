// POST /api/ask: a spoken or typed question about the card → a short answer from that document only.
import { handle, json, preflight, HttpError, isMultipart, readJson, parseJsonField } from '../lib/http.js';
import { generateJson, inlinePart, ASK_MODELS, HEDGE_MS, PER_CALL_MS } from '../lib/gemini.js';
import { ASK_SCHEMA, askPrompt, inLanguage } from '../lib/prompts.js';
import { messages, normalizeLang } from '../lib/i18n.js';

const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

async function readInput(req) {
  if (isMultipart(req)) {
    const form = await req.formData();
    const audio = form.get('audio');
    return {
      question: form.get('question'),
      card: parseJsonField(form.get('card'), null),
      lang: form.get('lang'),
      audio: audio && typeof audio !== 'string' ? audio : null,
    };
  }
  const body = await readJson(req);
  return { question: body.question, card: body.card, lang: body.lang, audio: null };
}

function documentContext(card) {
  const fields = Object.fromEntries(Object.entries(card.fields || {}).map(([k, f]) => [k, f?.text || '']));
  return JSON.stringify({
    document_text: String(card.rawText || '').slice(0, 8000),
    card: {
      docType: card.docType, fields, dates: card.dates, flags: card.flags, pills: card.pills, medicines: card.medicines,
      checklist: card.checklist, payment: card.payment && { method: card.payment.method, to: card.payment.billerName, amount: card.payment.amount },
    },
  });
}

export const POST = handle(async (req) => {
  const { question, card, lang: rawLang, audio } = await readInput(req);
  if (!card || typeof card !== 'object' || (!card.rawText && !card.fields)) {
    throw new HttpError(400, 'NO_CARD', 'Send the card returned by /api/read in "card"');
  }
  if (!audio && !String(question || '').trim()) throw new HttpError(400, 'NO_QUESTION', 'Send "question" text or an "audio" recording');
  if (audio && audio.size > MAX_AUDIO_BYTES) throw new HttpError(413, 'TOO_LARGE', 'Recording is too long. Keep it under 30 seconds.');

  const lang = normalizeLang(rawLang || card.lang);
  const parts = [{ text: `DOCUMENT:\n${documentContext(card)}` }];
  if (audio) {
    const mimeType = (audio.type || 'audio/webm').split(';')[0];
    parts.push(inlinePart(Buffer.from(await audio.arrayBuffer()).toString('base64'), mimeType));
    parts.push({ text: 'The question is spoken in the audio above.' });
  } else {
    parts.push({ text: `QUESTION: ${String(question).slice(0, 500)}` });
  }

  const result = await generateJson({
    system: askPrompt(lang, messages(lang).notInDocument), parts, schema: ASK_SCHEMA, models: ASK_MODELS, hedgeMs: HEDGE_MS.ask, perCallMs: PER_CALL_MS.ask,
    check: (r) => inLanguage([r.answer], lang),
  });
  const answer = String(result.answer || '').trim() || messages(lang).notInDocument;
  return json({ heard: result.heard || question || '', answer, answerable: result.answerable !== false, speak: answer });
});

export const OPTIONS = preflight;
