import { useEffect, useRef, useState } from 'react';
import { ask } from './api';
import { makeT } from './i18n';
import { speak, stopVoice, offlineClip } from './voice';
import { rememberBill } from './storage';
import Icon from './Icons';

// Severity decides the colour of the verdict slab.
const VERDICT = {
  SCAM: { slab: 'bg-postred text-paper', shake: true },
  EXPIRED: { slab: 'bg-postred text-paper', shake: true },
  URGENT: { slab: 'bg-turmeric text-ink' },
  BILL_SPIKE: { slab: 'bg-turmeric text-ink' },
  LOW_CONFIDENCE: { slab: 'bg-ink text-paper' },
};
const ROWS = ['what', 'action', 'deadline', 'amount', 'warning'];

function Action({ icon, label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className={`press min-h-[96px] rounded-[22px] flex flex-col items-start justify-between gap-2 p-4 text-left text-[20px] font-bold leading-tight ${
        primary ? 'bg-leaf text-paper' : 'bg-paper text-ink border-2 border-ink'
      }`}
    >
      <Icon name={icon} size={34} className={primary ? '' : 'text-stamp'} />
      {label}
    </button>
  );
}

export default function Card({ card, lang, photoUrl, photoBlob, onAgain }) {
  const t = makeT(lang);
  const flag = card.flags[0];
  const [box, setBox] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const photoRef = useRef(null);

  // On arrival: remember the bill amount, buzz for danger, and read the card aloud.
  useEffect(() => {
    rememberBill(card);
    if (card.alert?.vibrate) navigator.vibrate?.(card.alert.vibrate);
    const clip = card.mode === 'offline' || !photoUrl ? offlineClip(card, lang) : null;
    speak(card.speak, lang, clip);
    return () => stopVoice();
  }, [card, lang, photoUrl]);

  const listen = () => speak(card.speak, lang, offlineClip(card, lang));

  const showWhere = (b) => {
    setBox(b);
    setTimeout(() => photoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const pay = () => {
    setConfirm(card.payment.confirmText);
    speak(card.payment.confirmText, lang);
  };
  const confirmPay = async () => {
    const p = card.payment;
    setConfirm(null);
    if (p.upiUrl) {
      location.href = p.upiUrl;
      return;
    }
    // No await before window.open: iPhone Safari blocks a new tab that isn't opened right in the tap.
    if (p.copyText) navigator.clipboard?.writeText(p.copyText).catch(() => {});
    if (p.officialUrl) window.open(p.officialUrl, '_blank', 'noopener');
    if (p.copyText && p.copiedText) speak(p.copiedText, lang);
  };

  // Photo + summary through the phone's share sheet (WhatsApp); a wa.me link when files can't be shared.
  const sendFamily = async () => {
    const text = card.actions.whatsappText;
    if (photoBlob && navigator.canShare) {
      const file = new File([photoBlob], photoBlob.type === 'application/pdf' ? 'document.pdf' : 'document.jpg', { type: photoBlob.type || 'image/jpeg' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch (e) {
          if (e?.name === 'AbortError') return; // they closed the share sheet
        }
      }
    }
    window.open(card.actions.whatsappUrl, '_blank', 'noopener');
  };

  const sendQuestion = async (payload, isAudio) => {
    setAnswer('…');
    try {
      const res = await ask(payload, isAudio);
      setAnswer(res.answer);
      speak(res.speak, lang);
    } catch {
      setAnswer(t('error'));
    }
  };

  const toggleMic = async () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        recorderRef.current = null;
        setRecording(false);
        const audio = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        sendQuestion({ audio, card: JSON.stringify(card), lang }, true);
      };
      stopVoice();
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setAnswer(t('listening'));
      setTimeout(() => recorderRef.current === rec && rec.stop(), 20000);
    } catch {
      setAnswer(t('error'));
    }
  };

  const consensus = card.consensus;

  const verdict = flag && VERDICT[flag];

  return (
    <div className="inland min-h-screen px-4 pt-5 pb-10" aria-live="polite">
      {verdict && (
        <section className={`${verdict.slab} rounded-[26px] px-5 pt-6 pb-5 mb-5 ${verdict.shake ? 'shake' : ''}`} role="alert">
          <h2 className="thump stamp text-[40px] origin-left">{t(`b_${flag}`)}</h2>
          {flag !== 'LOW_CONFIDENCE' && card.fields.warning?.text && <p className="text-[22px] font-bold mt-4 leading-snug">{card.fields.warning.text}</p>}
          {flag === 'LOW_CONFIDENCE' && <p className="text-[22px] font-bold mt-4 leading-snug">{card.speak}</p>}
          {flag === 'SCAM' && card.scam.reasons.length > 0 && (
            <ul className="mt-3 space-y-2 text-[19px] leading-snug">
              {card.scam.reasons.map((r) => (
                <li key={r.code} className="flex gap-2"><span aria-hidden="true">✗</span><span>{r.text}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(card.mode === 'offline' || consensus?.label) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {card.mode === 'offline' && card.offline?.note && (
            <span className="bg-ink text-paper rounded-full px-4 py-1 text-[16px] font-bold">{card.offline.note}</span>
          )}
          {consensus?.label && (
            <span className={`rounded-full px-4 py-1 text-[16px] font-bold ${consensus.badge ? 'bg-leaf text-paper' : 'bg-turmeric text-ink'}`}>
              {consensus.label}
            </span>
          )}
        </div>
      )}

      <article className="slip px-5 pb-2">
        {ROWS.map((key) => {
          const f = card.fields[key];
          if (!f?.text) return null;
          if (key === 'warning' && (flag === 'SCAM' || flag === 'EXPIRED')) return null;
          const canShow = Boolean(f.box && photoUrl);
          const Row = canShow ? 'button' : 'div';
          return (
            <Row
              key={key}
              onClick={canShow ? () => showWhere(f.box) : undefined}
              className="block w-full text-left py-4 border-b-2 border-dashed border-ink/15 last:border-b-0"
            >
              <span className="block text-[17px] font-medium text-ink-soft">{t(key)}</span>
              {key === 'amount' ? (
                <span className="block font-display text-[56px] leading-none text-stamp mt-1">{f.text}</span>
              ) : (
                <span className="block text-[25px] font-bold leading-snug break-words">{f.text}</span>
              )}
              {(f.source === 'rule' || f.confidence < 0.6 || canShow) && (
                <span className="flex flex-wrap items-center gap-3 mt-2">
                  {f.source === 'rule' && <span className="stamp stamp-sm text-leaf">{t('checked')}</span>}
                  {f.confidence < 0.6 && <span className="stamp stamp-sm text-postred">{t('unclear')}</span>}
                  {canShow && (
                    <span className="inline-flex items-center gap-1 text-[16px] font-bold text-stamp underline underline-offset-4">
                      <Icon name="eye" size={20} /> {t('where')}
                    </span>
                  )}
                </span>
              )}
            </Row>
          );
        })}
      </article>

      {card.medicines && (
        <section className="mt-5 space-y-3">
          {card.medicines.map((m, i) => (
            <div key={`${m.name}-${i}`} className="bg-ink rounded-[22px] p-3 text-paper">
              <p className="font-display text-[24px] leading-tight px-1 break-words">{m.name}</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[['sun', m.morning, 'morning'], ['noon', m.noon, 'noon'], ['moon', m.night, 'night']].map(([icon, n, key]) => (
                  <div key={key} className={`rounded-2xl py-2 flex flex-col items-center ${n > 0 ? 'bg-turmeric text-ink' : 'bg-ink-soft/60 text-paper/70'}`}>
                    <Icon name={icon} size={28} />
                    <span className="font-display text-[36px] leading-none mt-1">{n}</span>
                    <span className="text-[16px] font-bold">{t(key)}</span>
                  </div>
                ))}
              </div>
              {m.food !== 'any' && (
                <p className="flex items-center gap-2 text-[19px] font-bold mt-2 px-1">
                  <Icon name="plate" size={26} className="text-turmeric" /> {t(m.food)}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {card.pills && (
        <section className="mt-5">
          <div className="grid grid-cols-3 gap-2 bg-ink p-2 rounded-[22px]">
            {[['sun', card.pills.morning, 'morning'], ['noon', card.pills.noon, 'noon'], ['moon', card.pills.night, 'night']].map(([icon, n, key]) => (
              <div key={key} className={`rounded-2xl py-3 flex flex-col items-center ${n > 0 ? 'bg-turmeric text-ink' : 'bg-ink-soft/60 text-paper/70'}`}>
                <Icon name={icon} size={34} />
                <span className="font-display text-[46px] leading-none mt-1">{n}</span>
                <span className="text-[17px] font-bold">{t(key)}</span>
              </div>
            ))}
          </div>
          {card.pills.food !== 'any' && (
            <p className="flex items-center gap-2 text-[22px] font-bold mt-3">
              <Icon name="plate" size={30} className="text-stamp" /> {t(card.pills.food)}
            </p>
          )}
        </section>
      )}

      {card.checklist && (
        <section className="slip px-5 pb-4 mt-5">
          <h3 className="font-display text-[24px] mt-2 mb-2">{t('carry')}</h3>
          <ul className="space-y-2 text-[21px]">
            {card.checklist.map((item) => (
              <li key={item} className="flex gap-3 items-start">
                <span className="mt-1 w-6 h-6 shrink-0 rounded border-[3px] border-ink" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {photoUrl && (
        <div ref={photoRef} className="relative mt-5 rounded-[18px] overflow-hidden border-4 border-paper shadow-lg">
          <img src={photoUrl} alt="" className="w-full block" />
          {box && (
            <div
              className="absolute border-4 border-turmeric rounded-md transition-all"
              style={{ top: `${box[0] / 10}%`, left: `${box[1] / 10}%`, height: `${(box[2] - box[0]) / 10}%`, width: `${(box[3] - box[1]) / 10}%`, boxShadow: '0 0 0 9999px rgba(20,33,61,.5)' }}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Action icon="speaker" label={t('listen')} onClick={listen} />
        {card.payment && <Action icon="pay" label={t('pay')} onClick={pay} primary />}
        <Action icon="family" label={t('family')} onClick={sendFamily} />
        {card.actions?.calendarUrl && <Action icon="alarm" label={t('remind')} onClick={() => window.open(card.actions.calendarUrl, '_blank', 'noopener')} />}
      </div>

      {card.mode !== 'offline' && (
        <section className="mt-6 bg-stamp rounded-[26px] p-4 text-paper">
          <button
            onClick={toggleMic}
            className={`w-full min-h-[76px] rounded-[20px] text-[24px] font-bold flex items-center justify-center gap-3 ${recording ? 'bg-postred animate-pulse' : 'bg-paper text-stamp'}`}
          >
            <Icon name="mic" size={32} /> {recording ? t('stop') : t('mic')}
          </button>
          <div className="flex gap-2 mt-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && question.trim() && sendQuestion({ question, card, lang })}
              placeholder={t('askPh')}
              aria-label={t('askPh')}
              className="flex-1 min-w-0 px-4 py-3 text-[19px] rounded-2xl bg-paper/15 text-paper placeholder:text-paper/70 border-2 border-paper/30 focus:border-paper outline-none"
            />
            <button
              onClick={() => question.trim() && sendQuestion({ question, card, lang })}
              className="bg-turmeric text-ink text-[19px] font-bold rounded-2xl px-4 min-h-[56px]"
            >
              {t('askBtn')}
            </button>
          </div>
          {answer && <p className="text-[22px] font-bold mt-4 leading-snug">{answer}</p>}
        </section>
      )}

      <button onClick={onAgain} className="w-full mt-7 min-h-[68px] rounded-full border-[3px] border-ink text-[22px] font-bold flex items-center justify-center gap-2 active:bg-paper">
        <Icon name="back" size={26} /> {t('again')}
      </button>

      {confirm && (
        <div className="fixed inset-0 bg-ink/70 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="slip px-6 pb-6 w-full max-w-[400px] animate-fade-in">
            <p className="font-display text-[28px] leading-snug mb-6 mt-3">{confirm}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={confirmPay} className="press bg-leaf text-paper text-[26px] font-bold rounded-2xl py-5">{t('yes')}</button>
              <button onClick={() => setConfirm(null)} className="press bg-paper border-[3px] border-ink text-ink text-[26px] font-bold rounded-2xl py-5">{t('no')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
