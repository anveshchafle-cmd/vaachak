import { useState, useEffect, useRef } from 'react';

export default function Home({ onNavigate, demoMode, onToggleDemo }) {
  const [lang, setLang] = useState(localStorage.getItem('vaachak.lang') || 'mr');
  const [userName, setUserName] = useState(localStorage.getItem('vaachak.userName') || '');
  const [familyPhone, setFamilyPhone] = useState(localStorage.getItem('vaachak.familyPhone') || '');
  const [showSettings, setShowSettings] = useState(false);
  
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('vaachak.lang', lang);
  }, [lang]);

  const saveSettings = () => {
    localStorage.setItem('vaachak.userName', userName);
    localStorage.setItem('vaachak.familyPhone', familyPhone);
    setShowSettings(false);
  };

  const getLabel = (mr, hi, en) => {
    if (lang === 'mr') return mr;
    if (lang === 'hi') return hi;
    return en;
  };

  const startPress = () => {
    timerRef.current = setTimeout(() => {
      onToggleDemo();
      navigator.vibrate?.([200, 100, 200]); 
    }, 1500); 
  };
  const endPress = () => clearTimeout(timerRef.current);

  return (
    <div className={`min-h-screen ${demoMode ? 'bg-yellow-50' : 'bg-gray-50'} flex flex-col p-4 w-full mx-auto`}>
      
      <div className={`flex justify-between items-center mb-8 w-full ${demoMode ? 'mt-6' : ''}`}>
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
            onChange={(e) => setLang(e.target.value)}
            className="text-[22px] px-3 py-2 bg-white border-2 border-gray-300 rounded-xl font-bold text-gray-800"
          >
            <option value="mr">मराठी</option>
            <option value="hi">हिंदी</option>
            <option value="en">ENG</option>
          </select>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-[28px] w-14 h-14 bg-white border-2 border-gray-300 rounded-xl flex items-center justify-center active:bg-gray-100"
          >
            ⚙️
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="bg-white p-5 rounded-3xl shadow-xl border-2 border-gray-200 mb-8 animate-fade-in">
          <label className="block text-[22px] mb-2 font-bold text-gray-800">
            {getLabel('तुमचे नाव', 'आपका नाम', 'Your Name')}
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={getLabel('उदा. प्रकाश काका', 'उदा. प्रकाश काका', 'e.g. Prakash Kaka')}
            className="w-full p-4 mb-5 text-[22px] border-2 border-gray-300 rounded-2xl bg-gray-50 focus:bg-white"
          />
          <label className="block text-[22px] mb-2 font-bold text-gray-800">
            {getLabel('घरातील नंबर', 'घर का नंबर', 'Family WhatsApp')}
          </label>
          <input
            type="tel"
            value={familyPhone}
            onChange={(e) => setFamilyPhone(e.target.value)}
            placeholder="9876543210"
            className="w-full p-4 mb-6 text-[22px] border-2 border-gray-300 rounded-2xl bg-gray-50 focus:bg-white"
          />
          <button
            onClick={saveSettings}
            className="w-full bg-gray-900 text-white text-[24px] font-bold py-5 rounded-2xl active:bg-gray-700"
          >
            {getLabel('सेव्ह करा', 'सेव करें', 'Save')}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5 flex-1 w-full mt-2">
        <button onClick={() => onNavigate('CAMERA')} className="w-full bg-blue-600 text-white rounded-[32px] py-14 shadow-lg flex flex-col items-center gap-4 active:scale-95 transition-transform">
          <span className="text-7xl">📷</span>
          <span className="text-[32px] font-bold tracking-wide">{getLabel('फोटो काढा', 'फोटो लें', 'SNAP')}</span>
        </button>
        <button onClick={() => onNavigate('UPLOAD')} className="w-full bg-emerald-600 text-white rounded-[32px] py-14 shadow-lg flex flex-col items-center gap-4 active:scale-95 transition-transform">
          <span className="text-7xl">🖼️</span>
          <span className="text-[32px] font-bold tracking-wide">{getLabel('गॅलरी', 'गैलरी', 'UPLOAD')}</span>
        </button>
        <button onClick={() => onNavigate('ASK_VOICE')} className="w-full bg-purple-600 text-white rounded-[32px] py-14 shadow-lg flex flex-col items-center gap-4 active:scale-95 transition-transform">
          <span className="text-7xl">🎤</span>
          <span className="text-[32px] font-bold tracking-wide">{getLabel('प्रश्न विचारा', 'सवाल पूछें', 'ASK')}</span>
        </button>
      </div>
    </div>
  );
}