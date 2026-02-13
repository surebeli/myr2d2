# 三层报告：openclaw

- PROJECT_NAME：openclaw
- ROOT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`
- OUT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw`
- PRIMARY_GOAL：learn

## 0. 同步信息（Doc ↔ Submodule）

- 本文档的源码基线由 [SOURCE.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/SOURCE.json) 管理。
- 本次更新将 submodule 从 `aaddbdae52d71bff3a74fa28dd6597816e2d7592` 快进到 `4c86010b0620a1a689bef2e47c7f1b2b00891aa9`（heads/main）。
- 变更摘要（用于快速定位需要复核的文档段落）：
  - hooks：移除 bundled `soul-evil` hook（影响安全/运维与 hooks 相关叙述）。
  - skills：新增/强化跨 agent 的 skills 发现路径（`.agents/skills/` 目录）。
  - gateway：提升 WebSocket payload 上限（图片上传场景）。

## 1. 结构层（Structure）

### 1.1 规模与语言分布（概览）

- 代码主体为 TypeScript/Node（`.ts` 文件数量占比最高），并包含大量文档（`.md`）与 Apple 平台代码（`.swift`）。证据：仓库存在大型 TypeScript 源码树 [src](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src)；构建/类型检查脚本以 TypeScript 为中心 [package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L35-L41)；细粒度统计见 [SUMMARY.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/subreports/SUMMARY.json)。

### 1.2 顶层目录与子项目（深度 2）

