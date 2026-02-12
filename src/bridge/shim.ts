import { createConsoleLogger } from "../observability/logger.js";
import { createTraceId } from "../observability/trace.js";
import type { Logger } from "../observability/logger.js";
import type { ShimConfig } from "./types.js";
import { OpenClawGatewayNodeClient } from "./openclaw-gateway-node-client.js";
import type { NodeInvokeRequestPayload, OpenClawConnectParams } from "./openclaw-gateway-node-client.js";
import { XiaoZhiWsTransport } from "./xiaozhi-ws-transport.js";
import type { JsonRpcId } from "./xiaozhi-ws-transport.js";

const PROTOCOL_VERSION = 3;

type InflightKey = string;

export const runShimFromEnv = async (): Promise<void> => {
  const gatewayUrl = process.env.MYR2D2_GATEWAY_URL?.trim() || "ws://127.0.0.1:18789";
  const gatewayToken = process.env.MYR2D2_GATEWAY_TOKEN?.trim() || undefined;
  const gatewayPassword = process.env.MYR2D2_GATEWAY_PASSWORD?.trim() || undefined;
  const nodeId = process.env.MYR2D2_NODE_ID?.trim() || "myr2d2.xiaozhi";
  const nodeDisplayName = process.env.MYR2D2_NODE_DISPLAY_NAME?.trim() || "myr2d2 xiaozhi shim";
  const declaredCommands =
    process.env.MYR2D2_DECLARED_COMMANDS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
      "mcp.initialize",
      "mcp.tools.list",
      "mcp.tools.call",
      "edge.audio.stream.start",
      "edge.audio.stream.stop",
    ];
  const xiaozhiUrl = process.env.MYR2D2_XIAOZHI_WS_URL?.trim() || "ws://127.0.0.1:18080";
  const logLevel = (process.env.MYR2D2_LOG_LEVEL?.trim() as "debug" | "info" | "warn" | "error") || "info";

  const cfg: ShimConfig = {
    openclaw: {
      gatewayUrl,
      nodeId,
      token: gatewayToken,
      password: gatewayPassword,
      declaredCommands,
    },
    mcp: { url: xiaozhiUrl },
    dataPlane: { url: xiaozhiUrl },
  };

  await runShim(cfg, createConsoleLogger(logLevel));
};

export type ShimInstance = {
  start: () => void;
  stop: () => void;
};

export const createShim = (cfg: ShimConfig, logger: Logger): ShimInstance => {
  const inflight = new Map<InflightKey, Promise<unknown>>();

  let gateway: OpenClawGatewayNodeClient;
  const xiaozhi = new XiaoZhiWsTransport({
    url: cfg.dataPlane.url ?? cfg.mcp.url,
    logger,
    onJsonRpcNotification: (n) => {
      void gateway.sendNodeEvent({
        event: "mcp.notification",
        payload: { ...n, _meta: { trace_id: createTraceId(), session_id: xiaozhi.getSessionId() } },
      });
    },
  });

  const connectParams: OpenClawConnectParams = {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: {
      id: "myr2d2.shim",
      displayName: cfg.openclaw.nodeId,
      version: "0.0.0",
      platform: process.platform,
      mode: "node",
      instanceId: cfg.openclaw.nodeId,
      modelIdentifier: nodeVersion(),
    },
    role: "node",
    scopes: [],
    caps: ["myr2d2", "xiaozhi"],
    commands: cfg.openclaw.declaredCommands,
    auth: { token: cfg.openclaw.token, password: cfg.openclaw.password },
  };

  gateway = new OpenClawGatewayNodeClient({
    url: cfg.openclaw.gatewayUrl,
    connectParams,
    logger,
    onNodeInvokeRequest: async (payload) => {
      await handleNodeInvokeRequest({ cfg, gateway, xiaozhi, inflight, payload, logger });
    },
  });

  return {
    start: () => {
      xiaozhi.start();
      gateway.start();
    },
    stop: () => {
      gateway.stop();
      xiaozhi.stop();
    },
  };
};

export const runShim = async (cfg: ShimConfig, logger: Logger): Promise<void> => {
  const shim = createShim(cfg, logger);
  shim.start();
  await new Promise(() => {});
};

