export type XiaoZhiAudioParams = {
  format?: string;
  sample_rate?: number;
  channels?: number;
  frame_duration?: number;
};

export type XiaoZhiHello = {
  type: "hello";
  version?: number;
  features?: Record<string, unknown>;
  transport?: "websocket" | "udp";
  session_id?: string;
  audio_params?: XiaoZhiAudioParams;
};

export type XiaoZhiListen = {
  type: "listen";
  state: "start" | "stop" | "detect";
  mode?: string;
};

export type XiaoZhiAbort = {
  type: "abort";
  reason?: string;
};

export type XiaoZhiMcp = {
  type: "mcp";
  session_id?: string;
  payload: unknown;
};

export type XiaoZhiServerToDevice =
  | XiaoZhiHello
  | { type: "stt"; text: string }
  | { type: "llm"; text: string; emotion?: string }
  | { type: "tts"; state: string; text?: string }
  | XiaoZhiMcp
  | { type: string; [k: string]: unknown };

export type XiaoZhiDeviceToServer =
  | XiaoZhiHello
  | XiaoZhiListen
  | XiaoZhiAbort
  | XiaoZhiMcp
  | { type: string; [k: string]: unknown };

export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

