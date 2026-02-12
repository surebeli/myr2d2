# Subreport: security_and_ops

OpenClaw 的安全边界主要由三部分组成：Gateway 的网络暴露与鉴权（bind+token/password 或 tailscale 身份）、渠道侧的 webhook/消息来源校验与门禁（如签名校验、allowlist/pairing 策略）、以及对工具执行面（尤其命令执行/文件访问/浏览器控制）的 sandbox 隔离。运维上需要重点关注“配置与凭据落点、反向代理头信任、插件扩展面、默认会话隔离策略”。

## 要点（证据化）

- Gateway 绑定非 loopback 时拒绝无鉴权启动（必须配置 token/password 或明确允许）。证据：[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L246-L258)
- Gateway token/password 鉴权使用常量时间比较，避免 timing side-channel。证据：[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L35-L40)、[auth.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L263-L288)
- 仅在 trusted proxy 命中时才信任 `x-forwarded-for/x-real-ip`，避免任意请求伪造来源 IP。证据：[net.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)
- 配置快照会对敏感字段进行脱敏（sentinel），且写回前会恢复 redacted 值以避免 UI round-trip 覆盖凭据。证据：[redact-snapshot.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/redact-snapshot.ts#L3-L8)、[redact-snapshot.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/redact-snapshot.ts#L109-L168)
- 默认状态目录与 agentDir 均位于用户目录（含凭据），可通过 env 覆盖。证据：[paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/paths.ts#L44-L104)、[agent-paths.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/agent-paths.ts#L6-L14)
- OAuth/API key 写入通过 auth profiles 归档到 agentDir（供 gateway 启动读取）。证据：[onboard-auth.credentials.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/commands/onboard-auth.credentials.ts#L9-L37)
- Docker sandbox 创建参数包含 `--read-only`、`--cap-drop`、`no-new-privileges`、seccomp/apparmor 与资源限制等硬化项。证据：[docker.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/docker.ts#L125-L206)
- 渠道 webhook 可包含签名校验（示例：LINE HMAC + timingSafeEqual）。证据：[signature.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/line/signature.ts#L1-L18)
- 文档明确把入站 DM 视为不可信输入，并默认采用 pairing + allowlist 策略以降低误触发。证据：[README.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/README.md#L106-L118)
- 文档明确主会话工具默认在宿主机运行；可通过 sandbox 配置让非主会话（群/渠道）在 Docker 中运行。证据：[README.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/README.md#L326-L332)

## 风险/缺口（P0/P1/P2）

- P0：当控制面被暴露（bind 非 loopback 或通过其他暴露方式）时，安全性强依赖共享密钥与插件治理；密钥泄露或插件污染会放大影响范围。证据：[gateway-cli/run.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/gateway-cli/run.ts#L246-L258)、[server-plugins.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-plugins.ts#L17-L30)
- P1：trusted proxies 配置不当会导致客户端 IP 解析失真，影响审计/策略决策的可靠性。证据：[net.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)
- P2：配置脱敏依赖 key 名模式匹配，存在“敏感字段命名不符合模式”时漏脱敏的可能。证据：[redact-snapshot.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/redact-snapshot.ts#L15-L19)

## 后续验证清单（最小命令集合）

- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw test`
- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw test:e2e`
- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw openclaw doctor`
- `pnpm -C /Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw gateway:dev`

