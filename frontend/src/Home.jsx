import { useState, useEffect, useRef } from 'react';
import { makeT } from './i18n';
import { load, save } from './storage';

export default function Home({ lang, onLang, onNavigate, demoMode, onToggleDemo }) {
  const [userName, setUserName] = useState(load('vaachak.userName', ''));
  const [familyPhone, setFamilyPhone] = useState(load('vaachak.familyPhone', ''));
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef(null);
  const timerRef = useRef(null);
  const t = makeT(lang);

  useEffect(() => {
    save('vaachak.lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const saveSettings = () => {
    save('vaachak.userName', userName.trim());
    save('vaachak.familyPhone', familyPhone.trim());
    setShowSettings(false);
  };

  // Long-press the logo for 1.5 s to switch Demo mode (works with Wi-Fi off).
  const startPress = () => {
    timerRef.current = setTimeout(() => {
      onToggleDemo();
      navigator.vibrate?.([200, 100, 200]);
    }, 1500);
  };
  const endPress = () => clearTimeout(timerRef.current);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onNavigate('READING', { input: { file } });
  };

  const samples = [
    ['electricity-bill', '⚡', 'sBill'],
    ['medicine-expired', '💊', 'sMed'],
    ['scam-sms', '🚨', 'sScam'],
    ['prescription', '🩺', 'sRx'],
  ];

  return (
    <div className={`min-h-screen ${demoMode ? 'bg-yellow-50' : 'bg-gray-50'} flex flex-col p-4 w-full mx-auto`}>

      <div className={`flex justify-between items-center mb-3 w-full ${demoMode ? 'mt-6' : ''}`}>
        <h1
          className="text-4xl font-extrabold text-gray-900 tracking-tight select-none"
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
        >
          वाचक
        </h1>
        <div className="flex gap-3">
          <select
            value={lang}
            onChange={(e) => onLang(e.target.value)}
            aria-label="Language / भाषा"
            className="text-[22px] px-3 py-2 bg-white border-2 border-gray-300 rounded-xl font-bold text-gray-800"
          >
            <option value="mr">मराठी</option>
            <option value="hi">हिंदी</option>
            <option value="en">ENG</option>
          </select>
          <button
            onClick={() => setShowSettings(!showSettings)}
            aria-label={t('settings')}
            aria-expanded={showSettings}
            className="text-[28px] w-14 h-14 bg-white border-2 border-gray-300 rounded-xl flex items-center justify-center active:bg-gray-100"
          >
            ⚙️
          </button>
        </div>
      </div>
      <p className="text-[19px] text-gray-700 mb-6 leading-snug">{t('tagline')}</p>

      {showSettings && (
        <div className="bg-white p-5 rounded-3xl shadow-xl border-2 border-gray-200 mb-8 animate-fade-in">
          <label htmlFor="userName" className="block text-[22px] mb-2 font-bold text-gray-800">{t('name')}</label>
          <input
            id="userName"
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={t('namePh')}
            className="w-full p-4 mb-5 text-[22px] border-2 border-gray-300 rounded-2xl bg-gray-50 focus:bg-white"
          />
          <label htmlFor="familyPhone" className="block text-[22px] mb-2 font-bold text-gray-800">{t('phone')}</label>
          <input
            id="familyPhone"
            type="tel"
            inputMode="tel"
            value={familyPhone}
            onChange={(e) => setFamilyPhone(e.target.value)}
            placeholder="9876543210"
            className="w-full p-4 mb-6 text-[22px] border-2 border-gray-300 rounded-2xl bg-gray-50 focus:bg-white"
          />
          <button
            onClick={saveSettings}
            className="w-full bg-gray-900 text-white text-[24px] font-bold py-5 rounded-2xl active:bg-gray-700"
          >
            {t('save')}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5 flex-1 w-full mt-2">
        <button onClick={() => onNavigate('CAMERA')} className="w-full bg-blue-700 text-white rounded-[32px] py-12 shadow-lg flex flex-col items-center gap-3 active:scale-95 transition-transform">
          <span className="text-7xl" aria-hidden="true">📷</span>
          <span className="text-[32px] font-bold tracking-wide">{t('snap')}</span>
        </button>
        <button onClick={() => fileRef.current?.click()} className="w-full bg-emerald-700 text-white rounded-[32px] py-9 shadow-lg flex flex-col items-center gap-3 active:scale-95 transition-transform">
          <span className="text-6xl" aria-hidden="true">🖼️</span>
          <span className="text-[30px] font-bold tracking-wide">{t('upload')}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onFile} />
        <button onClick={() => onNavigate('PASTE')} className="w-full bg-purple-700 text-white rounded-[32px] py-9 shadow-lg flex flex-col items-center gap-3 active:scale-95 transition-transform">
          <span className="text-6xl" aria-hidden="true">💬</span>
          <span className="text-[30px] font-bold tracking-wide">{t('paste')}</span>
        </button>
      </div>

      <div className="mt-8">
        <p className="text-[18px] font-bold text-gray-700 mb-3">{t('samples')}</p>
        <div className="grid grid-cols-2 gap-3">
          {samples.map(([name, icon, key]) => (
            <button
              key={name}
              onClick={() => onNavigate('READING', { input: { sample: name } })}
              className="bg-white border-2 border-gray-300 rounded-2xl py-4 px-3 text-[19px] font-bold text-gray-800 active:bg-gray-100 min-h-[64px]"
            >
              <span aria-hidden="true">{icon} </span>{t(key)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-[15px] text-gray-600 mt-8 mb-2">{t('footer')}</p>
    </div>
  );
}
