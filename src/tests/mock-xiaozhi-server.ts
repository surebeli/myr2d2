import { WebSocketServer } from "ws";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
};

type XiaoZhiEnvelope = {
  type: string;
  session_id?: string;
  payload?: any;
  [k: string]: any;
};

export type MockXiaoZhiServer = {
  url: string;
  close: () => Promise<void>;
};

export const startMockXiaoZhiServer = async (args: { port: number }): Promise<MockXiaoZhiServer> => {
  const wss = new WebSocketServer({ port: args.port });
  const sessionId = `sess_${args.port}`;

  wss.on("connection", (ws) => {
    ws.send(
      JSON.stringify({
        type: "hello",
        transport: "websocket",
        session_id: sessionId,
        features: { mcp: true },
        version: 1,
      }),
    );

    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : data.toString();
      let msg: XiaoZhiEnvelope;
      try {
        msg = JSON.parse(text) as XiaoZhiEnvelope;
      } catch {
        return;
      }
      if (msg.type === "listen") {
        return;
      }
      if (msg.type !== "mcp") return;
      const req = msg.payload as JsonRpcRequest;
      if (!req || req.jsonrpc !== "2.0" || req.id === undefined || typeof req.method !== "string") return;

      if (req.method === "tools/call") {
        ws.send(
          JSON.stringify({
            type: "mcp",
            session_id: sessionId,
            payload: {
              jsonrpc: "2.0",
              id: req.id,
              result: { content: [{ type: "text", text: "ok" }], isError: false },
            },
          }),
        );
        return;
      }

      if (req.method === "tools/list") {
        ws.send(
          JSON.stringify({
            type: "mcp",
            session_id: sessionId,
            payload: {
              jsonrpc: "2.0",
              id: req.id,
              result: {
                tools: [
                  {
                    name: "self.get_device_status",
                    description: "mock status",
                    inputSchema: { type: "object", properties: {} },
                  },
                ],
                nextCursor: "",
              },
            },
          }),
        );
        return;
      }

      if (req.method === "initialize") {
        ws.send(
          JSON.stringify({
            type: "mcp",
            session_id: sessionId,
            payload: {
              jsonrpc: "2.0",
              id: req.id,
              result: {
                protocolVersion: "2024-11-05",
                serverInfo: { name: "mock-xiaozhi", version: "0.0.0" },
                capabilities: {},
              },
            },
          }),
        );
      }
    });
  });

  await new Promise<void>((resolve) => wss.once("listening", () => resolve()));

  return {
    url: `ws://127.0.0.1:${args.port}`,
    close: async () => {
      for (const client of wss.clients) {
        client.close();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
};

