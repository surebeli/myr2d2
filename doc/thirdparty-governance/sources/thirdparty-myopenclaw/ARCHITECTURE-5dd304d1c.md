# Thirdparty Architecture Baseline: thirdparty/myopenclaw

- Generated at: 2026-02-20 19:00:37 UTC
- Repo path: `thirdparty/myopenclaw`
- Commit ID: `5dd304d1c65952646b2544132bb9948e5adc57c5`
- Commit short: `5dd304d1c`
- Analysis depth: `deep`
- Origin: `https://github.com/surebeli/myopenclaw`
- Upstream: `https://github.com/openclaw/openclaw`
- Feature profile:
- `context-management`
- `state-machine`
- `tool-strategy`
- `fallback-retry`
- `memory-system`
- `hooks-plugins`

## 1. Framework/Stack Snapshot

- Node.js/npm
- Node.js/pnpm

## 2. Build and Run Surface

Suggested commands:

- `npm test`
- `npm run build`

Entrypoint candidates:

- `src/index.ts`
- `openclaw.mjs`

## 3. Top-Level Module Map

Directories:

- `.agent`
- `.agents`
- `.pi`
- `apps`
- `assets`
- `docs`
- `extensions`
- `git-hooks`
- `packages`
- `patches`
- `scripts`
- `skills`
- `src`
- `Swabble`
- `test`
- `ui`

Key files:

- `LICENSE`
- `package.json`
- `README.md`

## 4. Runtime and Dependency Flow (deep auto-fill; verify manually)

1. Startup path candidates:
   - `src/index.ts`
   - `openclaw.mjs`

2. Boundary map:
- Transport boundary: `src/gateway/server-runtime-state.ts`, `src/gateway/server-ws-runtime.ts`, `src/gateway/server/ws-connection.ts`
- Config/storage boundary: `src/config/io.ts`, `src/config/zod-schema.ts`, `src/sessions`, `src/memory`
- Agent/runtime boundary: `src/agents`, `src/providers`, `src/routing`, `src/channels`
- Plugin/extension boundary: `src/plugins/loader.ts`, `src/plugins/discovery.ts`, `src/plugins/registry.ts`, `extensions`

3. Practical dependency layering:
1. CLI layer: `src/index.ts`, `src/cli`
2. Gateway orchestration layer: `src/gateway`
3. Domain services layer: `src/channels`, `src/agents`, `src/providers`, `src/routing`
4. Extension layer: `src/plugins`, `extensions`
5. Consumer/UI layer: `ui`, `apps`


## 5. Customization Hotspots (deep auto-fill; verify manually)

| Area | Primary files | Why this is a hotspot | Preferred customization path |
|---|---|---|---|
| Gateway RPC capability | `src/gateway/server-methods-list.ts`, `src/gateway/server-methods.ts` | Methods/events and scope checks are upgrade-sensitive. | Prefer plugin gateway handlers and config gates before core dispatcher edits. |
| Channel integrations | `src/channels/plugins`, `src/gateway/server-channels.ts`, `extensions` | Channel lifecycle failures can break runtime startup and message delivery. | Prefer channel plugin packages and per-channel config toggles. |
| Plugin loading/activation | `src/plugins/loader.ts`, `src/plugins/discovery.ts`, `src/plugins/registry.ts` | Loader order/enablement changes can disable custom behavior. | Prefer manifest/config control; avoid patching loader internals. |
| Routing/session semantics | `src/routing/resolve-route.ts`, `src/routing/session-key.ts` | Session-key changes may split or merge conversation state incorrectly. | Treat session key shape as compatibility contract and test before upgrades. |
| Config contract | `src/config/zod-schema.ts`, `src/config/io.ts` | Schema/default changes can fail startup or silently shift behavior. | Use additive keys and keep backward-compatibility checks in CI. |

High-risk zones (avoid patching unless necessary):
- `src/gateway/server.impl.ts`
- `src/routing/session-key.ts`
- `src/config/zod-schema.ts`
- `src/plugins/loader.ts`


## 6. Upgrade Risk Matrix (deep auto-fill; verify manually)

