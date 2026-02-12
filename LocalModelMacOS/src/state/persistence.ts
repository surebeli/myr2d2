import { NativeModules } from 'react-native';
import type { AppState } from './store';

type PersistedPayloadV1 = {
  version: 1;
  state: Pick<AppState, 'manager' | 'chat'>;
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
  if (payload.version !== 1 || !payload.state) return null;
  return payload.state as Partial<AppState>;
}

export async function savePersistedState(state: Pick<AppState, 'manager' | 'chat'>): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  const payload: PersistedPayloadV1 = { version: 1, state };
  await storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

