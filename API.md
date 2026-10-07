# Vaachak API contract

The frontend talks to the backend **only** through these endpoints. Don't rename fields
without telling the other person.

- Local: `http://localhost:3000`
- Deployed: same origin as the frontend (e.g. `https://vaachak.vercel.app`)
- CORS is open, so a frontend on `localhost:5173` can call `localhost:3000` directly.
- Every error looks like `{ "error": "human message", "code": "MACHINE_CODE" }` with a 4xx/5xx status.

| Error code | Status | What the UI should do |
|---|---|---|
| `QUOTA` | 429 | Gemini free quota ran out → switch to Demo mode |
| `TOO_LARGE` | 413 | Shrink the photo (max 4 MB) and retry |
| `BAD_TYPE` | 415 | "Send a photo or PDF" |
| `GEMINI_BUSY` | 503 | Gemini overloaded or unreachable after retries → "Try again in a minute", offer Demo mode |
| `GEMINI_ERROR` | 502 | Unexpected Gemini error → offer Demo mode |
| `NO_API_KEY` | 500 | Backend not configured (developer problem) |

---

## `POST /api/read`: document → action card (photo, PDF, link or text)

**Request** (`multipart/form-data`):

| Field | Required | Value |
|---|---|---|
| `file` | one of these three | Photo / screenshot / PDF (see below) |
| `url` | one of these three | A link to an e-bill page, government notice or PDF; the backend fetches and reads it (private/local addresses are refused) |
| `text` | one of these three | A pasted or shared **SMS / WhatsApp message** or any text; the scam rules run on these exact words |
| (file details) | | JPEG / PNG / WEBP / HEIC photo or PDF, **max 4 MB** (resize phone photos to ~1600 px wide first) |
| `lang` | no | `mr` (default), `hi`, `en` |
| `history` | no | JSON string from localStorage: `{"msedcl:000123456789": 300}` (see Bill spike below) |
| `familyPhone` | no | 10-digit number for the WhatsApp button, e.g. `9876543210` |
| `userName` | no | How to address the person, e.g. `प्रकाश काका`; the spoken card then starts "प्रकाश काका, …" |
| `edgeText` | no | Text from **Tesseract.js run on the same photo in the browser**; turns on the dual-engine check (see below) |

JSON also works: `{ "text": "..." }` or `{ "url": "https://..." }` or `{ "fileBase64": "data:image/jpeg;base64,...", "lang": "mr", "history": {...}, "familyPhone": "...", "edgeText": "..." }`

**Response** (`200`):

```json
{
  "docType": "electricity_bill",
  "lang": "mr",
  "fields": {
    "what":     { "text": "MSEDCL चे वीज बिल", "confidence": 0.97, "box": [20, 40, 70, 960], "source": "ai" },
    "action":   { "text": "₹840 भरा", "confidence": 0.94, "box": [430, 520, 470, 900], "source": "ai" },
    "deadline": { "text": "10 ऑक्टोबर 2026", "confidence": 0.93, "box": [380, 520, 420, 900], "source": "ai",
                  "iso": "2026-10-10", "verified": true },
    "amount":   { "text": "₹840", "confidence": 0.96, "box": [430, 520, 470, 900], "source": "ai",
                  "value": 840, "verified": true },
    "warning":  { "text": "उशिरा भरल्यास ₹850 भरावे लागतील", "confidence": 0.88, "box": [480, 520, 520, 900], "source": "ai" }
  },
  "flags": ["URGENT"],
  "scam": { "isSuspect": false, "score": 0, "reasons": [] },
  "pills": null,
  "checklist": null,
  "dates": { "today": "2026-10-08", "deadline": "2026-10-10", "expiry": null, "daysLeft": 2, "overdue": false },
  "spike": null,
  "billerKey": "msedcl:000123456789",
  "actions": {
    "whatsappText": "📄 वाचकने माझ्यासाठी हे कागद वाचले: ...",
    "whatsappUrl": "https://wa.me/919876543210?text=...",
    "calendarUrl": "https://calendar.google.com/calendar/render?action=TEMPLATE&..."
  },
  "speak": "MSEDCL चे वीज बिल. ₹840 भरा. रक्कम: ₹840. आठशे चाळीस रुपये. शेवटची तारीख: 10 ऑक्टोबर 2026. फक्त 2 दिवस बाकी आहेत. ...",
  "rawText": "MAHARASHTRA STATE ELECTRICITY ..."
}
```

