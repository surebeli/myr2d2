# 大局规划报告（mynanobot / nanobot）

输入仓库：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/`  
输出目录：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/nanobot`

## 0. 同步信息（Doc ↔ Submodule）

- 本文档的源码基线由 [SOURCE.json](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/nanobot/SOURCE.json) 管理。
- 本次更新将 submodule 从 `18ec651b34907e57af82d9d3ddc6ddf39d106c2a` 快进到 `890d7cf85327c13500be5ed13db70f87a4e91243`（heads/main）。
- 变更摘要（用于快速定位需要复核的文档段落）：
  - memory：重构为两层记忆（`MEMORY.md` + `HISTORY.md`）。
  - channels：新增/补齐多种渠道实现（Email/DingTalk/MoChat/QQ/Slack 等）。
  - tools/subagent：补齐 `edit_file` 工具，并为子代理补充时间上下文。

## 1. 环境与方案

- **环境检测结果**：当前在 **Trae IDE（macOS）** 环境中运行，具备本地代码检索、文件读取、命令执行与并行子任务能力。
- **选择的方案**：采用 **TRAE Multi-agent（并行只读分析）**：先用 Web 获取项目意图与亮点，再用本地元数据（文件数/目录树/入口点）完成大局与中观建模，最后只抽取极少量关键文件做细节校验。
- **边界**：本轮以“架构/模块/数据流/亮点”为主，不做全量源码逐行解读；仅引用少量关键入口与核心循环文件。

## 2. 外部概要

- 项目定位：`nanobot` 是一个“超轻量个人 AI 助手/Agent 框架”，强调核心代码量极小、便于学习与改造，并支持多种聊天渠道（Telegram/Discord/WhatsApp/飞书）与本地模型（vLLM/OpenAI-compatible）。  
  参考：GitHub `HKUDS/nanobot` README（https://github.com/HKUDS/nanobot）
- 典型架构描述：以 **Perceive-Think-Act-Loop** 的 agent loop 为核心，围绕工具调用（web/shell/filesystem）与会话上下文构建进行多轮迭代。  
  参考：学习仓库对 `agent/loop.py` 的概括（https://github.com/WangyiNTU/nanobot-study）

## 3. 仓库概述

- **规模（本地统计）**
  - 文件总数：92
  - Python 文件：54
  - 主要大文件为演示 GIF/PNG；核心代码集中在 `nanobot/`（单文件最大约 20KB）
