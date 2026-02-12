# OpenClaw Memory（一页摘要）

适用读者：产品/架构/安全/运维，希望在 3 分钟内理解 memory 的边界与价值。

## TL;DR

- 真相来源是 workspace 的 Markdown（可审计、可手工改、可版本化），不是私有 DB。证据：[concepts/memory.md:L10-L26](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L10-L26)
- 向量/全文索引只是“可替换检索加速层”（builtin SQLite 或 QMD sidecar），失败可 fallback 保持可用。证据：[concepts/memory.md:L104-L135](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L104-L135)、[search-manager.ts:L19-L65](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/search-manager.ts#L19-L65)
- 通过“compaction 前 silent memory flush”把 durable 记忆写盘变成生命周期的一部分，降低“压缩后遗忘”。证据：[concepts/memory.md:L38-L74](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L38-L74)

## 架构图

```mermaid
flowchart LR
  A[Workspace Markdown\nMEMORY.md + memory/*.md] --> B[增量扫描(hash)\n+ chunking]
  B --> C[Embeddings\nprovider auto/remote/local]
  C --> D[Builtin SQLite index\n(optional vec/FTS)]
  C --> E[QMD sidecar index\n(hybrid retrieval)]
  D --> F[memory_search/memory_get tools]
  E --> F
  F --> G[上下文注入 + 引用/行号读取]
```

## 关键机制（为什么“可控”）

- **两层记忆**：`memory/YYYY-MM-DD.md`（日记）+ `MEMORY.md`（精选长期）；且 `MEMORY.md` 只在 main/private session 加载以降低泄露面。证据：[concepts/memory.md:L18-L26](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L18-L26)
- **文件发现与安全边界**：默认只收集 `.md` 且跳过 symlink；支持 extraPaths 但同样跳过 symlink/realpath 去重。证据：[internal.ts:L61-L76](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/internal.ts#L61-L76)、[internal.ts:L109-L143](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/internal.ts#L109-L143)
- **增量索引**：manager 启动 watcher + interval sync + session transcript listener，避免每次全量重建。证据：[manager.ts:L233-L247](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/manager.ts#L233-L247)

## 对 myr2d2 的直接价值

- 记忆变更可审计、可回滚：适合机器人长期运行与运维交接。
- 可以把“安全策略/设备清单/家庭偏好/禁用动作”等写进 `MEMORY.md`，并依赖工具检索回注入，降低模型漂移。
- QMD 作为增强可选：先用 builtin 保底，需求增长再启用 QMD（并保留 fallback）。

## 风险与对策（P0/P1）

- P0：把敏感记忆写进群聊上下文 → 默认只在 private/main session 加载 `MEMORY.md`，不要放开。证据：[concepts/memory.md:L23-L26](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L23-L26)
- P1：extraPaths 引入不受控文档源 → 仅允许受信目录，保持 symlink 跳过策略（避免路径欺骗）。证据：[internal.ts:L114-L116](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/memory/internal.ts#L114-L116)

## 延伸阅读

- 深挖版：[memory.md](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/openclaw/deepdives/memory.md)

