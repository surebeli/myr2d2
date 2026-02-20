# Thirdparty Architecture Baseline: thirdparty/myopenclaw

- Generated at: 2026-02-20 17:50:31 UTC
- Repo path: `thirdparty/myopenclaw`
- Commit ID: `4c86010b0620a1a689bef2e47c7f1b2b00891aa9`
- Commit short: `4c86010b0`
- Origin: `https://github.com/surebeli/myopenclaw`
- Upstream: `n/a`

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

## 4. Runtime and Dependency Flow

### 4.1 Startup path (observed at this commit)

1. CLI bootstrap:
   `openclaw.mjs` -> `dist/entry.js|dist/entry.mjs`
2. Runtime init:
   `src/index.ts` (env normalize, dotenv load, runtime guard, CLI program build)
3. Command graph build:
   `src/cli/program/build-program.ts` -> `src/cli/program/command-registry.ts`
4. Lazy subcommand resolution:
   `src/cli/program/register.subclis.ts` (loads `gateway` subcli on demand)
5. Gateway command execution:
   `src/cli/gateway-cli/register.ts` -> `src/cli/gateway-cli/run.ts`
6. Gateway main loop:
   `src/cli/gateway-cli/run.ts` -> `startGatewayServer(...)`
7. Gateway orchestration:
   `src/gateway/server.impl.ts`
8. Runtime state assembly:
   `src/gateway/server-runtime-state.ts` (HTTP, WS, broadcast, chat run state)
9. WS wiring:
   `src/gateway/server-ws-runtime.ts` + method dispatcher in `src/gateway/server-methods.ts`
10. Channel lifecycle:
    `src/gateway/server-channels.ts` starts/stops channel accounts via channel plugins

### 4.2 Boundary map

- Transport boundary:
  `src/gateway/server-runtime-state.ts`, `src/gateway/server-ws-runtime.ts`,
  `src/gateway/server/ws-connection.ts`
- Config/storage boundary:
  `src/config/io.ts`, `src/config/zod-schema.ts`,
  `src/config/sessions/*.ts`
- Agent/model runtime boundary:
  `src/agents/*`, `src/providers/*`, `src/routing/*`
- Plugin/extension boundary:
  `src/plugins/loader.ts`, `src/plugins/discovery.ts`, `src/plugins/registry.ts`,
  `src/channels/plugins/index.ts`, `extensions/*`
- External surface (control-plane protocol):
  `src/gateway/server-methods-list.ts`, `src/gateway/server-methods.ts`,
  `docs/concepts/architecture.md`

### 4.3 Dependency direction (practical layering)

1. CLI layer:
   `src/index.ts`, `src/cli/*`
2. Gateway orchestration layer:
   `src/gateway/server.impl.ts`, `src/gateway/server-*.ts`
3. Domain services layer:
   `src/channels/*`, `src/agents/*`, `src/routing/*`, `src/sessions/*`, `src/providers/*`
4. Extension layer:
   `src/plugins/*` + `extensions/*`
5. UI/app consumers:
   `ui/*`, `apps/*` (consume gateway protocol, should not back-depend on gateway internals)

## 5. Customization Hotspots

| Area | Primary files | Why this is a hotspot | Preferred customization path |
|---|---|---|---|
| Gateway RPC capability | `src/gateway/server-methods-list.ts`, `src/gateway/server-methods.ts` | Methods/events are stability-sensitive and scope-gated | Add capabilities through plugin gateway handlers first (`src/plugins/*`), avoid direct edits to core dispatcher |
| Channel integrations | `src/channels/plugins/index.ts`, `src/gateway/server-channels.ts`, `extensions/*` | Channel account lifecycle and runtime health are centralized | Add/override via channel plugin packages in `extensions/*` and config entries |
| Plugin loading/activation | `src/plugins/loader.ts`, `src/plugins/discovery.ts`, `src/plugins/registry.ts` | Controls extension resolution, enable/disable, conflicts | Prefer manifest/config driven control (`plugins.*` in config) over patching loader internals |
| Routing/session semantics | `src/routing/resolve-route.ts`, `src/routing/session-key.ts` | Changes affect message isolation and history continuity | Prefer `bindings`, `session.dmScope`, and config policies before code patches |
| Config contract and defaults | `src/config/zod-schema.ts`, `src/config/io.ts` | Schema/default changes ripple across all commands and gateway startup | Prefer additive config keys and compatibility checks; avoid destructive schema changes |
| Skills and agent workspace behavior | `src/agents/skills/refresh.ts`, `src/agents/skills/plugin-skills.ts`, `src/agents/agent-scope.ts` | Affects both local skills and plugin-contributed skills | Prefer workspace/plugin skill dirs and config allowlists; avoid changing watcher semantics unless necessary |

