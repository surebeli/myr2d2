# 通用代码仓库分析 Prompt（强约束版，可复用 / IDE 友好）

用途：把任意源码仓库（单体 / 多语言 / 单仓多包 / monorepo）快速分析成可复现、可落地的“结构 / 行为 / 风险”三层报告，并生成机器可读摘要与可并行子任务计划。

## 0. 参数（运行前必须填写）

- PROJECT_NAME：`<项目名或仓库名>`
- ROOT：`<仓库根目录绝对路径>`（必须是你当前可读的本地路径）
- OUT：`<输出目录绝对路径>`（建议：`<你的doc目录>/<PROJECT_NAME>`）
- PRIMARY_GOAL：从以下选择 1 项：
  - `learn`：理解系统（默认）
  - `extend`：准备做功能扩展/重构
  - `prod`：准备生产落地（安全/运维/可观测/测试）
- CAPABILITIES（你可用的工具能力，按实际环境勾选）：
  - `can_list_dir`：能列目录与文件
  - `can_search_code`：能全文检索
  - `can_read_files`：能读取文件内容
  - `can_run_commands`：能运行命令（只读为主）
  - `can_web_search`：能联网检索（只做背景，非证据）

## 0.1 默认能力配置（IDE 场景）

当你在 IDE/代码助手环境中工作时，通常具备：
- `can_list_dir=true`
- `can_search_code=true`
- `can_read_files=true`
- `can_run_commands=可选`（建议只用于元数据统计/验证，不要用来编辑文件）
- `can_web_search=可选`（只做背景，禁止当证据）

## 1. 硬约束（必须遵守）

1) **证据来源限制**：所有结论必须能追溯到 `ROOT` 下的文件证据。  
- 允许引用：`file:///.../ROOT/...` 的文件链接（优先带 `#Lx-Ly`）。  
- 禁止引用：ROOT 外任何文件作为结论依据（包括相似仓库、历史记忆、互联网内容）。

2) **“结论”与“证据”分离**：  
- 每条关键结论必须带至少 1 个证据链接（文件级或行范围）。  
- 外部资料只允许作为“背景/动机”，必须标注为“非证据”，且不能覆盖本地证据结论。

3) **三层输出顺序**：必须按 `结构层 → 行为层 → 风险层` 输出，避免在结构层混入改造建议。

4) **非目标（Non-goals）**：  
- 不做全量逐行解读。  
- 不做未请求的代码修改/重构/加功能。  
- 不做无法被仓库证据支撑的推断性结论。

## 2. 上下文与预算策略

- Token 估算：低 <10k / 中 10–50k / 高 >50k。若进入“高”，必须切换为“摘要模式 + 分批读取 + 并行拆分”。
- 外部检索预算（可选）：最多 2 次、最多 5 条结果；仅用于背景，不作为结论证据。
- 阅读代码原则：先目录与入口，再读关键路径；单次读取尽量 < 2k 行，优先定位到函数/类区间。

## 2.1 工具使用策略（IDE 场景，推荐顺序）

当 `can_list_dir/can_search_code/can_read_files` 为真时，按以下顺序工作以降低上下文浪费：

1) **结构扫描优先**：先生成目录树（深度 2–3）、统计文件数/后缀分布、找入口文件（main/cli/server/config）。  
2) **语义检索优先**：如果有“语义搜索/搜索 agent”，先用它定位核心循环与关键模块，再做精读。  
3) **grep/全文检索补齐**：用关键词补齐边角（如 `session_key`、`tool_calls`、`allowFrom`、`restrict_to_workspace`、`Dockerfile`）。  
4) **小片段精读**：只读必要的函数/类区间；避免一次性读取整文件。  
5) **命令执行只做验证**：仅用于“非副作用”的统计/测试/格式校验；不要用命令去写文件或改仓库内容。  
6) **联网检索只做背景**：如果启用 web_search，只允许用于“项目定位/术语背景”；结论必须回到本地文件证据。

## 3. 输出物（必须落盘到 OUT）

- `REPORT.md`：三层报告（结构/行为/风险）
- `PLAN.json`：子任务计划（可并行 subagents）
- `subreports/INDEX.md`：子报告索引
- `subreports/SUMMARY.json`：合并摘要（机器可读）

（如果 PRIMARY_GOAL = prod）额外输出：
- `SECURITY-REVIEW.md`：威胁模型与最小修复集（只列建议，不改代码）

## 4. 执行流程（可复现步骤）

### Step 1：结构层（Structure）

目标：回答“系统边界是什么、入口在哪、模块怎么切、状态在哪、跨语言/跨进程点在哪”。

最小动作：
- 统计规模：文件数、语言分布（按扩展名）、最大文件列表（排除 `.git`、`node_modules`、`dist`、`build` 等）。
- 生成目录树（深度 2–3），识别顶层包/子项目。
- 定位入口点：
  - CLI：`package.json bin` / `pyproject.toml scripts` / `Cargo.toml [[bin]]` / `cmd/` / `main.*`
  - 服务：HTTP server、worker、daemon、cron、queue consumer
  - 配置入口：默认 config 路径、环境变量、profiles
- 定位状态与持久化：
  - DB / 文件 / 缓存 / 日志 / 会话 / workspace
