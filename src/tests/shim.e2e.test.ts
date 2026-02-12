import test from "node:test";
import assert from "node:assert/strict";

import { createConsoleLogger } from "../observability/logger.js";
import { createShim } from "../bridge/shim.js";
import type { ShimConfig } from "../bridge/types.js";
import { startMockXiaoZhiServer } from "./mock-xiaozhi-server.js";
import { startMockOpenClawGateway } from "./mock-openclaw-gateway.js";

test("shim bridges node.invoke.request to xiaozhi mcp and reports audio session binding", async () => {
  const gateway = await startMockOpenClawGateway({ port: 18791 });
  const xiaozhi = await startMockXiaoZhiServer({ port: 18081 });

  const cfg: ShimConfig = {
    openclaw: {
      gatewayUrl: gateway.url,
      nodeId: "myr2d2.xiaozhi",
      declaredCommands: ["mcp.tools.call", "edge.audio.stream.start", "edge.audio.stream.stop", "mcp.tools.list"],
    },
    mcp: { url: xiaozhi.url },
    dataPlane: { url: xiaozhi.url },
  };

  const shim = createShim(cfg, createConsoleLogger("error"));
  shim.start();

  try {
    await gateway.waitForNodeConnected();
    await new Promise((r) => setTimeout(r, 150));

    gateway.sendNodeInvokeRequest({
      id: "inv1",
      nodeId: "myr2d2.xiaozhi",
      command: "mcp.tools.call",
      paramsJSON: JSON.stringify({ name: "self.get_device_status", arguments: {} }),
      timeoutMs: 2_000,
      idempotencyKey: "k1",
    });

    const r1 = await gateway.waitForInvokeResult("inv1");
    assert.equal(r1.ok, true);
    assert.equal(r1.nodeId, "myr2d2.xiaozhi");
    assert.equal(Array.isArray(r1.payload?.content), true);
    assert.equal(r1.payload?.content?.[0]?.text, "ok");

    gateway.sendNodeInvokeRequest({
      id: "inv2",
      nodeId: "myr2d2.xiaozhi",
      command: "edge.audio.stream.start",
      paramsJSON: JSON.stringify({}),
      timeoutMs: 2_000,
      idempotencyKey: "k2",
    });

    const ev = await gateway.waitForNodeEvent("edge.audio.stream.state");
    assert.equal(ev.event, "edge.audio.stream.state");
    assert.equal(ev.payload?.state, "started");
    assert.equal(typeof ev.payload?.session_id, "string");

    const r2 = await gateway.waitForInvokeResult("inv2");
    assert.equal(r2.ok, true);
    assert.equal(r2.payload?.session_id, ev.payload?.session_id);
  } finally {
    shim.stop();
    await gateway.close();
    await xiaozhi.close();
  }
});
