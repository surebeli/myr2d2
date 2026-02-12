import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Appearance,
} from 'react-native';
import CmdRun from 'react-native-cmd-run';
import { useAppStore } from '../state/store';

const ManagerScreen = () => {
  const isDarkMode = typeof Appearance?.getColorScheme === 'function' && Appearance.getColorScheme() === 'dark';
  const isTestEnv =
    typeof process !== 'undefined' &&
    !!(process as any).env &&
    !!(process as any).env.JEST_WORKER_ID;
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'stopped' | 'running' | 'unknown'>('unknown');
  const { state, dispatch } = useAppStore();
  const projectRoot = state.manager.projectRoot;
  const logs = state.manager.logs;

  const styles = getStyles(isDarkMode);

  const addLog = (msg: string) => {
    dispatch({ type: 'manager/appendLog', payload: `[${new Date().toLocaleTimeString()}] ${msg}` });
  };

  const logsText = useMemo(() => logs.join('\n'), [logs]);

  const runCommand = async (cmd: string, args: string[], cwd: string) => {
    setLoading(true);
    addLog(`Running: ${cmd} ${args.join(' ')}`);
    try {
      const output = await CmdRun.execute(cmd, args, cwd);
      addLog(`Success:\n${output}`);
    } catch (error: any) {
      addLog(`Error: ${error.message}\n${error.userInfo?.exec_error || ''}`);
    } finally {
      setLoading(false);
    }
  };

  const installDependencies = async () => {
    const cwd = `${projectRoot}/thirdparty/my-local-model`;
    await runCommand('python3', ['install.py'], cwd);
  };

  const downloadModel = async () => {
    const cwd = `${projectRoot}/thirdparty/my-local-model`;
    await runCommand('python3', ['download_model.py'], cwd);
  };

  const startServer = async () => {
    const cwd = `${projectRoot}/thirdparty/my-local-model`;
    setLoading(true);
    addLog(`Starting server...`);
    try {
      const result = await CmdRun.startServer(
        'python3', 
        ['server.py', '--model', 'models/qwen2.5-1.5b-instruct-q4_k_m.gguf'], 
        cwd
      );
      addLog(result);
      setServerStatus('running');
    } catch (error: any) {
      addLog(`Error starting server: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const stopServer = async () => {
    try {
      const result = await CmdRun.stopServer();
      addLog(result);
      setServerStatus('stopped');
    } catch (error: any) {
      addLog(`Error stopping server: ${error.message}`);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/docs');
      if (response.status === 200) {
        setServerStatus('running');
        addLog('Server is responding (running)');
      } else {
        setServerStatus('stopped');
        addLog('Server responded with error (stopped?)');
      }
    } catch (e) {
      setServerStatus('stopped');
      addLog('Server not reachable (stopped)');
    }
  };

  useEffect(() => {
    if (isTestEnv) return;
    checkStatus();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Model Manager</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Project Root:</Text>
          <TextInput 
            style={styles.input} 
            value={projectRoot} 
            onChangeText={(value) => dispatch({ type: 'manager/setProjectRoot', payload: value })} 
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dependencies & Model</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={installDependencies} disabled={loading}>
              <Text style={styles.btnText}>Install Deps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={downloadModel} disabled={loading}>
              <Text style={styles.btnText}>Download Model</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server Control</Text>
          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: serverStatus === 'running' ? '#4CAF50' : '#ddd' }]} 
              disabled={true}
            >
              <Text style={styles.btnText}>Status: {serverStatus.toUpperCase()}</Text>
            </TouchableOpacity>
            
            {serverStatus !== 'running' ? (
              <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={startServer} disabled={loading}>
                <Text style={styles.btnText}>Start Server</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.btn, styles.dangerBtn]} onPress={stopServer} disabled={loading}>
                <Text style={styles.btnText}>Stop Server</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.btn} onPress={checkStatus} disabled={loading}>
              <Text style={styles.btnText}>Refresh Status</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.logs}>
          <Text style={styles.sectionTitle}>Logs</Text>
          {loading && <ActivityIndicator style={{ marginBottom: 10 }} />}
          <TextInput
            style={styles.logsInput}
            value={logsText}
            editable={false}
            multiline
            selectTextOnFocus={false}
            scrollEnabled
          />
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#1a1a1a' : '#F5F5F5',
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#333' : '#ddd',
    backgroundColor: isDark ? '#2c2c2c' : '#fff',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDark ? '#fff' : '#000',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 25,
    backgroundColor: isDark ? '#2c2c2c' : '#fff',
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: isDark ? '#fff' : '#000',
  },
  label: {
    marginBottom: 5,
    color: isDark ? '#aaa' : '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: isDark ? '#444' : '#ddd',
    padding: 10,
    borderRadius: 4,
    color: isDark ? '#fff' : '#000',
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: isDark ? '#444' : '#eee',
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
  },
  dangerBtn: {
    backgroundColor: '#FF3B30',
  },
  btnText: {
    color: isDark ? '#fff' : '#000',
    fontWeight: '500',
  },
  logs: {
    marginTop: 10,
    padding: 15,
    backgroundColor: isDark ? '#000' : '#333',
    borderRadius: 8,
    minHeight: 200,
  },
  logsInput: {
    minHeight: 160,
    padding: 10,
    borderRadius: 6,
    backgroundColor: isDark ? '#000' : '#111',
    color: '#0f0',
    fontFamily: 'Courier',
    fontSize: 12,
  },
});

export default ManagerScreen;
