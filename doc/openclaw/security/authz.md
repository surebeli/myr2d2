# Gateway 鉴权与授权模型（openclaw 参考实现）

ROOT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`

## 1) 连接前置：握手必须是 connect

- 服务端要求第一条消息必须是 `req(connect)`，否则直接返回错误并 close。证据：[message-handler.ts:L263-L305](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L263-L305)
- 协议版本协商：`minProtocol/maxProtocol` 必须覆盖服务端 `PROTOCOL_VERSION`，否则返回 protocol mismatch 并 close。证据：[message-handler.ts:L311-L336](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L311-L336)

## 2) 鉴权（Authentication）：允许的认证路径

openclaw 的 connect 认证大体分为两层：\n- **shared-secret**（token/password）与 tailscale 身份（服务端配置驱动）\n- **device 身份**（公钥签名 + pairing）与 device-token（复用 token）

### 2.1 shared-secret：token/password/tailscale

- 认证配置解析：`resolveGatewayAuth()` 从 config/env 得到 mode/token/password，并在 tailscale serve 且非 password 模式下默认 `allowTailscale=true`。证据：[auth.ts:L199-L221](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L199-L221)
- 认证执行：`authorizeGatewayConnect()` 先尝试 tailscale 身份（当 allowTailscale 且非 localDirect），再按 mode 校验 token 或 password（常量时间比较）。证据：[auth.ts:L238-L288](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/auth.ts#L238-L288)

### 2.2 device 身份：公钥派生、签名时效与验签

- deviceId 必须能从 publicKey 派生且一致，否则拒绝。证据：[message-handler.ts:L512-L529](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L512-L529)
- signedAt 必须在允许的时间偏差内，否则拒绝。证据：[message-handler.ts:L530-L548](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L530-L548)
- 签名失败会直接拒绝（并包含 close cause）。证据：[message-handler.ts:L620-L640](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L620-L640)

### 2.3 device-token：在已知 deviceId 上复用 token 免签名

- 当 `connectParams.auth.token` 存在且带 device 时，服务端会尝试 `verifyDeviceToken`，成功则 `authMethod="device-token"`。证据：[message-handler.ts:L661-L672](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L661-L672)
- 成功登录后会生成/确保 device token，并可在 `hello-ok.auth.deviceToken` 下发给客户端。证据：[message-handler.ts:L789-L791](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L789-L791)、[frames.ts:L92-L103](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/protocol/schema/frames.ts#L92-L103)

## 3) 配对（Pairing）：授权前的“身份绑定”与权限升级控制

### 3.1 device pairing（设备层）

- 当存在 device 身份且不满足配对条件时，服务端会发起 `requestDevicePairing`，并：\n  - silent=true 时自动 approve 并广播 resolved\n  - created=true 时广播 requested\n  - 非 silent 时直接返回 `NOT_PAIRED` 并 close（pairing required）\n证据：[message-handler.ts:L678-L730](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L678-L730)、[message-handler.ts:L694-L713](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L694-L713)
- 已配对设备在尝试 role/scopes 升级时仍可能触发配对（role-upgrade/scope-upgrade）。证据：[message-handler.ts:L743-L775](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L743-L775)

### 3.2 node pairing（节点层）

- node pairing 事件在网关事件清单中公开：`node.pair.requested` / `node.pair.resolved`。证据：[server-methods-list.ts:L106-L108](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods-list.ts#L106-L108)
- 事件层会对 pairing 事件做 scope gating（需 `operator.pairing`）。证据：[server-broadcast.ts:L9-L16](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-broadcast.ts#L9-L16)

## 4) 控制面授权（Authorization）：role + scopes + method allow

### 4.1 方法授权入口

- 所有 methods 的授权在 `authorizeGatewayMethod()` 执行：先检查 role，再按 scopes 检查审批/配对/read/write/admin 等。证据：[server-methods.ts:L93-L160](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L93-L160)

### 4.2 role：operator vs node

- `node.invoke.result/node.event/skills.bins` 为 node role 专属 methods；否则拒绝。证据：[server-methods.ts:L35-L37](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L35-L37)、[server-methods.ts:L99-L107](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L99-L107)
- operator 默认需要 scopes 才能调用特定方法集；`operator.admin` 可绕过。证据：[server-methods.ts:L111-L140](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L111-L140)

### 4.3 scopes：read/write/admin/pairing/approvals

- approvals：`exec.approval.request/resolve` 需要 `operator.approvals`。证据：[server-methods.ts:L35-L36](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L35-L36)、[server-methods.ts:L114-L116](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L114-L116)
- pairing：node/device pairing 与 token 相关 methods 需要 `operator.pairing`。证据：[server-methods.ts:L37-L49](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L37-L49)、[server-methods.ts:L117-L119](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L117-L119)
- read/write：read methods 需要 `operator.read` 或 `operator.write`；write methods 需要 `operator.write`。证据：[server-methods.ts:L120-L125](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server-methods.ts#L120-L125)

## 5) Web / Control UI 的特殊安全约束

- 当 connect 来源为 control ui 且不满足 secure context 时，服务端会拒绝连接（“requires HTTPS or localhost”）。证据：[message-handler.ts:L470-L487](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/server/ws-connection/message-handler.ts#L470-L487)

## 6) 反向代理与客户端 IP（trusted proxy）

- 仅当 `remoteAddr` 命中 `trustedProxies` 时才信任 `x-forwarded-for/x-real-ip`，否则使用 remoteAddr。证据：[net.ts:L74-L96](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/net.ts#L74-L96)

