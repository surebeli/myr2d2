# Local Model React Native macOS Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a native macOS desktop application using `react-native-macos` that connects to the local model server.

**Architecture:**
- **Framework**: React Native for macOS (Microsoft fork).
- **Navigation**: Basic state-based navigation or `react-navigation` (if compatible, usually is).
- **UI**: Standard React Native components (`View`, `Text`, `TextInput`, `FlatList`) optimized for desktop (keyboard handling).
- **Networking**: `fetch` API connecting to `http://localhost:8000`.

**Tech Stack:** React Native macOS, JavaScript/TypeScript.

---

### Task 1: Initialize macOS Project

**Files:**
- Create: `local-model-macos-demo/`

**Step 1: Init React Native Project**
We will use the standard `react-native` init and then apply the macOS extension.
*Note: Using a specific version known to be stable with macOS is often recommended, but we'll try latest.*

Run:
```bash
npx react-native@latest init LocalModelMacOS --version 0.73.0 --skip-install
```
*Why 0.73.0?* `react-native-macos` often trails the main repo slightly. 0.73 is a safe bet for compatibility.

**Step 2: Install macOS Extension**
Run:
```bash
cd LocalModelMacOS
npx react-native-macos-init
```
*This modifies the project to add macOS targets.*

**Step 3: Install Dependencies**
Run:
```bash
npm install
cd macos && pod install && cd ..
```

---

### Task 2: Implement API Client (Shared Logic)

**Files:**
- Create: `LocalModelMacOS/src/api/client.js`

**Step 1: Create Client**
Similar to the Expo demo, but simpler (always localhost).

```javascript
export const sendMessage = async (messages) => {
  const url = 'http://localhost:8000/v1/chat/completions';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: 'local-model',
        stream: false,
      }),
    });
    
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()).choices[0].message;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
```

---

### Task 3: Implement Chat UI

**Files:**
- Modify: `LocalModelMacOS/App.tsx` (or `.js`)

**Step 1: Create Basic Chat Interface**
We'll build a custom chat interface instead of `gifted-chat` to ensure full macOS compatibility (scrolling, keyboard).

```tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { sendMessage } from './src/api/client';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const App = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'system', content: 'Welcome to the Local Model macOS Client!' }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.concat(userMsg).map(m => ({ role: m.role, content: m.content }));
      // Filter out our internal system welcome if needed, or keep it.
      // Actually api expects standard roles.
      
      const response = await sendMessage(history.filter(m => m.role !== 'system' || m.content !== 'Welcome to the Local Model macOS Client!'));
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: response.content 
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      const errMsg: Message = { id: Date.now().toString(), role: 'system', content: 'Error: ' + error.message };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Local Model (macOS)</Text>
      </View>
      
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        style={styles.chatList}
        contentContainerStyle={styles.chatContent}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble, 
            item.role === 'user' ? styles.userBubble : 
            item.role === 'assistant' ? styles.botBubble : styles.sysBubble
          ]}>
            <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
            <Text style={styles.msgText}>{item.content}</Text>
          </View>
        )}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          onSubmitEditing={handleSend}
          editable={!loading}
        />
        <TouchableOpacity onPress={handleSend} style={styles.sendBtn} disabled={loading}>
          <Text style={styles.sendBtnText}>{loading ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ddd', backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: 'bold' },
  chatList: { flex: 1 },
  chatContent: { padding: 15, gap: 10 },
  bubble: { padding: 10, borderRadius: 8, maxWidth: '80%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#E5E5EA' },
  sysBubble: { alignSelf: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ddd' },
  roleText: { fontSize: 10, marginBottom: 2, opacity: 0.7, color: '#333' },
  msgText: { fontSize: 14, color: '#000' },
  inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginRight: 10 },
  sendBtn: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, backgroundColor: '#007AFF', borderRadius: 20 },
  sendBtnText: { color: '#fff', fontWeight: 'bold' },
});

export default App;
```

---

### Task 4: Add Launch Scripts

**Files:**
- Modify: `LocalModelMacOS/package.json`

**Step 1: Add Scripts**
Ensure `npm run macos` is available.
(The init script usually adds it: `npx react-native run-macos`)