- **技术栈**
  - Python：`>=3.11`（[pyproject.toml](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/pyproject.toml#L1-L33)）
  - CLI：Typer（`nanobot` 命令入口，[pyproject.toml](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/pyproject.toml#L42-L44) → [commands.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cli/commands.py)）
  - LLM Provider：LiteLLM 统一适配（[litellm_provider.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/providers/litellm_provider.py)）
  - 配置：Pydantic v2 / pydantic-settings（[schema.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/schema.py)）
  - 通道/网络：python-telegram-bot、Discord/飞书 SDK、websocket/websockets、httpx，及更多渠道实现（如 Email/Slack/DingTalk/MoChat/QQ）
  - WhatsApp：Node.js TypeScript bridge（`bridge/`）
- **核心定位（从源码结构推断）**
  - 一个“可部署的轻量 agent 服务”：支持 CLI 单次对话，也支持 gateway 常驻运行（通道 + cron + heartbeat）。

## 4. 目录树（Depth=3）

```text
mynanobot/
├── bridge/
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── types.d.ts
│   │   └── whatsapp.ts
│   ├── package.json
│   └── tsconfig.json
├── case/                      # 演示素材（GIF）
├── nanobot/                   # Python 主包
│   ├── agent/                 # 推理循环 + 上下文 + 工具/技能/子代理
│   ├── bus/                   # inbound/outbound 事件与队列
│   ├── channels/              # Telegram/Discord/Feishu/WhatsApp/Slack/Email/DingTalk/MoChat/QQ/...
│   ├── cli/                   # Typer CLI
│   ├── config/                # 配置 schema/loader
│   ├── cron/                  # 定时任务
│   ├── heartbeat/             # 心跳
│   ├── providers/             # LLM/转写 provider
│   ├── session/               # 会话持久化
│   ├── skills/                # 内置技能说明与脚本
│   ├── utils/
│   ├── __init__.py
│   └── __main__.py
├── tests/
├── workspace/                 # onboard 生成的模板（SOUL/TOOLS/USER 等）
├── Dockerfile
├── README.md
└── SECURITY.md
```

## 5. 模块分解

### 5.1 入口与运行形态

- **CLI 主入口**：`nanobot` → [commands.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cli/commands.py)
  - `onboard`：初始化用户目录/模板（workspace 的 AGENTS/SOUL/TOOLS/USER/memory）
  - `agent`：单次对话模式（直接调用 agent loop）
  - `gateway`：常驻模式（启动 channels + cron + heartbeat + agent loop）
- **模块入口**：`python -m nanobot` → [__main__.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/__main__.py)
- **WhatsApp Bridge**：Node 侧 [index.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/index.ts) / [server.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts)

### 5.2 Agent 核心（Perceive-Think-Act-Loop）

- **AgentLoop**：主循环与工具调用迭代在 [loop.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py)
- **ContextBuilder**：系统提示词由“bootstrap + memory + skills summary + history”组成（[context.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/context.py)）
- **SkillsLoader / MemoryStore**：技能摘要与持久记忆（[skills.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/skills.py)，[memory.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/memory.py)）
- **工具系统**：内置工具集中在 [agent/tools/](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/)
  - filesystem/shell/web/spawn/message/cron 等

### 5.3 消息总线（解耦 Channel 与 Agent）

- **事件定义**：[events.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/events.py)
- **队列与派发**：[queue.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/queue.py)
- **典型流**：
  - Channel 收到消息 → 写入 inbound queue
  - Agent 消费 inbound → 推理/工具迭代 → 写入 outbound queue
  - ChannelManager 消费 outbound → 发回对应通道

### 5.4 Channels 与 Bridge

- 抽象基类：[channels/base.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/base.py)
- 统一管理与分发：[channels/manager.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/manager.py)
- WhatsApp：Python 侧通过 WebSocket 连接 Node bridge（[channels/whatsapp.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py)）

### 5.5 定时、自唤醒与会话

- Cron：[cron/service.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cron/service.py)
- Heartbeat：[heartbeat/service.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/heartbeat/service.py)
- Session（历史持久化）：[session/manager.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/session/manager.py)

### 5.6 亮点（从本地实现提炼）

- **极简但完整的 Agent 回路**：核心逻辑集中、入口清晰，适合作为“可阅读的参考实现”（[loop.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/loop.py)）
- **消息总线解耦**：将“渠道接入”与“推理/工具回路”分离，方便扩展新 channel 或替换 agent（[queue.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/bus/queue.py)）
- **技能渐进加载**：先提供 skills 摘要，必要时再读取技能全文，降低上下文成本（[skills.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/skills.py)）
- **Provider 统一适配**：通过 LiteLLM 把多厂商模型接入路径统一（[litellm_provider.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/providers/litellm_provider.py)）
- **WhatsApp 采用 Node 桥接**：规避 Python 直连 WA Web 协议的复杂性，Python 侧只做 WS 协议适配（[bridge/src/server.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts)，[channels/whatsapp.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py)）

## 6. Subagent 计划（可并行执行的“深入分析”）

下面的子任务用于后续多轮深入（你可以直接说“执行[subagent名称]”来继续），每个子任务都限定在小上下文与最少代码片段。

```json
{
  "scheme": "TRAE",
  "subagents": [
    {
      "name": "structure_overview",
      "task": "补全仓库结构、入口、运行形态与依赖关系图",
      "boundary": "不做全量读代码；以元数据+关键入口文件为主",
      "prior_knowledge": "nanobot 是超轻量个人AI助手；核心为 agent loop；支持多渠道与本地模型"
    },
    {
      "name": "agent_core",
      "task": "细读 AgentLoop/ContextBuilder：消息如何变成 tool_calls，如何收敛与防循环",
      "boundary": "只读 agent/loop.py 与 agent/context.py 等少量关键文件",
      "prior_knowledge": "Perceive-Think-Act-Loop；工具迭代有 max_tool_iterations 上限"
    },
    {
      "name": "tools_and_skills",
      "task": "分析工具注册/权限边界/技能加载策略，评估安全与可扩展性",
      "boundary": "只读 agent/tools/* 与 agent/skills.py；不展开第三方库内部",
      "prior_knowledge": "restrict_to_workspace 等安全开关；skills 采用摘要+按需加载"
    },
    {
      "name": "channels_and_bus",
      "task": "分析 bus 与 channel 解耦设计：inbound/outbound 的事件模型与并发模型",
      "boundary": "只读 bus/* 与 channels/*；不做运行态抓包",
      "prior_knowledge": "Channel 收/发与 Agent 推理分离，靠队列连接"
    },
    {
      "name": "whatsapp_bridge",
      "task": "分析 Node bridge↔Python 通讯协议与故障恢复点",
      "boundary": "只读 bridge/src/* 与 channels/whatsapp.py",
      "prior_knowledge": "WhatsApp 采用 WebSocket 桥接"
    },
    {
      "name": "ops_deploy",
      "task": "分析 Dockerfile/SECURITY/测试脚本，梳理部署与安全基线",
      "boundary": "以文档与配置为主；只读少量相关实现",
      "prior_knowledge": "项目提供 Docker 支持与安全加固说明"
    }
  ]
}
```

## 7. 上下文评估

- **Token 估算**：低（<10k）
  - 理由：仓库文件数 84、核心 Python 文件 46、单文件体量小；本轮主要靠结构与入口点推断。
