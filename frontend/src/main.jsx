import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { unlockAudio } from './voice';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// First tap anywhere unlocks audio, so the card can read itself aloud on iPhone too.
addEventListener('touchend', unlockAudio, { capture: true });
addEventListener('click', unlockAudio, { capture: true });

// Service worker makes Vaachak installable, which enables "Share to Vaachak" from other apps.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
