const API = import.meta.env.VITE_API_URL ?? '';

async function processImage(file, maxSize = 1600) {
  if (!file.type.startsWith('image/')) return file; 

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
          'image/jpeg',
          0.8 
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(id);
  return response;
}

export async function read(file, lang, history, familyPhone, userName, edgeText) {
  const processedFile = await processImage(file);
  const formData = new FormData();
  
  formData.append('file', processedFile);
  formData.append('lang', lang);
  formData.append('history', JSON.stringify(history || {}));
  
  if (familyPhone) formData.append('familyPhone', familyPhone);
  if (userName) formData.append('userName', userName);
  if (edgeText) formData.append('edgeText', edgeText);

  try {
    const res = await fetchWithTimeout(`${API}/api/read`, {
      method: 'POST',
      body: formData,
      timeout: 25000
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw { code: errorData.code || res.status, error: errorData.error };
    }
    return await res.json();
  } catch (err) {
    throw err.name === 'AbortError' ? { code: 'TIMEOUT' } : err;
  }
}

export async function ask(payload, isAudio = false) {
  const options = { method: 'POST' };
  
  if (isAudio) {
    const formData = new FormData();
    formData.append('audio', payload.audio);
    formData.append('card', payload.card);
    formData.append('lang', payload.lang);
    options.body = formData;
  } else {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  }
  
  const res = await fetch(`${API}/api/ask`, options);
  if (!res.ok) throw new Error('Ask API failed');
  return res.json();
}

export async function tts(text, lang) {
  const res = await fetch(`${API}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang })
  });
  
  if (!res.ok) throw new Error('TTS API failed');
  return res.blob();
}