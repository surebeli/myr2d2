# 子报告 01：结构与入口（structure_overview）

分析对象：`thirdparty/mynanobot`

## 结论摘要

- 这是一个以 Python 为主的轻量 Agent 框架，核心包为 `nanobot/`，通过 CLI 提供 `onboard / agent / gateway` 三种主要运行形态。
- 架构主线是“Channel（多渠道输入输出）↔ Bus（inbound/outbound 队列解耦）↔ AgentLoop（LLM + tools 迭代）↔ Session/Memory（本地持久化）”。
- WhatsApp 采用 Node.js bridge（`bridge/`）通过 WebSocket 与 Python channel 对接，降低协议实现复杂度。

## 目录与模块边界

（Depth=3）仓库结构见 [REPORT.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/nanobot/REPORT.md#L45-L88)，这里补充“模块责任边界”：

- **nanobot/cli/**：命令行入口与编排（Typer app）。主入口 [commands.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cli/commands.py)。
- **nanobot/agent/**：认知核心（上下文构建 + LLM 调用 + tool_calls 迭代 + subagent）。核心 [loop.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py)、[context.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py)。
- **nanobot/agent/tools/**：工具集合（filesystem/shell/web/cron/spawn/message）。目录 [tools](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools)。
- **nanobot/bus/**：消息总线与事件定义（inbound/outbound queue）。[events.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/events.py)、[queue.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/queue.py)。
- **nanobot/channels/**：渠道适配与 ChannelManager（Telegram/Discord/Feishu/WhatsApp）。[base.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/base.py)、[manager.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/manager.py)。
- **nanobot/providers/**：LLM Provider 接入（LiteLLM）。[litellm_provider.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/providers/litellm_provider.py)。
- **nanobot/config/**：配置 schema 与 loader（camelCase↔snake_case）。[schema.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/schema.py)、[loader.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/loader.py)。
- **nanobot/session/**：会话历史持久化（JSONL）。[manager.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/session/manager.py)。
- **nanobot/cron/** 与 **nanobot/heartbeat/**：定时任务与自唤醒。 [cron/service.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cron/service.py)、[heartbeat/service.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/heartbeat/service.py)。
- **nanobot/skills/**：内置技能（主要为文档与脚本，不是 Python code）。[skills/README.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/skills/README.md)。
- **bridge/**：WhatsApp bridge（Node/TS），给 Python WhatsAppChannel 复用。入口 [bridge/src/index.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/index.ts)。
- **workspace/**：onboard 生成的模板样例（AGENTS/SOUL/TOOLS/USER/HEARTBEAT/memory）。见 [workspace/](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/workspace)。

## 入口点与运行形态

### CLI 入口

- `nanobot` 脚本入口在 [pyproject.toml](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/pyproject.toml#L42-L44)，指向 `nanobot.cli.commands:app`。
- `python -m nanobot` 的模块入口在 [__main__.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/__main__.py)。

### 三种主要运行模式

- **onboard**：初始化 `~/.nanobot`（config/workspace/logs 等）并生成模板文件。实现集中在 [commands.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cli/commands.py)。
- **agent**（单次）：CLI 直接调用 `AgentLoop.process_direct()`（不经过 channels），适合脚本/手工调试。见 [AgentLoop.process_direct](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py#L342-L369)。
- **gateway**（常驻）：同时启动 Channels + Cron + Heartbeat + AgentLoop.run，走完整“通道↔总线↔agent”链路。`gateway` 装配见 [commands.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cli/commands.py)。

## 核心数据流（结构级）

```text
Inbound (Telegram/Discord/Feishu/WhatsApp)               Outbound
┌──────────┐   publish_inbound   ┌─────────────┐   publish_outbound   ┌──────────────┐
│ Channel  ├────────────────────►│  MessageBus  ├────────────────────►│ ChannelManager│
└────┬─────┘                     │ (in/out queue│                      └─────┬────────┘
     │                           └──────┬──────┘                            │ send()
     │ consume inbound                   │ consume outbound                   ▼
     ▼                                   ▼                              ┌──────────┐
┌──────────┐  LLM+tools loop       ┌──────────┐                         │ Channel  │
│ AgentLoop ├──────────────────────►│ Provider │                         └──────────┘
└────┬─────┘                       └──────────┘
     │
     ▼
┌────────────┐   ┌────────────┐
│ SessionMgr  │   │ MemoryStore │   (workspace persistence)
└────────────┘   └────────────┘
```

关键点：
- 总线只负责“队列与事件”，不做路由策略；路由由 `OutboundMessage.channel` 与 `ChannelManager.channels` 决定（[ChannelManager._dispatch_outbound](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/manager.py#L119-L143)）。
- 会话归并键为 `InboundMessage.session_key = channel:chat_id`（[events.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/events.py#L20-L24)）。

## 配置与工作区模型（中观）

- 配置文件默认路径：`~/.nanobot/config.json`（[loader.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/loader.py#L10-L13)）。
- 配置加载特点：
  - 支持旧字段迁移（`tools.exec.restrictToWorkspace → tools.restrictToWorkspace`）。见 [_migrate_config](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/loader.py#L65-L72)。
  - camelCase 与 snake_case 双向转换，适配 Pydantic schema（[convert_keys / convert_to_camel](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/loader.py#L75-L90)）。
- 工作区模板文件（作为系统提示词基座）位于仓库样例 [workspace/](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/workspace)；实际运行时由 onboard 写到用户目录工作区并被 [ContextBuilder.build_system_prompt](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py#L21-L71) 读取。

