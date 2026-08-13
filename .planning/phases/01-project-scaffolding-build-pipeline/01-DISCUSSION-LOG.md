# Phase 1: Project Scaffolding & Build Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 1-Project Scaffolding & Build Pipeline
**Areas discussed:** Dev Workflow Orchestration

---

## Gray Area Selection

**Presented 4 areas:**
1. 🏗️ Monorepo package manager strategy
2. 🔧 Vite Chrome Extension plugin
3. 📦 Shared types strategy
4. ⚡ Dev workflow orchestration

**User selected:** ⚡ Dev workflow orchestration (1 of 4)

---

## Dev Workflow Orchestration — Tool Selection

| Option | Description | Selected |
|--------|-------------|----------|
| concurrently | Lightweight, color-coded output per process, simple config. Just runs backend + vite watch side-by-side. Most popular for dual-process setups. | ✓ |
| npm-run-all (run-p) | Similar to concurrently but npm-native feel. Slightly less flexible output formatting. | |
| turbo (Turborepo) | Full monorepo build orchestrator with caching, dependency graph. Overkill for 2 processes. | |
| Two terminal tabs | No orchestration tool. Users run commands separately. Simplest but manual. | |

**User's choice:** concurrently
**Notes:** User preferred the lightweight, focused approach over heavier orchestration tools.

---

## Dev Workflow Orchestration — Backend Hot Reload

| Option | Description | Selected |
|--------|-------------|----------|
| tsx (watch mode) | Fast, zero-config, uses esbuild under the hood. Runs TypeScript directly. Command: `tsx watch src/index.ts` | ✓ |
| nodemon + ts-node | Classic combo. Nodemon watches files, ts-node compiles. Slightly slower restarts. | |
| nodemon + tsx | Use nodemon for file-watching flexibility but tsx for fast TS execution. | |

**User's choice:** tsx (watch mode)
**Notes:** User chose speed and simplicity — zero-config TypeScript execution without precompilation.

---

## Agent's Discretion

The following areas were not selected for discussion. Agent used sensible defaults based on project context:

| Area | Decision | Rationale |
|------|----------|-----------|
| Monorepo strategy | npm workspaces | Simplest, native npm support, no extra dependency |
| Vite Chrome Extension plugin | CRXJS (@crxjs/vite-plugin) | Best MV3 support, HMR, listed in PROJECT.md |
| Shared types | `shared/` workspace package | Clean separation, TypeScript project references |

## Deferred Ideas

None — discussion stayed within phase scope.
