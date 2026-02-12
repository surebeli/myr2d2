# 子报告 03：工具与技能（tools_and_skills）

核心文件：
- 工具基类与注册表：[base.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/base.py)、[registry.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/registry.py)
- 文件/命令/网络工具：[filesystem.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/filesystem.py)、[shell.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/shell.py)、[web.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/web.py)
- 技能加载：[skills.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/skills.py)
- 记忆存储：[memory.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/memory.py)

## 结论摘要

- 工具系统由 `ToolRegistry` 统一注册、向 LLM 暴露 schema，并在执行前做轻量 JSON Schema 校验。
- `restrict_to_workspace` 是关键安全阀：文件工具通过 `allowed_dir` 限制路径，shell 工具通过“模式阻断 + 路径启发式检查 + 超时”降低破坏面。
- 技能系统采用“builtin + workspace override + requirements 过滤 + 摘要式注入”，明显偏向“降低上下文成本”和“可替换/可扩展”。
- 需要注意的安全边界：filesystem 的 `startswith` 前缀检查存在误判风险；web_fetch 未显式阻断内网/localhost，存在 SSRF 面；skills/workspace 内容若可被不可信方写入，会成为 prompt 注入入口。

## 工具注册与执行模型

- `ToolRegistry`：
  - name→tool 映射与覆盖式注册（[registry.py:L8-L33](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/registry.py#L8-L33)）。
  - `get_definitions()` 产出 OpenAI function schema（[registry.py:L34-L36](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/registry.py#L34-L36)）。
  - `execute(name, params)`：校验后执行，异常吞掉并转字符串返回（[registry.py:L38-L62](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/registry.py#L38-L62)）。

## 参数校验（轻量 JSON Schema）

- `Tool.validate_params()`：
  - 只支持 object/array/string/integer/number/boolean 的常用约束：required、enum、min/max、minLength/maxLength、items（[base.py:L55-L91](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/base.py#L55-L91)）。
  - 对对象属性的校验是“声明的 properties 才校验”，额外字段不报错（[base.py:L80-L88](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/base.py#L80-L88)），这点在测试里也被固定下来（[test_tool_validation.py:L78-L82](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/tests/test_tool_validation.py#L78-L82)）。

## 工作区限制（restrict_to_workspace）

### filesystem 工具

- `_resolve_path(path, allowed_dir)` 将路径 resolve 后做“前缀字符串 startswith 检查”决定是否允许（[filesystem.py:L9-L14](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/filesystem.py#L9-L14)）。
- 该检查用于 `read_file/write_file/edit_file/list_dir`（[filesystem.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/filesystem.py)）。

风险提示：
- 字符串前缀判断可能误放行同前缀目录（例如允许 `/work/dir` 时 `/work/dir_evil` 也匹配），属于典型安全薄弱点。

### shell 工具

- denylist：阻断明显危险命令模式（[shell.py:L15-L36](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/shell.py#L15-L36)）。
- allowlist（可选）：如果设置了 allowlist，则只允许匹配 allowlist（[shell.py:L111-L123](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/shell.py#L111-L123)）。
- 工作区限制：阻断 `../`，并尝试解析命令中出现的“看似路径”的参数，要求在 cwd 内（[shell.py:L124-L140](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/shell.py#L124-L140)）。

## web 工具与网络面

- URL 校验只检查 scheme 与 netloc（[web.py:L33-L43](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/web.py#L33-L43)）。
- `web_fetch` 走 httpx，带超时，并把内容通过 readability 抽取（[web.py:L121-L151](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/tools/web.py#L121-L151)）。

风险提示：
- 未显式阻断 `localhost` / 内网 IP / 云元数据地址，默认具备 SSRF 风险面（取决于运行环境网络策略）。

## 技能系统（Skills）

### 来源与覆盖规则

- workspace 优先：`{workspace}/skills/<skill>/SKILL.md`（[skills.py:L21-L45](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/skills.py#L21-L45)）。
- builtin：`nanobot/skills`，且当 workspace 没有同名 skill 时才加入（[skills.py:L10-L53](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/skills.py#L10-L53)）。

### requirements 检查（可用性过滤）

- 从 frontmatter 的 `metadata` 里解析 JSON，取 `nanobot.requires.bins/env` 校验（[skills.py:L169-L227](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/skills.py#L169-L227)）。

### 渐进加载（摘要→按需读全文）

- `build_skills_summary()` 输出 XML 摘要（含 location、available、缺失依赖原因），设计意图是“让模型先看到索引，需要时再用 read_file 拉全文”（[skills.py:L101-L140](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/skills.py#L101-L140)）。

## 记忆（Memory）落盘位置

- 长期记忆：`{workspace}/memory/MEMORY.md`；当日笔记：`{workspace}/memory/YYYY-MM-DD.md`（[memory.py:L16-L23](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/memory.py#L16-L23)）。
- `get_memory_context()` 会把长期 + 当日合并到 prompt（[memory.py:L90-L109](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/agent/memory.py#L90-L109)）。

