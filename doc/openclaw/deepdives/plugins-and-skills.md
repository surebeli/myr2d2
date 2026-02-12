# OpenClaw Plugins & Skills：设计思路、亮点与架构

ROOT：`/Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw`

## 1) 设计总览：两种扩展的定位不同

OpenClaw 把扩展能力分成两类，分别解决不同层面的“可扩展”：
- **Plugins（插件 / extensions）**：运行在网关进程内的“系统级扩展”，可以注册 gateway methods、HTTP 路由、channel/provider/hook 等；更强也更敏感。
- **Skills（技能包）**：以 `SKILL.md` 为载体的“提示词/能力说明 + 可选安装依赖”，强调可组合、可筛选、可在 sandbox 中安全注入；更偏“agent 能力拼装”。

这是一种很实用的工程分层：\n- Plugins 负责扩展系统面（API、通道、工具集）。\n- Skills 负责扩展认知面（prompt 与工具使用的“策略/使用说明”）。

## 2) Plugins：发现 → 校验 → 加载 → 注册扩展点

### 2.1 插件发现（Discovery）的多来源与去重

插件发现会扫描多种来源，并将结果归类为不同 `origin`：\n- workspace dir\n- global user dir\n- bundled dir\n- config 指定路径（paths）\n\n候选项结构包含 `idHint/source/rootDir/origin` 等，用 `seen` 去重同一 source。证据：[discovery.ts:L14-L25](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/discovery.ts#L14-L25)、[discovery.ts:L84-L113](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/discovery.ts#L84-L113)

目录发现的两个“兼容入口”：
- 直接放 JS/TS 文件：只要扩展名在白名单且不是 `.d.ts` 就会被识别。证据：[discovery.ts:L12-L38](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/discovery.ts#L12-L38)\n- 以 package 形式存在：从 `package.json` 的 `openclaw.extensions` 读取扩展入口，并生成稳定 idHint（优先 unscoped 包名）。证据：[discovery.ts:L53-L83](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/discovery.ts#L53-L83)、[discovery.ts:L158-L179](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/discovery.ts#L158-L179)

### 2.2 启用状态与“slots”门控（特别是 memory slot）

插件加载过程首先根据 config 决策 enable/disable，并处理“同 id 覆盖”冲突：\n- 如果同一 pluginId 在不同 origin 重复出现，会标记 `overridden` 并禁用。证据：[loader.ts:L225-L253](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/loader.ts#L225-L253)\n- 对 `plugins.slots.memory` 会选中“唯一的 memory 插件”（例如默认 `memory-core`），形成插槽化的可替换实现（memory 工具来自 active memory plugin）。证据：memory slot 选择变量见 [loader.ts:L226-L229](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/loader.ts#L226-L229)、memory 插槽说明见 [concepts/memory.md:L13-L15](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/docs/concepts/memory.md#L13-L15)

### 2.3 Schema-first：没有 config schema 就拒绝加载（fail-fast）

一个非常“工程化”的亮点：\n- manifest 中如果缺少 `configSchema`，即使插件启用也会直接报错并阻止加载。\n- 这能避免“插件配置写错 → 运行时随机崩溃/行为不确定”的长期维护灾难。\n\n证据：[loader.ts:L280-L292](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/loader.ts#L280-L292)

### 2.4 运行时加载：jiti 动态加载 TS/JS，导出结构做一致性校验

- 插件通过 `jiti(candidate.source)` 加载 TS/JS。证据：[loader.ts:L294-L310](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/loader.ts#L294-L310)\n- 若导出的 plugin id/kind 与 manifest 不一致，会记录诊断 warning。证据：[loader.ts:L316-L337](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/loader.ts#L316-L337)

### 2.5 扩展点注册：网关方法 / HTTP 路由 / Channel / Provider / Hook…

插件通过 registry API 注册各种扩展能力，其中最关键的是 **gatewayMethods**：\n- 插件注册 gateway method 时，会阻止覆盖 core method 或其他插件已注册 method（冲突直接 error）。证据：[registry.ts:L265-L285](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/plugins/registry.ts#L265-L285)

## 3) Skills：加载合并、metadata、可用性筛选、注入 prompt

### 3.1 Skills 的来源与优先级（可控覆盖）

skills 从多个目录加载并合并，优先级明确：\n- extra < bundled < managed < `~/.agents/skills` < `<workspace>/.agents/skills` < workspace\n\n证据：[workspace.ts:L124-L188](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/skills/workspace.ts#L124-L188)

这相当于一个“可控的覆盖栈”：
- bundled：随 OpenClaw 发布\n- managed：由 CLI 安装/管理\n- `~/.agents/skills`：个人级共享技能（跨项目/跨 agent）\n- `<workspace>/.agents/skills`：项目级共享技能（跨 agent）\n- workspace：项目级（与机器人/业务绑定）\n- extra：外部目录（团队共享知识库等）

### 3.2 Skills 的载体：SKILL.md + frontmatter metadata

skill 的核心资产不是代码，而是：\n- 一份可被模型读取的能力说明（prompt片段）\n- 配套 metadata（依赖、平台限制、安装脚本、是否允许模型调用等）\n\n技能条目会读 `SKILL.md` 并解析 frontmatter，构建 `SkillEntry{skill,frontmatter,metadata,invocation}`。证据：[workspace.ts:L173-L187](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/skills/workspace.ts#L173-L187)

### 3.3 Eligibility：不是“发现就启用”，而是“可用才注入”

构建 prompt 的时候会先过滤出 eligible skills，再格式化注入：\n- `filterSkillEntries(...)` 决定最终可用集合\n- `invocation.disableModelInvocation` 为 true 的技能不会注入 prompt（但仍可用于 UI/诊断）\n\n证据：[workspace.ts:L204-L214](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/skills/workspace.ts#L204-L214)

### 3.4 Plugin skills：插件携带 skills 的桥接（系统扩展 ↔ 能力说明）

插件可以携带 skills 目录，并在插件启用/slots 判断通过后把 skills 目录并入 skills 搜索路径（避免“插件装了但技能不可见”的割裂）。证据：[workspace.ts:L130-L135](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/myopenclaw/src/agents/skills/workspace.ts#L130-L135)

## 4) 亮点总结（适用于 myr2d2 的可复用点）

- **Schema-first 插件加载**：把不确定性前移到启动期，减少运行期事故。\n- **Slots（memory 等）**：关键系统能力用“插槽”抽象，允许替换实现但保证对外工具接口稳定。\n- **Skills 覆盖栈**：bundled/managed/workspace/extra 的优先级设计，天然支持“平台默认 + 项目定制 + 临时覆盖”。\n- **技能可用性筛选**：把“缺依赖/不支持 OS/不允许模型调用”等问题在注入前解决，降低 agent 幻觉与失败率。\n- **插件携带技能桥接**：让系统扩展与认知扩展保持一致交付（装了插件就带上使用说明与策略）。
