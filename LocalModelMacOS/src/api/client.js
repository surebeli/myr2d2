export const sendMessage = async (messages) => {
  // On macOS, localhost refers to the machine itself, so this works out of the box.
  const url = 'http://localhost:8000/v1/chat/completions';
  
  console.log('Sending request to:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model: 'local-model', // Model name often ignored by llama-cpp-python but required by schema
        stream: false,
      }),
    });
    
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error: ${response.status} ${text}`);
    }

    const data = await response.json();
    return data.choices[0].message;
  } catch (error) {
    console.error('API Connection Error:', error);
    throw error;
  }
};

const SPEECH_BASE_URL = 'http://127.0.0.1:8765';

export const speechassistantHealth = async () => {
  const res = await fetch(`${SPEECH_BASE_URL}/health`);
  return res.status === 200;
};

export const speechassistantGetState = async () => {
  const res = await fetch(`${SPEECH_BASE_URL}/state`);
  if (!res.ok) throw new Error(`state ${res.status}`);
  return await res.json();
};

export const speechassistantGetConfig = async () => {
  const res = await fetch(`${SPEECH_BASE_URL}/config`);
  if (!res.ok) throw new Error(`config ${res.status}`);
  return await res.json();
};

export const speechassistantSetConfig = async (cfg) => {
  const res = await fetch(`${SPEECH_BASE_URL}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  if (!res.ok) throw new Error(`set config ${res.status}`);
  return await res.json();
};

export const speechassistantStartListening = async () => {
  const res = await fetch(`${SPEECH_BASE_URL}/listening/start`, { method: 'POST' });
  if (!res.ok) throw new Error(`start listening ${res.status}`);
  return await res.json();
};

export const speechassistantStopListening = async () => {
  const res = await fetch(`${SPEECH_BASE_URL}/listening/stop`, { method: 'POST' });
  if (!res.ok) throw new Error(`stop listening ${res.status}`);
  return await res.json();
};
