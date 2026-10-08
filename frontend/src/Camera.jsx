import { useEffect, useRef, useState } from 'react';
import { startViewfinder } from '../../lib/viewfinder.js';
import { makeT } from './i18n';
import { warmOcr } from './ocr';

const STATUS_KEY = { dark: 'camDark', blurry: 'camBlurry', ok: 'camOk' };

export default function Camera({ lang, onCapture, onClose }) {
  const videoRef = useRef(null);
  const camRef = useRef(null);
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
    // Load the on-device text reader while the person is still aiming.
    warmOcr();
    startViewfinder(videoRef.current, {
      lang,
      onStatus: (status) => setStatusMsg(t(STATUS_KEY[status] || 'camOk')),
      onCapture: (blob) => {
        if (doneRef.current) return;
        doneRef.current = true;
        captureRef.current(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      },
    })
      .then((cam) => {
        if (cancelled) cam.stop();
        else camRef.current = cam;
      })
      .catch(() => !cancelled && setError(t('error')));
    return () => {
      cancelled = true;
      camRef.current?.stop();
      camRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // The shutter waits for the shake of the tap to pass, then keeps the sharpest frame.
  const handleManualCapture = () => {
    if (doneRef.current) return;
    setStatusMsg(t('camOk'));
    camRef.current?.snap();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans" >
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <div className="relative z-10 w-full p-4 flex justify-between items-start bg-gradient-to-b from-black/70 to-transparent pb-10">
        <button onClick={onClose} aria-label={t('close')} className="text-white text-6xl leading-none w-16 h-16 flex items-center justify-center active:bg-white/20 rounded-full">×</button>
        {(statusMsg || error) && (
          <div role="status" aria-live="polite" className="bg-stamp text-paper text-[24px] font-bold px-6 py-3 rounded-2xl text-center max-w-[65%] shadow-lg">
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
