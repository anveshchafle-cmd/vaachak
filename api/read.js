// POST /api/read: any document → action card.
// Accepts a photo/screenshot/PDF (`file`), a link to a web page or PDF (`url`), or plain text (`text`,
// e.g. a pasted SMS or WhatsApp forward). Paper or screen, it all becomes the same card.
import { handle, json, preflight, HttpError, isMultipart, readJson, parseJsonField } from '../lib/http.js';
import { generateJson, inlinePart } from '../lib/gemini.js';
import { EXTRACT_SCHEMA, extractPrompt } from '../lib/prompts.js';
import { buildCard } from '../lib/card.js';
import { normalizeLang } from '../lib/i18n.js';
import { fetchDocument } from '../lib/webpage.js';

// Vercel rejects request bodies over 4.5 MB, so the frontend should shrink photos first.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 30_000;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

async function readInput(req) {
  if (isMultipart(req)) {
    const form = await req.formData();
    const file = form.get('file');
    return {
      bytes: file && typeof file !== 'string' ? Buffer.from(await file.arrayBuffer()) : null,
      mimeType: file && typeof file !== 'string' ? file.type : null,
      url: form.get('url'),
      text: form.get('text'),
      lang: form.get('lang'),
      history: parseJsonField(form.get('history'), {}),
      familyPhone: form.get('familyPhone'),
      edgeText: form.get('edgeText'),
      userName: form.get('userName'),
    };
  }

  // JSON: { fileBase64: "data:image/jpeg;base64,..." | url | text, mimeType?, lang, history, familyPhone, edgeText, userName }
  const body = await readJson(req);
  const dataUrl = body.fileBase64 ? /^data:([^;]+);base64,/.exec(body.fileBase64) : null;
  return {
    bytes: body.fileBase64 ? Buffer.from(String(body.fileBase64).slice(dataUrl ? dataUrl[0].length : 0), 'base64') : null,
    mimeType: body.mimeType || dataUrl?.[1],
    url: body.url,
    text: body.text,
    lang: body.lang,
    history: parseJsonField(body.history, {}),
    familyPhone: body.familyPhone,
    edgeText: body.edgeText,
    userName: body.userName,
  };
}

// Works out what we were given and returns the Gemini parts plus the trusted source text, if any.
async function resolveDocument(input) {
  let { bytes, mimeType } = input;
  let sourceText = typeof input.text === 'string' ? input.text.trim() : '';
  let sourceUrl = null;

  if (!bytes?.length && !sourceText && typeof input.url === 'string' && input.url.trim()) {
    const doc = await fetchDocument(input.url.trim());
    sourceUrl = doc.url;
    if (doc.kind === 'file') ({ bytes, mimeType } = doc);
    else sourceText = doc.text;
  }

  if (bytes?.length) {
    if (bytes.length > MAX_BYTES) throw new HttpError(413, 'TOO_LARGE', 'File is over 4 MB. Shrink the photo before sending.');
    mimeType = String(mimeType || '').toLowerCase().replace('image/jpg', 'image/jpeg');
    if (!ALLOWED.includes(mimeType)) throw new HttpError(415, 'BAD_TYPE', 'Send a JPEG, PNG, WEBP or HEIC photo, or a PDF');
    return {
      source: mimeType === 'application/pdf' ? 'pdf' : 'image',
      parts: [inlinePart(bytes.toString('base64'), mimeType), { text: 'Read this document and return the action card JSON.' }],
      sourceText: null,
      sourceUrl,
    };
  }

  if (sourceText) {
    sourceText = sourceText.slice(0, MAX_TEXT);
    return {
      source: 'text',
      parts: [{ text: `${sourceUrl ? `WEB PAGE ${sourceUrl}\n` : 'MESSAGE / DOCUMENT TEXT\n'}"""\n${sourceText}\n"""\nReturn the action card JSON.` }],
      sourceText,
      sourceUrl,
    };
  }

  throw new HttpError(400, 'NO_FILE', 'Send a photo/PDF in "file", a link in "url", or the message in "text"');
}

export const POST = handle(async (req) => {
  const input = await readInput(req);
  const doc = await resolveDocument(input);
  const lang = normalizeLang(input.lang);

  const extraction = await generateJson({ system: extractPrompt(lang, doc.source), parts: doc.parts, schema: EXTRACT_SCHEMA });
  // For text and web pages we have the exact original words, so the rule engine checks against those,
  // not against the AI's copy of them.
  if (doc.sourceText) extraction.rawText = doc.sourceText;

  const history = input.history && typeof input.history === 'object' && !Array.isArray(input.history) ? input.history : {};
  const edgeText = typeof input.edgeText === 'string' ? input.edgeText.slice(0, 20_000) : null;
  const card = buildCard(extraction, {
    lang, history, familyPhone: input.familyPhone, isPdf: doc.source !== 'image', edgeText, userName: input.userName,
  });
  card.source = { kind: doc.source, url: doc.sourceUrl };
  // Photos: the phone runs its own OCR in parallel instead of making the person wait for it first,
  // then rebuilds the card from this extraction with that text (same buildCard, dual-engine check).
  if (doc.source === 'image') card.extraction = extraction;
  return json(card);
});

export const OPTIONS = preflight;
