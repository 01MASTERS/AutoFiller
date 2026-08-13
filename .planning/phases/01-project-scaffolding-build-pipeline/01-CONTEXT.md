# Phase 1: Project Scaffolding & Build Pipeline - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the complete development infrastructure for the AutoFiller Chrome extension — monorepo structure with npm workspaces, TypeScript strict configurations, Vite extension build with CRXJS for Manifest V3, Node.js/Express backend scaffold, ESLint + Prettier, and dev/build/test/lint scripts. All subsequent phases build on this foundation.

</domain>

<decisions>
## Implementation Decisions

### Dev Workflow Orchestration
- **D-01:** Use `concurrently` to run backend server + Vite extension watch side-by-side in a single `npm run dev` command. Color-coded output per process for easy identification. — **Reversibility:** reversible — swapping orchestration tools only changes one script in root `package.json`.
- **D-02:** Use `tsx` (watch mode) for backend hot reload. Command: `tsx watch src/index.ts`. Fast, zero-config, uses esbuild under the hood. Runs TypeScript directly without precompilation step. — **Reversibility:** reversible — swapping to nodemon only changes the backend dev script.

### Agent's Discretion
- **D-03:** Monorepo package manager — npm workspaces with `workspaces: ["extension", "backend", "shared"]` in root `package.json`. Simplest option, no extra dependency, native npm support.
- **D-04:** Vite Chrome Extension plugin — CRXJS (`@crxjs/vite-plugin`). Best MV3 support, HMR for popup/content scripts, actively maintained. PROJECT.md listed it as a primary option.
- **D-05:** Shared types — `shared/` as a workspace package with its own `tsconfig.json`. Both `extension` and `backend` import via workspace protocol. Clean separation with TypeScript project references. Types include field metadata, LLM response shapes, and API contracts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture & Decisions
- `.planning/PROJECT.md` — Architecture diagram, component breakdown, all ADRs (001–008), tech stack versions, scope boundaries
- `.planning/REQUIREMENTS.md` — Functional requirements FR-1 through FR-6, non-functional requirements NFR-1 through NFR-5, user stories, verification criteria
- `.planning/ROADMAP.md` — Phase 1 deliverables and UAT criteria (lines 11–31)

### Key ADRs (in PROJECT.md)
- `ADR-004: Manifest V3` — Extension must use MV3 with service workers
- `ADR-005: TypeScript strict mode` — `strict: true` in all tsconfigs
- `ADR-006: Vite bundler` — Vite for extension build pipeline
- `ADR-007: Vitest for testing` — Vitest as test runner

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. Repository contains only `.git/` and `.planning/` directory.

### Established Patterns
- None yet — this phase establishes the foundational patterns for all subsequent phases.

### Integration Points
- This phase creates the scaffolding that Phase 2 (Profile Store & Backend API) and Phase 3 (LLM Gateway) will build upon.
- The `shared/` package will be consumed by both extension and backend from Phase 2 onward.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow the tech stack and versions defined in PROJECT.md.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Project Scaffolding & Build Pipeline*
*Context gathered: 2026-08-13*
