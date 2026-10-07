import { useEffect, useRef, useState } from 'react';
import { ask } from './api';
import { makeT } from './i18n';
import { speak, stopVoice, offlineClip } from './voice';
import { rememberBill } from './storage';

const BANNER = {
  SCAM: { cls: 'bg-red-700 animate-danger', icon: '🚨' },
  EXPIRED: { cls: 'bg-red-700 animate-danger', icon: '⛔' },
  URGENT: { cls: 'bg-orange-700', icon: '⏰' },
  BILL_SPIKE: { cls: 'bg-yellow-800', icon: '⚠️' },
  LOW_CONFIDENCE: { cls: 'bg-gray-700', icon: '🤔' },
};
const ROWS = [
  ['what', '📄'],
  ['action', '👉'],
  ['deadline', '📅'],
  ['amount', '₹'],
  ['warning', '⚠️'],
];

function Action({ icon, label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[88px] rounded-3xl border-2 text-[20px] font-bold flex flex-col items-center justify-center gap-1 px-2 active:scale-95 transition-transform ${
        primary ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-300 text-gray-900'
      }`}
    >
      <span className="text-[30px]" aria-hidden="true">{icon}</span>
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
    if (p.copyText) {
      try {
        await navigator.clipboard.writeText(p.copyText);
      } catch {}
      if (p.copiedText) speak(p.copiedText, lang);
    }
    if (p.officialUrl) window.open(p.officialUrl, '_blank', 'noopener');
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
        } catch {}
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-10 animate-fade-in" aria-live="polite">
      {flag && BANNER[flag] && (
        <div className={`${BANNER[flag].cls} text-white rounded-3xl p-5 mb-4 shadow-lg`} role="alert">
          <h2 className="text-[30px] font-extrabold leading-tight">
            <span aria-hidden="true">{BANNER[flag].icon} </span>{t(`b_${flag}`)}
          </h2>
          {flag !== 'LOW_CONFIDENCE' && card.fields.warning?.text && <p className="text-[21px] mt-2 leading-snug">{card.fields.warning.text}</p>}
          {flag === 'LOW_CONFIDENCE' && <p className="text-[21px] mt-2 leading-snug">{card.speak}</p>}
          {flag === 'SCAM' && card.scam.reasons.length > 0 && (
            <ul className="list-disc pl-6 mt-3 text-[19px] leading-snug space-y-1">
              {card.scam.reasons.map((r) => <li key={r.code}>{r.text}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {card.mode === 'offline' && card.offline?.note && (
          <span className="bg-gray-200 text-gray-800 rounded-full px-4 py-1 text-[16px] font-bold">📴 {card.offline.note}</span>
        )}
        {consensus?.label && (
          <span className={`rounded-full px-4 py-1 text-[16px] font-bold ${consensus.badge ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
            {consensus.label}
          </span>
        )}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-3xl px-5 py-2 shadow-sm">
        {ROWS.map(([key, icon]) => {
          const f = card.fields[key];
          if (!f?.text) return null;
          if (key === 'warning' && (flag === 'SCAM' || flag === 'EXPIRED')) return null;
          const canShow = Boolean(f.box && photoUrl);
          const Row = canShow ? 'button' : 'div';
          return (
            <Row
              key={key}
              onClick={canShow ? () => showWhere(f.box) : undefined}
              className="w-full text-left grid grid-cols-[44px_1fr] gap-3 py-4 border-b border-gray-200 last:border-b-0"
            >
              <span className="text-[30px] leading-tight" aria-hidden="true">{icon}</span>
              <span className="min-w-0">
                <span className="block text-[16px] font-bold text-gray-600">{t(key)}</span>
                <span className={`block font-extrabold text-gray-900 break-words ${key === 'amount' ? 'text-[44px] text-blue-800 leading-tight' : 'text-[24px] leading-snug'}`}>
                  {f.text}
                </span>
                <span className="flex flex-wrap gap-2 mt-1">
                  {f.source === 'rule' && <span className="bg-green-100 text-green-800 rounded-full px-3 py-0.5 text-[14px] font-bold">🛡️ {t('checked')}</span>}
                  {f.confidence < 0.6 && <span className="bg-red-100 text-red-800 rounded-full px-3 py-0.5 text-[14px] font-bold">{t('unclear')}</span>}
                  {canShow && <span className="bg-blue-100 text-blue-800 rounded-full px-3 py-0.5 text-[14px] font-bold">👁️ {t('where')}</span>}
                </span>
              </span>
            </Row>
          );
        })}
      </div>

      {card.pills && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[['☀️', card.pills.morning, 'morning'], ['🌤️', card.pills.noon, 'noon'], ['🌙', card.pills.night, 'night']].map(([icon, n, key]) => (
              <div key={key} className={`rounded-3xl py-3 ${n > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                <div className="text-[36px]" aria-hidden="true">{icon}</div>
                <div className="text-[40px] font-extrabold text-gray-900 leading-none">{n}</div>
                <div className="text-[16px] font-bold text-gray-700 mt-1">{t(key)}</div>
              </div>
            ))}
          </div>
          {card.pills.food !== 'any' && <p className="text-center text-[21px] font-bold text-gray-800 mt-3">🍽️ {t(card.pills.food)}</p>}
        </div>
      )}

      {card.checklist && (
        <div className="bg-white border-2 border-gray-200 rounded-3xl p-5 mt-4">
          <p className="text-[18px] font-bold text-gray-600 mb-2">{t('carry')}</p>
          <ul className="list-disc pl-6 text-[21px] space-y-1">
            {card.checklist.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      {photoUrl && (
        <div ref={photoRef} className="relative mt-4 rounded-3xl overflow-hidden border-2 border-gray-200">
          <img src={photoUrl} alt="" className="w-full block" />
          {box && (
            <div
              className="absolute border-4 border-amber-400 bg-amber-300/30 rounded-md transition-all"
              style={{ top: `${box[0] / 10}%`, left: `${box[1] / 10}%`, height: `${(box[2] - box[0]) / 10}%`, width: `${(box[3] - box[1]) / 10}%`, boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-5">
        <Action icon="🔊" label={t('listen')} onClick={listen} />
        {card.payment && <Action icon="💳" label={t('pay')} onClick={pay} primary />}
        <Action icon="👨‍👩‍👦" label={t('family')} onClick={sendFamily} />
        {card.actions?.calendarUrl && <Action icon="⏰" label={t('remind')} onClick={() => window.open(card.actions.calendarUrl, '_blank', 'noopener')} />}
      </div>

      {card.mode !== 'offline' && (
        <div className="bg-white border-2 border-gray-200 rounded-3xl p-4 mt-5">
          <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && question.trim() && sendQuestion({ question, card, lang })}
              placeholder={t('askPh')}
              aria-label={t('askPh')}
              className="flex-1 min-w-0 p-3 text-[20px] border-2 border-gray-300 rounded-2xl"
            />
            <button
              onClick={() => question.trim() && sendQuestion({ question, card, lang })}
              className="bg-gray-900 text-white text-[20px] font-bold rounded-2xl px-4 min-h-[56px]"
            >
              {t('askBtn')}
            </button>
          </div>
          <button
            onClick={toggleMic}
            className={`w-full mt-3 min-h-[64px] rounded-2xl text-[22px] font-bold border-2 ${recording ? 'bg-red-700 text-white border-red-700 animate-pulse' : 'bg-purple-50 text-purple-900 border-purple-300'}`}
          >
            🎤 {recording ? t('stop') : t('mic')}
          </button>
          {answer && <p className="text-[22px] font-bold text-gray-900 mt-4 leading-snug">{answer}</p>}
        </div>
      )}

      <button onClick={onAgain} className="w-full mt-6 min-h-[72px] bg-white border-4 border-gray-900 rounded-3xl text-[24px] font-extrabold text-gray-900 active:bg-gray-100">
        ↩️ {t('again')}
      </button>

      {confirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl p-6 w-full max-w-[400px] animate-fade-in">
            <p className="text-[26px] font-extrabold text-gray-900 leading-snug mb-6">{confirm}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={confirmPay} className="bg-green-700 text-white text-[26px] font-bold rounded-2xl py-5">{t('yes')}</button>
              <button onClick={() => setConfirm(null)} className="bg-white border-4 border-gray-400 text-gray-900 text-[26px] font-bold rounded-2xl py-5">{t('no')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
