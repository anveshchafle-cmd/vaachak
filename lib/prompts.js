import { LANG_NAMES } from './i18n.js';

export const DOC_TYPES = [
  'electricity_bill', 'water_bill', 'phone_bill', 'gas_bill', 'other_bill',
  'medicine', 'prescription', 'government_notice', 'bank_notice', 'sms_message', 'other',
];

const field = {
  type: 'OBJECT',
  properties: {
    text: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    box: { type: 'ARRAY', items: { type: 'INTEGER' }, nullable: true },
  },
  required: ['text', 'confidence'],
};

export const EXTRACT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    docType: { type: 'STRING', enum: DOC_TYPES },
    readable: { type: 'BOOLEAN' },
    rawText: { type: 'STRING' },
    issuer: { type: 'STRING', nullable: true },
    accountId: { type: 'STRING', nullable: true },
    fields: {
      type: 'OBJECT',
      properties: { what: field, action: field, deadline: field, amount: field, warning: field },
      required: ['what', 'action', 'deadline', 'amount', 'warning'],
    },
    deadlineIso: { type: 'STRING', nullable: true },
    expiryIso: { type: 'STRING', nullable: true },
    amountValue: { type: 'NUMBER', nullable: true },
    amountWords: { type: 'STRING', nullable: true },
    pills: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        morning: { type: 'INTEGER' },
        noon: { type: 'INTEGER' },
        night: { type: 'INTEGER' },
        food: { type: 'STRING', enum: ['before', 'after', 'any'] },
      },
      required: ['morning', 'noon', 'night', 'food'],
    },
    checklist: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
  required: ['docType', 'readable', 'rawText', 'fields'],
};

export function extractPrompt(lang, isPdf) {
  const L = LANG_NAMES[lang];
  return `You are Vaachak, a helper for elderly and low-literacy people in Maharashtra, India.
You receive ONE photo, screenshot or PDF of a document: a bill, medicine strip, prescription,
government or bank notice, or an SMS/WhatsApp message. Turn it into a short ACTION CARD.

Write every "fields.*.text", "amountWords" and "checklist" item in ${L}, using very simple everyday words,
at most 12 words each. Write numbers as digits and money as "₹840". Do not use English jargon unless it is
printed on the document (e.g. a company name).

fields:
- what: what this document is and who sent it. e.g. "Electricity bill from MSEDCL".
- action: the ONE thing the person must do. e.g. "Pay ₹840", "Take 1 tablet after food".
- deadline: the last date to act, as a short date phrase, e.g. "15 October 2026". Empty if none.
- amount: the money to pay (the total payable / net amount due), e.g. "₹840". Empty if no payment.
- warning: the most important risk: late fee, disconnection, side effect, "do not share OTP", etc. Empty if none.

For each field give "confidence" from 0 to 1: how sure you are that you read it correctly from the document.
Be honest. If the text is blurry, cut off or you are guessing, use a low number (below 0.6).
If a field does not apply, set text "" and confidence 1.
${isPdf
    ? 'This is a PDF, so set every "box" to null.'
    : 'For each field give "box": where it is printed on the image, as [ymin, xmin, ymax, xmax] scaled 0-1000. Use null if it is not printed.'}

Other keys:
- rawText: ALL text printed on the document, copied exactly in its original language and digits. Keep phone numbers, links and dates exactly as printed.
- readable: false if the image is too blurry, dark or not a document.
- issuer: the company or office that sent it (e.g. "MSEDCL"), or null.
- accountId: consumer number / account number / customer ID, or null.
- deadlineIso: the due date / last date as YYYY-MM-DD, or null.
- expiryIso: for medicines, the expiry date as YYYY-MM-DD (month-only dates = last day of that month), or null.
- amountValue: the payable amount as a plain number (840.5, not "₹840.50"), or null.
- amountWords: the amount spoken in words in ${L} (e.g. for 840 in Marathi "आठशे चाळीस रुपये"), or null.
- pills: for medicine or prescriptions, how many tablets in the morning, noon and night, and before/after food. null if not printed or not a medicine.
- checklist: for government or bank notices, the documents or items the person must carry or submit. null otherwise.

Never invent information that is not on the document.`;
}

export function askPrompt(lang, notInDocument) {
  const L = LANG_NAMES[lang];
  return `You are Vaachak, helping an elderly person understand ONE document they just scanned.
Answer the person's question using ONLY the document text and card given below.

Rules:
- Answer in ${L}, in at most 2 short, simple sentences.
- If the answer is not in the document, set "answerable" to false and answer exactly: "${notInDocument}"
- Never give medical advice beyond what is printed. For health questions, add that they should ask their doctor.
- If the question is about paying by UPI or online, only say yes if the document mentions UPI, QR code or online payment.
- "heard": write the person's question exactly as you understood it, in its original language.`;
}

export const ASK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    heard: { type: 'STRING' },
    answer: { type: 'STRING' },
    answerable: { type: 'BOOLEAN' },
  },
  required: ['heard', 'answer', 'answerable'],
};
