import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { read, readText, processImage } from './api';
import { offlineRead } from '../../lib/offline.js';
import { settings } from './storage';
import { makeT } from './i18n';

// Ready-made cards built by the backend (repo samples/), used in Demo mode and as named samples.
const sampleFiles = import.meta.glob('../../samples/*.json', { eager: true });
export const SAMPLES = Object.fromEntries(
  Object.entries(sampleFiles).map(([path, mod]) => [path.split('/').pop().replace('.json', ''), mod.default || mod]),
);
const SAMPLE_ORDER = ['electricity-bill', 'medicine-expired', 'scam-sms', 'prescription'];

// Wait for on-device OCR at most this long before asking the server, so the person isn't kept waiting.
const OCR_HEAD_START_MS = 6000;

function nextDemoSample() {
  let i = 0;
  try {
    i = Number(sessionStorage.getItem('vaachak.demoIndex') || 0);
    sessionStorage.setItem('vaachak.demoIndex', String((i + 1) % SAMPLE_ORDER.length));
  } catch {}
  return SAMPLES[SAMPLE_ORDER[i % SAMPLE_ORDER.length]];
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
    const slowTimer = setTimeout(() => isMounted && setNote(t('slow')), 12000);
    const done = (card) => isMounted && cb.current.onSuccess(card);

    async function run() {
      if (input?.sample || (isDemo && !input?.text)) {
        setStatus(t('reading'));
        const card = SAMPLES[input?.sample] || nextDemoSample();
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

      // Photo, screenshot or PDF.
      const file = input.file;
      const isImage = file.type?.startsWith('image/');
      const small = isImage ? await processImage(file) : file;
      const ocr = isImage
        ? Tesseract.recognize(small, 'eng').then((r) => r.data.text || '').catch(() => '')
        : Promise.resolve('');
      const edgeText = await Promise.race([ocr, new Promise((r) => setTimeout(() => r(''), OCR_HEAD_START_MS))]);
      if (!isMounted) return;
      setStatus(t('reading'));

      try {
        if (!navigator.onLine) throw new Error('offline');
        const { history, familyPhone, userName } = opts;
        done(await read(small, lang, history, familyPhone, userName, edgeText));
      } catch {
        // Server busy, out of quota or no internet: the same rule engine runs right here on the OCR text.
        const text = edgeText || (await ocr);
        if (!isMounted) return;
        if (text) done(offlineRead(text, opts));
        else cb.current.onError(t('error'));
      }
    }

    run();
    return () => {
      isMounted = false;
      clearTimeout(slowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isDemo]);

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col items-center justify-center p-8 text-center font-sans" role="status" aria-live="polite">
      <div className="relative w-32 h-32 mb-10">
        <div className="absolute inset-0 border-[10px] border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-[10px] border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-4xl" aria-hidden="true">👀</div>
      </div>
      <h2 className="text-[36px] font-bold text-gray-900 animate-pulse tracking-wide">{status}</h2>
      <p className="text-[22px] text-gray-600 mt-4 max-w-[80%]">{note}</p>
      <button onClick={onCancel} className="mt-16 text-[24px] font-bold text-gray-700 bg-white border-4 border-gray-300 px-10 py-5 rounded-full shadow-md active:bg-gray-100 active:scale-95 transition-transform">
        {t('cancel')}
      </button>
    </div>
  );
}