| Risk Area | Why it may break local customization | Detection signal | Mitigation |
|---|---|---|---|
| API surface | New/removed methods or auth rules may break custom clients and automations. | Diff in gateway/server method registry and runtime RPC failures. | Keep compatibility checks and smoke tests for critical RPC methods. |
| Behavior contract | Session/routing/plugin-lifecycle changes may alter expected runtime behavior. | Diff in routing/session/plugin loader files and unexpected runtime logs. | Add regression tests around session key, routing policy, and plugin enablement. |
| Build/deps | Toolchain and dependency updates can break build/test pipelines. | `package.json`/`Cargo.toml`/lockfile diffs and failing CI jobs. | Pin runtime toolchain and upgrade dependencies in controlled steps. |


## 7. Feature Focus (deep auto-fill; verify manually)

### Context Management (`context-management`)
- Observed candidate files: `src/routing/session-key.ts`, `src/routing/resolve-route.ts`, `src/sessions`, `src/gateway/server-runtime-state.ts`
- [ ] List sources of runtime context (session history, memory, config, inbound payload).
- [ ] Describe pruning/compaction strategy and trigger conditions.
- [ ] Document token/cost guardrails and fallback behavior when limits are hit.

### State Machine (`state-machine`)
- Observed candidate files: `src/gateway/server.impl.ts`, `src/gateway/server-channels.ts`, `src/gateway/config-reload.ts`, `src/cli/gateway-cli/run.ts`
- [ ] Identify core states in request lifecycle and service lifecycle.
- [ ] Document state transitions, triggers, and timeout/error transitions.
- [ ] Mark persisted state vs in-memory state.

### Tool Strategy (`tool-strategy`)
- Observed candidate files: `src/plugins`, `src/agents`, `extensions`
- [ ] Document tool registration/discovery path.
- [ ] Describe tool selection policy and safety/approval gates.
- [ ] List failure modes and escalation path for tool execution.

### Fallback and Retry (`fallback-retry`)
- Observed candidate files: `src/providers`, `src/channels`, `src/gateway/server.impl.ts`, `src/config`
- [ ] Document retry policy (max attempts, backoff, idempotency).
- [ ] List fallback chain across providers/channels/components.
- [ ] Specify circuit-breaker or safe-degrade behavior.

### Memory System (`memory-system`)
- Observed candidate files: `src/memory`, `src/sessions`, `src/config`, `src/agents`
- [ ] Document memory storage surfaces and retention policy.
- [ ] Describe memory write/read paths and query strategy.
- [ ] List consistency and privacy constraints.

### Hooks and Plugin Framework (`hooks-plugins`)
- Observed candidate files: `src/plugins/loader.ts`, `src/plugins/discovery.ts`, `src/plugins/registry.ts`, `extensions`
- [ ] Document plugin discovery/loading order and enablement gates.
- [ ] List extension points and compatibility constraints.
- [ ] Describe rollback strategy for faulty plugins/hooks.

## 8. Companion Docs

- Dataflow: `DATAFLOW-5dd304d1c.md`
- State machine: `STATE-MACHINE-5dd304d1c.md`
- Extensibility: `EXTENSIBILITY-5dd304d1c.md`

## 9. Quick Reference for Future Tasks

Critical file index:
- Boot/CLI: `openclaw.mjs`, `src/index.ts`, `src/cli`
- Gateway core: `src/cli/gateway-cli/run.ts`, `src/gateway/server.impl.ts`, `src/gateway`
- Protocol surface: `src/gateway/server-methods-list.ts`, `src/gateway/server-methods.ts`, `docs`
- Config/runtime contract: `src/config/io.ts`, `src/config/zod-schema.ts`
- Routing/session: `src/routing/resolve-route.ts`, `src/routing/session-key.ts`
- Extension/plugin: `src/plugins/loader.ts`, `src/plugins/discovery.ts`, `src/plugins/registry.ts`, `extensions`

Related upgrade review docs:
- `UPGRADE-4c86010b0-to-5dd304d1c.md`

Commit-tagged notes:
- Add commit-tagged pitfalls and local customization assumptions after each sync-review.

