// POST /api/read: photo, screenshot or PDF in → action card out.
import { handle, json, preflight, HttpError, isMultipart, readJson, parseJsonField } from '../lib/http.js';
import { generateJson, inlinePart } from '../lib/gemini.js';
import { EXTRACT_SCHEMA, extractPrompt } from '../lib/prompts.js';
import { buildCard } from '../lib/card.js';
import { normalizeLang } from '../lib/i18n.js';

// Vercel rejects request bodies over 4.5 MB, so the frontend should shrink photos first.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

async function readInput(req) {
  if (isMultipart(req)) {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') throw new HttpError(400, 'NO_FILE', 'Send the photo or PDF in the "file" field');
    return {
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      lang: form.get('lang'),
      history: parseJsonField(form.get('history'), {}),
      familyPhone: form.get('familyPhone'),
      edgeText: form.get('edgeText'),
      userName: form.get('userName'),
    };
  }

  // Also accepts JSON: { fileBase64: "data:image/jpeg;base64,...", mimeType?, lang, history, familyPhone, edgeText, userName }
  const body = await readJson(req);
  if (!body.fileBase64) throw new HttpError(400, 'NO_FILE', 'Send "fileBase64" (or use multipart form data)');
  const dataUrl = /^data:([^;]+);base64,/.exec(body.fileBase64);
  return {
    bytes: Buffer.from(String(body.fileBase64).slice(dataUrl ? dataUrl[0].length : 0), 'base64'),
    mimeType: body.mimeType || dataUrl?.[1],
    lang: body.lang,
    history: parseJsonField(body.history, {}),
    familyPhone: body.familyPhone,
    edgeText: body.edgeText,
    userName: body.userName,
  };
}

export const POST = handle(async (req) => {
  const input = await readInput(req);
  if (!input.bytes.length) throw new HttpError(400, 'EMPTY_FILE', 'The file is empty');
  if (input.bytes.length > MAX_BYTES) throw new HttpError(413, 'TOO_LARGE', 'File is over 4 MB. Shrink the photo before sending.');

  const mimeType = String(input.mimeType || '').toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!ALLOWED.includes(mimeType)) throw new HttpError(415, 'BAD_TYPE', 'Send a JPEG, PNG, WEBP or HEIC photo, or a PDF');

  const lang = normalizeLang(input.lang);
  const isPdf = mimeType === 'application/pdf';
  const extraction = await generateJson({
    system: extractPrompt(lang, isPdf),
    parts: [inlinePart(input.bytes.toString('base64'), mimeType), { text: 'Read this document and return the action card JSON.' }],
    schema: EXTRACT_SCHEMA,
  });

  const history = input.history && typeof input.history === 'object' && !Array.isArray(input.history) ? input.history : {};
  const edgeText = typeof input.edgeText === 'string' ? input.edgeText.slice(0, 20_000) : null;
  return json(buildCard(extraction, { lang, history, familyPhone: input.familyPhone, isPdf, edgeText, userName: input.userName }));
});

export const OPTIONS = preflight;
