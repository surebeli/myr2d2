# OpenClaw 安全性设计（一页摘要）

适用读者：安全/架构/运维，希望快速掌握默认安全姿态、关键护栏与落地点。

## TL;DR

- 默认把 Gateway 当作高价值控制面：loopback 优先、暴露面最小化；一旦超出 loopback 且缺共享密钥会被判为 critical。证据：[audit.ts:L278-L286](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L278-L286)
- “身份绑定 + 防静默提权”：device pairing 不只是首配，还会在 role/scopes 升级时强制重新配对。证据：[message-handler.ts:L743-L775](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L743-L775)
- “执行互锁”：tool policy/sandbox/exec approvals 叠加，且在无 UI 可审批时 askFallback 默认 deny（fail-closed）。证据：[exec-approvals.md:L18-L20](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/tools/exec-approvals.md#L18-L20)

## 分层护栏（从外到内）

```mermaid
flowchart TB
  N[网络暴露面\nbind/tailscale/reverse-proxy] --> A[连接鉴权\n(token/password/tailscale identity)]
  A --> P[pairing\n(device/node)]
  P --> Z[授权\nrole/scopes + allowlist]
  Z --> T[工具治理\npolicy + sandbox + approvals]
  T --> S[状态与凭据\nstate/config/credentials perms]
  S --> O[审计与修复\naudit + doctor]
```

## 关键机制（最值得复用的“工程落点”）

- **非 loopback 无 auth 直接高危**：`gateway.bind != loopback` 且无 token/password 直接 critical，指导运维收敛配置。证据：[audit.ts:L278-L286](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L278-L286)
- **trusted proxies 白名单**：只有 remoteAddr 命中 trustedProxies 才信任 XFF/Real-IP，默认不信头部，防伪造本地绕过。证据：[net.ts:L74-L96](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)
- **role/scopes 升级触发配对复核**：阻断端侧“静默提权”。证据：[message-handler.ts:L743-L775](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L743-L775)
- **node 命令双约束**：platform allowlist + declaredCommands，降低 node 被攻破后的横向移动能力。证据：[nodes.ts:L403-L418](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/nodes.ts#L403-L418)
- **subagent 默认 deny 敏感工具**：子代理默认禁用 memory_search/get 等，避免“扩展智能体”越权读取内部状态。证据：[pi-tools.policy.ts:L79-L97](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.policy.ts#L79-L97)
- **exec approvals 的 fail-closed**：需要提示但无 UI → askFallback 决策，默认 deny。证据：[exec-approvals.md:L18-L20](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/tools/exec-approvals.md#L18-L20)
- **状态目录权限收紧**：state dir world-writable / config world-readable 都会被审计为 critical，并给出 chmod 修复建议。证据：[audit.ts:L151-L164](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L151-L164)、[audit.ts:L224-L237](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L224-L237)

## 对 myr2d2 的默认建议（可直接写进 runbook）

- 控制面：永远优先 loopback + SSH/tailnet；需要暴露时先把 token/password 与 trustedProxies 配齐。\n- 端侧能力：都走 node.invoke，总线层必须保留 allowlist + declaredCommands 双约束。\n- 动作/命令：凡是触达宿主机 exec 的路径必须经过 approvals，且 askFallback 固化 deny。\n- 运维：把 security audit + 权限收紧（state/config/credentials）作为部署前置检查。

## 延伸阅读

- 深挖版：[security.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/deepdives/security.md)

