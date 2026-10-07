import { useEffect, useState } from 'react';
import Tesseract from 'tesseract.js';
import { read } from './api';
import { offlineRead } from '../../lib/offline.js';

const sampleFiles = import.meta.glob('./samples/*.json', { eager: true });
const sampleKeys = Object.keys(sampleFiles);

export default function Reading({ file, isDemo, onSuccess, onCancel }) {
  const [status, setStatus] = useState('फोटो स्कॅन करत आहे...'); 

  useEffect(() => {
    let isMounted = true;
    
    async function processImage() {
      const lang = localStorage.getItem('vaachak.lang') || 'mr';
      const history = JSON.parse(localStorage.getItem('vaachak.history') || '{}');
      const familyPhone = localStorage.getItem('vaachak.familyPhone');
      const userName = localStorage.getItem('vaachak.userName');

      if (isDemo && sampleKeys.length > 0) {
        setStatus('डेमो मोड लोड करत आहे...');
        const randomKey = sampleKeys[Math.floor(Math.random() * sampleKeys.length)];
        const sampleCard = sampleFiles[randomKey].default || sampleFiles[randomKey];
        setTimeout(() => {
          if (isMounted) onSuccess(sampleCard);
        }, 1200);
        return;
      }

      let edgeText = '';
      try {
        const { data: { text } } = await Tesseract.recognize(file, 'eng');
        edgeText = text;
        
        if (!isMounted) return;
        setStatus('वाचत आहे…');

        const card = await read(file, lang, history, familyPhone, userName, edgeText);
        if (isMounted) onSuccess(card);

      } catch (err) {
        if (!isMounted) return;
        const offlineCard = offlineRead(edgeText, { lang, history, userName });
        offlineCard.mode = 'offline';
        offlineCard.offline = { note: 'इंटरनेट बंद आहे. ऑफलाइन मोड.' }; 
        onSuccess(offlineCard);
      }
    }

    processImage();

    return () => { isMounted = false; };
  }, [file, isDemo, onSuccess]);

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col items-center justify-center p-8 text-center font-sans">
      <div className="relative w-32 h-32 mb-10">
        <div className="absolute inset-0 border-[10px] border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-[10px] border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-4xl">👀</div>
      </div>
      <h2 className="text-[36px] font-bold text-gray-900 animate-pulse tracking-wide">{status}</h2>
      <p className="text-[22px] text-gray-500 mt-4 max-w-[80%]">कृपया थांबा, यात थोडा वेळ लागू शकतो...</p>
      <button onClick={onCancel} className="mt-16 text-[24px] font-bold text-gray-700 bg-white border-4 border-gray-300 px-10 py-5 rounded-full shadow-md active:bg-gray-100 active:scale-95 transition-transform">
        रद्द करा (Cancel)
      </button>
    </div>
  );
}