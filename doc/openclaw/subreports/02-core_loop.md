# Subreport: core_loop

OpenClaw 的核心执行路径可分为 CLI 与 Gateway 两条：CLI 负责解析命令、加载配置、注册插件命令并触发子命令；Gateway 负责读取/迁移配置、装配插件与渠道方法、建立 HTTP+WS 控制面运行时状态并处理连接鉴权与事件广播。系统关键不变量集中在“运行时最低版本、配置加载顺序、Gateway 暴露护栏、插件注入点”四类。

## 要点（证据化）

- CLI 在启动后会先 `loadDotEnv()` 与 `normalizeEnv()`，再做 runtime guard。证据：[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L27-L35)
- 最低运行时要求固定为 Node ≥ 22.12.0。证据：[runtime-guard.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/infra/runtime-guard.ts#L12-L99)
- CLI 支持按 primary command 懒加载注册子 CLI（减少启动成本）。证据：[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L55-L61)
- CLI 在解析前会尝试注册插件 CLI 命令（避免 plugin 命令无法被识别）。证据：[run-main.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/run-main.ts#L63-L69)、[plugins/cli.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/cli.ts#L11-L58)
- `loadConfig()` 的核心顺序为：JSON5 parse → `$include` → `config.env` 注入 env → `${VAR}` 替换 → 校验 → defaults → 路径归一化。证据：[io.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/io.ts#L229-L286)
- Gateway 启动时会读取 config snapshot 并处理 legacy 迁移（可能写回配置）。证据：[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L170-L190)
- Gateway 可能自动启用插件并尝试持久化配置变更（失败时降级为 warn）。证据：[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L206-L217)
- Gateway 装配会加载 gateway plugins 与 channel methods，并合并出 `gatewayMethods`。证据：[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L229-L245)、[server-plugins.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-plugins.ts#L17-L30)
- Gateway runtime state 以 `WebSocketServer` 为核心，维护 clients 与 broadcast。证据：[server-runtime-state.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-runtime-state.ts#L29-L80)
- Gateway token/password 鉴权使用 `timingSafeEqual` 做常量时间比较。证据：[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L35-L40)、[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L263-L288)
- 反向代理头解析严格依赖 trusted proxies。证据：[net.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)

## 风险/缺口（P0/P1/P2）

- P0：插件与渠道方法注入是核心扩展点，意味着运行时方法集合与处理器集合可变；需要依赖插件治理与最小权限策略。证据：[server-plugins.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-plugins.ts#L17-L30)
- P1：配置加载允许 `$include` 与 env substitution，配置分层合并复杂时更易出现误配/行为漂移。证据：[io.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/io.ts#L229-L242)
- P2：Gateway 在启动阶段会进行配置写回（legacy 迁移/auto-enable），对只读配置环境（如 Nix mode）需额外运维注意。证据：[server.impl.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server.impl.ts#L170-L190)、[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L6-L15)

## 后续验证清单（最小命令集合）

- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw test`
- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw test:e2e`
- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw gateway:dev`

