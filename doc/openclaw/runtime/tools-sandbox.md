# 工具系统与 Sandbox 治理（openclaw 参考实现）

ROOT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`

## 1) 工具集合如何构建（tool list assembly）

入口：`createOpenClawCodingTools()`。证据：[pi-tools.ts:L115-L187](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.ts#L115-L187)

关键点：
- 工具集合并非静态常量，而是按 `sessionKey/modelProvider/modelId/groupId/sandbox` 动态裁剪。证据：[pi-tools.ts:L180-L230](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.ts#L180-L230)
- `exec` 工具会被重新创建，并可注入 sandbox 容器信息（containerName/workspaceDir/workdir/env）。证据：[pi-tools.ts:L275-L302](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.ts#L275-L302)
- base coding tools 中会过滤掉默认的 `bash/exec`，并对 `read/write/edit` 做 openclaw/sandbox 包装。证据：[pi-tools.ts:L245-L272](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.ts#L245-L272)

## 2) Sandbox 是否启用（mode/off/non-main/all）

决策函数：`resolveSandboxRuntimeStatus()`。证据：[runtime-status.ts:L45-L79](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/runtime-status.ts#L45-L79)

规则（以代码为准）：
- `mode="off"`：永不 sandbox。证据：[runtime-status.ts:L10-L13](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/runtime-status.ts#L10-L13)
- `mode="all"`：总是 sandbox。证据：[runtime-status.ts:L14-L16](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/runtime-status.ts#L14-L16)
- 其它模式：当 `sessionKey != mainSessionKey` 时 sandbox（即“non-main”语义）。证据：[runtime-status.ts:L17-L18](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/runtime-status.ts#L17-L18)

## 3) Sandbox 下工具的“落点切换”（read/write/edit）

在 sandbox 场景下，openclaw 会把文件类工具重定向到 sandbox workspace：\n- `read`：使用 `createSandboxedReadTool(sandboxRoot)`。证据：[pi-tools.ts:L245-L252](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.ts#L245-L252)\n- `write/edit`：默认从 base tools 中移除；当 `workspaceAccess != "ro"` 时再添加 sandboxed 版本。证据：[pi-tools.ts:L256-L270](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.ts#L256-L270)、[pi-tools.ts:L316-L320](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.ts#L316-L320)

## 4) Sandbox 工具策略（allow/deny、来源优先级、通配符）

策略解析与默认值：
- `resolveSandboxToolPolicyForAgent()`：优先 agent 级配置，其次 global 配置，否则使用默认 allow/deny。证据：[tool-policy.ts:L71-L121](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/tool-policy.ts#L71-L121)
- 通配符支持：pattern 可含 `*`，会被编译为 regex；`*` 单独代表 all。证据：[tool-policy.ts:L16-L31](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/tool-policy.ts#L16-L31)
- allow/deny 解释：deny 命中则拒绝；allow 为空则默认允许；allow 非空则必须命中 allow。证据：[tool-policy.ts:L58-L69](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/tool-policy.ts#L58-L69)

默认安全倾向（重要）：
- sandboxed sessions 会强制把 `image` 加入 allow（除非显式 deny）。证据：[tool-policy.ts:L125-L132](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/tool-policy.ts#L125-L132)

## 5) 被阻断时的可解释性（blocked message）

当 sandboxed 且命中 deny / 未命中 allow 时，会生成可读的阻断说明，指向具体配置键。证据：[runtime-status.ts:L81-L118](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/sandbox/runtime-status.ts#L81-L118)

## 6) 对 my r2d2 的可复用启示（路线 A）

- 建议把“工具能力”与“执行环境”分离：同一 tool name（read/edit/exec）在 host 与 sandbox 有不同落点与权限。\n- 建议把 tool policy 做成“多来源叠加”的决策树：global（产品级默认）/agent（人格或机器人技能包）/group（群/频道）/sandbox（安全域）/subagent（子代理）。证据：policy 汇总点在 [pi-tools.ts:L220-L230](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-tools.ts#L220-L230)\n- 建议把阻断解释当作协议的一部分：当机器人拒绝执行动作/命令时，返回“被哪个策略阻断、如何修复”比单纯报错更利于运维。

