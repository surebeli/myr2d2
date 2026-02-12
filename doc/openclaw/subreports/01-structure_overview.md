# Subreport: structure_overview

OpenClaw 是以 TypeScript/Node 为核心的 monorepo：根包提供 CLI/Gateway（控制面），并通过 `packages/*` 与 `extensions/*` 扩展能力；同时包含 macOS/iOS/Android 伴侣应用与大量文档。CLI 入口从 `openclaw.mjs` 引导到源码 `src/entry.ts` 与 `runCli()`，Gateway 入口由 `openclaw gateway` 启动并装配 `startGatewayServer()`，状态与配置默认落在 `~/.openclaw`。

## 要点（证据化）

- npm `bin` 将 `openclaw` 指向 `openclaw.mjs`。证据：[package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L8-L10)
- CLI 启动脚本启用 compile cache（若可用）并加载 `./dist/entry.js`。证据：[openclaw.mjs](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/openclaw.mjs#L1-L14)
- 源码入口 `src/entry.ts` 会做 env 归一化，并在需要时 `spawn` 自我重启以注入 Node 警告 suppress flag。证据：[entry.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/entry.ts#L10-L77)
- `runCli()` 是 CLI 的主执行点：dotenv、runtime guard、路由、plugin CLI 注册、Commander parse。证据：[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L27-L72)
- monorepo workspace 包含根包、`ui`、`packages/*`、`extensions/*`。证据：[pnpm-workspace.yaml](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/pnpm-workspace.yaml#L1-L6)
- 状态目录默认 `~/.openclaw`（可用 env 覆盖），config 默认 `~/.openclaw/openclaw.json`。证据：[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L44-L104)
- agentDir 默认落在 stateDir 下的 `agents/<DEFAULT_AGENT_ID>/agent`（可用 env 覆盖）。证据：[agent-paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/agent-paths.ts#L6-L14)
- macOS 侧存在 Swift `@main` 入口（作为伴侣应用/CLI）。证据：[EntryPoint.swift](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/apps/macos/Sources/OpenClawMacCLI/EntryPoint.swift#L1-L56)
- Gateway runtime state 明确包含 `WebSocketServer`、clients 集合、broadcast 以及 http servers。证据：[server-runtime-state.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-runtime-state.ts#L29-L80)

## 风险/缺口（P0/P1/P2）

- P0：monorepo 插件/扩展面广（`extensions/*`），插件可注入 CLI 命令与 Gateway 方法，供应链与本地目录安全性重要。证据：[pnpm-workspace.yaml](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/pnpm-workspace.yaml#L1-L6)、[plugins/cli.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/cli.ts#L20-L58)
- P1：状态与凭据落在用户目录（stateDir/agentDir），备份/权限配置不当会扩大泄露面。证据：[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L44-L104)、[agent-paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/agent-paths.ts#L6-L14)
- P2：构建产物 `dist/` 是发布入口的一部分；从源码运行与发布运行路径不同，排障时需区分。证据：[openclaw.mjs](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/openclaw.mjs#L14)

## 后续验证清单（最小命令集合）

- `node -v`（确认 Node 版本满足最低要求）
- `pnpm -v`（如需从源码构建）
- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw install`
- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw build`

