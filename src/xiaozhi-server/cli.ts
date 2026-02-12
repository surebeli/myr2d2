import { createConsoleLogger } from "../observability/logger.js";
import { startXiaoZhiCompatibleServer } from "./server.js";

const port = Number(process.env.MYR2D2_XIAOZHI_SERVER_PORT ?? "18080");
const mockTranscript = process.env.MYR2D2_XIAOZHI_SERVER_MOCK_TRANSCRIPT?.trim() || undefined;
const logger = createConsoleLogger((process.env.MYR2D2_LOG_LEVEL as any) || "info");

await startXiaoZhiCompatibleServer({ port, logger, mockTranscript });
await new Promise(() => {});