Every card also has `source: { kind: "image" | "pdf" | "text", url }`. Only `image` cards have highlight boxes.

### Field notes
- **`fields.*.text`** is in the chosen language. Empty string = not applicable (hide that row).
- **`confidence`** 0–1. Below **0.6**, show "can't read clearly" next to that field.
- **`box`** `[ymin, xmin, ymax, xmax]` on a **0–1000 scale** of the uploaded image (`null` for PDFs or when not printed).
  To highlight: `top = ymin/1000 * imgHeight`, `left = xmin/1000 * imgWidth`, etc. → the **"Show me where"** feature.
- **`source`**: `"ai"` = read by Gemini, `"rule"` = written by our rule engine (show a small 🛡️ "Checked" badge; good for judges).
- **`verified`** (amount/deadline only): `true` = we found that exact number/date printed in the document's text. `false` = the AI may have misread it; its confidence has already been lowered.

### `flags` (most serious first; style them in this order)
| Flag | Meaning | Suggested UI |
|---|---|---|
| `SCAM` | Rule-based fraud check fired; see `scam.reasons[].text` | Full-screen red, show the reasons, hide Pay/Remind buttons |
| `EXPIRED` | Medicine past its expiry date | Red banner |
| `URGENT` | Due in ≤ 3 days, or already overdue (`dates.overdue`) | Orange banner, show `dates.daysLeft` |
| `BILL_SPIKE` | Bill is ≥ 2× the last one from the same biller; see `spike` | Yellow banner |
| `LOW_CONFIDENCE` | Photo unclear or a field is uncertain | Grey banner "Please ask someone"; suggest retaking the photo |

### Other keys
- **`scam.reasons`**: `[{ "code": "PERSONAL_NUMBER", "weight": 2, "text": "खाजगी मोबाईल नंबरवर फोन..." }]`, already translated.
- **`pills`**: medicines/prescriptions only: `{ "morning": 1, "noon": 0, "night": 1, "food": "before" | "after" | "any" }`
  → draw ☀️ 🌤️ 🌙 with counts, 🍽️ before/after. `null` otherwise (also `null` when the medicine is expired).
- **`checklist`**: government/bank notices: list of documents to carry. `null` otherwise.
- **`actions.whatsappUrl`**: open as a link: "Send to family". The message asks them to reply YES/NO.
- **`actions.calendarUrl`**: "Remind me" button (day before the deadline). `null` for scams or past deadlines.
- **`speak`**: send this to `/api/tts` for the LISTEN button. Warnings are already put first.
- **`rawText`**: keep it; `/api/ask` needs the card including this.

### Bill spike (history is kept in the browser)
After every successful read where `billerKey` is not null:
```js
const h = JSON.parse(localStorage.getItem('vaachak.history') || '{}');
h[card.billerKey] = card.fields.amount.value;
localStorage.setItem('vaachak.history', JSON.stringify(h));
```
…and send that object as `history` on the next `/api/read`.

---

## Safety & accessibility keys (v2)

Every card from `/api/read` (and from offline mode) also has these:

