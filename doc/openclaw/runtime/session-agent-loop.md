# 会话与 Agent Loop（openclaw 参考实现）

ROOT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`

## 1) Session store：并发写入与原子性

openclaw 以 `sessions.json` 作为会话元信息存储，并通过“进程间锁 + 原子写入”避免并发写覆盖。

- 写入前会获取 `${storePath}.lock`（`open(...,"wx")`），失败则轮询/超时，并支持 stale lock 清理。证据：[store.ts:L285-L355](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/sessions/store.ts#L285-L355)
- 写入策略：\n  - 非 Windows：写入 tmp → rename → chmod 0o600（并 rm tmp）。证据：[store.ts:L219-L255](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/sessions/store.ts#L219-L255)\n  - Windows：避免 rename swap，直接写入；依赖 lock 序列化。证据：[store.ts:L201-L217](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/sessions/store.ts#L201-L217)
- 更新 API：`updateSessionStore()` 在锁内“总是重读”以避免 clobber 并发 writer。证据：[store.ts:L266-L277](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/config/sessions/store.ts#L266-L277)

## 2) 进程内并发：Lane 队列（防止同一 session 交错执行）

openclaw 在进程内用 lane 队列把命令执行串行化/受控并发化（默认每 lane `maxConcurrent=1`）。

- lane 状态：`queue/active/maxConcurrent`。证据：[command-queue.ts:L18-L42](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/process/command-queue.ts#L18-L42)
- 调度：`drainLane()` 在 `active < maxConcurrent` 时启动任务，并在完成后继续 pump。证据：[command-queue.ts:L44-L90](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/process/command-queue.ts#L44-L90)
- 入队：`enqueueCommandInLane(lane, task)` 追加队列并触发 drain。证据：[command-queue.ts:L99-L122](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/process/command-queue.ts#L99-L122)

## 3) Embedded agent run 的双层序列化（session lane + global lane）

在 embedded runner 中，一次 agent run 会先进入 session lane，再进入 global lane，从而同时保证：\n- 同一 session 不会并发交错\n- 全局资源（如模型探测、共享工具）不会被无限并行打爆

证据：[run.ts:L73-L94](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-embedded-runner/run.ts#L73-L94)

## 4) Attempt 执行体：会话加载、工具集、session 创建

一次 attempt 会完成以下关键步骤（节选证据）：

- 预热并打开 SessionManager（并绑定访问追踪）。证据：[attempt.ts:L423-L429](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-embedded-runner/run/attempt.ts#L423-L429)
- 准备 SessionManager（确保 cwd、sessionFile、sessionId 的一致性）。证据：[attempt.ts:L431-L438](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-embedded-runner/run/attempt.ts#L431-L438)
- 创建 SettingsManager，并确保 compaction reserve tokens。证据：[attempt.ts:L439-L444](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-embedded-runner/run/attempt.ts#L439-L444)
- 按 sandboxEnabled 拆分 built-in tools 与 custom tools，并把 client tools 适配进 custom tools。证据：[attempt.ts:L454-L475](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-embedded-runner/run/attempt.ts#L454-L475)
- 最终 `createAgentSession({ tools, customTools, sessionManager, settingsManager, ... })` 创建可运行的 agent session。证据：[attempt.ts:L476-L488](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/pi-embedded-runner/run/attempt.ts#L476-L488)

## 5) 对 my r2d2 的可复用启示（路线 A）

- 把“控制面 WS + session lane”作为机器人基座的并发骨架：每个对话/任务一条 lane，避免机器人动作与工具执行在同一会话内交错导致状态错乱。\n- 把“session store lock + 原子写入”作为跨进程可靠性底座：多端（Web UI/手机/机器人）同时控制时，至少要能保证元数据不被互相覆盖。\n- 把“attempt 执行体”拆成可审计阶段：加载会话 → 解析权限/工具 → 执行 → 事件回传，利于安全治理与可观测性。

