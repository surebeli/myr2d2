# 与 XiaoZhi 的对接映射（openclaw node.invoke ↔ MCP tools/call）

目标：把 XiaoZhi 端侧的 MCP Tool Use（`tools/list`、`tools/call`）接入到 openclaw 风格的“强控制面 Gateway”，让 my r2d2 基座可以用统一的 WS 控制面编排端侧能力。

ROOT（openclaw）：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`\nROOT（xiaozhi）：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32`

## 1) 两端契约的最小公共面

### openclaw：node.invoke / node.invoke.result / node.event

- `node.invoke`：operator 调用 gateway，再由 gateway 下发 `node.invoke.request` 给 node，并等待 `node.invoke.result` 回包。证据：[nodes.ts:L364-L490](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/nodes.ts#L364-L490)、[node-registry.ts:L107-L155](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/node-registry.ts#L107-L155)
- `node.event`：node 可主动向 gateway 上报事件（携带 `payloadJSON`）。证据：[nodes.ts:L491-L536](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/nodes.ts#L491-L536)
- 端侧命令必须同时满足 allowlist + declaredCommands。证据：[nodes.ts:L403-L418](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/nodes.ts#L403-L418)、[node-command-policy.ts:L117-L137](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/node-command-policy.ts#L117-L137)
- allowlist 可以叠加 config 的 `gateway.nodes.allowCommands/denyCommands`。证据：[node-command-policy.ts:L99-L115](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/node-command-policy.ts#L99-L115)

### XiaoZhi：MCP JSON-RPC（initialize/tools/list/tools/call）

- XiaoZhi 的 MCP 消息体是 JSON-RPC 2.0，常用 methods：`initialize`、`tools/list`、`tools/call`。证据：[mcp-protocol.md:L7-L25](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32/docs/mcp-protocol.md#L7-L25)
- `tools/list` 返回 tools 列表（含 `name/description/inputSchema`）。证据：[mcp-protocol.md:L108-L147](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32/docs/mcp-protocol.md#L108-L147)
- `tools/call` 请求包含 `{name, arguments}`，响应 `result.content[]`。证据：[mcp-protocol.md:L150-L184](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32/docs/mcp-protocol.md#L150-L184)

## 2) 推荐对接形态（路线 A）：XiaoZhi 作为 Gateway 的 Node

核心做法：实现一个 “Node Shim”\n- 上游：以 role=node 连接 openclaw Gateway（复用 `GatewayClient` 连接逻辑）\n- 下游：以 MCP client 身份连接 XiaoZhi（WebSocket 或 MQTT 等）\n- 翻译层：把 `node.invoke.request` 翻译成 `tools/call`；把 `tools/list` 暴露成 `node.invoke` 命令；把 MCP notifications 翻译为 `node.event`

关键收益：\n- 控制面单一：所有端侧能力通过 Gateway WS 统一进入调度/权限/审计\n- 端侧多样：不同端侧（ESP32、手机、桌面）都能用同一 `node.invoke` 总线接入

## 3) 命令命名与 allowlist 策略（建议）

为了兼容 openclaw 的 “allowlist + declaredCommands” 机制，建议为 XiaoZhi 端侧新增一组稳定命名空间，并通过 config 允许：\n- `gateway.nodes.allowCommands += [\"mcp.tools.list\",\"mcp.tools.call\",\"mcp.initialize\",\"mcp.notify\"]`\n\n证据：allowCommands/denyCommands 在 allowlist 合并中生效。 [node-command-policy.ts:L99-L115](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/node-command-policy.ts#L99-L115)

同时，Node Shim 在 connect 时应把它实际支持的 commands 上报（declaredCommands），以通过二次校验。证据：node.invoke 校验 declaredCommands。 [node-command-policy.ts:L129-L135](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/node-command-policy.ts#L129-L135)

## 4) 映射表（node.invoke.command → MCP method）

### 4.1 MCP 初始化

- `node.invoke.command = \"mcp.initialize\"`\n  - params：`{ capabilities?: {...} }`\n  - shim → 发送 JSON-RPC request：`method=\"initialize\" params={capabilities}`\n  - 返回：`{ protocolVersion, serverInfo, capabilities }`\n\n证据：initialize 交互格式。 [mcp-protocol.md:L61-L106](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32/docs/mcp-protocol.md#L61-L106)

### 4.2 工具发现

- `node.invoke.command = \"mcp.tools.list\"`\n  - params：`{ cursor?: string }`\n  - shim → JSON-RPC：`method=\"tools/list\" params={cursor:\"\"}`\n  - 返回：`{ tools:[{name,description,inputSchema}], nextCursor }`\n\n证据：tools/list 请求/响应。 [mcp-protocol.md:L108-L147](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32/docs/mcp-protocol.md#L108-L147)

### 4.3 工具调用

- `node.invoke.command = \"mcp.tools.call\"`\n  - params：`{ name: string, arguments: object }`\n  - shim → JSON-RPC：`method=\"tools/call\" params={name,arguments}`\n  - 返回：`{ content:[...], isError:false }` 或 JSON-RPC error\n\n证据：tools/call 请求/响应。 [mcp-protocol.md:L150-L194](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32/docs/mcp-protocol.md#L150-L194)

## 5) 异步通知：MCP notifications → node.event

XiaoZhi 允许设备主动发 notifications（JSON-RPC 无 `id`）。证据：[mcp-protocol.md:L197-L213](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32/docs/mcp-protocol.md#L197-L213)

建议 Node Shim 将其转为 openclaw 的 `node.event`：\n- `node.event.params = { event: \"mcp.notification\", payloadJSON: <原始 notification JSON> }`\n\n证据：node.event 支持 `payloadJSON` 并会路由到 server-node-events 处理。 [nodes.ts:L500-L533](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/nodes.ts#L500-L533)

## 6) 音频/视频流：控制面与数据面分离（推荐）

原因：Gateway WS 更适合作为控制面（命令、状态、审计），而音视频是高吞吐数据面。\n- 控制面：node.invoke / node.event（命令与状态）\n- 数据面：沿用 XiaoZhi 的 WebSocket/MQTT+UDP（或升级为 WebRTC），Gateway 仅分发“开始/停止/参数变更”命令
\n该选择与 XiaoZhi “WebSocket/MQTT 实现完整，UDP 加密增强安全性”的结论一致。证据：[analysis_report_my_xiaozhi_esp32.md:L131-L133](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/xiaozhi/analysis_report_my_xiaozhi_esp32.md#L131-L133)

