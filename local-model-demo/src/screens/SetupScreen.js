import React from 'react';
import { ScrollView, StyleSheet, View, Button, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

const instructions = `
# Setup Local Model Server

To chat with the local model, you need to run the Python server on your computer.

### 1. Open Terminal
Navigate to the project root in your terminal.

### 2. Install Dependencies
Run the install script to set up the environment (supports Mac Metal & Windows CUDA):

\`\`\`bash
cd thirdparty/my-local-model
python install.py
\`\`\`

### 3. Download Model
Download a GGUF model (default: Qwen2.5-1.5B):

\`\`\`bash
python download_model.py
\`\`\`

### 4. Start Server
Start the OpenAI-compatible API server:

\`\`\`bash
python server.py --model models/qwen2.5-1.5b-instruct-q4_k_m.gguf
\`\`\`

**Note:** The server must be running on port **8000**.
`;

export default function SetupScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Markdown>{instructions}</Markdown>
        <View style={styles.buttonContainer}>
             <Button title="I have started the server -> Chat" onPress={() => navigation.navigate('Chat')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  buttonContainer: { marginTop: 20, marginBottom: 40 }
});
