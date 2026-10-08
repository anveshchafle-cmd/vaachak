import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { read, readText, processImage } from './api';
import { offlineRead } from '../../lib/offline.js';
import { buildCard } from '../../lib/card.js';
import { settings } from './storage';
import { makeT } from './i18n';
import { warmVoice } from './voice';

// Ready-made cards built by the backend (repo samples/), used in Demo mode and as named samples.
const sampleFiles = import.meta.glob('../../samples/*.json', { eager: true });
export const SAMPLES = Object.fromEntries(
  Object.entries(sampleFiles).map(([path, mod]) => [path.split('/').pop().replace('.json', ''), mod.default || mod]),
);
const SAMPLE_ORDER = ['electricity-bill', 'medicine-expired', 'scam-sms', 'prescription'];

// After the server answers, wait at most this long for on-device OCR to finish.
const OCR_GRACE_MS = 2000;

// Rebuilds the server's card with the phone's OCR text, so Gemini and Tesseract must agree
// on the amount and date (same pure buildCard the server uses).
function withEdgeText(card, edgeText, { history, familyPhone, userName }) {
  const rebuilt = buildCard(card.extraction, { lang: card.lang, history, familyPhone, userName, edgeText });
  return { ...rebuilt, source: card.source, extraction: card.extraction };
}

// samples/<name>.json is Marathi; <name>.hi.json and <name>.en.json are the same card in Hindi and English.
function sampleCard(name, lang) {
  return SAMPLES[`${name}.${lang}`] || SAMPLES[name];
}

function nextDemoSample(lang) {
  let i = 0;
  try {
    i = Number(sessionStorage.getItem('vaachak.demoIndex') || 0);
    sessionStorage.setItem('vaachak.demoIndex', String((i + 1) % SAMPLE_ORDER.length));
  } catch {}
  return sampleCard(SAMPLE_ORDER[i % SAMPLE_ORDER.length], lang);
}

export default function Reading({ input, isDemo, onSuccess, onError, onCancel }) {
  const { lang } = settings();
  const t = makeT(lang);
  const [status, setStatus] = useState(input?.text ? t('reading') : t('scanning'));
  const [note, setNote] = useState(t('wait'));
  // Keep the latest callbacks without re-running the whole read on every render.
  const cb = useRef({ onSuccess, onError });
  cb.current = { onSuccess, onError };

  useEffect(() => {
    let isMounted = true;
    const opts = settings();
    warmVoice();
    const slowTimer = setTimeout(() => isMounted && setNote(t('slow')), 12000);
    const done = (card) => isMounted && cb.current.onSuccess(card);

    async function run() {
      if (input?.sample || (isDemo && !input?.text)) {
        setStatus(t('reading'));
        const card = (input?.sample && sampleCard(input.sample, lang)) || nextDemoSample(lang);
        setTimeout(() => done(card), 900);
        return;
      }

      // Pasted message or link.
      if (input?.text) {
        const value = input.text.trim();
        const isLink = /^https?:\/\//i.test(value);
        if (isDemo || !navigator.onLine) {
          if (isLink) return isMounted && cb.current.onError(t('linkError'));
          return done(offlineRead(value, opts));
        }
        try {
          done(await readText(value, opts));
        } catch {
          if (!isMounted) return;
          if (isLink) return cb.current.onError(t('linkError'));
          done(offlineRead(value, opts));
        }
        return;
      }

      // Photo, screenshot or PDF. The server and on-device OCR run at the same time.
      const file = input.file;
      const isImage = file.type?.startsWith('image/');
      const small = isImage ? await processImage(file) : file;
      const ocr = isImage
        ? Tesseract.recognize(small, 'eng').then((r) => r.data.text || '').catch(() => '')
        : Promise.resolve('');
      if (!isMounted) return;
      setStatus(t('reading'));

      let card;
      try {
        if (!navigator.onLine) throw new Error('offline');
        const { history, familyPhone, userName } = opts;
        card = await read(small, lang, history, familyPhone, userName);
      } catch {
        // Server busy, out of quota or no internet: the same rule engine runs right here on the OCR text.
        const text = await ocr;
        if (!isMounted) return;
        if (text) done(offlineRead(text, opts));
        else cb.current.onError(t('error'));
        return;
      }
      // Second engine: give OCR a short grace period, then re-check the card against it.
      const edgeText = await Promise.race([ocr, new Promise((r) => setTimeout(() => r(''), OCR_GRACE_MS))]);
      done(edgeText && card.extraction ? withEdgeText(card, edgeText, opts) : card);
    }

    run();
    return () => {
      isMounted = false;
      clearTimeout(slowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isDemo]);

  return (
    <div className="inland fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center" role="status" aria-live="polite">
      <div className="slip relative w-56 h-64 px-6 pb-6 mb-10" aria-hidden="true">
        {[70, 90, 55, 85, 65, 80, 45].map((w, i) => (
          <div key={i} className="h-3 rounded-full bg-ink/15 mt-5" style={{ width: `${w}%` }} />
        ))}
        <div className="scanbar absolute inset-x-2 h-2 rounded-full bg-stamp shadow-[0_0_24px_6px_rgba(74,44,143,.45)]" />
      </div>
      <h2 className="font-display text-[40px] text-stamp leading-tight">{status}</h2>
      <p className="text-[22px] text-ink-soft mt-3 max-w-[22ch]">{note}</p>
      <button onClick={onCancel} className="mt-12 text-[22px] font-bold text-ink border-[3px] border-ink px-10 py-4 rounded-full active:bg-paper">
        {t('cancel')}
      </button>
    </div>
  );
}
