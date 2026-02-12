import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import type { Logger } from "../observability/logger.js";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  XiaoZhiDeviceToServer,
  XiaoZhiHello,
  XiaoZhiListen,
  XiaoZhiMcp,
  XiaoZhiServerToDevice,
} from "./types.js";

export type XiaoZhiCompatibleServerOptions = {
  port: number;
  logger: Logger;
  mockTranscript?: string;
};

export type XiaoZhiCompatibleServer = {
  url: string;
  close: () => Promise<void>;
};

export const startXiaoZhiCompatibleServer = async (
  opts: XiaoZhiCompatibleServerOptions,
): Promise<XiaoZhiCompatibleServer> => {
  const wss = new WebSocketServer({ port: opts.port });
  const url = `ws://127.0.0.1:${opts.port}`;
  const logger = opts.logger;

  wss.on("connection", (ws) => {
    const connId = randomUUID();
    let sessionId: string | undefined;

    const send = (msg: XiaoZhiServerToDevice) => {
      ws.send(JSON.stringify(msg));
    };

    const sendMcp = (payload: JsonRpcResponse) => {
      const msg: XiaoZhiMcp = { type: "mcp", session_id: sessionId, payload };
      send(msg);
    };

    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : data.toString();
      let msg: XiaoZhiDeviceToServer;
      try {
        msg = JSON.parse(text) as XiaoZhiDeviceToServer;
      } catch {
        return;
      }

      if (msg.type === "hello") {
        const hello = msg as XiaoZhiHello;
        sessionId = hello.session_id?.trim() || sessionId || `sess_${randomUUID()}`;
        logger.info("xiaozhi device hello", { connId, sessionId, version: hello.version, transport: hello.transport });
        send({
          type: "hello",
          transport: "websocket",
          session_id: sessionId,
          audio_params: hello.audio_params,
        });
        return;
      }

      if (msg.type === "listen") {
        const listen = msg as XiaoZhiListen;
        logger.info("xiaozhi listen", { connId, sessionId, state: listen.state, mode: listen.mode });
        if (listen.state === "start" || listen.state === "detect") {
          const transcript = opts.mockTranscript ?? "你好，我是 myr2d2。";
          setTimeout(() => {
            send({ type: "stt", text: transcript });
            send({ type: "llm", text: `收到：${transcript}` });
            send({ type: "tts", state: "start" });
            send({ type: "tts", state: "sentence_start", text: `收到：${transcript}` });
            send({ type: "tts", state: "stop" });
          }, 120);
        }
        return;
      }

      if (msg.type === "mcp") {
        const mcp = msg as XiaoZhiMcp;
        const payload = mcp.payload;
        if (!payload || typeof payload !== "object") return;
        const req = payload as Partial<JsonRpcRequest>;
        if (req.jsonrpc !== "2.0" || req.id === undefined || typeof req.method !== "string") return;
        if (req.method === "initialize") {
          sendMcp({
            jsonrpc: "2.0",
            id: req.id,
            result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "myr2d2-xiaozhi-server", version: "0.0.0" } },
          });
          return;
        }
        if (req.method === "tools/list") {
          sendMcp({
            jsonrpc: "2.0",
            id: req.id,
            result: {
              tools: [
                { name: "self.get_device_status", description: "mock status", inputSchema: { type: "object", properties: {} } },
              ],
              nextCursor: "",
            },
          });
          return;
        }
        if (req.method === "tools/call") {
          sendMcp({
            jsonrpc: "2.0",
            id: req.id,
            result: { content: [{ type: "text", text: "ok" }], isError: false },
          });
          return;
        }
        sendMcp({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found" } });
      }
    });

    ws.on("close", () => {
      logger.info("xiaozhi device disconnected", { connId, sessionId });
    });
  });

  await new Promise<void>((resolve) => wss.once("listening", () => resolve()));
  logger.info("xiaozhi compatible server listening", { url });

  return {
    url,
    close: async () => {
      for (const client of wss.clients) {
        client.close();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
};

