import React, { useState, useCallback, useEffect } from 'react';
import { GiftedChat } from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendMessage } from '../api/client';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

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
    // 1. Update UI immediately
    setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
    
    const userMessage = newMessages[0];
    setIsTyping(true);

    try {
      // 2. Prepare context for LLM
      // In a real app, you would map previous messages to {role, content}
      // Here we just send the last message for simplicity + system prompt
      const apiMessages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: userMessage.text }
      ];

      // 3. Call API
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

      // 4. Update UI with response
      setMessages((previousMessages) => GiftedChat.append(previousMessages, [botMessage]));
    } catch (error) {
      const errorMessage = {
        _id: Math.round(Math.random() * 1000000),
        text: `Error: ${error.message}. Is the server running on port 8000?`,
        createdAt: new Date(),
        user: { _id: 2, name: 'System' },
      };
      setMessages((previousMessages) => GiftedChat.append(previousMessages, [errorMessage]));
    } finally {
      setIsTyping(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={(messages) => onSend(messages)}
        user={{
          _id: 1,
        }}
        isTyping={isTyping}
        renderFooter={() => (isTyping ? <ActivityIndicator size="small" style={{ margin: 10 }} /> : null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' }
});
