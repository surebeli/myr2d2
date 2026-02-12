import { WebSocketServer } from "ws";

type ReqFrame = { type: "req"; id: string; method: string; params?: any };
type ResFrame = { type: "res"; id: string; ok: boolean; payload?: any; error?: any };
type EventFrame = { type: "event"; event: string; payload?: any };
type Frame = ReqFrame | ResFrame | EventFrame;

export type MockOpenClawGateway = {
  url: string;
  waitForNodeConnected: () => Promise<void>;
  sendNodeInvokeRequest: (payload: any) => void;
  waitForInvokeResult: (requestId: string, timeoutMs?: number) => Promise<any>;
  waitForNodeEvent: (eventName: string, timeoutMs?: number) => Promise<any>;
  close: () => Promise<void>;
};

export const startMockOpenClawGateway = async (args: { port: number }): Promise<MockOpenClawGateway> => {
  const wss = new WebSocketServer({ port: args.port });
  const url = `ws://127.0.0.1:${args.port}`;

  let nodeSocket: import("ws").WebSocket | null = null;
  let nodeConnectedResolve: (() => void) | null = null;
  const nodeConnected = new Promise<void>((resolve) => {
    nodeConnectedResolve = resolve;
  });

  const invokeResults = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  const nodeEvents = new Map<string, Array<any>>();
  const nodeEventWaiters = new Map<string, Array<(v: any) => void>>();

  const respond = (ws: import("ws").WebSocket, id: string, ok: boolean, payload?: any, error?: any) => {
    const res: ResFrame = { type: "res", id, ok, payload, error };
    ws.send(JSON.stringify(res));
  };

  wss.on("connection", (ws) => {
    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : data.toString();
      let frame: Frame;
      try {
        frame = JSON.parse(text) as Frame;
      } catch {
        return;
      }
      if (frame.type !== "req") return;

      if (frame.method === "connect") {
        nodeSocket = ws;
        nodeConnectedResolve?.();
        respond(ws, frame.id, true, {
          type: "hello-ok",
          protocol: 3,
          server: { version: "test", host: "mock", connId: "mock" },
          features: { methods: [], events: ["node.invoke.request"] },
          snapshot: { presence: [], stateVersion: {} },
          policy: { maxPayload: 1_000_000, maxBufferedBytes: 1_000_000, tickIntervalMs: 500 },
        });
        return;
      }

      if (frame.method === "node.invoke.result") {
        const reqId = String(frame.params?.id ?? "");
        respond(ws, frame.id, true, {});
        const waiter = invokeResults.get(reqId);
        if (waiter) {
          invokeResults.delete(reqId);
          waiter.resolve(frame.params);
        }
        return;
      }

      if (frame.method === "node.event") {
        respond(ws, frame.id, true, {});
        const eventName = String(frame.params?.event ?? "");
        const payload = frame.params;
        const buf = nodeEvents.get(eventName) ?? [];
        buf.push(payload);
        nodeEvents.set(eventName, buf);
        const waiters = nodeEventWaiters.get(eventName);
        if (waiters && waiters.length > 0) {
          const resolveOne = waiters.shift()!;
          resolveOne(payload);
        }
        return;
      }

      respond(ws, frame.id, true, {});
    });
  });

  await new Promise<void>((resolve) => wss.once("listening", () => resolve()));

  const waitForInvokeResult = async (requestId: string, timeoutMs = 2_000): Promise<any> => {
    const existing = invokeResults.get(requestId);
    if (existing) throw new Error("duplicate waiter");
    return await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        invokeResults.delete(requestId);
        reject(new Error("timeout waiting invoke result"));
      }, timeoutMs);
      invokeResults.set(requestId, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });
    });
  };

  const waitForNodeEvent = async (eventName: string, timeoutMs = 2_000): Promise<any> => {
    const buffered = nodeEvents.get(eventName);
    if (buffered && buffered.length > 0) return buffered.shift();
    return await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("timeout waiting node event"));
      }, timeoutMs);
      const list = nodeEventWaiters.get(eventName) ?? [];
      list.push((v) => {
        clearTimeout(timeout);
        resolve(v);
      });
      nodeEventWaiters.set(eventName, list);
    });
  };

  return {
    url,
    waitForNodeConnected: async () => {
      await nodeConnected;
    },
    sendNodeInvokeRequest: (payload) => {
      if (!nodeSocket) throw new Error("node not connected");
      const evt: EventFrame = { type: "event", event: "node.invoke.request", payload };
      nodeSocket.send(JSON.stringify(evt));
    },
    waitForInvokeResult,
    waitForNodeEvent,
    close: async () => {
      for (const client of wss.clients) {
        client.close();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
};