High-risk zones (avoid patching unless absolutely necessary):

- `src/gateway/server.impl.ts` (startup orchestration and integration glue)
- `src/routing/session-key.ts` (session key shape compatibility)
- `src/config/zod-schema.ts` (global config validation contract)
- `src/plugins/loader.ts` (plugin loading order and enablement semantics)

## 6. Upgrade Risk Matrix

| Risk Area | Why it may break local customization | Detection signal | Mitigation |
|---|---|---|---|
| Gateway API surface | New/removed methods or scope rules can break custom clients/automation | Diff in `src/gateway/server-methods-list.ts` and `src/gateway/server-methods.ts`; failed RPC calls | Keep a compatibility shim in project-side integration layer; add smoke tests for critical methods |
| Routing/session behavior | Session-key or route matching changes can mix/fragment conversation state | Diff in `src/routing/resolve-route.ts` and `src/routing/session-key.ts`; unexpected session IDs in logs | Add regression tests for your binding/session policy; treat session-key shape as versioned contract |
| Plugin lifecycle/loading | Discovery/enablement changes can disable previously working extensions | Diff in `src/plugins/loader.ts`/`src/plugins/discovery.ts`; plugin diagnostics at startup | Keep customizations as standalone plugin packages; validate with plugin list/status checks after pull |
| Config schema/defaults | Strict schema or default changes can reject existing config or alter runtime behavior | Config validation warnings/errors from `src/config/io.ts` and schema diffs in `src/config/zod-schema.ts` | Run config validation and gateway startup checks in CI before merging upstream sync |
| Build/dependency/toolchain | Node/pnpm/tool deps changes can break local build and release automation | `package.json` `engines`/scripts/deps diff; `pnpm build` or tests fail | Pin CI/runtime Node and pnpm versions; update lockfile/toolchain in controlled step |

## 7. Quick Reference for Future Tasks

Critical file index:

- Boot/CLI:
  `openclaw.mjs`, `src/index.ts`, `src/cli/program/build-program.ts`, `src/cli/program/register.subclis.ts`
- Gateway core:
  `src/cli/gateway-cli/run.ts`, `src/gateway/server.impl.ts`, `src/gateway/server-runtime-state.ts`, `src/gateway/server-ws-runtime.ts`
- Gateway protocol:
  `src/gateway/server-methods-list.ts`, `src/gateway/server-methods.ts`, `docs/concepts/architecture.md`
- Config/runtime contract:
  `src/config/io.ts`, `src/config/zod-schema.ts`
- Routing/session:
  `src/routing/resolve-route.ts`, `src/routing/session-key.ts`
- Extension/plugin:
  `src/plugins/loader.ts`, `src/plugins/discovery.ts`, `src/plugins/registry.ts`, `extensions/*`

Related upgrade review docs:

- (not generated yet for this repo at this commit)

Commit-tagged notes:

- `[4c86010b0]` `src/cli/gateway-cli/run.ts` enforces auth for non-loopback bind modes; custom deployment scripts must account for token/password requirements.
- `[4c86010b0]` Plugin registry is runtime-global (`src/plugins/runtime.ts`); plugin reload behavior depends on cache key/config state.
- `[4c86010b0]` Config reload plan (`src/gateway/config-reload.ts`) treats `plugins.*` and `gateway.*` changes as restart-required in hybrid mode.
