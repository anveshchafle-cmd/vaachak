import { useState } from 'react';
import { makeT } from './i18n';

// The "digital content" path: a pasted SMS, WhatsApp forward or link becomes the same action card.
export default function Paste({ lang, onRead, onBack }) {
  const [value, setValue] = useState('');
  const t = makeT(lang);

  const fromClipboard = async () => {
    try {
      setValue(await navigator.clipboard.readText());
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col animate-fade-in">
      <button onClick={onBack} className="self-start text-[22px] font-bold text-gray-800 bg-white border-2 border-gray-300 rounded-2xl px-5 py-3 mb-6 active:bg-gray-100">
        ← {t('back')}
      </button>
      <label htmlFor="paste" className="text-[28px] font-extrabold text-gray-900 mb-4">{t('pasteTitle')}</label>
      <textarea
        id="paste"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('pastePh')}
        className="w-full min-h-[220px] p-4 text-[22px] border-2 border-gray-300 rounded-3xl bg-white focus:border-purple-700"
      />
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button onClick={fromClipboard} className="bg-white border-4 border-purple-700 text-purple-800 text-[24px] font-bold rounded-2xl py-5 active:bg-purple-50">
          {t('clip')}
        </button>
        <button
          onClick={() => value.trim() && onRead(value)}
          disabled={!value.trim()}
          className="bg-purple-700 text-white text-[24px] font-bold rounded-2xl py-5 active:bg-purple-800 disabled:opacity-50"
        >
          {t('read')}
        </button>
      </div>
    </div>
  );
}
