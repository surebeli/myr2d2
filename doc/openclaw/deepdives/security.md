# OpenClaw 安全性设计：分层护栏、威胁模型与工程落点

ROOT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`

## 1) 总体思路：把“控制面”当作高价值目标

OpenClaw 把 Gateway（控制面）视为“高价值资产”，因此安全设计不是单点（只有 token），而是 **多层互补护栏**：
- 网络暴露最小化（loopback + SSH/tailnet 为默认路径）\n- 连接鉴权（token/password/tailscale identity）\n- 设备/节点配对（pairing 绑定身份，阻断静默提权）\n- 授权（role + scopes + allowlist）\n- 工具执行治理（tool policy + sandbox + exec approvals）\n- 供应链与扩展（plugins/skills 扫描与审计）\n- 本地状态与凭据权限（state dir、config、credentials）\n- 安全审计与修复（audit + doctor）

这套组合对“机器人系统”尤其重要：控制面一旦被拿下，等价于可远程控制物理世界与所有外设能力。

## 2) 网络暴露面：默认 loopback，超出 loopback 必须有共享密钥

安全审计明确把“非 loopback 暴露但没有共享密钥”判为 critical：\n- 当 `gateway.bind != loopback` 且未配置 token/password 时，直接给出 critical finding 与 remediation。证据：[audit.ts:L278-L286](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L278-L286)\n- 即使 `bind=loopback`，若 Control UI 可能被反代暴露且没有 auth，同样会被标为 critical。证据：[audit.ts:L302-L312](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L302-L312)

Tailscale 暴露模式也被显式纳入威胁模型：\n- `tailscale.mode="funnel"`（公网暴露）为 critical；`serve`（tailnet 暴露）为 info。证据：[audit.ts:L314-L329](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L314-L329)

配合运行时约束（fail-closed）可进一步减少误配：\n- 例如对 tailscale/bind/auth 组合做启动期强校验（避免错误暴露）。证据：[server-runtime-config.ts:L64-L108](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-runtime-config.ts#L64-L108)

## 3) 反向代理与真实 IP：trustedProxies 白名单 + 头部不可信默认

OpenClaw 对 `X-Forwarded-For` / `X-Real-IP` 采用 “默认不信任，只有 trusted proxy 才信任” 的强策略：\n- 只有当 remoteAddr 命中 `trustedProxies` 才读取 XFF/Real-IP，否则直接使用 remoteAddr。证据：[net.ts:L74-L96](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)

这直接防住一个常见攻击面：伪造 XFF 让服务端误判为“本地/可信客户端”，进而绕过 pairing 或控制台安全策略。

## 4) 连接级身份绑定：device token + pairing，且对 role/scopes 升级强制复核

### 4.1 device-token 登录：把 deviceId 与 role/scopes 一起绑定

- 当 connect 携带 token 且带 device 时会走 `verifyDeviceToken`，通过即 `authMethod="device-token"`。证据：[message-handler.ts:L661-L672](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L661-L672)

### 4.2 pairing：非本地默认不 silent，缺配对直接 close

在 device 身份存在且不允许 bypass 时，会触发 `requestDevicePairing`：\n- 本地客户端可以 silent 自动 approve，并广播 `device.pair.resolved`\n- 非 silent 场景会广播 `device.pair.requested`，并返回 NOT_PAIRED 后 close（fail-closed）\n\n证据：[message-handler.ts:L678-L733](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L678-L733)

### 4.3 静默提权防线：role/scopes 升级会触发重新配对

当已配对设备请求更高 role 或额外 scopes，仍会强制 requirePairing：\n- role-upgrade：不在 allowedRoles 内\n- scope-upgrade：pairedScopes 缺失所需 scope\n\n证据：[message-handler.ts:L743-L775](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L743-L775)

## 5) Node 能力暴露：platform allowlist + declaredCommands 双重约束

OpenClaw 不让 node “自说自话”暴露任意命令：\n- node 连接时声明的 commands，会按 platform allowlist 过滤后才写回 connectParams。证据：[message-handler.ts:L793-L804](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L793-L804)\n- operator 调用 `node.invoke` 时还会做二次校验：allowlist + declaredCommands 必须同时满足。证据：[nodes.ts:L403-L418](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods/nodes.ts#L403-L418)、[node-command-policy.ts:L117-L137](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/node-command-policy.ts#L117-L137)

这能有效缓解端侧被攻破后的横向移动：即使 node 被控制，也很难通过“声明新命令”骗 gateway 执行更高风险的动作。

## 6) 工具执行治理：tool policy + sandbox + exec approvals（互补）

### 6.1 tool policy：deny 优先、allowlist 可切强约束

工具策略匹配规则：\n- deny 命中直接拒绝\n- allow 为空时默认为允许（allow-all）\n- allow 非空时必须命中 allow（强 allowlist）\n- `apply_patch` 可视为 `exec` 的派生允许（当 allow 允许 exec）。证据：[pi-tools.policy.ts:L58-L76](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.policy.ts#L58-L76)

一个工程化细节：subagent 默认 deny 了 `memory_search/memory_get` 等敏感工具，避免子代理滥用内部状态。证据：[pi-tools.policy.ts:L79-L97](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.policy.ts#L79-L97)

### 6.2 sandbox：把“执行环境”与“权限面”绑定

sandbox 的核心价值是降低“工具成功执行 = 破坏真实宿主机”的概率：\n- read/write/edit/exec 在 sandbox 与 host 的落点不同（详见我们生成的 [tools-sandbox.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/runtime/tools-sandbox.md)）。

### 6.3 exec approvals：宿主机命令执行的最后安全互锁

exec approvals 是对“宿主机执行命令”的专门护栏（尤其是 node host / macOS app 场景）：\n- 命令只在 policy + allowlist +（可选）人工审批 同时满足时才执行。证据：[exec-approvals.md:L12-L20](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/tools/exec-approvals.md#L12-L20)\n- 没有 UI 可审批时，askFallback 默认 deny（fail-closed）。证据：[exec-approvals.md:L18-L20](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/tools/exec-approvals.md#L18-L20)\n- approvals 存储在本地 `~/.openclaw/exec-approvals.json`，并通过 UDS/同 UID/HMAC+TTL 做 IPC 安全。证据：[exec-approvals.md:L35-L47](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/tools/exec-approvals.md#L35-L47)、[exec-approvals.md:L206-L219](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/tools/exec-approvals.md#L206-L219)

## 7) 本地状态与凭据：权限收紧 + symlink 视为额外信任边界

OpenClaw 把 state/config 的权限问题当作一等安全风险：\n- state dir world-writable 是 critical，建议收紧到 700。证据：[audit.ts:L151-L164](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L151-L164)\n- config world-readable/writable 也是 critical，建议 600。证据：[audit.ts:L210-L237](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L210-L237)\n- symlink 会被标记为额外 trust boundary（warn），提示运维注意其目标可信性。证据：[audit.ts:L143-L149](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L143-L149)、[audit.ts:L202-L208](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/security/audit.ts#L202-L208)

## 8) 对 myr2d2 的直接建议（落地版）

- 控制面永远优先 loopback + SSH/tailnet，除非明确需要 lan/public。\n- 端侧（XiaoZhi/手机/桌面）接入一律走 node.invoke 总线，并用 allowlist + declaredCommands 双重约束。\n- 任何宿主机 exec 都必须留在 approvals 框架下，并且把 askFallback 固化为 deny。\n- 把 `security audit` 与 “权限收紧 doctor”纳入部署 runbook，避免状态目录泄露导致“本地提权”。

