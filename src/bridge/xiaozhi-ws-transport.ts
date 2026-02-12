import WebSocket from "ws";
import type { Logger } from "../observability/logger.js";

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

type XiaoZhiJsonEnvelope =
  | { type: "hello"; session_id?: string; version?: number; features?: unknown; transport?: string; audio_params?: unknown }
  | { type: "listen"; state: string; mode?: string }
  | { type: "abort"; reason?: string }
  | { type: "mcp"; session_id?: string; payload: unknown }
  | { type: string; [k: string]: unknown };

export type XiaoZhiWsTransportOptions = {
  url: string;
  logger: Logger;
  reconnectDelayMs?: number;
  onJsonRpcNotification?: (n: JsonRpcNotification) => void;
};

export class XiaoZhiWsTransport {
  private ws: WebSocket | null = null;
  private stopped = false;
  private sessionId: string | undefined;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(private readonly opts: XiaoZhiWsTransportOptions) {}

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  start(): void {
    void this.connectLoop();
  }

  stop(): void {
    this.stopped = true;
    const ws = this.ws;
    this.ws = null;
    if (ws) ws.close();
  }

  async callJsonRpc<T>(req: JsonRpcRequest, timeoutMs: number): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("xiaozhi not connected");
    }
    const idKey = String(req.id);
    const envelope: XiaoZhiJsonEnvelope = {
      type: "mcp",
      session_id: this.sessionId,
      payload: req,
    };
    const res = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(idKey);
        reject(new Error("mcp timeout"));
      }, timeoutMs);
      this.pending.set(idKey, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });
      ws.send(JSON.stringify(envelope), (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pending.delete(idKey);
          reject(err);
        }
      });
    });
    return res as T;
  }

  async listenStart(mode: "start" | "detect" = "start"): Promise<{ sessionId?: string }> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error("xiaozhi not connected");
    const msg: XiaoZhiJsonEnvelope = { type: "listen", state: mode };
    ws.send(JSON.stringify(msg));
    return { sessionId: this.sessionId };
  }

  async listenStop(): Promise<{ sessionId?: string }> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error("xiaozhi not connected");
    const msg: XiaoZhiJsonEnvelope = { type: "listen", state: "stop" };
    ws.send(JSON.stringify(msg));
    return { sessionId: this.sessionId };
  }

  private async connectLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.connectOnce();
      } catch (err) {
        this.opts.logger.error("xiaozhi connect failed", { error: String(err) });
      }
      if (this.stopped) return;
      const delayMs = this.opts.reconnectDelayMs ?? 750;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  private async connectOnce(): Promise<void> {
    const { url, logger } = this.opts;
    this.sessionId = undefined;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.on("message", (data, isBinary) => this.onMessage(data, isBinary));
    ws.on("close", (code, reason) => {
      logger.warn("xiaozhi closed", { code, reason: reason.toString() });
      for (const [id, p] of this.pending) {
        p.reject(new Error(`xiaozhi closed: ${code}`));
        this.pending.delete(id);
      }
    });
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", (err) => reject(err));
    });
    logger.info("xiaozhi connected", { url });
    await new Promise<void>((resolve) => ws.once("close", () => resolve()));
  }

  private onMessage(data: WebSocket.RawData, isBinary: boolean): void {
    if (isBinary) return;
    const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : data.toString();
    let msg: XiaoZhiJsonEnvelope;
    try {
      msg = JSON.parse(text) as XiaoZhiJsonEnvelope;
    } catch {
      return;
    }
    if (msg.type === "hello") {
      if (typeof msg.session_id === "string" && msg.session_id.trim().length > 0) {
        this.sessionId = msg.session_id.trim();
      }
      return;
    }
    if (msg.type === "mcp") {
      if (typeof msg.session_id === "string" && msg.session_id.trim().length > 0) {
        this.sessionId = msg.session_id.trim();
      }
      const payload = msg.payload;
      if (!payload || typeof payload !== "object") return;
      const maybeResponse = payload as Partial<JsonRpcResponse>;
      if (maybeResponse.jsonrpc === "2.0" && "id" in maybeResponse && (("result" in maybeResponse) || ("error" in maybeResponse))) {
        const idKey = String(maybeResponse.id);
        const pending = this.pending.get(idKey);
        if (!pending) return;
        this.pending.delete(idKey);
        if ("error" in maybeResponse && maybeResponse.error) {
          pending.reject(new Error(String(maybeResponse.error.message ?? "mcp error")));
          return;
        }
        pending.resolve((maybeResponse as { result: unknown }).result);
        return;
      }
      const maybeNotification = payload as Partial<JsonRpcNotification>;
      if (maybeNotification.jsonrpc === "2.0" && typeof maybeNotification.method === "string" && !("id" in maybeNotification)) {
        this.opts.onJsonRpcNotification?.(maybeNotification as JsonRpcNotification);
      }
    }
  }
}