```json
"mode": "online",                       // or "offline"
"alert": { "flag": "EXPIRED", "level": "danger", "vibrate": [400, 200, 400, 200, 800] },
"consensus": { "available": true, "engines": ["gemini", "tesseract"],
               "amount": "agree", "deadline": "agree", "badge": "VERIFIED_BY_EDGE" },
"payment": {
  "method": "official_site",            // or "upi"
  "billerId": "msedcl", "billerName": "MSEDCL (Mahavitaran)", "amount": 840,
  "consumerNumber": "000123456789",
  "upiUrl": null,                        // "upi://pay?pa=...&am=840.00..." only if the bill prints a UPI ID
  "upiSource": null,                     // "document" when upiUrl is set
  "officialUrl": "https://wss.mahadiscom.in/wss/wss?uiActionName=getViewPayBill",
  "copyText": "000123456789",
  "confirmText": "तुम्ही MSEDCL (Mahavitaran) ला ₹840 भरत आहात. बरोबर आहे ना?",
  "copiedText": "ग्राहक क्रमांक कॉपी केला आहे. पुढच्या पानावर पेस्ट करा."
}
```

### Verified badge: `consensus.label`
Ready-made text in the chosen language: green **"✓ दोन वेळा तपासले"** when `consensus.badge === "VERIFIED_BY_EDGE"`,
amber **"मजकूर स्पष्ट नाही. कृपया घरच्यांकडून तपासून घ्या."** when the engines disagree, `null` otherwise.

### Send to family with the photo: `actions`
`wa.me` links can only carry text. To send **the photo + summary**, use the phone's share sheet (Android Chrome), and fall back to the link:
```js
const file = new File([photoBlob], 'document.jpg', { type: 'image/jpeg' });
if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({ files: [file], text: card.actions.whatsappText });   // user picks WhatsApp → son
} else {
  location.href = card.actions.whatsappUrl;
}
```
`whatsappText` includes a plain English line for the family, e.g. *"🇬🇧 MSEDCL electricity bill of ₹840 due on 10 Oct 2026. Please verify."*
(also on its own as `actions.familySummaryEn`).

### Haptic alerts: `alert`
Right after showing the card: `if (navigator.vibrate) navigator.vibrate(card.alert.vibrate)`.
`level` is `danger` (SCAM/EXPIRED, long buzz), `warning` (URGENT/BILL_SPIKE), `info` (LOW_CONFIDENCE) or `ok` (tiny tick).
Works on **Android Chrome**; iPhones ignore it, so demo on an Android phone.

### Dual-engine check: `consensus`
1. In the browser, run Tesseract.js on the same photo (`eng` is enough for bills and strips).
2. Send its text as `edgeText` with the photo.
3. If both engines agree on the amount/date → `consensus.badge === "VERIFIED_BY_EDGE"`: show a **"✓ Verified by 2 engines"** badge.
   If they disagree → that field's confidence drops, `LOW_CONFIDENCE` is raised, and payment is hidden.
   `fields.amount.edge` / `fields.deadline.edge` = `"agree"` or `"disagree"` per field.
   If OCR text is junk or missing, `consensus.available` is `false` and nothing is penalised.

### Zero-type payment: `payment`
`null` unless it's a bill with a trusted amount (never for SCAM or LOW_CONFIDENCE). The Pay button should:
1. Show `payment.confirmText` with **Yes / No** (and speak it).
2. If `payment.upiUrl` → `location.href = payment.upiUrl` (opens GPay/PhonePe with the amount filled in).
3. Else → `navigator.clipboard.writeText(payment.copyText)`, show/speak `payment.copiedText`, then open `payment.officialUrl`.

Vaachak never invents a UPI ID: UPI links are only made for a UPI ID **printed on the bill**.

---

## Offline mode (no internet at all)

The backend's rule engine runs in the browser too. Copy the backend's `lib/` folder into the frontend (or import it from `../lib/`), then:

```js
import Tesseract from 'tesseract.js';
import { offlineRead } from '../lib/offline.js';

const { data } = await Tesseract.recognize(photoFile, 'eng');
const card = offlineRead(data.text, { lang: 'mr', history });   // same card shape as /api/read
```