const handleNodeInvokeRequest = async (args: {
  cfg: ShimConfig;
  gateway: OpenClawGatewayNodeClient;
  xiaozhi: XiaoZhiWsTransport;
  inflight: Map<InflightKey, Promise<unknown>>;
  payload: NodeInvokeRequestPayload;
  logger: Logger;
}): Promise<void> => {
  const { cfg, gateway, xiaozhi, inflight, payload, logger } = args;
  const requestId = String(payload.id ?? "");
  const nodeId = String(payload.nodeId ?? cfg.openclaw.nodeId);
  const command = String(payload.command ?? "");
  const timeoutMs = typeof payload.timeoutMs === "number" && payload.timeoutMs > 0 ? payload.timeoutMs : 30_000;
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : "";
  const paramsParsed = tryParseParams(payload.paramsJSON);
  if (!paramsParsed.ok) {
    await gateway.sendNodeInvokeResult({
      requestId,
      nodeId,
      ok: false,
      error: { code: "E_BAD_REQUEST", message: paramsParsed.errorMessage },
    });
    return;
  }
  const params = paramsParsed.value;
  const traceId = createTraceId();

  const inflightKey = `${nodeId}:${command}:${idempotencyKey || requestId}`;
  const existing = inflight.get(inflightKey);
  if (existing) {
    try {
      const cached = await existing;
      await gateway.sendNodeInvokeResult({ requestId, nodeId, ok: true, payload: cached });
    } catch (err) {
      await gateway.sendNodeInvokeResult({
        requestId,
        nodeId,
        ok: false,
        error: { code: "E_INFLIGHT", message: String(err) },
      });
    }
    return;
  }

  const promise = (async () => {
    if (command === "edge.audio.stream.start") {
      const res = await xiaozhi.listenStart("start");
      const sessionId = res.sessionId ?? xiaozhi.getSessionId();
      await gateway.sendNodeEvent({
        event: "edge.audio.stream.state",
        payload: { state: "started", session_id: sessionId, trace_id: traceId },
      });
      return { session_id: sessionId };
    }
    if (command === "edge.audio.stream.stop") {
      const res = await xiaozhi.listenStop();
      const sessionId = res.sessionId ?? xiaozhi.getSessionId();
      await gateway.sendNodeEvent({
        event: "edge.audio.stream.state",
        payload: { state: "stopped", session_id: sessionId, trace_id: traceId },
      });
      return { session_id: sessionId };
    }
    if (command === "mcp.initialize") {
      const result = await xiaozhi.callJsonRpc(
        {
          jsonrpc: "2.0",
          id: requestId as JsonRpcId,
          method: "initialize",
          params: {
            ...(params ?? {}),
            _meta: { trace_id: traceId, session_id: xiaozhi.getSessionId(), idempotency_key: idempotencyKey },
          },
        },
        timeoutMs,
      );
      return result;
    }
    if (command === "mcp.tools.list") {
      const result = await xiaozhi.callJsonRpc(
        {
          jsonrpc: "2.0",
          id: requestId as JsonRpcId,
          method: "tools/list",
          params: {
            ...(params ?? {}),
            _meta: { trace_id: traceId, session_id: xiaozhi.getSessionId(), idempotency_key: idempotencyKey },
          },
        },
        timeoutMs,
      );
      return result;
    }
    if (command === "mcp.tools.call") {
      const result = await xiaozhi.callJsonRpc(
        {
          jsonrpc: "2.0",
          id: requestId as JsonRpcId,
          method: "tools/call",
          params: {
            ...(params ?? {}),
            _meta: { trace_id: traceId, session_id: xiaozhi.getSessionId(), idempotency_key: idempotencyKey },
          },
        },
        timeoutMs,
      );
      return result;
    }
    throw new Error(`unknown command: ${command}`);
  })();

  inflight.set(inflightKey, promise);
  try {
    const out = await promise;
    await gateway.sendNodeInvokeResult({ requestId, nodeId, ok: true, payload: out });
  } catch (err) {
    logger.warn("invoke failed", { requestId, command, error: String(err) });
    const msg = String(err);
    const isTimeout = msg.toLowerCase().includes("timeout");
    await gateway.sendNodeInvokeResult({
      requestId,
      nodeId,
      ok: false,
      error: { code: isTimeout ? "E_TIMEOUT" : "E_MCP_ERROR", message: msg },
    });
  } finally {
    inflight.delete(inflightKey);
  }
};

const tryParseParams = (
  paramsJSON: string | null | undefined,
): { ok: true; value: unknown } | { ok: false; errorMessage: string } => {
  if (!paramsJSON) return { ok: true, value: undefined };
  if (typeof paramsJSON !== "string") return { ok: true, value: undefined };
  const trimmed = paramsJSON.trim();
  if (!trimmed) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (err) {
    return { ok: false, errorMessage: `invalid paramsJSON: ${String(err)}` };
  }
};

const nodeVersion = (): string => {
  const v = process.version?.trim();
  return v ? `node ${v}` : "node";
};
