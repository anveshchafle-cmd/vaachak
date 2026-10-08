# Vaachak (वाचक)

**Vaachak reads any bill, medicine strip or government notice, on paper or on screen, and tells an
elderly or low-literacy person, in Marathi or Hindi, exactly what to do.**

> Gemini reads documents. Vaachak protects the person holding them.

Built for THINK AI 4.0 (IETE TCET Mumbai), PS10: AI-Powered Accessibility Assistant.

## What makes it different

| Feature | How |
|---|---|
| **Any digital content in** | Photo, screenshot, PDF, a **link** (e-bill page, government notice) or **pasted/shared text** (SMS, WhatsApp forward), all turned into the same card. "Share to Vaachak" from any app |
| **5-field action card** | What is this · What to do · By when · How much · Warning, in Marathi / Hindi / English |
| **Confidence on every field** | Unsure readings say "please ask someone" instead of guessing |
| **"Show me where" proof** | Each field comes with the box where it is printed on the photo |
| **Amount & date verification** (rules, not AI) | The amount/date the AI reports must actually appear in the document text, otherwise it's marked unverified |
| **Scam shield** (rules, not AI) | Flags fake "power will be cut tonight, call 98xxx" SMS: personal numbers, OTP requests, AnyDesk/APK, look-alike links, threats, personal UPI IDs, prize bait |
| **Expiry check** (rules, not AI) | Our own parser reads `EXP. 08/2026` / `Exp AUG 2026` and raises a red EXPIRED card |
| **Due-date urgency** (rules) | ≤ 3 days left → URGENT; past due → overdue warning |
| **Bill-spike alert** (rules) | Bill ≥ 2× the last one from the same consumer number → "ask someone before paying" |
| **Pill picture card** | Prescriptions become ☀️ 🌤️ 🌙 + before/after food: works with zero literacy |
| **Grounded voice Q&A** | Ask by voice; answers only from that document, never from the internet |
| **Elder-friendly voice** | Slow speech, warnings first, amount said in digits *and* words |
| **Family loop** | One tap sends the card to a family member on WhatsApp asking "Should I pay? YES/NO" |
| **Remind me** | Google Calendar reminder the day before the deadline |
| **Dual-engine verification** | Gemini's amount/date must agree with on-device Tesseract OCR (Levenshtein-tolerant of OCR slips) → "Verified by 2 engines"; disagreement lowers confidence and hides Pay |
| **Zero-type payment** | Pay opens a UPI link pre-filled with the amount (only for a UPI ID printed on the bill), or copies the consumer number and opens the official biller page. Never a guessed UPI ID |
| **Haptic danger alerts** | Distinct vibration patterns for scam/expired vs urgent, for users who can't see the screen well |
| **Works with zero internet** | The same rule engine runs in the browser on Tesseract text, with an offline directory of 50 common Indian medicines, so an expired Crocin strip still gets a red card |
| **Audio-assisted camera** | Measures brightness and sharpness of the live camera: low light → "प्रकाश कमी आहे" + torch on; shaking → "फोन स्थिर धरा"; takes the photo by itself when it's clear |
| **Rule-based dose reading** | "1-0-1 after food" → ☀️ 1 · 🌤️ 0 · 🌙 1 · after food, even offline |
| **Speaks to the person by name** | "प्रकाश काका, MSEDCL चे वीज बिल…" |
| **Call the real number** | A scam card has one-tap buttons for **1930** (national cyber-fraud helpline) and the real helpline of the company being impersonated (MSEDCL 1912, SBI) |
| **Medicine reminders, whole course** | Every medicine × every dose time × number of days → phone calendar (iPhone: one `.ics`, "Add All"; Android: one link per dose). Two medicines are never merged into one schedule |
| **My papers** | Home screen lists bill deadlines and running medicine courses ("MSEDCL bill · 2 days left") and how many scams were caught. Stored only on the phone |
| **Jan Aushadhi tip** | Medicine cards name the generic and point to the much cheaper Jan Aushadhi Kendra |
| **Spoken guided tour** | First visit: pick मराठी / हिंदी / English, then each part of the screen is highlighted and read aloud. The **?** button replays it |
| **Natural Indian voice** | Sarvam AI Bulbul v3 (handles Marathi-English mixing), Gemini TTS as backup, pre-recorded clips offline |

> **"हे साफ दिसत नाही. कृपया कुणालातरी विचारून घ्या."** Vaachak never guesses with someone's money or medicine.

## Architecture

```
Phone camera / screenshot / PDF
        │
        ▼
 React frontend ──► POST /api/read ──► Gemini 3.8 Flash (vision, JSON schema)
        │                                   │
        │                                   ▼
        │                        Rule engine (no AI)
        │             verify amount/date · expiry · urgency
        │             scam shield · bill spike · confidence
        │                                   │
        ◄──────────── action card JSON ─────┘
        │
        ├─► POST /api/tts  ──► Gemini TTS (slow Marathi/Hindi voice, WAV)
        └─► POST /api/ask  ──► Gemini, grounded on the document only
```

Backend: Node 18+ serverless functions (Vercel), **zero npm dependencies**. Gemini is called with `fetch`.

## Run the backend locally

```bash
cp .env.example .env        # then put your key from https://aistudio.google.com/apikey in .env
npm test                    # 58 rule-engine + card tests (no API key needed)
npm run dev                 # http://localhost:3000
npm run try -- "C:\path\to\bill.jpg" mr     # send a real photo, print the card
npm run samples -- 2026-10-09               # rebuild the Demo-mode sample cards
```

## Project layout

```
api/            Vercel functions: read.js, ask.js, tts.js, health.js
lib/            card.js (builds the card) · rules.js · scam.js · prompts.js · gemini.js · i18n.js
samples/        Ready-made cards for offline Demo mode
test/           node:test suites + fixtures
dev-server.js   Local dev server that runs the same handlers
API.md          The contract between frontend and backend
frontend/       React app (built separately, merged here)
```

## Deploy

Push to GitHub, import the repo in Vercel, add `GEMINI_API_KEY` under Environment Variables, deploy.
