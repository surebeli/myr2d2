# Thirdparty Architecture Baseline: thirdparty/myopenclaw

- Generated at: 2026-02-20 18:32:42 UTC
- Repo path: `thirdparty/myopenclaw`
- Commit ID: `5dd304d1c65952646b2544132bb9948e5adc57c5`
- Commit short: `5dd304d1c`
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

## 4. Runtime and Dependency Flow (manual fill required)

- [ ] Identify startup path from entrypoint to main service loop
- [ ] Mark boundaries: transport, storage, model/runtime, plugin/extension
- [ ] Draw dependency direction (which module can depend on which)

## 5. Customization Hotspots (manual fill required)

- [ ] List files/functions where local custom requirements currently hook in
- [ ] List safer extension points that avoid patching third-party core
- [ ] List high-risk zones that should avoid direct modifications

## 6. Upgrade Risk Matrix (manual fill required)

| Risk Area | Why it may break local customization | Detection signal | Mitigation |
|---|---|---|---|
| API surface | TODO | TODO | TODO |
| Behavior contract | TODO | TODO | TODO |
| Build/deps | TODO | TODO | TODO |

## 7. Feature Focus (manual fill required)

### Context Management (`context-management`)
- [ ] List sources of runtime context (session history, memory, config, inbound payload).
- [ ] Describe pruning/compaction strategy and trigger conditions.
- [ ] Document token/cost guardrails and fallback behavior when limits are hit.

### State Machine (`state-machine`)
- [ ] Identify core states in request lifecycle and service lifecycle.
- [ ] Document state transitions, triggers, and timeout/error transitions.
- [ ] Mark persisted state vs in-memory state.

### Tool Strategy (`tool-strategy`)
- [ ] Document tool registration/discovery path.
- [ ] Describe tool selection policy and safety/approval gates.
- [ ] List failure modes and escalation path for tool execution.

### Fallback and Retry (`fallback-retry`)
- [ ] Document retry policy (max attempts, backoff, idempotency).
- [ ] List fallback chain across providers/channels/components.
- [ ] Specify circuit-breaker or safe-degrade behavior.

### Memory System (`memory-system`)
- [ ] Document memory storage surfaces and retention policy.
- [ ] Describe memory write/read paths and query strategy.
- [ ] List consistency and privacy constraints.

### Hooks and Plugin Framework (`hooks-plugins`)
- [ ] Document plugin discovery/loading order and enablement gates.
- [ ] List extension points and compatibility constraints.
- [ ] Describe rollback strategy for faulty plugins/hooks.

## 8. Companion Docs

- Dataflow: `DATAFLOW-5dd304d1c.md`
- State machine: `STATE-MACHINE-5dd304d1c.md`
- Extensibility: `EXTENSIBILITY-5dd304d1c.md`

## 9. Quick Reference for Future Tasks

- [ ] Add links to critical source files
- [ ] Add links to related upgrade review docs
- [ ] Add commit-tagged notes for known pitfalls
