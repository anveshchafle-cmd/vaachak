# Frontend hand-off: paste this into Gemini

**How to use:** open Gemini (or Gemini Code Assist / AI Studio), paste everything inside the box below as your
first message, and **attach these 3 files from the repo**: `API.md`, `samples/electricity-bill.json`,
`samples/scam-sms.json`. Then ask for one piece at a time (e.g. "build the Home screen").

---

```text
You are helping me build the FRONTEND of "Vaachak" for a hackathon (THINK AI 4.0, TCET Mumbai, final on 9 Oct).
My teammate has ALREADY built and deployed the backend. Your job is only the frontend. I attached API.md (the exact
API contract) and two sample responses. Treat API.md as the source of truth; never invent fields.

== WHAT VAACHAK IS ==
"Vaachak reads any bill, medicine strip or government notice, on paper or on screen, and tells an elderly or
low-literacy person, in Marathi or Hindi, exactly what to do."
User persona: Prakash-kaka, 68, retired clerk in Thane, has cataracts, reads Marathi, children at work.
Pitch line: "Gemini answers questions. Vaachak never needs one."
Honesty line: "हे साफ दिसत नाही. कृपया कुणालातरी विचारून घ्या." (Vaachak never guesses with money or medicine.)

== HARD RULES (so nothing breaks) ==
1. All my code lives in the folder `frontend/` of the repo. NEVER create or edit files in `api/`, `lib/`,
   `test/`, `scripts/`, `samples/` or the root `package.json` / `vercel.json`. Those belong to the backend.
2. Stack: React + Vite (JavaScript, not TypeScript), plain CSS or Tailwind. No login, no database, no Next.js.
3. Every backend call goes through ONE file: `frontend/src/api.js`.
   Base URL: `const API = import.meta.env.VITE_API_URL ?? ''`
   - local dev: `frontend/.env.local` contains `VITE_API_URL=https://vaachak-zeta.vercel.app`
   - production: the frontend is served from the same site as the API, so it stays '' (relative `/api/...`).
4. Use the backend's response fields EXACTLY as in API.md. Do not rename them, do not compute things the backend
   already gives (flags, speech text, payment links, vibration patterns, WhatsApp text, verified labels).
5. The backend's rule engine also runs in the browser for OFFLINE mode. Import it, never copy or rewrite it:
   `import { offlineRead } from '../../lib/offline.js'` and `import { startViewfinder } from '../../lib/viewfinder.js'`
   (paths from frontend/src/). In `frontend/vite.config.js` add `server: { fs: { allow: ['..'] } }` so Vite may
   import from the repo's lib/ folder.
6. Never put any API key in the frontend. The backend holds the keys.
7. Mobile first: design for a 360-412 px wide Android phone held in one hand. Test in Chrome DevTools phone mode.

== API (summary; full details in API.md) ==
- POST /api/read   multipart: file (photo/PDF, max 4 MB, resize photos to ≤1600 px), lang (mr|hi|en),
                   history (JSON string), familyPhone, userName, edgeText (Tesseract text)  → CARD JSON
- POST /api/ask    JSON { question, card, lang }  or multipart { audio, card (JSON string), lang } → { heard, answer, answerable, speak }
- POST /api/tts    JSON { text, lang } → audio/wav (Sarvam voice, ~2 s)
- GET  /api/health
Errors: { error, code }. codes GEMINI_BUSY (503) and QUOTA (429) → switch to offline/demo result, never show a raw error.

Key CARD fields: fields.{what,action,deadline,amount,warning}.{text,confidence,box,source,verified,edge},
flags[] (SCAM, EXPIRED, URGENT, BILL_SPIKE, LOW_CONFIDENCE, most serious first), alert.{level,vibrate},
consensus.{badge,label}, payment.{method,upiUrl,officialUrl,copyText,confirmText,copiedText}, pills, checklist,
dates.{daysLeft,overdue}, actions.{whatsappText,whatsappUrl,calendarUrl}, speak, mode ("online"|"offline").

== SCREENS ==
1. HOME: huge high-contrast UI, 3 giant buttons: SNAP (camera) · UPLOAD (screenshot/PDF) · ASK (voice).
   Language toggle मराठी / हिंदी / English at top. Optional one-time setup: user's name (e.g. "प्रकाश काका")
   and family WhatsApp number, saved in localStorage.
2. CAMERA: full-screen <video> using startViewfinder(video, { lang, onStatus, onCapture }). It speaks
   "light is low" + turns on the torch, "hold steady", and auto-captures. Also keep a big manual capture button.
