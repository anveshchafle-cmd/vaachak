import { useCallback, useEffect, useState } from 'react';
import Home from './Home';
import Camera from './Camera';
import Reading from './Reading';
import Paste from './Paste';
import Card from './Card';
import { load, save } from './storage';
import { makeT } from './i18n';
import { stopVoice } from './voice';

// Text or a link shared into Vaachak from another app (PWA share target), or ?sample=name.
function initialInput() {
  const p = new URLSearchParams(location.search);
  const shared = p.get('url') || p.get('text') || p.get('title');
  if (shared) return { text: shared };
  if (/^[a-z-]+$/.test(p.get('sample') || '')) return { sample: p.get('sample') };
  return null;
}

export default function App() {
  const first = initialInput();
  const [screen, setScreen] = useState(first ? 'READING' : 'HOME');
  const [input, setInput] = useState(first);
  const [lang, setLang] = useState(load('vaachak.lang', 'mr'));
  const [demoMode, setDemoMode] = useState(load('vaachak.demo', false));
  const [cardData, setCardData] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [toast, setToast] = useState('');
  const t = makeT(lang);

  useEffect(() => {
    if (first) history.replaceState(null, '', '/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!photo?.url) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  const navigate = useCallback((newScreen, data = null) => {
    stopVoice();
    if (data?.input) {
      setInput(data.input);
      const file = data.input.file;
      setPhoto(file ? { blob: file, url: file.type?.startsWith('image/') ? URL.createObjectURL(file) : null } : null);
    }
    if (data?.card) setCardData(data.card);
    setToast('');
    setScreen(newScreen);
    window.scrollTo(0, 0);
  }, []);

  const toggleDemo = useCallback(() => {
    setDemoMode((d) => {
      save('vaachak.demo', !d);
      return !d;
    });
  }, []);

  const onCapture = useCallback((file) => navigate('READING', { input: { file } }), [navigate]);
  const onSuccess = useCallback((card) => navigate('CARD', { card }), [navigate]);
  const onError = useCallback((msg) => {
    setScreen('HOME');
    setToast(msg);
  }, []);
  const goHome = useCallback(() => navigate('HOME'), [navigate]);
  const changeLang = useCallback((l) => setLang(l), []);

  return (
    <div className="w-full max-w-[480px] mx-auto bg-gray-50 min-h-screen shadow-2xl relative overflow-hidden font-sans" style={{ fontFamily: '"Noto Sans Devanagari", sans-serif' }}>

      {demoMode && (
        <div className="absolute top-0 inset-x-0 bg-yellow-400 text-black text-center text-[14px] font-bold py-1 z-40">
          {t('demoOn')}
        </div>
      )}

      {toast && screen === 'HOME' && (
        <div role="alert" className="mx-4 mt-10 -mb-6 bg-red-100 border-2 border-red-300 text-red-900 rounded-2xl p-4 text-[20px] font-bold">
          {toast}
        </div>
      )}

      {screen === 'HOME' && (
        <Home lang={lang} onLang={changeLang} onNavigate={navigate} demoMode={demoMode} onToggleDemo={toggleDemo} />
      )}

      {screen === 'CAMERA' && <Camera lang={lang} onClose={goHome} onCapture={onCapture} />}

      {screen === 'PASTE' && <Paste lang={lang} onBack={goHome} onRead={(text) => navigate('READING', { input: { text } })} />}

      {screen === 'READING' && (
        <Reading input={input} isDemo={demoMode} onSuccess={onSuccess} onError={onError} onCancel={goHome} />
      )}

      {screen === 'CARD' && cardData && (
        <Card card={cardData} lang={lang} photoUrl={photo?.url} photoBlob={photo?.blob} onAgain={goHome} />
      )}
    </div>
  );
}
