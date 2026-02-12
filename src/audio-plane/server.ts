import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import type { Logger } from "../observability/logger.js";

type Session = {
  sessionId: string;
  token: string;
  uplink: WebSocket | null;
  downlinks: Set<WebSocket>;
  bytesIn: number;
  createdAtMs: number;
  didMockAsr: boolean;
};

export type AudioPlaneServerOptions = {
  port: number;
  logger: Logger;
  mockTranscript?: string;
  mockTtsText?: string;
};

export type AudioPlaneServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

export const startAudioPlaneServer = async (opts: AudioPlaneServerOptions): Promise<AudioPlaneServer> => {
  const wss = new WebSocketServer({ port: opts.port });
  const logger = opts.logger;
  const sessions = new Map<string, Session>();

  const getOrCreateSession = (sessionId: string, token: string): Session => {
    const existing = sessions.get(sessionId);
    if (existing) return existing;
    const s: Session = {
      sessionId,
      token,
      uplink: null,
      downlinks: new Set(),
      bytesIn: 0,
      createdAtMs: Date.now(),
      didMockAsr: false,
    };
    sessions.set(sessionId, s);
    return s;
  };

  const parseUrl = (rawUrl: string | undefined): { path: string; sessionId: string; token: string } | null => {
    if (!rawUrl) return null;
    const u = new URL(rawUrl, "ws://localhost");
    const path = u.pathname || "/";
    const sessionId = (u.searchParams.get("session_id") ?? "").trim();
    const token = (u.searchParams.get("token") ?? "").trim();
    if (!sessionId || !token) return null;
    return { path, sessionId, token };
  };

  const broadcastJson = (session: Session, msg: unknown) => {
    const text = JSON.stringify(msg);
    for (const ws of session.downlinks) {
      if (ws.readyState === ws.OPEN) ws.send(text);
    }
  };

  const broadcastBinary = (session: Session, buf: Buffer) => {
    for (const ws of session.downlinks) {
      if (ws.readyState === ws.OPEN) ws.send(buf);
    }
  };

  wss.on("connection", (ws, req) => {
    const connId = randomUUID();
    const parsed = parseUrl(req.url);
    if (!parsed) {
      ws.close(1008, "missing session_id/token");
      return;
    }
    const { path, sessionId, token } = parsed;
    const session = getOrCreateSession(sessionId, token);
    if (session.token !== token) {
      ws.close(1008, "invalid token");
      return;
    }

    if (path === "/uplink") {
      if (session.uplink) session.uplink.close(1012, "replaced");
      session.uplink = ws;
      logger.info("audio uplink connected", { connId, sessionId });
      ws.send(JSON.stringify({ type: "uplink.ready", session_id: sessionId }));

      ws.on("message", (data, isBinary) => {
        if (!isBinary) return;
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        session.bytesIn += buf.length;

        if (!session.didMockAsr) {
          session.didMockAsr = true;
          const transcript = opts.mockTranscript ?? "（mock transcript）你好，我已唤醒。";
          broadcastJson(session, { type: "asr.mock", session_id: sessionId, text: transcript });
          const ttsText = opts.mockTtsText ?? `收到：${transcript}`;
          broadcastJson(session, { type: "tts.mock", session_id: sessionId, text: ttsText });
          broadcastBinary(session, Buffer.from(`MOCK_TTS_AUDIO:${ttsText}`, "utf8"));
        }
      });

      ws.on("close", () => {
        if (session.uplink === ws) session.uplink = null;
        logger.info("audio uplink disconnected", { connId, sessionId, bytesIn: session.bytesIn });
      });
      return;
    }

    if (path === "/downlink") {
      session.downlinks.add(ws);
      logger.info("audio downlink connected", { connId, sessionId, downlinks: session.downlinks.size });
      ws.send(JSON.stringify({ type: "downlink.ready", session_id: sessionId }));

      ws.on("close", () => {
        session.downlinks.delete(ws);
        logger.info("audio downlink disconnected", { connId, sessionId, downlinks: session.downlinks.size });
        if (!session.uplink && session.downlinks.size === 0) sessions.delete(sessionId);
      });
      return;
    }

    ws.close(1008, "unknown path");
  });

  await new Promise<void>((resolve) => wss.once("listening", () => resolve()));
  const baseUrl = `ws://127.0.0.1:${opts.port}`;
  logger.info("audio plane listening", { baseUrl });

  return {
    baseUrl,
    close: async () => {
      for (const client of wss.clients) {
        client.close();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
};