- 输出模块边界（module map）：每个模块只写“职责 + 关键文件”。

结构层输出模板（写入 REPORT.md）：
- 入口点（entrypoints）
- 模块边界（module map）
- 状态与持久化（state locations）
- 并发/跨线程/跨进程点（concurrency boundaries）

### Step 2：行为层（Behavior）

目标：回答“输入如何变成输出、主循环在哪里、关键不变量是什么、失败如何处理、哪些点能扩展”。

最小动作（只读关键文件）：
- 选出 5–12 个“定义系统行为”的文件（主循环、消息契约、路由器、执行器、配置加载器、持久化层）。
- 为每条主链路画出事件/状态机（用文字即可）：`Input → Parse/Route → Core Loop → Side Effects → Output`。
- 提取不变量（至少 5 条，最好 10 条），例如：
  - 路由键如何构造
  - ID 生成规则
  - 消息/协议字段格式（JSON schema / protobuf / HTTP contract）
  - 工具/插件接口契约
  - 并发假设（单线程/多线程/async）与队列语义
  - 超时/重试/幂等等策略
- 列出扩展点（extension points）：新增模块/插件/命令/handler 的最小改动路径。

行为层输出模板（写入 REPORT.md）：
- 主链路（按用户路径分组，如：CLI / HTTP / worker / scheduled job）
- 不变量清单（每条带 file:/// 证据）
- 扩展点清单（每条带 file:/// 证据）

### Step 3：风险层（Risk）

目标：回答“信任边界在哪、攻击面有哪些、控制点是什么、测试/观测缺口在哪里”。

最小动作：
- 明确资产（secrets、用户数据、workspace、日志、历史会话、凭据、可写目录）。
- 列出攻击面（执行命令、文件读写、网络出站、反序列化、插件加载、hook 脚本、webhook、bridge）。
- 列出控制点（鉴权、allowlist、sandbox、路径限制、超时、速率限制、审计日志）。
- 列出缺口（P0/P1/P2）：安全缺口、可靠性缺口、可观测性缺口、测试缺口。

风险层输出模板（写入 REPORT.md）：
- 信任边界与最小威胁模型（资产/攻击面/控制点）
- 风险清单（P0/P1/P2，附证据）
- 测试覆盖缺口（附证据）

## 5. 子任务拆分（并行 subagents）

当满足以下任一条件，必须拆分并行子任务：
- 文件数 > 100 或模块 > 5
- 多语言/多运行时（如 Python + Node + Go + Rust）
- 存在跨进程桥接（bridge/daemon/container）
- PRIMARY_GOAL = prod

推荐拆分模板（按仓库实际调整）：
- `structure_overview`：结构与入口
- `core_loop`：主循环/核心执行路径
- `io_contracts`：输入输出契约（HTTP/CLI/protocol）
- `persistence`：状态/持久化/迁移
- `extensibility`：插件/工具/扩展点
- `security_and_ops`：安全/部署/观测/测试

PLAN.json 模板（必须生成，字段可扩展）：
```json
{
  "scheme": "generic",
  "projectName": "PROJECT_NAME",
  "root": "ROOT",
  "out": "OUT",
  "primaryGoal": "learn|extend|prod",
  "capabilities": {
    "can_list_dir": true,
    "can_search_code": true,
    "can_read_files": true,
    "can_run_commands": false,
    "can_web_search": false
  },
  "subagents": [
    {"name": "structure_overview", "task": "结构层与入口点", "boundary": "只读 ROOT 内文件", "prior_knowledge": ""},
    {"name": "core_loop", "task": "核心执行路径与不变量", "boundary": "只读 ROOT 内关键文件", "prior_knowledge": ""},
    {"name": "security_and_ops", "task": "风险层与运维视角缺口", "boundary": "只读 ROOT 内文档/配置/入口实现", "prior_knowledge": ""}
  ]
}
```

## 6. Subagent 交付格式（防上下文漂移）

每个子任务必须输出（写入 `OUT/subreports/<NN>-<name>.md`）：
1) 150–300 字摘要（结论先行）  
2) 5–12 条要点：每条都带 `file:///...` 证据链接（优先 `#Lx-Ly`）  
3) 风险/缺口列表：P0/P1/P2 分级  
4) 后续验证清单：最小命令集合（不要求实际执行）  

禁止：
- 引用 ROOT 外内容作为结论依据
- 输出与该主题无关的模块
- 用泛泛描述代替证据

## 7. 质量闸门（必须通过）

- 任意关键结论都必须带 `file:///` 证据链接。
- 扫描输出中出现的 `file:///` 链接：如果不在 `ROOT` 或 `OUT` 下，视为污染，必须修正或删除。
- `PLAN.json`、`subreports/SUMMARY.json` 必须可解析。

## 8. 最终报告结构（写入 REPORT.md）

```md
# 三层报告：PROJECT_NAME

## 1. 结构层（Structure）
...

## 2. 行为层（Behavior）
...

## 3. 风险层（Risk）
...
```

执行开始：如果 `CAPABILITIES.can_list_dir/can_search_code/can_read_files` 可用，先完成结构层扫描；只有当需要背景解释时才做外部检索，并标注“非证据”。
