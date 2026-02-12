# Local Model React Native Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a React Native (Expo) demo app in the project root that guides users on setting up the local model server and provides a chat interface to interact with it.

**Architecture:** 
- **Framework**: Expo (React Native).
- **Navigation**: React Navigation (Stack).
- **UI**: `react-native-gifted-chat` for the chat interface, `react-native-markdown-display` for instructions.
- **Networking**: `fetch` API connecting to the local Python server (OpenAI compatible).

**Tech Stack:** React Native, Expo, JavaScript.

---

### Task 1: Initialize Project and Install Dependencies

**Files:**
- Create: `local-model-demo/` (via CLI)

**Step 1: Create Expo App**
Run: `npx create-expo-app local-model-demo --template blank`
*Note: This might be interactive. If so, I will use `yes |` or ensure non-interactive flags if available, or just run it and hope defaults work. `create-expo-app` usually defaults to 'yes' for simple questions if CI=true, but locally it might ask. I will use `--yes` if possible.*
*Actually, `npx create-expo-app local-model-demo -t blank` is usually safe.*

**Step 2: Install Dependencies**
Run: 
```bash
cd local-model-demo
npx expo install react-native-gifted-chat react-native-safe-area-context react-native-markdown-display @react-navigation/native @react-navigation/stack react-native-screens
```

**Step 3: Verify Init**
Check `package.json` exists.

---

### Task 2: Implement API Client

**Files:**
- Create: `local-model-demo/src/api/client.js`

**Step 1: Create Client Logic**
Implement a function `sendMessage(messages)` that posts to the local server.
*Key Detail*: Handle platform differences for localhost (`10.0.2.2` for Android, `localhost` for iOS).

```javascript
import { Platform } from 'react-native';

const getBaseUrl = () => {
  // If running on Android Emulator, localhost is 10.0.2.2
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/v1';
  }
  return 'http://localhost:8000/v1';
};

export const sendMessage = async (messages) => {
  try {
    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
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
    const data = await response.json();
    return data.choices[0].message;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
```

---

### Task 3: Implement Setup Screen

**Files:**
- Create: `local-model-demo/src/screens/SetupScreen.js`

**Step 1: Create UI**
Display Markdown instructions explaining how to start the server.

```javascript
import React from 'react';
import { ScrollView, StyleSheet, View, Button } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

const instructions = `
# Setup Local Model

1. **Install Dependencies**
   Run the install script in your project root:
   \`\`\`bash
   cd thirdparty/my-local-model
   python install.py
   \`\`\`

2. **Download Model**
   \`\`\`bash
   python download_model.py
   \`\`\`

3. **Start Server**
   \`\`\`bash
   python server.py --model models/qwen2.5-1.5b-instruct-q4_k_m.gguf
   \`\`\`

Once the server is running at port 8000, you can start chatting!
`;

export default function SetupScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Markdown>{instructions}</Markdown>
        <Button title="Go to Chat" onPress={() => navigation.navigate('Chat')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
});
```

---

### Task 4: Implement Chat Screen

**Files:**
- Create: `local-model-demo/src/screens/ChatScreen.js`

**Step 1: Create UI**
Use `GiftedChat` to handle the chat interface.

```javascript
import React, { useState, useCallback, useEffect } from 'react';
import { GiftedChat } from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendMessage } from '../api/client';
import { View, Text, StyleSheet } from 'react-native';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setMessages([
      {
        _id: 1,
        text: 'Hello! Ensure your local model server is running, then say hi.',
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'System',
        },
      },
    ]);
  }, []);

  const onSend = useCallback(async (newMessages = []) => {
    setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
    
    const userMessage = newMessages[0];
    setIsTyping(true);

    try {
      // Prepare messages for API (reverse chronological order in GiftedChat, need chronological for API)
      // Actually GiftedChat stores latest first.
      // We need to construct the history. For simplicity, just sending the last message for now
      // or a simple history if we had access to state correctly.
      // Let's just send the last user message + system prompt.
      
      const apiMessages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: userMessage.text }
      ];

      const response = await sendMessage(apiMessages);
      
      const botMessage = {
        _id: Math.round(Math.random() * 1000000),
        text: response.content,
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'Assistant',
        },
      };

      setMessages((previousMessages) => GiftedChat.append(previousMessages, [botMessage]));
    } catch (error) {
      const errorMessage = {
        _id: Math.round(Math.random() * 1000000),
        text: "Error connecting to server. Is it running?",
        createdAt: new Date(),
        user: { _id: 2, name: 'System' },
      };
      setMessages((previousMessages) => GiftedChat.append(previousMessages, [errorMessage]));
    } finally {
      setIsTyping(false);
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <GiftedChat
        messages={messages}
        onSend={(messages) => onSend(messages)}
        user={{
          _id: 1,
        }}
        isTyping={isTyping}
      />
    </SafeAreaView>
  );
}
```

---

### Task 5: Setup Navigation

**Files:**
- Modify: `local-model-demo/App.js`

**Step 1: Configure Stack Navigator**

```javascript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SetupScreen from './src/screens/SetupScreen';
import ChatScreen from './src/screens/ChatScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Setup">
        <Stack.Screen name="Setup" component={SetupScreen} options={{ title: 'Setup Guide' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Local Model Chat' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

### Task 6: Add Helper Scripts (Optional)

**Files:**
- Modify: `package.json` inside `local-model-demo`

**Step 1: Add run scripts**
Ensure `npm run start`, `npm run android`, `npm run ios` work.