- monorepo：根包 + `packages/*` + `extensions/*` + `ui`。证据：[pnpm-workspace.yaml](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/pnpm-workspace.yaml#L1-L6)。
- 伴侣应用：iOS/Android/macOS 在 `apps/*`。证据：`apps` 目录存在 [apps](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/apps)。
- Swift 包：`Swabble`。证据：`Swabble` 目录存在 [Swabble](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/Swabble)。
- 核心源码：`src/*`。证据：[src](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src)。
- 文档：`docs/*`。证据：[docs](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs)。
- 技能（技能文档/脚本）：`skills/*`。证据：发布包包含 `skills/` [package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L11-L22)。

### 1.3 入口点（Entrypoints）

- CLI（发布版）：`openclaw` 命令由 npm `bin` 指向 `openclaw.mjs`，再动态加载 `./dist/entry.js`。证据：[package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L8-L10)、[openclaw.mjs](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/openclaw.mjs#L1-L14)。
- CLI（源码入口）：`src/entry.ts` 负责环境归一化、必要时自我重启（为注入 `--disable-warning=ExperimentalWarning`），再进入 `runCli()`。证据：[entry.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/entry.ts#L10-L171)。
- CLI（主执行）：`runCli()` 在 `src/cli/run-main.ts`，做 dotenv、runtime guard、路由、plugin CLI 注册与 `program.parseAsync()`。证据：[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L27-L72)。
- Gateway（启动命令）：`openclaw gateway` 的启动与安全护栏集中在 `src/cli/gateway-cli/run.ts`。证据：[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L161-L308)。
- Gateway（服务装配入口）：`startGatewayServer()` 在 `src/gateway/server.impl.ts`。证据：[server.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.ts#L1-L3)、[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L155-L353)。
- macOS（CLI/应用内入口之一）：`apps/macos/.../EntryPoint.swift` 存在 Swift `@main`。证据：[EntryPoint.swift](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/apps/macos/Sources/OpenClawMacCLI/EntryPoint.swift#L1-L56)。

### 1.4 模块边界（Module Map）

- CLI 框架与命令装配：`src/cli/*`（argv/route/program/subclis）。证据：[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L27-L72)。
- Gateway 控制面：`src/gateway/*`（鉴权、网络、runtime state、方法/事件）。证据：[server-runtime-state.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-runtime-state.ts#L1-L80)、[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L1-L40)。
- 配置系统：`src/config/*`（JSON5、include、env substitution、validation、paths）。证据：[io.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/io.ts#L203-L320)、[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L44-L104)。
- 插件系统：`src/plugins/*`（加载器、CLI 注册、Gateway handlers 注入）。证据：[plugins/cli.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/cli.ts#L11-L58)、[server-plugins.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-plugins.ts#L5-L49)。
- sandbox（隔离执行）：`src/agents/sandbox/*`（Docker 容器配置与生命周期）。证据：[docker.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/docker.ts#L125-L245)。
- 渠道与接入面：`src/*` 下按渠道分目录（例如 `src/line/*`），并支持 `extensions/*`。证据：存在 webhook 签名校验实现 [signature.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/line/signature.ts#L1-L18)；monorepo 含 `extensions/*` [pnpm-workspace.yaml](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/pnpm-workspace.yaml#L1-L6)。
- 伴侣应用（移动/桌面）：`apps/*`。证据：[package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L31-L67)。

### 1.5 状态与持久化（State Locations）

- 状态目录：默认 `~/.openclaw`（兼容 legacy 目录名），可用 `OPENCLAW_STATE_DIR` 覆盖。证据：[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L44-L74)。
- 配置文件：默认 `~/.openclaw/openclaw.json`（JSON5），可用 `OPENCLAW_CONFIG_PATH` 覆盖。证据：[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L90-L104)。
- agent 目录：默认落在 `resolveStateDir()/agents/<DEFAULT_AGENT_ID>/agent`，可用 `OPENCLAW_AGENT_DIR` 覆盖。证据：[agent-paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/agent-paths.ts#L6-L14)。
- OAuth / API Key 凭据写入：通过 `upsertAuthProfile()` 写入“解析后的 agentDir”，以便 gateway 启动时能找到。证据：[onboard-auth.credentials.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/commands/onboard-auth.credentials.ts#L9-L37)、[onboard-auth.credentials.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/commands/onboard-auth.credentials.ts#L160-L182)。

### 1.6 并发/跨线程/跨进程边界（Concurrency Boundaries）

- 进程级：CLI 会在必要时 `spawn(process.execPath, ...)` 自我重启，并桥接子进程退出码/信号。证据：[entry.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/entry.ts#L45-L76)。
- 网络并发：Gateway 同时维护 HTTP Server + `WebSocketServer({ noServer })`，并维护 WS clients 集合与广播器。证据：[server-runtime-state.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-runtime-state.ts#L1-L80)。
- 容器化：sandbox 通过 Docker 创建并启动常驻容器（`sleep infinity`），并按配置挂载 workspace。证据：[docker.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/docker.ts#L208-L245)。

### 1.7 架构图（drawio-mcp）

- 图源目录：`doc/openclaw/diagrams/`（`.mmd` 源文件 + `links.json`）
- 系统架构图：
  - 源文件：[openclaw-architecture.mmd](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/diagrams/openclaw-architecture.mmd)
  - 打开编辑器：https://app.diagrams.net/?grid=0&pv=0&border=10&edit=_blank#create=%7B%22type%22%3A%22mermaid%22%2C%22compressed%22%3Atrue%2C%22data%22%3A%22jVRdb9sgFP01lrqHWJGrrc%2BNE3eVtimaU%2BUZ41ubhUBlnKR92W%2FfBYxhMa4iWebCPYf7zSuXF9qSrk%2By5W6VLB9xxU%2BdqqYjby2K%2BY%2Fn5OvK%2FNej3n4b0XcfqJRvICgnFzy6q5j4MkX%2BPomcM4SqjiZZQVHOiu4kFkfCRNqrkAGi1nLElSfSw4Voi05C9yQ6ITlKW04ETE0%2F7ctex4e29TowS%2BjO0N1FXN2XCN1DVUp6AJ0WC50Cv%2B92W4SaZR71E%2FpW1uo%2Fn8eza%2FCqk6SmRGlvA%2FmW3GAeXlmjK2UFrf%2Bm%2FerR7NSSOV4zdHj1F0uRhiVUgy6SHHt5wTgEZU%2F%2FKCk0kRpthFaCUkwKnQXlxKzgstELJbSF24LcvOvM4B%2BEYhXjrP%2BYGtvyU8OMrVGa%2BHNgnGuEE64Bjw2IXtn8ECOjo8l9zurkfoOiOYvcS0RdyXckrXX3dOHRTUXkzNjCKjpp0p5QvTzbDsXdS2Qq85YIATy4yx4oXaIdcEBrR4xhzRSVXa2rn6aRov2SNWj6sM76b1%2BBbLlYmNy4WXfqYev0D3kzzMFDHkznLFr2rckjlccjplJZmrfhiO4iz%2BQ4P8MwGE7Qu3Mk3zwO4fYe4YZ3HjE0lQMMW6%2F3zfWJ%2F%2BYhmleaV8epETnvn9t7hH9ZAvvjg%2BBxkYRFUONsf4KJRmw72ddLR1GYuEy5gvCvOvoWim1ajxS4T5k4ywMgxezgrGfYEIOcjVEMczsbxD8%3D%22%7D
- Skills 覆盖栈优先级图：
  - 源文件：[openclaw-skills-precedence.mmd](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/diagrams/openclaw-skills-precedence.mmd)
  - 打开编辑器：https://app.diagrams.net/?grid=0&pv=0&border=10&edit=_blank#create=%7B%22type%22%3A%22mermaid%22%2C%22compressed%22%3Atrue%2C%22data%22%3A%22fZDBDoIwDIafZkcMgfAAIhgPmhgvnueoMJkb6aZ48tkthDH0YLKk3fp9f5NdlelFw9GxJN6fWLymSqd8OeQsy2GohUTLsoKeo4ilJdX8oSsFFQEX3xWz64cBP3DN6xG%2F%2By7gfhjwI6A1mivi3yzZrmisnaXOtlIpu5RndGGjuYFwJLN00xtsbccFjLP%2FUZMXks6znOUh6Mf1ujZu4HaybgDp3iEIqEAPRmyegCgroM0xfTgB03dGX2vGuA8%3D%22%7D

## 2. 行为层（Behavior）

### 2.1 主链路（Main Flows）

- CLI 启动链路：`openclaw` → `openclaw.mjs` → `dist/entry.js` → `src/entry.ts` → `runCli()`。证据：[package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L8-L10)、[openclaw.mjs](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/openclaw.mjs#L1-L14)、[entry.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/entry.ts#L148-L170)、[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L27-L72)。
- CLI 运行时关键阶段（简化）：dotenv → env normalize → runtime guard → `tryRouteCli()`（短路某些路径）→ build Commander program →（按需）注册 plugin CLI commands → `program.parseAsync()`。证据：[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L27-L72)。
- Gateway 启动（CLI 层）：读取 config snapshot → `gateway.mode` 护栏 → 解析 bind/auth/tailscale → 启动 `runGatewayLoop(startGatewayServer(...))`。证据：[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L161-L282)。
- Gateway 装配（服务层，简化）：\n+ 读取 config snapshot（含 legacy 检测/迁移）→ plugin auto-enable（可写回 config）→ `loadConfig()` → 加载 gateway plugins 与 channel methods → 解析 runtimeConfig（bind/auth/tailscale/UI）→ `createGatewayRuntimeState()`（http/wss/broadcast/chat/tool recipients 等）。证据：[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L170-L353)、[server-runtime-state.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-runtime-state.ts#L29-L80)。
- 配置加载（loadConfig，简化）：选 configPath → JSON5 parse → `$include` 解析 → `config.env` 注入 env → `${VAR}` 替换 → 校验（含 plugin schema）→ defaults → 路径归一化 →（可选）shell env fallback。证据：[io.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/io.ts#L203-L308)。

### 2.2 不变量清单（Invariants）

- `--no-color` 会通过设置 `NO_COLOR/FORCE_COLOR` 影响颜色输出。证据：[entry.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/entry.ts#L14-L17)。
- CLI 可能会为了 suppress `ExperimentalWarning` 而自我 respawn（可被环境变量 guard 禁用）。证据：[entry.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/entry.ts#L19-L77)。
- CLI 在“做任何工作之前”会强制要求 Node ≥ 22.12.0。证据：[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L33-L35)、[runtime-guard.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/infra/runtime-guard.ts#L12-L99)。
- 配置文件不存在时 `loadConfig()` 默认返回空对象（并可能触发 shell env fallback）。证据：[io.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/io.ts#L214-L225)。
- `$include` 解析发生在 validation 之前，且 `config.env` 会在 `${VAR}` 替换前注入。证据：[io.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/io.ts#L229-L242)。
- config 会与 plugin schema 一起参与校验（`validateConfigObjectWithPlugins`），无效配置会返回 `{}` 并记录错误。证据：[io.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/io.ts#L255-L320)。
- 状态目录与配置路径默认落在 `~/.openclaw`，并提供 env 覆盖。证据：[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L44-L104)。
- Gateway 非 local 模式（或缺 config）时默认拒绝启动（除非 `--allow-unconfigured`）。证据：[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L161-L176)。
- Gateway bind 非 loopback 时拒绝“无共享密钥”的启动。证据：[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L246-L258)。
- Gateway token/password 比较为常量时间比较（长度不等直接 false）。证据：[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L35-L40)、[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L263-L288)。
- Gateway 只有在 `remoteAddr` 命中 `trustedProxies` 时才信任 `x-forwarded-for/x-real-ip`。证据：[net.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)。
- 启动时会检测 legacy config 并尝试迁移、必要时写回 config（Nix mode 下更严格）。证据：[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L170-L190)。
- 插件可扩展 Gateway methods（gatewayHandlers）并影响 method 列表；CLI 也会尝试注册插件命令。证据：[server-plugins.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-plugins.ts#L17-L49)、[plugins/cli.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/cli.ts#L11-L58)、[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L63-L69)。
- Gateway 对外返回的 config snapshot 会对敏感字段做 sentinel 脱敏，并支持 Web UI round-trip 还原避免覆盖凭据。证据：[redact-snapshot.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/redact-snapshot.ts#L3-L8)、[redact-snapshot.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/redact-snapshot.ts#L109-L168)。

### 2.3 扩展点清单（Extension Points）

- monorepo 扩展面：`extensions/*` 与 `packages/*` 是一级 workspace packages。证据：[pnpm-workspace.yaml](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/pnpm-workspace.yaml#L1-L6)。
- CLI 扩展：插件通过 `cliRegistrars` 往 Commander program 注入命令（并做命令名冲突规避）。证据：[plugins/cli.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/cli.ts#L20-L58)。
- Gateway 扩展：插件通过 `gatewayHandlers` 注入方法名集合，最终合并为 `gatewayMethods`。证据：[server-plugins.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-plugins.ts#L14-L49)、[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L229-L245)。
- Skills 扩展：发布包包含 `skills/`，并在文档中明确 workspace skills 路径约定。证据：[package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L11-L22)、[README.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/README.md#L306-L311)。

### 2.4 流程图（drawio-mcp）

- Gateway 启动与 WebSocket 调用链路：
  - 源文件：[openclaw-gateway-flows.mmd](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/diagrams/openclaw-gateway-flows.mmd)
  - 打开编辑器：https://app.diagrams.net/?grid=0&pv=0&border=10&edit=_blank#create=%7B%22type%22%3A%22mermaid%22%2C%22compressed%22%3Atrue%2C%22data%22%3A%22fVPtbsIgFH0aE%2F1hYuYTuG52LmYzNqa%2Fr%2FSuJaPQAdX49rvQUrWOJY0inA%2FuOdXgT4uS4QuHUkM9WawmTwt6oLVKtvUR9bDVgLac8QakpV8HBzJuYaKYZLsJKNWQi4BzvxvBr9OAFwqKRMkvXk5nEfRuG8A70ZZcmgguzQMuBYtnuNBq30rLa4ww8iwwcjxmin2j281Qn%2BKjBkYiOPqdKXFdPBsPX7ujCqRE4ecJKof5ZPlKjwtluboPquyvG7CECWgKyqM1QkFfzCdFCyOhMZWynvBMnycQvCCdq8g6nY89e%2FqjD0XsAQU3TLnhg6yrx2UwCn63fdDuh3gDWQjUZlBggu%2Bx5MZq0OYPa2rN842lnPviugamYdrkeoPrO5LmvQCV6AUEeaAcfIExbGw3tERmueruP9xgRO9hw3meDSN2APqnVA5XgRAoSxzqdt1coro12kr57ojnXpf37PNjdmtznwNV0IBlzsqqW37VJXsbwMhKo2nFPxPQeUMpYBfDLw%3D%3D%22%7D

## 3. 风险层（Risk）

### 3.1 信任边界与最小威胁模型（资产/攻击面/控制点）

- 资产（Assets）\n+  - 本地状态目录（sessions/logs/caches）与 config：默认 `~/.openclaw` 与 `~/.openclaw/openclaw.json`。证据：[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L44-L104)。\n+  - agentDir 与其下的认证信息（OAuth/API keys profiles 等）。证据：[agent-paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/agent-paths.ts#L6-L14)、[onboard-auth.credentials.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/commands/onboard-auth.credentials.ts#L9-L24)。\n+  - Gateway 共享密钥（token/password）与 tailscale 身份联动。证据：[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L199-L221)、[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L199-L258)。
- 攻击面（Attack Surfaces）\n+  - Gateway 网络暴露：HTTP/WS 服务端与广播机制。证据：[server-runtime-state.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-runtime-state.ts#L29-L80)。\n+  - 反向代理头：`x-forwarded-for/x-real-ip` 等（依赖 trusted proxy 配置）。证据：[net.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)。\n+  - 渠道 webhook：例如 LINE 依赖 HMAC 签名校验。证据：[signature.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/line/signature.ts#L1-L18)。\n+  - 插件：插件可注入 Gateway handlers 与 CLI commands。证据：[server-plugins.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-plugins.ts#L17-L29)、[plugins/cli.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/cli.ts#L20-L58)。\n+  - 工具执行与隔离：支持 Docker sandbox 常驻容器执行。证据：[docker.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/docker.ts#L125-L245)。
- 控制点（Control Points）\n+  - bind/auth 护栏：非 loopback 强制要求 token/password。证据：[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L246-L258)。\n+  - 常量时间比较：token/password 与部分 webhook 签名校验均使用 timingSafeEqual。证据：[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L35-L40)、[signature.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/line/signature.ts#L12-L18)。\n+  - 反向代理头信任限制：只有 trusted proxies 才解析 forwarded headers。证据：[net.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)。\n+  - 配置脱敏：gateway responses 中的 config snapshot 会脱敏敏感字段并支持 round-trip 还原。证据：[redact-snapshot.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/redact-snapshot.ts#L109-L168)。\n+  - sandbox 硬化：read-only root、cap-drop、no-new-privileges、seccomp/apparmor 等。证据：[docker.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/docker.ts#L125-L206)。

### 3.2 风险清单（P0/P1/P2）

- P0\n+  - 控制面暴露依赖共享密钥：当 bind 非 loopback 时，Gateway 以 token/password 作为主要访问控制；若密钥弱或泄露，可能导致远程控制面接管。证据：[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L246-L258)、[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L263-L288)。\n+  - 默认“主会话工具在宿主机运行”的安全边界：若不可信输入被路由到主会话，工具能力可能直接作用于宿主机。证据：[README.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/README.md#L326-L332)。\n+  - 插件注入面：插件可注入 Gateway handlers 与 CLI commands，意味着插件供应链/本地插件目录被污染时风险上升。证据：[server-plugins.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-plugins.ts#L17-L29)、[plugins/cli.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/cli.ts#L20-L58)。\n+- P1\n+  - 反向代理头与 IP 解析依赖 trusted proxies 配置：配置错误时可能导致审计/限流/某些“按客户端 IP”逻辑失真。证据：[net.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)。\n+  - 配置写回行为：启动阶段可能因 legacy 迁移与 plugin auto-enable 写回 config，在 Nix mode 下会更严格失败；运维上需注意“配置是否可写”的假设。证据：[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L170-L190)、[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L206-L217)、[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L6-L15)。\n+  - `config.env` 可在 `${VAR}` 替换前写入 env：如果 config 来源不可信或合并层级复杂，可能带来运行时行为漂移。证据：[io.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/io.ts#L235-L242)。\n+- P2\n+  - 配置脱敏基于 key 名模式匹配（token/password/secret/api key），不匹配模式的敏感字段可能无法被自动识别。证据：[redact-snapshot.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/redact-snapshot.ts#L15-L19)。\n+  - 测试覆盖聚焦在 `src/**/*.ts`，移动/桌面应用目录被排除在 vitest 运行范围之外。证据：[package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L231-L248)。\n+
### 3.3 测试覆盖缺口（证据化）

- 单元测试覆盖阈值与覆盖范围主要针对 `src/**/*.ts`，并排除 `dist/**` 与 `apps/macos/**` 等目录。证据：[package.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/package.json#L218-L248)。
