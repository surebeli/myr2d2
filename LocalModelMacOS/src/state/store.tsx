import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Message } from '../types';
import { loadPersistedState, savePersistedState } from './persistence';

type ManagerState = {
  projectRoot: string;
  logs: string[];
};

type ChatState = {
  messages: Message[];
};

type SpeechAssistantState = {
  baseUrl: string;
};

export type AppState = {
  manager: ManagerState;
  chat: ChatState;
  speechassistant: SpeechAssistantState;
};

type Action =
  | { type: 'hydrate'; payload: Partial<AppState> }
  | { type: 'manager/setProjectRoot'; payload: string }
  | { type: 'manager/appendLog'; payload: string }
  | { type: 'manager/clearLogs' }
  | { type: 'chat/appendMessage'; payload: Message }
  | { type: 'chat/setMessages'; payload: Message[] }
  | { type: 'speechassistant/setBaseUrl'; payload: string };

const DEFAULT_PROJECT_ROOT = '/Users/litianyi/Documents/__secondlife/__project/myr2d2';

const initialState: AppState = {
  manager: {
    projectRoot: DEFAULT_PROJECT_ROOT,
    logs: [],
  },
  chat: {
    messages: [
      {
        id: '1',
        role: 'system',
        content: 'Welcome to the Local Model macOS Client! Ensure your server is running on port 8000.',
      },
    ],
  },
  speechassistant: {
    baseUrl: 'http://127.0.0.1:8765',
  },
};

const MAX_LOG_LINES = 1000;
const MAX_CHAT_MESSAGES = 200;
const isTestEnv =
  typeof process !== 'undefined' &&
  !!(process as any).env &&
  !!(process as any).env.JEST_WORKER_ID;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate': {
      return {
        ...state,
        ...action.payload,
        manager: { ...state.manager, ...action.payload.manager },
        chat: { ...state.chat, ...action.payload.chat },
        speechassistant: { ...state.speechassistant, ...action.payload.speechassistant },
      };
    }
    case 'manager/setProjectRoot': {
      return { ...state, manager: { ...state.manager, projectRoot: action.payload } };
    }
    case 'manager/appendLog': {
      const logs = [...state.manager.logs, action.payload];
      const clipped = logs.length > MAX_LOG_LINES ? logs.slice(logs.length - MAX_LOG_LINES) : logs;
      return { ...state, manager: { ...state.manager, logs: clipped } };
    }
    case 'manager/clearLogs': {
      return { ...state, manager: { ...state.manager, logs: [] } };
    }
    case 'chat/appendMessage': {
      const messages = [...state.chat.messages, action.payload];
      const clipped = messages.length > MAX_CHAT_MESSAGES ? messages.slice(messages.length - MAX_CHAT_MESSAGES) : messages;
      return { ...state, chat: { ...state.chat, messages: clipped } };
    }
    case 'chat/setMessages': {
      const clipped =
        action.payload.length > MAX_CHAT_MESSAGES
          ? action.payload.slice(action.payload.length - MAX_CHAT_MESSAGES)
          : action.payload;
      return { ...state, chat: { ...state.chat, messages: clipped } };
    }
    case 'speechassistant/setBaseUrl': {
      return { ...state, speechassistant: { ...state.speechassistant, baseUrl: action.payload } };
    }
    default: {
      return state;
    }
  }
}

const AppStoreContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isTestEnv) return;
    let cancelled = false;
    (async () => {
      try {
        const persisted = await loadPersistedState();
        if (!cancelled && persisted) {
          dispatch({ type: 'hydrate', payload: persisted });
        }
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isTestEnv) return;
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePersistedState({ manager: state.manager, chat: state.chat, speechassistant: state.speechassistant }).catch(() => {});
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state.manager, state.chat]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error('useAppStore must be used within AppStoreProvider');
  }
  return ctx;
}
