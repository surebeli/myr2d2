# OpenClaw Memory：设计思路、亮点与架构

ROOT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`

## 1) 设计目标（从“可控”出发）

OpenClaw 的 memory 不是“黑盒向量数据库先行”，而是把 **人类可审计、可版本化、可手工编辑** 放在第一位：
- 记忆真相来源是 workspace 中的 Markdown 文件，而不是内部私有 DB。证据：[concepts/memory.md:L10-L26](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L10-L26)
- DB/向量索引只是“检索加速层”，随时可重建、可替换后端（builtin / QMD）。证据：[concepts/memory.md:L104-L135](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L104-L135)、[search-manager.ts:L19-L65](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/search-manager.ts#L19-L65)

这套设计非常适合作为“蜂后大脑”的长期记忆底座：运维能查、能改、能迁移；出问题能回滚；不会被某个 embedding provider 或某套向量库锁死。

## 2) 信息架构：两层记忆（Daily log + Curated memory）

默认 workspace 布局是“两层记忆”：
- `memory/YYYY-MM-DD.md`：日记式 append-only；会在会话启动时读当天与前一天。证据：[concepts/memory.md:L18-L23](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L18-L23)
- `MEMORY.md`：精选长期记忆；只在 main/private session 加载，避免群聊/公开上下文泄露。证据：[concepts/memory.md:L23-L26](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L23-L26)

文件发现规则（工程化细节）：
- 默认收集 `MEMORY.md` / `memory.md` + `memory/` 目录下所有 `.md`，且跳过 symlink。证据：[internal.ts:L46-L76](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/internal.ts#L46-L76)、[internal.ts:L78-L107](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/internal.ts#L78-L107)
- 支持 `extraPaths` 引入工作区外的 Markdown（同样跳过 symlink，并做 realpath 去重）。证据：[internal.ts:L109-L143](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/internal.ts#L109-L143)、[concepts/memory.md:L221-L232](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L221-L232)

## 3) 架构：Source-of-truth（MD）+ Index（可替换）

```mermaid
flowchart LR
  A[Workspace Markdown\nMEMORY.md + memory/*.md + extraPaths] --> B[File discovery + hash\nlistMemoryFiles/buildFileEntry]
  B --> C[Chunking\nchunkMarkdown(tokens,overlap)]
  C --> D[Embeddings\nprovider=auto/openai/gemini/voyage/local]
  D --> E[Builtin Index\nSQLite(meta/files/chunks)\n+ optional sqlite-vec + optional FTS]
  D --> F[QMD Sidecar Index\nqmd update/embed/query\nown sqlite + hybrid retrieval]
  E --> G[memory_search/memory_get tools]
  F --> G
  G --> H[Agent Context Injection]
```

### 3.1 Builtin 后端：SQLite +（可选）sqlite-vec +（可选）FTS

Builtin 的核心对象是 `MemoryIndexManager`：\n- 以 agentId + workspaceDir + settings 为 cacheKey 复用实例。证据：[manager.ts:L170-L204](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/manager.ts#L170-L204)\n- 启动时建立 schema、启动 watcher、订阅 session transcript 事件、启动 interval sync。证据：[manager.ts:L233-L247](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/manager.ts#L233-L247)

切块策略的工程取舍：
- `chunkMarkdown` 用 “tokens×4≈chars” 的近似方式做 chunk+overlap，减少对 tokenizer 的依赖，提升跨环境可用性与速度。证据：[internal.ts:L166-L176](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/internal.ts#L166-L176)

### 3.2 QMD 后端：Hybrid retrieval sidecar（实验性但可落地）

QMD 的定位不是替代 Markdown，而是替代 builtin 的“检索引擎”：\n- 配置 `memory.backend = "qmd"`，OpenClaw 通过子进程调用 `qmd query --json`。\n- 若 qmd 不可用或返回异常，会自动 fallback 到 builtin，保证工具可用性。证据：[concepts/memory.md:L133-L135](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L133-L135)、[search-manager.ts:L24-L64](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/search-manager.ts#L24-L64)

## 4) 写入与更新：以“增量同步”避免成本爆炸

memory 的写入（从产品视角）不是 API，而是“写文件”：
- 模型/用户想记住什么，就写到 `MEMORY.md` 或 `memory/YYYY-MM-DD.md`。证据：[concepts/memory.md:L30-L37](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L30-L37)

索引更新（从工程视角）强调三点：
- **基于 hash 的增量**：文件内容 hash 相同跳过，变更才重建 chunks 与 embedding。\n- **多触发源**：文件 watcher（debounce）、定时 interval、session start warm、session transcript update。\n- **可控并发**：embedding batching/concurrency 与重试策略内置在 manager，防止 provider 波动把系统拖垮。证据：批量/重试常量与并发设置见 [manager.ts:L91-L103](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/manager.ts#L91-L103)

## 5) “记忆写盘”与“上下文压缩”的衔接（亮点）

最容易被忽视但非常关键的一点：OpenClaw 解决了“压缩前遗忘”的实际痛点。\n当 session 接近 auto-compaction，会触发一次 **silent agent turn**，提醒把 durable 内容写入 memory 文件，通常要求 `NO_REPLY` 让用户无感。证据：[concepts/memory.md:L38-L74](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L38-L74)

这等价于把“长期记忆写入”变成 compaction 生命周期的一部分：\n- 不依赖用户每次手动说“记住”\n- 不依赖模型“自觉”\n- 让记忆更稳定可控（因为最终写到文件）

## 6) 对外能力面：工具、CLI、HTTP

Agent 工具层：
- `memory_search`：语义检索（可附 citations）；`memory_get`：按文件行精确读取。证据：[memory-tool.ts:L25-L135](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/tools/memory-tool.ts#L25-L135)

CLI 层：
- `openclaw memory status/index/search` 用于诊断与重建索引。证据：[memory-cli.ts:L485-L560](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/cli/memory-cli.ts#L485-L560)

Gateway HTTP 层：
- `POST /tools/invoke` 统一入口可以调用 `memory_search/memory_get`（与工具策略一致受控）。证据：[tools-invoke-http.ts:L102-L170](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/gateway/tools-invoke-http.ts#L102-L170)

## 7) 适用于 myr2d2 的直接结论（拿来即用）

- “可审计 + 可回滚”的 memory 形态，非常适合作为机器人系统长期运行的基础设施。\n- “只在 main/private session 加载 MEMORY.md”是默认隐私策略，适合机器人在公开环境（群聊/家庭多人）运行。\n- “compaction 前 memory flush”建议保留：它显著降低“机器人忘记关键偏好/约束”的概率，同时不污染用户对话体验。

