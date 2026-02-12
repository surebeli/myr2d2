import { createConsoleLogger } from "../observability/logger.js";
import { createEsp32NodeSim } from "./esp32-node-sim.js";

const logger = createConsoleLogger((process.env.MYR2D2_LOG_LEVEL as any) || "info");

const gatewayUrl = process.env.MYR2D2_GATEWAY_URL ?? "ws://127.0.0.1:18789";
const token = process.env.MYR2D2_GATEWAY_TOKEN;
const password = process.env.MYR2D2_GATEWAY_PASSWORD;
const nodeId = process.env.MYR2D2_NODE_ID ?? "myr2d2.esp32";
const declaredCommands = (process.env.MYR2D2_DECLARED_COMMANDS ?? "audio.stream.start,audio.stream.stop,audio.play.start,audio.play.stop,device.wake.mock")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const audioPlaneBaseUrl = process.env.MYR2D2_AUDIO_PLANE_BASE_URL ?? "ws://127.0.0.1:18880";

const node = createEsp32NodeSim(
  {
    gatewayUrl,
    nodeId,
    token,
    password,
    declaredCommands,
    audioPlaneBaseUrl,
  },
  logger,
);

node.start();

if ((process.env.MYR2D2_WAKE_ON_START ?? "").toLowerCase() === "true") {
  setTimeout(() => {
    void node.triggerWake();
  }, 500);
}

await new Promise(() => {});

