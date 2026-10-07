import { useState } from 'react';
import Home from './Home';
import Camera from './Camera';
import Reading from './Reading';

export default function App() {
  const [screen, setScreen] = useState('HOME');
  const [demoMode, setDemoMode] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [cardData, setCardData] = useState(null);

  const navigate = (newScreen, data = null) => {
    if (data?.photo) setPhoto(data.photo);
    if (data?.card) setCardData(data.card);
    setScreen(newScreen);
  };

  return (
    <div className="w-full max-w-[412px] mx-auto bg-gray-50 min-h-screen shadow-2xl relative overflow-hidden font-sans" style={{ fontFamily: '"Noto Sans Devanagari", sans-serif' }}>
      
      {demoMode && (
        <div className="absolute top-0 inset-x-0 bg-yellow-400 text-black text-center text-[14px] font-bold py-1 z-50">
          DEMO MODE ACTIVE (Wi-Fi OFF)
        </div>
      )}
      
      {screen === 'HOME' && (
        <Home 
          onNavigate={navigate} 
          demoMode={demoMode}
          onToggleDemo={() => setDemoMode(!demoMode)} 
        />
      )}
      
      {screen === 'CAMERA' && (
        <Camera 
          lang={localStorage.getItem('vaachak.lang') || 'mr'}
          onClose={() => navigate('HOME')}
          onCapture={(file) => navigate('READING', { photo: file })}
        />
      )}
      
      {screen === 'READING' && (
        <Reading 
          file={photo}
          isDemo={demoMode}
          onSuccess={(card) => navigate('CARD', { card })}
          onCancel={() => navigate('HOME')}
        />
      )}

      {/* Temporary Placeholder for the Hero Screen until we build Card.jsx */}
      {screen === 'CARD' && (
        <div className="p-4 pt-12">
           <button onClick={() => navigate('HOME')} className="mb-4 bg-gray-200 px-4 py-2 rounded-xl text-[22px] font-bold">
             Back to Home
           </button>
           <pre className="bg-white p-4 text-xs overflow-auto h-[600px] border-2 rounded-xl">
             {JSON.stringify(cardData, null, 2)}
           </pre>
        </div>
      )}
    </div>
  );
}