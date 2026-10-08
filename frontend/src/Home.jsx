import { useState, useEffect, useRef } from 'react';
import { makeT } from './i18n';
import { load, save } from './storage';
import Icon from './Icons';
import { loadPapers, removePaper, upcoming, scamsCaught } from './papers';
import { warmApi } from './api';

const LANGS = [['mr', 'मराठी'], ['hi', 'हिंदी'], ['en', 'Eng']];

export default function Home({ lang, onLang, onNavigate, demoMode, onToggleDemo, onTour }) {
  const [papers, setPapers] = useState(loadPapers);
  const due = upcoming(papers);
  const caught = scamsCaught(papers);
  const [userName, setUserName] = useState(load('vaachak.userName', ''));
  const [familyPhone, setFamilyPhone] = useState(load('vaachak.familyPhone', ''));
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef(null);
  const timerRef = useRef(null);
  const t = makeT(lang);

  // Wake the reader and voice on the server while the person decides what to show.
  useEffect(() => warmApi('read', 'tts'), []);

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
    ['electricity-bill', 'bolt', 'sBill', 'text-turmeric'],
    ['medicine-expired', 'pill', 'sMed', 'text-postred'],
    ['scam-sms', 'alert', 'sScam', 'text-postred'],
    ['prescription', 'note', 'sRx', 'text-leaf'],
  ];

  return (
    <div className={`inland min-h-screen flex flex-col px-5 pb-6 ${demoMode ? 'pt-10' : 'pt-6'}`}>
      <header className="flex items-start justify-between gap-3">
        <h1
          className="font-display text-[64px] leading-[1.05] text-stamp select-none"
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
        >
          वाचक
        </h1>
        <div className="flex gap-2">
        <button
          id="tour-help"
          onClick={onTour}
          aria-label={t('help')}
          className="mt-3 w-14 h-14 rounded-full bg-paper text-ink grid place-items-center border-2 border-ink/15 active:bg-stamp-soft"
        >
          <Icon name="help" size={30} />
        </button>
        <button
          id="tour-settings"
          onClick={() => setShowSettings(!showSettings)}
          aria-label={t('settings')}
          aria-expanded={showSettings}
          className="mt-3 w-14 h-14 rounded-full bg-paper text-ink grid place-items-center border-2 border-ink/15 active:bg-stamp-soft"
        >
          <Icon name="gear" size={28} />
        </button>
        </div>
      </header>

      <p className="text-[21px] leading-snug text-ink-soft mt-1 max-w-[30ch]">{t('tagline')}</p>

      <div id="tour-lang" role="radiogroup" aria-label="भाषा / Language" className="flex gap-2 mt-5">
        {LANGS.map(([code, label]) => (
          <button
            key={code}
            role="radio"
            aria-checked={lang === code}
            onClick={() => onLang(code)}
            className={`flex-1 min-h-[52px] rounded-full text-[20px] font-bold border-2 ${
              lang === code ? 'bg-stamp text-paper border-stamp' : 'bg-paper/70 text-ink border-ink/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showSettings && (
        <div className="slip mt-5 px-5 pb-5 animate-fade-in">
          <label htmlFor="userName" className="block text-[20px] font-bold mb-1 mt-2">{t('name')}</label>
          <input
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={t('namePh')}
            className="w-full px-4 py-3 mb-4 text-[22px] border-b-4 border-ink/25 bg-inland/40 rounded-t-lg focus:border-stamp outline-none"
          />
          <label htmlFor="familyPhone" className="block text-[20px] font-bold mb-1">{t('phone')}</label>
          <input
            id="familyPhone"
            type="tel"
            inputMode="tel"
            value={familyPhone}
            onChange={(e) => setFamilyPhone(e.target.value)}
            placeholder="9876543210"
            className="w-full px-4 py-3 mb-5 text-[22px] border-b-4 border-ink/25 bg-inland/40 rounded-t-lg focus:border-stamp outline-none"
          />
          <button onClick={saveSettings} className="press w-full bg-stamp text-paper text-[22px] font-bold py-4 rounded-2xl">
            {t('save')}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 mt-7">
        <button
          id="tour-snap"
          onClick={() => onNavigate('CAMERA')}
          className="press w-full bg-stamp text-paper rounded-[28px] px-6 py-8 flex items-center gap-5 text-left"
        >
          <span className="w-20 h-20 shrink-0 rounded-full bg-paper/15 grid place-items-center">
            <Icon name="camera" size={46} />
          </span>
          <span className="font-display text-[38px] leading-tight">{t('snap')}</span>
        </button>

        <button
          id="tour-call"
          onClick={() => onNavigate('CALL')}
          className="press w-full bg-postred text-paper rounded-[28px] px-6 py-6 flex items-center gap-5 text-left"
        >
          <span className="w-16 h-16 shrink-0 rounded-full bg-paper/15 grid place-items-center">
            <Icon name="phone" size={38} />
          </span>
          <span>
            <span className="block font-display text-[30px] leading-tight">{t('callCheck')}</span>
            <span className="block text-[18px] font-bold mt-1 leading-snug">{t('callCheckSub')}</span>
          </span>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button
            id="tour-upload"
            onClick={() => fileRef.current?.click()}
            className="press bg-paper text-ink rounded-[24px] p-5 min-h-[150px] flex flex-col justify-between text-left border-2 border-ink"
          >
            <Icon name="file" size={40} className="text-stamp" />
            <span className="text-[22px] font-bold leading-tight">{t('upload')}</span>
          </button>
          <button
            id="tour-paste"
            onClick={() => onNavigate('PASTE')}
            className="press bg-paper text-ink rounded-[24px] p-5 min-h-[150px] flex flex-col justify-between text-left border-2 border-ink"
          >
            <Icon name="chat" size={40} className="text-stamp" />
            <span className="text-[22px] font-bold leading-tight">{t('paste')}</span>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onFile} />
      </div>

      <section id="tour-papers" className="mt-9" aria-labelledby="papers-h">
        <h2 id="papers-h" className="font-display text-[26px] text-ink mb-3">{t('papers')}</h2>
        {caught > 0 && (
          <p className="flex items-center gap-2 bg-leaf text-paper rounded-2xl px-4 py-3 mb-3 text-[19px] font-bold">
            <Icon name="shield" size={28} /> {t('scamsBlocked')(caught)}
          </p>
        )}
        {due.length === 0 ? (
          <p className="text-[19px] text-ink-soft leading-snug">{t('papersEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {due.slice(0, 5).map(({ paper, kind, days, amount }) => {
              const tone = days < 0 ? 'bg-postred text-paper' : days <= 3 ? 'bg-turmeric text-ink' : 'bg-paper text-ink';
              return (
                <li key={paper.id} className={`${tone} rounded-[20px] flex items-stretch border-2 border-ink/10`}>
                  <button onClick={() => onNavigate('CARD', { card: paper.card, fromPapers: true })} className="flex-1 min-w-0 flex items-center gap-3 p-4 text-left">
                    <Icon name={kind === 'course' || /medicine|prescription/.test(paper.card.docType) ? 'pill' : /bill/.test(paper.card.docType) ? 'bolt' : 'note'} size={32} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[19px] font-bold leading-snug break-words">{paper.card.fields.what.text}</span>
                      <span className="block text-[17px] font-medium mt-0.5">
                        {kind === 'course' ? t('courseLeft')(days) : t('daysLeft')(days)}{amount ? ` · ${amount}` : ''}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => { removePaper(paper.id); setPapers(loadPapers()); }}
                    aria-label={t('remove')}
                    className="px-4 text-[28px] leading-none opacity-70"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="tour-samples" className="mt-9" aria-labelledby="samples-h">
        <h2 id="samples-h" className="font-display text-[26px] text-ink mb-3">{t('samples')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {samples.map(([name, icon, key, tone]) => (
            <button
              key={name}
              onClick={() => onNavigate('READING', { input: { sample: name } })}
              className="slip min-h-[72px] px-4 pb-3 flex items-center gap-3 text-left active:translate-y-0.5"
            >
              <Icon name={icon} size={30} className={tone} />
              <span className="text-[19px] font-bold leading-tight">{t(key)}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="font-display text-[19px] text-stamp mt-auto pt-10 leading-snug">{t('footer')}</p>
    </div>
  );
}
