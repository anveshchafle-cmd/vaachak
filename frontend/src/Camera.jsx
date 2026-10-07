import { useEffect, useRef, useState } from 'react';
import { startViewfinder } from '../../lib/viewfinder.js';
import { makeT } from './i18n';

const STATUS_KEY = { dark: 'camDark', blurry: 'camBlurry', ok: 'camOk' };

export default function Camera({ lang, onCapture, onClose }) {
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const doneRef = useRef(false);
  // Keep the latest callback without restarting the camera every render.
  const captureRef = useRef(onCapture);
  captureRef.current = onCapture;
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const t = makeT(lang);

  useEffect(() => {
    let cancelled = false;
    doneRef.current = false;
    startViewfinder(videoRef.current, {
      lang,
      onStatus: (status) => setStatusMsg(t(STATUS_KEY[status] || 'camOk')),
      onCapture: (blob) => {
        if (doneRef.current) return;
        doneRef.current = true;
        captureRef.current(blob);
      },
    })
      .then((stop) => {
        if (cancelled) stop();
        else stopRef.current = stop;
      })
      .catch(() => setError(t('error')));
    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleManualCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || doneRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      doneRef.current = true;
      stopRef.current?.();
      captureRef.current(new File([blob], 'manual_capture.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans" style={{ fontFamily: '"Noto Sans Devanagari", sans-serif' }}>
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <div className="relative z-10 w-full p-4 flex justify-between items-start bg-gradient-to-b from-black/70 to-transparent pb-10">
        <button onClick={onClose} aria-label={t('close')} className="text-white text-6xl leading-none w-16 h-16 flex items-center justify-center active:bg-white/20 rounded-full">×</button>
        {(statusMsg || error) && (
          <div role="status" aria-live="polite" className="bg-black/80 text-white text-[24px] font-bold px-6 py-3 rounded-2xl animate-pulse text-center max-w-[65%] border-2 border-white/20 shadow-lg">
            {error || statusMsg}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 p-8 flex justify-center pb-12 bg-gradient-to-t from-black/80 to-transparent pt-20">
        <button onClick={handleManualCapture} aria-label={t('capture')} className="w-24 h-24 bg-transparent rounded-full border-[6px] border-white active:scale-90 transition-transform shadow-2xl flex items-center justify-center">
          <div className="w-[72px] h-[72px] bg-white rounded-full"></div>
        </button>
      </div>
    </div>
  );
}
