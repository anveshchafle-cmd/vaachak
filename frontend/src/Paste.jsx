import { useState } from 'react';
import { makeT } from './i18n';
import Icon from './Icons';

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
    <div className="inland min-h-screen px-5 pt-5 pb-8 flex flex-col">
      <button onClick={onBack} className="self-start flex items-center gap-1 text-[21px] font-bold text-ink border-[3px] border-ink rounded-full pl-3 pr-5 py-2 mb-6 active:bg-paper">
        <Icon name="back" size={24} /> {t('back')}
      </button>
      <label htmlFor="paste" className="font-display text-[34px] text-stamp leading-tight mb-4">{t('pasteTitle')}</label>
      <textarea
        id="paste"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('pastePh')}
        className="slip w-full min-h-[240px] px-5 pb-4 text-[22px] leading-relaxed outline-none focus:ring-4 focus:ring-stamp/40"
      />
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button onClick={fromClipboard} className="press flex items-center justify-center gap-2 bg-paper border-2 border-ink text-ink text-[22px] font-bold rounded-2xl py-5">
          <Icon name="paste" size={28} className="text-stamp" /> {t('clip').replace('📋 ', '')}
        </button>
        <button
          onClick={() => value.trim() && onRead(value)}
          disabled={!value.trim()}
          className="press bg-stamp text-paper text-[24px] font-bold rounded-2xl py-5 disabled:opacity-50"
        >
          {t('read')}
        </button>
      </div>
    </div>
  );
}
