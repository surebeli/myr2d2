import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Appearance, ActivityIndicator } from 'react-native';
import CmdRun from 'react-native-cmd-run';
import { useAppStore } from '../state/store';

type DaemonStatus = 'stopped' | 'running' | 'unknown';

const SPEECH_SERVER_NAME = 'speechassistant';
const SPEECH_BASE_URL = 'http://127.0.0.1:8765';

export default function SpeechAssistantScreen() {
  const isDarkMode = typeof Appearance?.getColorScheme === 'function' && Appearance.getColorScheme() === 'dark';
  const isTestEnv =
    typeof process !== 'undefined' && !!(process as any).env && !!(process as any).env.JEST_WORKER_ID;

  const { state, dispatch } = useAppStore();
  const projectRoot = state.manager.projectRoot;

  const [loading, setLoading] = useState(false);
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus>('unknown');
  const [listening, setListening] = useState(false);
  const [power, setPower] = useState('unknown');
  const [wakeState, setWakeState] = useState('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [lastError, setLastError] = useState('');

  const [engine, setEngine] = useState<'whisper' | 'whisper-cli'>('whisper');
  const [acModel, setAcModel] = useState('large-v3');
  const [batteryModel, setBatteryModel] = useState('small');
  const [cliModelAc, setCliModelAc] = useState('');
  const [cliModelBattery, setCliModelBattery] = useState('');
  const [wakeWords, setWakeWords] = useState('小虾米');

  const wsRef = useRef<WebSocket | null>(null);

  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  const addLog = (msg: string) => {
    dispatch({ type: 'manager/appendLog', payload: `[speech][${new Date().toLocaleTimeString()}] ${msg}` });
  };

  const venvPython = `${projectRoot}/speechassistant/.venv/bin/python3`;
  const speechCwd = `${projectRoot}/speechassistant`;

  const checkDaemon = async () => {
    try {
      const res = await fetch(`${SPEECH_BASE_URL}/health`);
      if (res.status === 200) {
        setDaemonStatus('running');
        return true;
      }
    } catch {}
    setDaemonStatus('stopped');
    return false;
  };

  const connectWs = () => {
    if (wsRef.current) return;
    const ws = new WebSocket(`ws://127.0.0.1:8765/ws`);
    wsRef.current = ws;
    ws.onopen = () => addLog('WS connected');
    ws.onclose = () => {
      addLog('WS closed');
      wsRef.current = null;
    };
    ws.onerror = () => addLog('WS error');
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data));
        if (msg.type === 'status' && msg.data) {
          setListening(!!msg.data.listening);
          setPower(String(msg.data.power || 'unknown'));
          setWakeState(String(msg.data.wakeState || 'idle'));
          setLastTranscript(String(msg.data.lastTranscript || ''));
          setLastError(String(msg.data.lastError || ''));
        }
        if (msg.type === 'transcript' && msg.data?.text) {
          setLastTranscript(String(msg.data.text));
        }
        if (msg.type === 'openclaw_response') {
          const raw = typeof msg.data?.raw === 'string' ? msg.data.raw : '';
          setLastResponse(raw);
        }
        if (msg.type === 'error') {
          const m = typeof msg.data?.message === 'string' ? msg.data.message : 'Unknown error';
          setLastError(m);
        }
        if (msg.type === 'log' && msg.data?.message) {
          addLog(String(msg.data.message));
        }
      } catch (e) {
        addLog('WS message parse failed');
      }
    };
  };

  const loadConfig = async () => {
    const res = await fetch(`${SPEECH_BASE_URL}/config`);
    const cfg = await res.json();
    const w = cfg?.wakeWords;
    setWakeWords(Array.isArray(w) ? w.join(',') : '小虾米');
    const we = cfg?.whisper?.engine === 'whisper-cli' ? 'whisper-cli' : 'whisper';
    setEngine(we);
    setAcModel(String(cfg?.whisper?.acModel || 'large-v3'));
    setBatteryModel(String(cfg?.whisper?.batteryModel || 'small'));
    setCliModelAc(String(cfg?.whisper?.whisperCliModelPathAc || ''));
    setCliModelBattery(String(cfg?.whisper?.whisperCliModelPathBattery || ''));
  };

  const saveConfig = async () => {
    const res = await fetch(`${SPEECH_BASE_URL}/config`);
    const cfg = await res.json();
    cfg.wakeWords = wakeWords.split(',').map((s: string) => s.trim()).filter(Boolean);
    cfg.whisper = cfg.whisper || {};
    cfg.whisper.engine = engine;
    cfg.whisper.acModel = acModel;
    cfg.whisper.batteryModel = batteryModel;
    cfg.whisper.whisperCliModelPathAc = cliModelAc;
    cfg.whisper.whisperCliModelPathBattery = cliModelBattery;
    await fetch(`${SPEECH_BASE_URL}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    addLog('Config saved');
  };

  const installDeps = async () => {
    setLoading(true);
    addLog('Installing speechassistant deps');
    try {
      const output = await CmdRun.execute('python3', ['install.py'], speechCwd);
      addLog(output);
    } catch (e: any) {
      addLog(`Install failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startDaemon = async () => {
    setLoading(true);
    addLog('Starting speechassistant daemon');
    try {
      const result = await CmdRun.startNamedServer(SPEECH_SERVER_NAME, venvPython, ['server.py'], speechCwd);
      addLog(result);
    } catch (e: any) {
      addLog(`Start failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
    const ok = await checkDaemon();
    if (ok) {
      connectWs();
      await loadConfig();
    }
  };

  const stopDaemon = async () => {
    setLoading(true);
    try {
      const result = await CmdRun.stopNamedServer(SPEECH_SERVER_NAME);
      addLog(result);
    } catch (e: any) {
      addLog(`Stop failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
    setDaemonStatus('stopped');
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  };

  const startListening = async () => {
    await fetch(`${SPEECH_BASE_URL}/listening/start`, { method: 'POST' });
  };

  const stopListening = async () => {
    await fetch(`${SPEECH_BASE_URL}/listening/stop`, { method: 'POST' });
  };

  useEffect(() => {
    if (isTestEnv) return;
    (async () => {
      const ok = await checkDaemon();
      if (ok) {
        connectWs();
        await loadConfig();
      }
    })();
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Speech Assistant</Text>
        <Text style={styles.subtitle}>Daemon: {daemonStatus.toUpperCase()} | Listen: {listening ? 'ON' : 'OFF'} | {power.toUpperCase()}</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={installDeps} disabled={loading}>
              <Text style={styles.btnText}>Install</Text>
            </TouchableOpacity>
            {daemonStatus !== 'running' ? (
              <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={startDaemon} disabled={loading}>
                <Text style={styles.btnText}>Start</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.btn, styles.dangerBtn]} onPress={stopDaemon} disabled={loading}>
                <Text style={styles.btnText}>Stop</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, listening ? styles.dangerBtn : styles.primaryBtn]} onPress={listening ? stopListening : startListening} disabled={daemonStatus !== 'running'}>
              <Text style={styles.btnText}>{listening ? 'Stop Listening' : 'Start Listening'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wake Words</Text>
          <TextInput style={styles.input} value={wakeWords} onChangeText={setWakeWords} placeholder="小虾米" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Whisper Engine</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, engine === 'whisper' ? styles.selectedBtn : undefined]} onPress={() => setEngine('whisper')}>
              <Text style={styles.btnText}>whisper</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, engine === 'whisper-cli' ? styles.selectedBtn : undefined]} onPress={() => setEngine('whisper-cli')}>
              <Text style={styles.btnText}>whisper-cli</Text>
            </TouchableOpacity>
          </View>

          {engine === 'whisper' ? (
            <>
              <Text style={styles.label}>AC Model</Text>
              <TextInput style={styles.input} value={acModel} onChangeText={setAcModel} placeholder="large-v3" />
              <Text style={styles.label}>Battery Model</Text>
              <TextInput style={styles.input} value={batteryModel} onChangeText={setBatteryModel} placeholder="small" />
            </>
          ) : (
            <>
              <Text style={styles.label}>AC Model Path</Text>
              <TextInput style={styles.input} value={cliModelAc} onChangeText={setCliModelAc} placeholder="/path/to/ggml-large-v3.bin" />
              <Text style={styles.label}>Battery Model Path</Text>
              <TextInput style={styles.input} value={cliModelBattery} onChangeText={setCliModelBattery} placeholder="/path/to/ggml-small.bin" />
            </>
          )}

          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={saveConfig} disabled={daemonStatus !== 'running' || loading}>
              <Text style={styles.btnText}>Save Config</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.kv}>Wake: {wakeState}</Text>
          <Text style={styles.kv}>Transcript: {lastTranscript}</Text>
          {lastError ? <Text style={styles.err}>Error: {lastError}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OpenClaw</Text>
          {loading ? <ActivityIndicator style={{ marginBottom: 8 }} /> : null}
          <TextInput style={styles.output} value={lastResponse} editable={false} multiline />
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#1a1a1a' : '#F5F5F5' },
    header: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#333' : '#ddd',
      backgroundColor: isDark ? '#2c2c2c' : '#fff',
    },
    title: { fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#000' },
    subtitle: { marginTop: 4, fontSize: 12, color: isDark ? '#aaa' : '#666' },
    content: { padding: 12 },
    section: { backgroundColor: isDark ? '#2c2c2c' : '#fff', padding: 12, borderRadius: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: isDark ? '#fff' : '#000' },
    row: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
    btn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: isDark ? '#3a3a3a' : '#eee' },
    selectedBtn: { backgroundColor: '#007AFF' },
    primaryBtn: { backgroundColor: '#007AFF' },
    dangerBtn: { backgroundColor: '#D32F2F' },
    btnText: { color: '#fff', fontWeight: '600' },
    label: { fontSize: 12, color: isDark ? '#aaa' : '#666', marginTop: 6, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#ddd',
      padding: 8,
      borderRadius: 6,
      color: isDark ? '#fff' : '#000',
      backgroundColor: isDark ? '#1a1a1a' : '#fff',
    },
    kv: { fontSize: 12, color: isDark ? '#ddd' : '#222', marginBottom: 6 },
    err: { fontSize: 12, color: '#ff6b6b', marginTop: 6 },
    output: {
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#ddd',
      padding: 8,
      borderRadius: 6,
      minHeight: 120,
      color: isDark ? '#fff' : '#000',
      backgroundColor: isDark ? '#1a1a1a' : '#fff',
    },
  });

