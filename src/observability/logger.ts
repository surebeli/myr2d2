export type LogLevel = "debug" | "info" | "warn" | "error";

export type Logger = {
  debug: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
};

export const createConsoleLogger = (level: LogLevel = "info"): Logger => {
  const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  const min = order[level];
  const emit = (lvl: LogLevel, message: string, fields?: Record<string, unknown>) => {
    if (order[lvl] < min) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level: lvl,
      message,
      ...(fields ?? {}),
    });
    const fn =
      lvl === "error" ? console.error : lvl === "warn" ? console.warn : lvl === "debug" ? console.debug : console.log;
    fn(line);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
};

