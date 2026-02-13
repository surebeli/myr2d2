import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Appearance,
} from 'react-native';
import { sendMessage } from './src/api/client';
import type { Message } from './src/types';
import { AppStoreProvider, useAppStore } from './src/state/store';

import ManagerScreen from './src/screens/ManagerScreen';
import SpeechAssistantScreen from './src/screens/SpeechAssistantScreen';

const AppInner = () => {
  const isDarkMode = typeof Appearance?.getColorScheme === 'function' && Appearance.getColorScheme() === 'dark';
  const [currentTab, setCurrentTab] = useState<'chat' | 'manager' | 'speech'>('speech');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { state, dispatch } = useAppStore();
  const messages = state.chat.messages;

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#F5F5F5',
  };
  
  const textStyle = {
    color: isDarkMode ? '#ffffff' : '#000000',
  };

  useEffect(() => {
    // Scroll to bottom when messages change
    if (currentTab === 'chat') {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, currentTab]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    dispatch({ type: 'chat/appendMessage', payload: userMsg });
    setInput('');
    setLoading(true);

    try {
      const history = state.chat.messages
        .filter(m => m.role !== 'system' || m.content.startsWith('Welcome'))
        .map(m => ({ role: m.role, content: m.content }));
      
      if (history.length === 0 || history[0].role !== 'system') {
          history.unshift({ role: 'system', content: 'You are a helpful assistant.' });
      }

      history.push({ role: 'user', content: userMsg.content });

      const response = await sendMessage(history);
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: response.content 
      };
      dispatch({ type: 'chat/appendMessage', payload: botMsg });
    } catch (error: any) {
      const errMsg: Message = { id: Date.now().toString(), role: 'system', content: 'Error: ' + error.message };
      dispatch({ type: 'chat/appendMessage', payload: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, backgroundStyle]}>
      <View style={styles.tabBar}>
        <TouchableOpacity onPress={() => setCurrentTab('chat')} style={[styles.tabBtn, currentTab === 'chat' ? styles.activeTab : undefined]}>
          <Text style={[styles.tabText, currentTab === 'chat' ? styles.activeTabText : textStyle]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentTab('manager')} style={[styles.tabBtn, currentTab === 'manager' ? styles.activeTab : undefined]}>
          <Text style={[styles.tabText, currentTab === 'manager' ? styles.activeTabText : textStyle]}>Manager</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentTab('speech')} style={[styles.tabBtn, currentTab === 'speech' ? styles.activeTab : undefined]}>
          <Text style={[styles.tabText, currentTab === 'speech' ? styles.activeTabText : textStyle]}>Speech</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.contentContainer}>
        <View style={[styles.screen, currentTab !== 'chat' ? styles.hidden : undefined]} pointerEvents={currentTab === 'chat' ? 'auto' : 'none'}>
          <View style={[styles.header, { backgroundColor: isDarkMode ? '#2c2c2c' : '#fff', borderBottomColor: isDarkMode ? '#444' : '#ddd' }]}>
            <Text style={[styles.title, textStyle]}>Local Model (macOS)</Text>
          </View>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            style={styles.chatList}
            contentContainerStyle={styles.chatContent}
            renderItem={({ item }) => (
              <View style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble :
                item.role === 'assistant' ? [styles.botBubble, { backgroundColor: isDarkMode ? '#333' : '#E5E5EA' }] :
                [styles.sysBubble, { backgroundColor: isDarkMode ? '#222' : '#FFF', borderColor: isDarkMode ? '#444' : '#ddd' }]
              ]}>
                <Text style={[styles.roleText, { color: isDarkMode ? '#aaa' : '#333' }]}>{item.role.toUpperCase()}</Text>
                <Text style={[styles.msgText, { color: item.role === 'user' ? '#fff' : textStyle.color }]}>{item.content}</Text>
              </View>
            )}
          />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.inputContainer, { backgroundColor: isDarkMode ? '#2c2c2c' : '#fff', borderTopColor: isDarkMode ? '#444' : '#ddd' }]}>
              <TextInput
                style={[styles.input, { color: textStyle.color, borderColor: isDarkMode ? '#444' : '#ddd', backgroundColor: isDarkMode ? '#1a1a1a' : '#fff' }]}
                value={input}
                onChangeText={setInput}
                placeholder="Type a message..."
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                onSubmitEditing={handleSend}
                editable={!loading}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={handleSend} style={[styles.sendBtn, { opacity: loading ? 0.6 : 1 }]} disabled={loading}>
                {loading ?
                  <ActivityIndicator color="#fff" size="small" /> :
                  <Text style={styles.sendBtnText}>Send</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>

        <View style={[styles.screen, currentTab !== 'manager' ? styles.hidden : undefined]} pointerEvents={currentTab === 'manager' ? 'auto' : 'none'}>
          <ManagerScreen />
        </View>

        <View style={[styles.screen, currentTab !== 'speech' ? styles.hidden : undefined]} pointerEvents={currentTab === 'speech' ? 'auto' : 'none'}>
          <SpeechAssistantScreen />
        </View>
      </View>
    </SafeAreaView>
  );
};

const App = () => {
  return (
    <AppStoreProvider>
      <AppInner />
    </AppStoreProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 15, borderBottomWidth: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold' },
  chatList: { flex: 1 },
  chatContent: { padding: 15, gap: 10, paddingBottom: 20 },
  bubble: { padding: 10, borderRadius: 12, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  botBubble: { alignSelf: 'flex-start' },
  sysBubble: { alignSelf: 'center', borderWidth: 1, width: '90%', alignItems: 'center' },
  roleText: { fontSize: 10, marginBottom: 4, opacity: 0.7, fontWeight: '600' },
  msgText: { fontSize: 15, lineHeight: 22 },
  inputContainer: { flexDirection: 'row', padding: 15, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10, fontSize: 14 },
  sendBtn: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: '#007AFF', borderRadius: 20, minWidth: 70 },
  sendBtnText: { color: '#fff', fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#ddd', paddingHorizontal: 15, paddingVertical: 10 },
  tabBtn: { paddingVertical: 5, paddingHorizontal: 15, marginRight: 10 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#007AFF' },
  activeTabText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },
  tabText: { fontSize: 16 },
  contentContainer: { flex: 1 },
  screen: { flex: 1 },
  hidden: { display: 'none' },
});

export default App;
