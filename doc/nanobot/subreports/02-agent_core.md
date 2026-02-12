# 子报告 02：Agent 核心回路（agent_core）

核心文件：
- [loop.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py)
- [context.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py)

## 结论摘要

- AgentLoop 采用典型的 “LLM → tool_calls → tool result → LLM” 迭代，最多迭代 `max_tool_iterations` 次防止无限循环（默认 20）。
- 上下文拼装采用 “系统提示词（bootstrap + memory + skills）+ 历史 + 当前 user 消息”，并兼容图片输入（OpenAI 兼容的 `content: [ ... ]` 结构）。
- 子代理（subagent）结果回传采用 `channel="system"` 的 InboundMessage，并把原始目的地编码进 `chat_id="origin_channel:origin_chat_id"`，主 Agent 解析后回路由发送。

## 主循环（run）

- `AgentLoop.run()` 以 1s 超时轮询 `bus.consume_inbound()`，拿到消息后调用 `_process_message()`，并将结果写入 `bus.publish_outbound()`；出现异常会兜底返回一条错误回复（[loop.py:L109-L137](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L109-L137)）。

## 正常消息处理（_process_message）

### 会话与 messages 组织

- 若消息来自普通 channel：获取或创建 session（[loop.py:L160-L166](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L160-L166)），再由 `ContextBuilder.build_messages()` 生成 `messages`（[context.py:L121-L159](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py#L121-L159)）。
- 系统提示词构成：
  - identity + workspace bootstrap 文件（`AGENTS.md/SOUL.md/USER.md/TOOLS.md/IDENTITY.md`）+ memory + always_skills + skills_summary
  - `---` 分隔块（[context.py:L21-L71](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py#L21-L71)）。

### tool_calls 迭代与收敛

- 迭代循环：`while iteration < self.max_iterations`（[loop.py:L185-L229](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L185-L229)）。
- 每轮调用 provider：
  - `provider.chat(messages, tools=tool_registry.get_definitions(), model=...)`（[loop.py:L192-L197](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L192-L197)）。
- 若有 tool_calls：
  - 将 assistant 消息（含 tool_calls）加入 `messages`（[loop.py:L199-L216](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L199-L216)）。
  - 逐个执行工具并把 tool result 以 `role="tool"` 追加回 `messages`（[loop.py:L217-L225](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L217-L225)）。
- 若无 tool_calls：`final_content = response.content` 并 break（[loop.py:L225-L229](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L225-L229)）。
- 超过迭代上限：返回固定提示（[loop.py:L230-L233](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L230-L233)）。

## 消息格式（OpenAI 兼容）

- user message：
  - 纯文本：`{"role":"user","content": "..."}`。
  - 图片 + 文本：`content` 为 list，元素含 `{type:"image_url", image_url:{url:"data:mime;base64,..."} }` 和 `{type:"text", text:"..."}`（[context.py:L161-L178](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py#L161-L178)）。
- assistant 工具调用消息：`tool_calls` 形状为 `{"id","type":"function","function":{"name","arguments":"<json string>"}}`（[loop.py:L201-L215](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L201-L215)）。
- tool result 消息：`{"role":"tool","tool_call_id","name","content": result}`（[context.py:L179-L204](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py#L179-L204)）。

## 子代理回传与 system 路由

- 子代理完成后会向 bus 注入 `InboundMessage(channel="system", chat_id="origin_channel:origin_chat_id", ...)`（[subagent.py:L179-L207](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/subagent.py#L179-L207)）。
- `AgentLoop._process_system_message()` 解析 `chat_id`，并最终向原 channel 输出（[loop.py:L244-L340](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L244-L340)）。

## 扩展点清单

- 新工具：通过 `ToolRegistry.register()` + 修改 `_register_default_tools()` 注入（[loop.py:L63-L108](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L63-L108)）。
- Prompt/能力暴露：通过 workspace bootstrap 文件、skills、memory 改变系统提示词（[context.py:L21-L71](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py#L21-L71)）。
- 子代理能力：由 `SpawnTool` 连接 `SubagentManager`（[loop.py:L64-L73](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L64-L73)）。

