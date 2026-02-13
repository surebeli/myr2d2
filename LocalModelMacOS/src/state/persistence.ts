import { NativeModules } from 'react-native';
import type { AppState } from './store';

type PersistedPayloadV1 = {
  version: 1;
  state: Pick<AppState, 'manager' | 'chat'>;
};

type PersistedPayloadV2 = {
  version: 2;
  state: Pick<AppState, 'manager' | 'chat' | 'speechassistant'>;
};

const STORAGE_KEY = 'LocalModelMacOS.appState';

function getStorage(): any | null {
  const storage = (NativeModules as any).LocalModelStorage;
  return storage ?? null;
}

export async function loadPersistedState(): Promise<Partial<AppState> | null> {
  const storage = getStorage();
  if (!storage) return null;
  const raw = await storage.getItem(STORAGE_KEY);
  if (!raw || typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const payload = parsed as Partial<PersistedPayloadV1>;
  if (!payload || typeof payload !== 'object') return null;
  const version = (payload as any).version;
  const state = (payload as any).state;
  if (!state) return null;
  if (version === 1) {
    return state as Partial<AppState>;
  }
  if (version === 2) {
    return state as Partial<AppState>;
  }
  return null;
}

export async function savePersistedState(state: Pick<AppState, 'manager' | 'chat' | 'speechassistant'>): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  const payload: PersistedPayloadV2 = { version: 2, state };
  await storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
