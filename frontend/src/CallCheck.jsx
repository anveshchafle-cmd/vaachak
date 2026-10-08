import { useEffect, useRef, useState } from 'react';
import { makeT } from './i18n';
import { listen } from './listen';
import { speak, stopVoice } from './voice';
import Icon from './Icons';

// "Is this call a scam?": the person says (or types) what a caller told them, and gets the same
// action card: a red fraud card with 1930 for digital-arrest, OTP, lottery-fee and "safe account"
// calls, or the two golden rules when nothing is clearly wrong.
export default function CallCheck({ lang, onRead, onBack }) {
  const t = makeT(lang);
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState('');
  const session = useRef(null);

  // Say what to do, for people who cannot read the screen.
  useEffect(() => {
    speak(t('ccHint'), lang);
    return () => {
      stopVoice();
      session.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const check = (text) => {
    const v = (text ?? value).trim();
    if (v) onRead({ text: v, kind: 'call' });
  };

  const toggleMic = async () => {
    if (session.current) {
      session.current.stop();
      return;
    }
    stopVoice();
    setNote(t('listening'));
    const s = listen({ lang, onWords: setValue });
    session.current = s;
    setListening(true);
    try {
      const { text, audio } = await s.result;
      if (text) {
        setValue(text);
        check(text);
      } else if (audio?.size > 2000) onRead({ audio, kind: 'call' });
      else setNote(t('notHeard'));
    } catch {
      setNote(t('error'));
    } finally {
      session.current = null;
      setListening(false);
    }
  };

  return (
    <div className="inland min-h-screen px-5 pt-5 pb-8 flex flex-col">
      <button onClick={onBack} className="self-start flex items-center gap-1 text-[21px] font-bold text-ink border-[3px] border-ink rounded-full pl-3 pr-5 py-2 mb-6 active:bg-paper">
        <Icon name="back" size={24} /> {t('back')}
      </button>
      <h1 className="font-display text-[36px] text-postred leading-tight">{t('ccTitle')}</h1>
      <p className="text-[21px] text-ink-soft leading-snug mt-2">{t('ccHint')}</p>

      <button
        onClick={toggleMic}
        className={`press w-full mt-6 rounded-[28px] px-6 py-7 flex items-center gap-5 text-left text-paper ${listening ? 'bg-ink animate-pulse' : 'bg-postred'}`}
      >
        <span className="w-20 h-20 shrink-0 rounded-full bg-paper/15 grid place-items-center">
          <Icon name="mic" size={46} />
        </span>
        <span className="font-display text-[34px] leading-tight">{listening ? t('stop') : t('ccSpeak')}</span>
      </button>
      {note && listening && <p role="status" className="text-[20px] font-bold text-stamp mt-3">{note}</p>}
      {note && !listening && note !== t('listening') && <p role="alert" className="text-[20px] font-bold text-postred mt-3">{note}</p>}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('ccPh')}
        aria-label={t('ccTitle')}
        className="slip w-full min-h-[150px] mt-5 px-5 pb-4 text-[22px] leading-relaxed outline-none focus:ring-4 focus:ring-stamp/40"
      />
      <button
        onClick={() => check()}
        disabled={!value.trim() || listening}
        className="press w-full mt-4 bg-stamp text-paper text-[24px] font-bold rounded-2xl py-5 disabled:opacity-50"
      >
        {t('ccCheck')}
      </button>

      <h2 className="font-display text-[22px] text-ink mt-8 mb-3">{t('ccTry')}</h2>
      <div className="space-y-3">
        {t('ccEx').map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setValue(ex);
              check(ex);
            }}
            className="slip w-full px-4 pb-3 flex items-start gap-3 text-left text-[18px] font-medium leading-snug active:translate-y-0.5"
          >
            <Icon name="phone" size={26} className="text-postred shrink-0 mt-1" />
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
