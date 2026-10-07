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

## `POST /api/read`: document → action card

**Request** (`multipart/form-data`):

| Field | Required | Value |
|---|---|---|
| `file` | yes | JPEG / PNG / WEBP / HEIC photo or PDF, **max 4 MB** (resize phone photos to ~1600 px wide first) |
| `lang` | no | `mr` (default), `hi`, `en` |
| `history` | no | JSON string from localStorage: `{"msedcl:000123456789": 300}` (see Bill spike below) |
| `familyPhone` | no | 10-digit number for the WhatsApp button, e.g. `9876543210` |

JSON also works: `{ "fileBase64": "data:image/jpeg;base64,...", "lang": "mr", "history": {...}, "familyPhone": "..." }`

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
Max 800 characters. Spoken slowly for elderly listeners. If it fails (quota/offline), fall back to
the browser's `speechSynthesis` with `lang: 'mr-IN'` / `'hi-IN'`, or the pre-recorded MP3s.

---

## `GET /api/health`
`{ "ok": true, "model": "gemini-3.8-flash", "ttsModel": "...", "hasKey": true }`

---

## Demo mode
`samples/*.json` are real cards built by the backend (`npm run samples`). The frontend should
bundle them and show them when offline or when the API returns `QUOTA`:
`electricity-bill.json` (URGENT), `medicine-expired.json` (EXPIRED), `scam-sms.json` (SCAM), `prescription.json` (pills).
