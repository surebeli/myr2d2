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
