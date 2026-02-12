# Gateway WS Methods（openclaw 参考契约）

ROOT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`

## Methods 列表如何形成与下发

- BASE methods 列表在 `BASE_METHODS` 中定义。证据：[server-methods-list.ts:L3-L88](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods-list.ts#L3-L88)
- 最终 methods = base + channel plugins 的 `gatewayMethods` 去重合并。证据：[server-methods-list.ts:L90-L93](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods-list.ts#L90-L93)
- 服务端在 `hello-ok.features.methods` 中下发 methods 列表。证据：[frames.ts:L83-L90](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/protocol/schema/frames.ts#L83-L90)

## 请求分发与 handler 聚合点（method → handler）

- 网关的 core handler 聚合在 `coreGatewayHandlers`，通过 spread 把各子域 handlers 合并。证据：[server-methods.ts:L162-L188](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L162-L188)
- 请求处理入口：`handleGatewayRequest()` 会先做授权校验，再按 `req.method` 取 handler。证据：[server-methods.ts:L190-L216](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L190-L216)

## 授权模型（methods 与 scopes）

openclaw 对 methods 做 role/scopes 授权控制（operator/node），并按方法集合划分 read/write/admin/pairing/approvals：\n证据：[server-methods.ts:L29-L160](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L29-L160)

## BASE_METHODS 覆盖（method → 实现文件）

下面是对 `BASE_METHODS` 的实现文件映射（覆盖率 ≥ 80% 的质量闸门）：\n- BASE 方法数量：82\n- 覆盖：82（其中 `health/status/wake/send/agent` 为 bare key，需要单独匹配）\n\n证据（BASE 清单）：[server-methods-list.ts:L3-L88](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods-list.ts#L3-L88)

### Health / Status

- `health`、`status`： [health.ts:L8-L32](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/health.ts#L8-L32)

### Logs

- `logs.tail`： [logs.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/logs.ts)

### Channels

- `channels.status`、`channels.logout`： [channels.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/channels.ts)

### Usage

- `usage.status`、`usage.cost`： [usage.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/usage.ts)

### TTS

- `tts.status/providers/enable/disable/convert/setProvider`： [tts.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/tts.ts)

### Config

- `config.get/set/apply/patch/schema`： [config.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/config.ts)

### Exec approvals

- `exec.approvals.*`： [exec-approvals.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/exec-approvals.ts)\n- `exec.approval.request/resolve`： [exec-approval.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/exec-approval.ts)

### Wizard / Talk

- `wizard.*`： [wizard.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/wizard.ts)\n- `talk.mode`： [talk.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/talk.ts)

### Models / Agents / Skills / Update

- `models.list`： [models.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/models.ts)\n- `agents.*`： [agents.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/agents.ts)\n- `skills.*`： [skills.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/skills.ts)\n- `update.run`： [update.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/update.ts)

### Voicewake

- `voicewake.get/set`： [voicewake.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/voicewake.ts)

### Sessions

- `sessions.*`： [sessions.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/sessions.ts)

### Heartbeat / System

- `last-heartbeat/set-heartbeats/system-presence/system-event`： [system.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/system.ts)

### Wake / Cron

- `wake` 与 `cron.*`： [cron.ts:L20-L47](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/cron.ts#L20-L47)

### Node / Device

- `node.*`： [nodes.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/nodes.ts)\n- `device.*`： [devices.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/devices.ts)

### Send

- `send`： [send.ts:L45-L58](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/send.ts#L45-L58)

### Agent（一次 agent turn）

- `agent`： [agent.ts:L45-L58](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/agent.ts#L45-L58)\n- `agent.identity.get/agent.wait`： [agent.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/agent.ts)

### Browser / Chat

- `browser.request`： [browser.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/browser.ts)\n- `chat.history/chat.send/chat.abort`： [chat.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/chat.ts)
