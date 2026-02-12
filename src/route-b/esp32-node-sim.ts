import { randomUUID } from "node:crypto";
import type { Logger } from "../observability/logger.js";
import type { NodeInvokeRequestPayload, OpenClawConnectParams } from "../bridge/openclaw-gateway-node-client.js";
import { OpenClawGatewayNodeClient } from "../bridge/openclaw-gateway-node-client.js";
import type { AudioPlayStartParams, AudioStreamStartParams, WakeEventPayload } from "./types.js";

export type Esp32NodeSimConfig = {
  gatewayUrl: string;
  nodeId: string;
  token?: string;
  password?: string;
  declaredCommands: string[];
  audioPlaneBaseUrl: string;
};

export type Esp32NodeSim = {
  start: () => void;
  stop: () => void;
  triggerWake: (payload?: WakeEventPayload) => Promise<void>;
};

export const createEsp32NodeSim = (cfg: Esp32NodeSimConfig, logger: Logger): Esp32NodeSim => {
  const connectParams: OpenClawConnectParams = {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: "myr2d2.esp32-node-sim",
      displayName: cfg.nodeId,
      version: "0.0.0",
      platform: process.platform,
      mode: "node",
      instanceId: cfg.nodeId,
      modelIdentifier: "esp32-sim",
    },
    role: "node",
    scopes: [],
    caps: ["myr2d2", "esp32"],
    commands: cfg.declaredCommands,
    auth: { token: cfg.token, password: cfg.password },
  };

  const gateway = new OpenClawGatewayNodeClient({
    url: cfg.gatewayUrl,
    connectParams,
    logger,
    onConnected: async () => {
      await gateway.sendNodeEvent({
        event: "device.ready",
        payload: { node_id: cfg.nodeId, ts: new Date().toISOString() },
      });
    },
    onNodeInvokeRequest: async (payload) => {
      await handleInvoke({ cfg, gateway, payload, logger });
    },
  });

  return {
    start: () => gateway.start(),
    stop: () => gateway.stop(),
    triggerWake: async (payload) => {
      await gateway.sendNodeEvent({
        event: "voice.wake",
        payload: payload ?? { wake_word: "hey myr2d2", confidence: 0.9, ts: new Date().toISOString() },
      });
    },
  };
};

const handleInvoke = async (args: {
  cfg: Esp32NodeSimConfig;
  gateway: OpenClawGatewayNodeClient;
  payload: NodeInvokeRequestPayload;
  logger: Logger;
}): Promise<void> => {
  const { cfg, gateway, payload, logger } = args;
  const requestId = String(payload.id ?? "");
  const nodeId = String(payload.nodeId ?? cfg.nodeId);
  const command = String(payload.command ?? "");

  const sendOk = async (result: unknown) => {
    await gateway.sendNodeInvokeResult({ requestId, nodeId, ok: true, payload: result });
  };
  const sendErr = async (code: string, message: string) => {
    await gateway.sendNodeInvokeResult({ requestId, nodeId, ok: false, error: { code, message } });
  };

  let params: unknown = undefined;
  if (typeof payload.paramsJSON === "string" && payload.paramsJSON.trim()) {
    try {
      params = JSON.parse(payload.paramsJSON) as unknown;
    } catch (err) {
      await sendErr("E_BAD_REQUEST", `invalid paramsJSON: ${String(err)}`);
      return;
    }
  }

  if (command === "audio.stream.start") {
    const p = (params ?? {}) as AudioStreamStartParams;
    const sessionId = `aud_${randomUUID()}`;
    const token = randomUUID();
    const uplinkUrl = `${cfg.audioPlaneBaseUrl.replace(/\/+$/, "")}/uplink?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}&codec=${encodeURIComponent(
      p.codec ?? "opus",
    )}&sample_rate=${encodeURIComponent(String(p.sampleRate ?? 16000))}&channels=${encodeURIComponent(String(p.channels ?? 1))}`;
    const downlinkUrl = `${cfg.audioPlaneBaseUrl.replace(/\/+$/, "")}/downlink?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}&codec=${encodeURIComponent(
      p.codec ?? "opus",
    )}&sample_rate=${encodeURIComponent(String(p.sampleRate ?? 16000))}&channels=${encodeURIComponent(String(p.channels ?? 1))}`;

    await gateway.sendNodeEvent({
      event: "audio.stream.state",
      payload: { state: "started", session_id: sessionId },
    });
    await sendOk({ session_id: sessionId, uplink_url: uplinkUrl, downlink_url: downlinkUrl, token });
    return;
  }

  if (command === "audio.stream.stop") {
    await gateway.sendNodeEvent({
      event: "audio.stream.state",
      payload: { state: "stopped" },
    });
    await sendOk({});
    return;
  }

  if (command === "audio.play.start") {
    const p = (params ?? {}) as AudioPlayStartParams;
    const sessionId = `play_${randomUUID()}`;
    const token = randomUUID();
    const downlinkUrl = `${cfg.audioPlaneBaseUrl.replace(/\/+$/, "")}/downlink?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}&codec=${encodeURIComponent(
      p.codec ?? "opus",
    )}&sample_rate=${encodeURIComponent(String(p.sampleRate ?? 24000))}&channels=${encodeURIComponent(String(p.channels ?? 1))}`;
    await gateway.sendNodeEvent({
      event: "audio.play.state",
      payload: { state: "started", session_id: sessionId },
    });
    await sendOk({ session_id: sessionId, downlink_url: downlinkUrl, token });
    return;
  }

  if (command === "audio.play.stop") {
    await gateway.sendNodeEvent({
      event: "audio.play.state",
      payload: { state: "stopped" },
    });
    await sendOk({});
    return;
  }

  if (command === "device.wake.mock") {
    await gateway.sendNodeEvent({
      event: "voice.wake",
      payload: { wake_word: "hey myr2d2", confidence: 0.9, ts: new Date().toISOString() },
    });
    await sendOk({ ok: true });
    return;
  }

  logger.warn("unknown command", { command });
  await sendErr("E_UNKNOWN_COMMAND", `unknown command: ${command}`);
};
