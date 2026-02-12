import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";

import { createConsoleLogger } from "../observability/logger.js";
import { startMockOpenClawGateway } from "./mock-openclaw-gateway.js";
import { startAudioPlaneServer } from "../audio-plane/server.js";
import { createEsp32NodeSim } from "../route-b/esp32-node-sim.js";

type WsMsg = { text?: string; bin?: Buffer };

const createWsQueue = (ws: WebSocket) => {
  const buf: WsMsg[] = [];
  const waiters: Array<(v: WsMsg) => void> = [];
  ws.on("message", (data, isBinary) => {
    const msg: WsMsg = isBinary
      ? { bin: Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer) }
      : { text: typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : data.toString() };
    const w = waiters.shift();
    if (w) w(msg);
    else buf.push(msg);
  });
  return {
    next: async (timeoutMs = 2_000): Promise<WsMsg> => {
      const existing = buf.shift();
      if (existing) return existing;
      return await new Promise<WsMsg>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("timeout waiting ws message")), timeoutMs);
        waiters.push((v) => {
          clearTimeout(t);
          resolve(v);
        });
      });
    },
  };
};

test("route B: node sim connects, handles audio.stream.start, and audio plane emits mock asr/tts", async () => {
  const logger = createConsoleLogger("error");
  const gateway = await startMockOpenClawGateway({ port: 18792 });
  const audioPlane = await startAudioPlaneServer({ port: 18881, logger, mockTranscript: "hello", mockTtsText: "ok" });

  const node = createEsp32NodeSim(
    {
      gatewayUrl: gateway.url,
      nodeId: "myr2d2.esp32",
      declaredCommands: ["audio.stream.start", "audio.stream.stop", "audio.play.start", "audio.play.stop", "device.wake.mock"],
      audioPlaneBaseUrl: audioPlane.baseUrl,
    },
    logger,
  );
  node.start();

  try {
    await gateway.waitForNodeConnected();
    await gateway.waitForNodeEvent("device.ready");

    gateway.sendNodeInvokeRequest({
      id: "s1",
      nodeId: "myr2d2.esp32",
      command: "audio.stream.start",
      paramsJSON: JSON.stringify({ codec: "opus", sampleRate: 16000, channels: 1 }),
      timeoutMs: 2_000,
      idempotencyKey: "k1",
    });

    const ev = await gateway.waitForNodeEvent("audio.stream.state");
    assert.equal(ev.event, "audio.stream.state");
    assert.equal(ev.payload?.state, "started");
    assert.equal(typeof ev.payload?.session_id, "string");

    const r = await gateway.waitForInvokeResult("s1");
    assert.equal(r.ok, true);
    assert.equal(typeof r.payload?.uplink_url, "string");
    assert.equal(typeof r.payload?.downlink_url, "string");
    assert.equal(typeof r.payload?.token, "string");

    const sessionId = String(r.payload.session_id);
    const token = String(r.payload.token);
    const downlink = new WebSocket(
      `${audioPlane.baseUrl}/downlink?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`,
    );
    const downQ = createWsQueue(downlink);
    await new Promise<void>((resolve, reject) => {
      downlink.once("open", () => resolve());
      downlink.once("error", (e) => reject(e));
    });
    const downReady = await downQ.next();
    assert.ok(downReady.text?.includes('"downlink.ready"'));

    const uplink = new WebSocket(
      `${audioPlane.baseUrl}/uplink?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`,
    );
    const upQ = createWsQueue(uplink);
    await new Promise<void>((resolve, reject) => {
      uplink.once("open", () => resolve());
      uplink.once("error", (e) => reject(e));
    });
    const upReady = await upQ.next();
    assert.ok(upReady.text?.includes('"uplink.ready"'));

    uplink.send(Buffer.from([1, 2, 3, 4, 5]));

    const m1 = await downQ.next();
    assert.ok(m1.text?.includes('"asr.mock"'));
    const m2 = await downQ.next();
    assert.ok(m2.text?.includes('"tts.mock"'));
    const m3 = await downQ.next();
    assert.equal(Buffer.isBuffer(m3.bin), true);

    uplink.close();
    downlink.close();
  } finally {
    node.stop();
    await gateway.close();
    await audioPlane.close();
  }
});
