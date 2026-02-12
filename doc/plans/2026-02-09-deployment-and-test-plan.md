# 部署与测试方案（OpenClaw 真实集成 + XiaoZhi 设备联调）

日期：2026-02-09  
范围：不修改 `thirdparty/**`，只补齐“如何部署/如何测”的可执行 Runbook 与验收清单。

## 0. 当前状态（你能直接复用的东西）
- myr2d2 的桥接层（Node Shim）已在 `/src` 落地，并且有 Mock Gateway + Mock XiaoZhi 的端到端测试通过：`src/tests/shim.e2e.test.ts`。
- 真实接入 OpenClaw 时，operator 侧最常用命令为 `openclaw nodes list/status/pending/approve/invoke`（参考 [nodes.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/cli/nodes.md)）。

## 1) 真实 OpenClaw 集成 Runbook（配对、权限、调用）

### 1.1 准备 OpenClaw Gateway（Brain）
前置：Gateway 推荐运行在稳定主机（macOS/Linux；Windows 用 WSL2）。证据：[OpenClaw README](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/README.md)

1. 安装并启动 Gateway（示例）：

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw gateway --port 18789
```

2. 远程访问（可选）：保持 Gateway loopback，仅用 SSH/tailnet 转发。证据：[remote.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/gateway/remote.md)

### 1.2 让 Shim 作为 Node 连接到 Gateway
说明：MVP 阶段优先走“共享密钥（token/password）”连接，这样可以跳过 device identity 签名与 pairing 的复杂度；后续再升级为严格的 node pairing token。

在运行 shim 的主机（通常同一台或同一 LAN 内另一台）设置环境变量：

```bash
export MYR2D2_GATEWAY_URL="ws://127.0.0.1:18789"
export MYR2D2_GATEWAY_TOKEN="your-gateway-token"   # 或 MYR2D2_GATEWAY_PASSWORD
export MYR2D2_NODE_ID="myr2d2.xiaozhi"
export MYR2D2_XIAOZHI_WS_URL="ws://<xiaozhi-host>:<port>"
export MYR2D2_DECLARED_COMMANDS="mcp.initialize,mcp.tools.list,mcp.tools.call,edge.audio.stream.start,edge.audio.stream.stop"
```

启动 shim（在本仓库 `/src` 下）：

```bash
npm install
npm run build
npm start
```

### 1.3 验证 node 已连上
在 Gateway 主机上：

```bash
openclaw nodes status
openclaw nodes list --connected
```

如果未来走严格 pairing：当 node 首次连接出现 pending 时：

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

（iOS Node 的配对流程也使用同一套命令；证据：[ios.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/platforms/ios.md)）

### 1.4 Operator 调用示例（最小闭环）
1) MCP 工具发现：

```bash
openclaw nodes invoke --node "myr2d2.xiaozhi" --command "mcp.tools.list" --params "{}"
```

2) MCP 工具调用（示例：调用端侧 tool）：

```bash
openclaw nodes invoke --node "myr2d2.xiaozhi" --command "mcp.tools.call" --params '{"name":"self.get_device_status","arguments":{}}'
```

3) 音频流开关（先验收“控制+session 绑定”，不要求真实音频质量）：

```bash
openclaw nodes invoke --node "myr2d2.xiaozhi" --command "edge.audio.stream.start" --params "{}"
openclaw nodes invoke --node "myr2d2.xiaozhi" --command "edge.audio.stream.stop" --params "{}"
```

如果要指定超时与幂等键（可选）：`--invoke-timeout <ms>` 与 `--idempotency-key <key>`（见 [nodes.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/cli/nodes.md)）。

## 2) 配置模板（allowCommands/declaredCommands + 环境变量）

### 2.1 declaredCommands（shim 上报能力）
- 由 `MYR2D2_DECLARED_COMMANDS` 控制，建议 MVP 固定为：
  - `mcp.initialize`
  - `mcp.tools.list`
  - `mcp.tools.call`
  - `edge.audio.stream.start`
  - `edge.audio.stream.stop`

### 2.2 allowCommands/denyCommands（Gateway 侧放行策略）
OpenClaw 对 node.invoke 有“配置 allowlist + node 自报 declaredCommands”的双重校验（仓库内对接说明见 [xiaozhi-mapping.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/integration/xiaozhi-mapping.md)）。

建议在 Gateway 配置中放行（示例为 JSON5 值；用 `openclaw config set ... --json` 写入）：

```bash
openclaw config set gateway.nodes.allowCommands '["mcp.initialize","mcp.tools.list","mcp.tools.call","edge.audio.stream.start","edge.audio.stream.stop"]' --json
```

修改配置后需重启 Gateway（见 [config.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/cli/config.md)）。

### 2.3 两种安全模式（建议路线）
- MVP（最快跑通）：Gateway 开启 token/password，shim 复用该 token/password 连接。
- 生产化（更安全）：改为 node pairing token（每个 node 独立 token、可撤销），并让 shim 使用该 token 连接（需要补齐 shim 的 pairing/token 获取流程或人工注入 token）。

## 3) 分阶段部署测试流程与验收清单

### 阶段 A：纯软件联调（已具备）
- 验收：`src/tests/shim.e2e.test.ts` 通过（Mock Gateway + Mock XiaoZhi + shim）

### 阶段 B：真实 OpenClaw + Mock XiaoZhi
目标：把所有“策略/权限/运维”问题先在无硬件条件下跑通。
- 验收：
  - `openclaw nodes status` 能看到 shim 在线
  - `openclaw nodes invoke ... mcp.tools.call` 返回有效结果
  - `edge.audio.stream.start/stop` 能返回 session_id，且 Gateway 侧能看到 node.event（如需可加日志观察）

### 阶段 C：真实 OpenClaw + 真实 XiaoZhi 设备（LAN）
目标：打通真实设备端 MCP 与 listen 控制。
你需要准备：
- ESP32 设备型号与固件版本（v1/v2）、刷机方式、麦克风/喇叭与供电、Wi‑Fi 网络条件（2.4G/5G）。
- XiaoZhi 连接入口：\n  - 若走官方 `xiaozhi.me`：需要明确“设备是否允许连接到自定义 server”；\n  - 若自建 server：需要给到 WebSocket/MQTT endpoint 与鉴权方式。\n  证据：XiaoZhi 支持 WebSocket/MQTT+UDP（见 [README_zh.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/my-xiaozhi-esp32/README_zh.md)）。

验收：
- `mcp.tools.list/call` 能触发设备真实动作或返回真实状态
- `edge.audio.stream.start/stop` 能稳定执行，断线重连后仍可恢复

### 阶段 D：远程/弱网（可选）
目标：验证“Gateway 常驻 + 跨网控制”，再决定数据面是否升级 MQTT+UDP。
- 部署建议：Gateway loopback + SSH/tailnet（见 [remote.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/gateway/remote.md)）
- 验收：
  - 跨网控制指令延迟与稳定性符合预期
  - 需要时再将数据面从 WebSocket 切换到 MQTT+UDP（更复杂，但更适合弱网/加密）

## 4) 责任划分（我继续做什么，你做什么）
- 我继续完善：阶段 B/C 的“精确对接细节”与“稳定性增强”（连接鉴权、重连策略、错误码与观测指标），并将 Runbook 与配置模板持续补齐到本文件。\n- 你提供与执行：硬件选择/刷机与联网、实际设备端 endpoint 与鉴权信息、运行 Gateway 的主机与网络环境（同 LAN 或 tailnet/SSH 隧道）。

