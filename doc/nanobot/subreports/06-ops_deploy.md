# 子报告 06：部署、安全与测试（ops_deploy）

核心文件：
- Docker：[Dockerfile](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/Dockerfile)
- 安全策略：[SECURITY.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/SECURITY.md)
- 测试：[test_tool_validation.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/tests/test_tool_validation.py)、[test_docker.sh](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/tests/test_docker.sh)
- 配置加载：[loader.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/loader.py)
- 运行期任务：[cron/service.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cron/service.py)、[heartbeat/service.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/heartbeat/service.py)

## 结论摘要

- Docker 镜像是“Python 主体 + Node bridge（WhatsApp）”的组合：基于 `uv:python3.12-bookworm-slim`，额外安装 Node.js 20，并在构建期编译 bridge。
- 安全文档对生产环境给出了较明确的建议（allowFrom 白名单、非 root、权限、审计、依赖更新），但 Dockerfile 默认仍以 root 运行，这与文档建议存在实现差距。
- 测试覆盖很薄：Python 侧主要验证工具参数校验；Docker 冒烟脚本验证 `onboard/status` 输出，但没有覆盖 allowFrom、restrict_to_workspace、bridge 可靠性、安全边界等关键路径。

## Docker 部署模型

- 基础镜像：`ghcr.io/astral-sh/uv:python3.12-bookworm-slim`（[Dockerfile:L1](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/Dockerfile#L1)）。
- 额外安装 Node.js 20 用于 WhatsApp bridge（[Dockerfile:L3-L13](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/Dockerfile#L3-L13)）。
- 依赖安装策略：先复制 `pyproject.toml` 做缓存层安装，再复制完整源码并二次安装（[Dockerfile:L17-L27](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/Dockerfile#L17-L27)）。
- bridge 构建：`npm install && npm run build`（[Dockerfile:L28-L31](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/Dockerfile#L28-L31)）。
- 默认入口：`ENTRYPOINT ["nanobot"]`，默认命令 `status`（[Dockerfile:L39-L40](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/Dockerfile#L39-L40)）。
- 暴露端口：`EXPOSE 18790`（[Dockerfile:L36-L37](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/Dockerfile#L36-L37)）。

## 安全态势（以 SECURITY.md 为准）

文档明确的生产基线：
- **API key**：要求 `~/.nanobot/config.json` 权限 `0600`（[SECURITY.md:L19-L35](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/SECURITY.md#L19-L35)）。
- **通道访问控制**：强烈建议配置 `allowFrom`；空列表会放行所有用户（[SECURITY.md:L37-L61](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/SECURITY.md#L37-L61)）。
- **不要以 root 运行**：在 Shell/文件系统章节与生产部署章节都强调（[SECURITY.md:L63-L72](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/SECURITY.md#L63-L72)，[SECURITY.md:L128-L151](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/SECURITY.md#L128-L151)）。
- **WhatsApp bridge**：默认 `localhost:3001`，如果暴露网络需要鉴权与 TLS；并强调 `~/.nanobot/whatsapp-auth` 权限（[SECURITY.md:L97-L101](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/SECURITY.md#L97-L101)）。
- **已知限制**：无 rate limiting、配置明文、命令过滤有限、审计不足（[SECURITY.md:L229-L238](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/SECURITY.md#L229-L238)）。

实现落差（重要）：
- Dockerfile 创建 `/root/.nanobot` 且未切换用户（[Dockerfile:L33-L35](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/Dockerfile#L33-L35)），与“不要以 root 运行”的生产建议不一致。

## 配置加载与迁移（运维角度）

- 默认配置路径：`~/.nanobot/config.json`（[loader.py:L10-L13](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/loader.py#L10-L13)）。
- 加载失败策略：JSON 解析失败或校验失败会打印 warning 并回退到默认 `Config()`（[loader.py:L33-L43](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/loader.py#L33-L43)）。
- 迁移点：历史字段 `tools.exec.restrictToWorkspace` 会被提升到 `tools.restrictToWorkspace`（[loader.py:L65-L72](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/config/loader.py#L65-L72)）。

## 定时与自唤醒（运行稳定性）

- Cron：
  - store 为 JSON 文件；启动时加载、重算 next_run、arm timer；到点执行回调 `on_job`（[cron/service.py:L56-L155](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cron/service.py#L56-L155)）。
  - 由于执行是串行 `for job in due_jobs: await _execute_job(job)`，多个到期任务会顺序执行（[cron/service.py:L204-L215](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/cron/service.py#L204-L215)）。
- Heartbeat：
  - 默认间隔 30 分钟（[heartbeat/service.py:L9-L16](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/heartbeat/service.py#L9-L16)）。
  - HEARTBEAT.md 没有“可执行内容”则跳过（[heartbeat/service.py:L21-L35](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/heartbeat/service.py#L21-L35)，[heartbeat/service.py:L104-L110](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/heartbeat/service.py#L104-L110)）。

## 测试现状与缺口

已覆盖：
- 工具参数校验（object/array/enum/range/required），并固定“忽略未知字段”的行为（[test_tool_validation.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/tests/test_tool_validation.py)）。
- Docker 冒烟：构建镜像、跑 onboard、commit 后跑 status 并检查输出关键字段（[test_docker.sh](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/tests/test_docker.sh)）。

明显缺口（可作为后续测试清单）：
- `restrict_to_workspace` 的安全边界（filesystem/shell）未被单测覆盖。
- `allowFrom` 的鉴权策略（BaseChannel.is_allowed）未被测试覆盖。
- WhatsApp bridge 的协议兼容性、断线重连、离线丢消息等可靠性未覆盖。
- config loader 的错误路径/迁移行为缺少测试矩阵（JSON 错误、缺字段、旧字段迁移、key 转换一致性）。

