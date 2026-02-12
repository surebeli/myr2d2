import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import type { Logger } from "../observability/logger.js";

type ReqFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

type ResFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code?: string; message?: string; details?: unknown; retryable?: boolean; retryAfterMs?: number };
};

type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

type Frame = ReqFrame | ResFrame | EventFrame;

type PendingMode = "payload" | "frame";
type PendingEntry = { mode: PendingMode; resolve: (v: unknown) => void; reject: (e: Error) => void };

export type OpenClawConnectParams = {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName?: string;
    version: string;
    platform: string;
    mode: string;
    instanceId?: string;
    deviceFamily?: string;
    modelIdentifier?: string;
  };
  role: "node";
  scopes: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  pathEnv?: string;
  auth?: { token?: string; password?: string };
};

export type NodeInvokeRequestPayload = {
  id: string;
  nodeId: string;
  command: string;
  paramsJSON?: string | null;
  timeoutMs?: number;
  idempotencyKey?: string;
};

export type OpenClawGatewayNodeClientOptions = {
  url: string;
  connectParams: OpenClawConnectParams;
  logger: Logger;
  reconnectDelayMs?: number;
  onNodeInvokeRequest: (payload: NodeInvokeRequestPayload) => void | Promise<void>;
  onConnected?: () => void | Promise<void>;
};

export class OpenClawGatewayNodeClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingEntry>();
  private stopped = false;
  private connected = false;
  private invokeQueue: NodeInvokeRequestPayload[] = [];

  constructor(private readonly opts: OpenClawGatewayNodeClientOptions) {}

  start(): void {
    void this.connectLoop();
  }

  stop(): void {
    this.stopped = true;
    const ws = this.ws;
    this.ws = null;
    if (ws) ws.close();
  }

  async request<T>(method: string, params: unknown): Promise<T> {
    const id = `req_${randomUUID()}`;
    const frame: ReqFrame = { type: "req", id, method, params };
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || !this.connected) {
      const state = ws ? String(ws.readyState) : "null";
      throw new Error(`gateway not connected (state=${state} connected=${String(this.connected)})`);
    }
    const res = await new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { mode: "payload", resolve, reject });
      ws.send(JSON.stringify(frame), (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
    return res as T;
  }

  async sendNodeInvokeResult(args: {
    requestId: string;
    nodeId: string;
    ok: boolean;
    payload?: unknown;
    payloadJSON?: string;
    error?: { code?: string; message?: string };
  }): Promise<void> {
    const params = {
      id: args.requestId,
      nodeId: args.nodeId,
      ok: args.ok,
      payload: args.payload,
      payloadJSON: args.payloadJSON,
      error: args.error,
    };
    await this.request("node.invoke.result", params);
  }

  async sendNodeEvent(args: { event: string; payload?: unknown; payloadJSON?: string }): Promise<void> {
    const params = { event: args.event, payload: args.payload, payloadJSON: args.payloadJSON };
    await this.request("node.event", params);
  }

  private async connectLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.connectOnce();
      } catch (err) {
        this.opts.logger.error("gateway connect failed", { error: String(err) });
      }
      if (this.stopped) return;
      const delayMs = this.opts.reconnectDelayMs ?? 750;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  private async connectOnce(): Promise<void> {
    const { url, logger } = this.opts;
    this.connected = false;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.on("message", (data) => this.onMessage(data));
    ws.on("close", (code, reason) => {
      this.connected = false;
      logger.warn("gateway closed", { code, reason: reason.toString() });
      for (const [id, p] of this.pending) {
        p.reject(new Error(`gateway closed: ${code}`));
        this.pending.delete(id);
      }
    });
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", (err) => reject(err));
    });
    const connectId = `connect_${randomUUID()}`;
    const connectFrame: ReqFrame = { type: "req", id: connectId, method: "connect", params: this.opts.connectParams };
    const helloRes = await new Promise<ResFrame>((resolve, reject) => {
      this.pending.set(connectId, {
        mode: "frame",
        resolve: (v) => resolve(v as ResFrame),
        reject,
      });
      ws.send(JSON.stringify(connectFrame), (err) => {
        if (err) {
          this.pending.delete(connectId);
          reject(err);
        }
      });
    });
    if (!helloRes.ok) {
      throw new Error(
        `gateway connect rejected: ${helloRes.error?.code ?? "UNKNOWN"} ${helloRes.error?.message ?? ""}`,
      );
    }
    this.connected = true;
    logger.info("gateway connected", { url });
    if (this.opts.onConnected) {
      try {
        await this.opts.onConnected();
      } catch (err) {
        logger.warn("onConnected failed", { error: String(err) });
      }
    }
    if (this.invokeQueue.length > 0) {
      const queued = this.invokeQueue;
      this.invokeQueue = [];
      for (const payload of queued) {
        Promise.resolve(this.opts.onNodeInvokeRequest(payload)).catch((err) => {
          this.opts.logger.error("onNodeInvokeRequest failed", { error: String(err) });
        });
      }
    }
    await new Promise<void>((resolve) => ws.once("close", () => resolve()));
  }

  private onMessage(data: WebSocket.RawData): void {
    const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : data.toString();
    let frame: Frame;
    try {
      frame = JSON.parse(text) as Frame;
    } catch {
      return;
    }
    if (frame.type === "res") {
      const pending = this.pending.get(frame.id);
      if (!pending) return;
      this.pending.delete(frame.id);
      if (pending.mode === "frame") {
        pending.resolve(frame);
        return;
      }
      if (!frame.ok) pending.reject(new Error(frame.error?.message ?? "gateway error"));
      else pending.resolve(frame.payload);
      return;
    }
    if (frame.type === "event" && frame.event === "node.invoke.request") {
      const payload = frame.payload as NodeInvokeRequestPayload;
      if (!this.connected) {
        this.invokeQueue.push(payload);
        return;
      }
      Promise.resolve(this.opts.onNodeInvokeRequest(payload)).catch((err) => {
        this.opts.logger.error("onNodeInvokeRequest failed", { error: String(err) });
      });
    }
  }
}