- Knows 50 common Indian medicines (Crocin, Dolo, Pantocid, Metformin, Telma, Thyronorm, Azithral…), tolerant of OCR spelling mistakes.
- Still runs **expiry, due-date, scam and bill-spike rules**, so an expired Crocin strip gives a red `EXPIRED` card offline.
- `card.mode === "offline"`, `card.offline.note` = "इंटरनेट नाही. फोनवरच वाचले." (show it as a small badge).
- No boxes, no Q&A offline. For voice, play `samples/audio/*.wav` (expired / scam / low-confidence) or use `speechSynthesis`.

Recommended flow: run Tesseract **first** (it's needed for `edgeText` anyway). If `navigator.onLine` is false or `/api/read`
fails (`GEMINI_BUSY`, `QUOTA`, network error), show `offlineRead(...)` instead of an error.

---

## Camera helper: auto-torch, "hold steady", auto-capture

`lib/viewfinder.js` (browser only) watches the live camera so the person never has to aim or press a tiny button:
- too dark → speaks **"प्रकाश कमी आहे. टॉर्च चालू करत आहे."** and switches on the phone's flashlight (Android Chrome);
- blurry/shaking → speaks **"फोन स्थिर धरा."**;
- bright and sharp for ~1 second → speaks **"छान. फोटो घेत आहे."** and captures a ≤1600 px JPEG by itself.

```js
import { startViewfinder } from '../lib/viewfinder.js';

const stop = await startViewfinder(document.querySelector('video'), {
  lang: 'mr',
  onStatus: (status) => setHint(status),          // 'dark' | 'blurry' | 'ok', for an on-screen hint
  onCapture: async (blob) => { /* run Tesseract on blob, then POST blob to /api/read */ },
});
// call stop() if the user leaves the camera screen
```
Thresholds are in `THRESHOLDS` (`dark: 60`, `blurry: 60`); tune them on the demo phone if needed.

---

## Pill schedule
`pills` comes from Gemini, or from our own rule that reads doctor's shorthand like **"1-0-1 after food"**, so it
also works offline. Draw ☀️ (morning) 🍽️/🌤️ (noon) 🌙 (night) with the count, plus "before/after food".

---

## `POST /api/ask`: question about the current document

Typed (`application/json`):
```json
{ "question": "UPI ने भरू शकतो का?", "card": { ...the whole card from /api/read... }, "lang": "mr" }
```
Spoken (`multipart/form-data`): `audio` (the MediaRecorder blob, ≤ 30 s), `card` (JSON **string**), `lang`.

**Response:**
```json
{ "heard": "UPI ने भरू शकतो का?", "answer": "हो, बिलावर UPI QR कोड आहे.", "answerable": true, "speak": "हो, बिलावर UPI QR कोड आहे." }
```
Answers come **only** from that document. If it's not in the document, `answerable` is `false`
and the answer says to ask the family.

---

## `POST /api/tts`: text → speech

```json
{ "text": "<card.speak or ask.speak>", "lang": "mr" }
```
Returns **`audio/wav`** (binary). Play it with:
```js
const res = await fetch(`${API}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }) });
new Audio(URL.createObjectURL(await res.blob())).play();
```
Max 800 characters. Spoken slowly for elderly listeners. Uses **Sarvam AI Bulbul v3** (natural Indian voice) when the
server has a Sarvam key, otherwise Gemini; the `X-Voice-Provider` response header says which.
The free Gemini voice quota is small, so **always have a fallback**: the browser's `speechSynthesis`
(`lang: 'mr-IN'` / `'hi-IN'`) or the pre-recorded `samples/audio/*.wav` clips.

---

## `GET /api/health`
`{ "ok": true, "model": "gemini-3.8-flash", "ttsModel": "...", "hasKey": true }`

---

## Demo mode
`samples/*.json` are real cards built by the backend (`npm run samples`). The frontend should
bundle them and show them when offline or when the API returns `QUOTA`:
`electricity-bill.json` (URGENT), `medicine-expired.json` (EXPIRED), `scam-sms.json` (SCAM), `prescription.json` (pills).
