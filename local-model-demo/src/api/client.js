import { Platform } from 'react-native';

const getBaseUrl = () => {
  // If running on Android Emulator, localhost is 10.0.2.2
  // For iOS Simulator or web, localhost works
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/v1';
  }
  return 'http://localhost:8000/v1';
};

export const sendMessage = async (messages) => {
  const url = `${getBaseUrl()}/chat/completions`;
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
