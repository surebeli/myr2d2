import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function encodeRpcMessage(obj) {
  const json = Buffer.from(JSON.stringify(obj), "utf8");
  const header = Buffer.from(`Content-Length: ${json.length}\r\n\r\n`, "utf8");
  return Buffer.concat([header, json]);
}

function createMessageParser(onMessage) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const contentLengthStart = buffer.indexOf("Content-Length:");
      if (contentLengthStart === -1) {
        buffer = Buffer.alloc(0);
        return;
      }
      if (contentLengthStart > 0) {
        buffer = buffer.slice(contentLengthStart);
      }
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\\s*(\\d+)/i);
      if (!match) throw new Error("Missing Content-Length");
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (buffer.length < bodyEnd) return;
      const body = buffer.slice(bodyStart, bodyEnd).toString("utf8");
      buffer = buffer.slice(bodyEnd);
      onMessage(JSON.parse(body));
    }
  };
}

async function callToolOverMcp({ tool, content, dark = "auto", lightbox = false }) {
  function createJsonLineParser(onMessage) {
    let buffer = "";
    return (chunk) => {
      buffer += chunk.toString("utf8");
      while (true) {
        const idx = buffer.indexOf("\n");
        if (idx === -1) return;
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          onMessage(JSON.parse(line));
        } catch {
          continue;
        }
      }
    };
  }

  const run = async (mode) => {
    const child = spawn("npx", ["-y", "@drawio/mcp"], { stdio: ["pipe", "pipe", "inherit"] });

    const pending = new Map();
    const feed =
      mode === "framed"
        ? createMessageParser((msg) => {
            if (msg && typeof msg === "object" && "id" in msg && pending.has(msg.id)) {
              pending.get(msg.id)(msg);
              pending.delete(msg.id);
            }
          })
        : createJsonLineParser((msg) => {
            if (msg && typeof msg === "object" && "id" in msg && pending.has(msg.id)) {
              pending.get(msg.id)(msg);
              pending.delete(msg.id);
            }
          });
    child.stdout.on("data", feed);

    const send = (obj) => {
      if (mode === "framed") {
        child.stdin.write(encodeRpcMessage(obj));
      } else {
        child.stdin.write(`${JSON.stringify(obj)}\n`, "utf8");
      }
    };

    const request = (method, params) =>
      new Promise((resolve, reject) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const timeout = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error(`Timeout calling ${method}`));
          }
        }, 30_000);
        pending.set(id, (msg) => {
          clearTimeout(timeout);
          resolve(msg);
        });
        send({ jsonrpc: "2.0", id, method, params });
      });

    try {
      const init = await request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "myr2d2-docs", version: "0.0.0" },
      });
      if (init.error) throw new Error(JSON.stringify(init.error));
      send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

      const toolsList = await request("tools/list", {});
      if (toolsList.error) throw new Error(JSON.stringify(toolsList.error));
      const toolNames = (toolsList.result?.tools ?? []).map((t) => t?.name).filter(Boolean);
      if (!toolNames.includes(tool)) {
        throw new Error(`Tool not found: ${tool}. Available: ${toolNames.join(", ")}`);
      }

      const result = await request("tools/call", {
        name: tool,
        arguments: { content, dark, lightbox },
      });
      if (result.error) throw new Error(JSON.stringify(result.error));

      const items = result.result?.content ?? [];
      const text = items
        .filter((c) => c && typeof c === "object" && c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join("\n");
      const urlMatch = text.match(/https?:\/\/\S+/);
      if (!urlMatch) {
        throw new Error(`No URL found in tool result. Raw: ${text.slice(0, 500)}`);
      }
      return urlMatch[0];
    } finally {
      child.kill();
    }
  };

  try {
    return await run("line");
  } catch (e) {
    return await run("framed");
  }
}

function listMmdFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".mmd"))
    .map((e) => path.join(dir, e.name))
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    throw new Error("Usage: node scripts/drawio-mcp/generate-links.mjs <diagrams-dir>");
  }
  const absDir = path.resolve(process.cwd(), dir);
  const files = listMmdFiles(absDir);
  if (files.length === 0) {
    throw new Error(`No .mmd files found in ${absDir}`);
  }

  const out = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const url = await callToolOverMcp({
      tool: "open_drawio_mermaid",
      content,
      dark: "auto",
      lightbox: false,
    });
    out.push({
      source: path.relative(process.cwd(), file),
      tool: "open_drawio_mermaid",
      dark: "auto",
      lightbox: false,
      url,
    });
  }

  const outputPath = path.join(absDir, "links.json");
  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), items: out }, null, 2) + "\n");
  process.stdout.write(`${path.relative(process.cwd(), outputPath)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? String(err)}\n`);
  process.exit(1);
});
