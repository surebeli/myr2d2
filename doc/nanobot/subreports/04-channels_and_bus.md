# 子报告 04：通道与消息总线（channels_and_bus）

核心文件：
- bus：[events.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/events.py)、[queue.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/queue.py)
- channels 抽象与管理：[base.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/base.py)、[manager.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/manager.py)
- gateway 编排：[commands.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cli/commands.py)

## 结论摘要

- `InboundMessage` 与 `OutboundMessage` 是唯一的跨模块契约，bus 只负责排队与消费，不关心 channel 细节。
- 运行时并发主要在 channel 层：每个 channel `start()` 独立 task；AgentLoop 在单循环里串行处理 inbound。
- 路由关键字段：
  - 会话归并：`InboundMessage.session_key = channel:chat_id`
  - 出站路由：`OutboundMessage.channel` 决定由哪个 Channel 实现 `send()`
  - system 回路由：`chat_id="origin_channel:origin_chat_id"`

## 事件模型

- `InboundMessage`（通道→Agent）与 `OutboundMessage`（Agent→通道）定义于 [events.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/events.py#L8-L36)。
- 会话键：`InboundMessage.session_key` 用 `channel:chat_id` 编码（[events.py:L20-L24](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/events.py#L20-L24)）。

## 总线实现与并发模式

- `MessageBus` 用两个 `asyncio.Queue`：`inbound` 与 `outbound`（[queue.py:L11-L40](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/queue.py#L11-L40)）。
- 两条分发路径：
  - `MessageBus.dispatch_outbound()`（按 subscribers 分发，带 1s 超时轮询）（[queue.py:L51-L68](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/queue.py#L51-L68)）。
  - gateway 实际使用 `ChannelManager._dispatch_outbound()`（直接消费 `bus.consume_outbound()` 后按 channel 查表调用 send）（[manager.py:L119-L143](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/manager.py#L119-L143)）。

## Channel 基类的职责

- `BaseChannel._handle_message()`：
  - 入站前做 allowlist 校验（`allow_from` 为空则放行所有用户）；
  - 通过 `bus.publish_inbound` 把消息交给 Agent；
  - 不在 channel 内部直接调 LLM（[base.py:L61-L123](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/base.py#L61-L123)）。

## 路由键与跨线程边界

- system 回路由：子代理/系统消息用 `chat_id="origin_channel:origin_chat_id"`，Agent 侧解析并回发到 origin（[AgentLoop._process_system_message](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L244-L340)）。
- Feishu 是唯一显式跨线程：SDK WebSocket 在单独线程运行，收到消息用 `asyncio.run_coroutine_threadsafe` 投递回主 loop（[feishu.py:L199-L206](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/feishu.py#L199-L206)）。

## 失败处理与韧性策略

- Agent 失败兜底：`AgentLoop.run()` 捕获异常并回复错误信息（[loop.py:L122-L134](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L122-L134)）。
- Outbound 分发失败隔离：单条 send 报错只记录日志，不中断分发循环（[manager.py:L130-L140](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/manager.py#L130-L140)）。
- 典型重连：
  - WhatsApp：异常后 sleep 5s 重连（[whatsapp.py:L41-L65](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py#L41-L65)）。
  - Discord：gateway 异常后 sleep 5s 重连；429 有重试退避（[discord.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/discord.py)）。
  - Telegram：发送失败会降级为纯文本再发（[telegram.py:L154-L182](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/telegram.py#L154-L182)）。

## gateway 装配关系

- `nanobot gateway` 会创建：`MessageBus → Provider → AgentLoop → ChannelManager`，并并发启动 `agent.run()` 与 `channels.start_all()`，同时启动 cron/heartbeat（[commands.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cli/commands.py#L155-L276)）。

