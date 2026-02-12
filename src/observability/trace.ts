import { randomBytes } from "node:crypto";

export type TraceContext = {
  traceId: string;
  sessionId?: string;
};

export const createTraceId = (): string => {
  const bytes = randomBytes(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
