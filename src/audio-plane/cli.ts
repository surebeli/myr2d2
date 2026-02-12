import { createConsoleLogger } from "../observability/logger.js";
import { startAudioPlaneServer } from "./server.js";

const port = Number(process.env.MYR2D2_AUDIO_PLANE_PORT ?? "18880");
const logger = createConsoleLogger((process.env.MYR2D2_LOG_LEVEL as any) || "info");
const mockTranscript = process.env.MYR2D2_AUDIO_PLANE_MOCK_TRANSCRIPT?.trim() || undefined;
const mockTtsText = process.env.MYR2D2_AUDIO_PLANE_MOCK_TTS?.trim() || undefined;

await startAudioPlaneServer({ port, logger, mockTranscript, mockTtsText });
await new Promise(() => {});

