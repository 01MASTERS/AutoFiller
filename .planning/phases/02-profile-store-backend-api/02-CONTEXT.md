# Phase 2: Profile Store & Backend API - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the local backend profile store (`profile.json` schema and sample data) and REST API endpoints (`GET /health`, `GET /profile`, `POST /autofill` stub) with CORS support, input validation, and Vitest suite in `@autofiller/backend` and `@autofiller/shared`.

</domain>

<decisions>
## Implementation Decisions

### /autofill Payload Schema Contract
- **D-01:** Define structured types in `@autofiller/shared`:
  - `FieldMetadata`: `{ id: string; label: string; placeholder?: string; ariaLabel?: string; type?: string; required?: boolean }`
  - `AutofillRequest`: `{ fields: FieldMetadata[]; provider?: 'ollama' | 'gemini'; model?: string }`
  - `AutofillResponse`: `{ status: 'success' | 'error'; mappings: Record<string, string>; error?: string }`
  — **Reversibility:** reversible — schema changes only affect shared type definitions and contract handlers.

### Agent's Discretion
- **D-02:** Profile JSON location & loading — `profile.json` stored in `backend/profile.json`, configurable via `PROFILE_PATH` env var. Backend serves profile via `GET /profile` with Zod validation. If missing, automatically generates a comprehensive sample `profile.json`.
- **D-03:** CORS Security — Configure Express `cors()` middleware to allow `chrome-extension://*` origins and `http://localhost:*` for development & testing.
- **D-04:** Input Validation — Use Zod in backend for runtime validation of `AutofillRequest` payloads and `profile.json` structure, returning clear 400 Bad Request error responses on invalid data.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements & Architecture
- `.planning/PROJECT.md` — Section on Backend Server, Profile Store (ADR-001)
- `.planning/REQUIREMENTS.md` — Requirements FR-4.1 to FR-4.5, NFR-2 (CORS)
- `.planning/ROADMAP.md` — Phase 2 deliverables and UAT criteria

### Existing Code & Patterns
- `shared/src/index.ts` — Shared type exports
- `backend/src/index.ts` — Express app setup and `/health` route

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/src/index.ts`: `HealthResponse` interface — expand with `UserProfile`, `FieldMetadata`, `AutofillRequest`, `AutofillResponse`.
- `backend/src/index.ts`: Express `app` instance — add routes for `/profile` and `/autofill`.
- `backend/vitest.config.ts` & `health.test.ts`: Established Vitest + Supertest testing structure for adding endpoint tests.

### Established Patterns
- Express 5 app with ES Modules (`type: "module"` in package.json).
- `vitest` + `supertest` for endpoint unit/integration testing.

### Integration Points
- `GET /profile` -> reads `profile.json` from disk.
- `POST /autofill` -> receives `AutofillRequest`, returns `AutofillResponse` stub (`mappings: {}`).

</code_context>

<specifics>
## Specific Ideas

Follow standard Zod schema validation and clean Express route handler separation (`routes/`, `controllers/`, `services/`).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Profile Store & Backend API*
*Context gathered: 2026-08-13*