3. READING: big friendly loader ("वाचत आहे…"). Gemini can take 10-40 s on the free tier, so:
   - immediately run Tesseract.js (`tesseract.js`, lang 'eng') on the photo;
   - send the photo + edgeText to /api/read;
   - if offline, or /api/read errors, or no answer in 25 s → show offlineRead(tesseractText, {lang, history, userName}).
4. CARD (the hero screen):
   - Banner from flags[0]: SCAM/EXPIRED = full red, URGENT = orange (show dates.daysLeft), BILL_SPIKE = yellow,
     LOW_CONFIDENCE = grey "please ask someone". Show scam.reasons[].text under a SCAM banner.
   - 5 rows with icons: What · Do · By when · How much · Warning. Hide empty rows. Rows with confidence < 0.6
     show "साफ दिसत नाही". Rows with source "rule" get a small 🛡️ "Checked" badge.
   - consensus.badge === "VERIFIED_BY_EDGE" → green chip with consensus.label; disagreement → amber chip with consensus.label.
   - pills → ☀️ / 🌤️ / 🌙 with big counts + "before/after food" icon.
   - Tap a row that has a box → show the photo with that area highlighted (box = [ymin,xmin,ymax,xmax] on 0-1000 scale).
   - On arrival: navigator.vibrate?.(card.alert.vibrate) and auto-play the voice (see VOICE).
   - mode === "offline" → small badge with card.offline.note.
5. ACTION BUTTONS (big, under the card):
   - 🔊 LISTEN again.
   - 💳 PAY (only if card.payment): show payment.confirmText with YES/NO. YES → if payment.upiUrl, open it;
     else copy payment.copyText to clipboard, show/speak payment.copiedText, open payment.officialUrl.
     Never show PAY for SCAM.
   - 👨‍👩‍👦 SEND TO FAMILY: share photo + card.actions.whatsappText via navigator.share({files,text}) when
     navigator.canShare({files}) is true, else open card.actions.whatsappUrl.
   - ⏰ REMIND ME: open card.actions.calendarUrl (only if not null).
   - ❓ ASK: hold-to-talk with MediaRecorder → POST /api/ask (multipart audio + card) → show and speak the answer.
6. DEMO MODE: hidden toggle (e.g. long-press the logo). Uses the bundled sample cards (copy samples/*.json into
   frontend/src/samples/) and the offline audio in samples/audio/*.wav (copy into frontend/public/audio/).
   Must work with Wi-Fi OFF.

== VOICE ==
Play order: POST /api/tts with card.speak → play the WAV. While waiting, or if it fails, use
speechSynthesis (lang 'mr-IN' / 'hi-IN', rate 0.9). For SCAM / EXPIRED / LOW_CONFIDENCE when offline, play
/audio/scam.mr.wav, /audio/expired.mr.wav, /audio/low-confidence.mr.wav (or .hi.wav).

== BILL HISTORY (for the BILL_SPIKE alert) ==
After every card with billerKey: save localStorage['vaachak.history'][card.billerKey] = card.fields.amount.value,
and send that object as `history` on the next /api/read.

== ACCESSIBILITY / DESIGN ==
Minimum font 22 px (key numbers 40 px+), buttons ≥ 64 px tall, contrast ≥ 7:1, no tiny icons without labels,
every label in the selected language (Devanagari font: "Noto Sans Devanagari"), no text-only error messages
(always speak them too). One action per screen. It must look polished and warm, not like a form.

== GIT WORKFLOW ==
- Work on a branch named `frontend`. Commit only files inside `frontend/`.
- Run locally: `cd frontend && npm install && npm run dev`.
- When a screen works, push the branch and open a Pull Request to `main`; my teammate merges and deploys.
- Before each PR: `npm run build` must succeed with no errors.

Start by creating the Vite + React project in `frontend/`, the vite.config.js with fs.allow, `src/api.js`
(read, ask, tts, health, with a 25 s timeout on read), and the HOME screen. Ask me before adding any library
other than react, tesseract.js and (optionally) tailwind.
```

---

## Notes for the team (not for Gemini)

- **Live backend:** https://vaachak-zeta.vercel.app (CORS is open, so `localhost:5173` can call it).
- **Phone testing:** on the same Wi-Fi, run `npm run dev -- --host` and open the shown IP on the phone. Camera, torch
  and vibration need **Android Chrome**; on `http://` IPs Chrome blocks the camera, so test the camera on the deployed
  preview URL (https) or use Chrome's `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
- **Merging:** Anvesh (backend) merges the `frontend` PR, then Claude wires Vercel to serve `frontend/dist` and `/api` from one URL.
- **Vercel previews of the friend's branch may show "Blocked"** (Hobby plan only deploys commits by the account owner).
  That's expected: test locally; the merge to `main` deploys.
