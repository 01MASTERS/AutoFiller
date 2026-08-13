# Phase 3: LLM Gateway (Ollama + Gemini) - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the unified LLM Gateway in `@autofiller/backend` with `LLMGateway` interface, `OllamaProvider` (HTTP to `http://localhost:11434`), `GeminiProvider` (`@google/generative-ai` SDK), prompt engineering, JSON response parsing & validation, 30s timeout, 2 retries, and comprehensive Vitest unit tests with mocked LLM responses.

</domain>

<decisions>
## Implementation Decisions

### Provider Error & Fallback Behavior
- **D-01:** Fail fast with explicit provider-specific error message when selected provider is unavailable. If Ollama is selected and not running at `localhost:11434`, return clear actionable error ("Ollama not reachable at http://localhost:11434. Ensure Ollama is running"). Do not perform silent auto-fallback unless explicitly configured. — **Reversibility:** reversible — changing fallback behavior only affects error handling in gateway dispatch.

### Agent's Discretion
- **D-02:** Prompt Engineering & Parsing — System prompt instructs LLM to return ONLY a flat JSON object `{ "fieldId": "matchingProfileValue" }`. Use native JSON mode (Ollama `format: "json"`, Gemini `responseMimeType: "application/json"`). Clean markdown fences (` ```json `) automatically if returned.
- **D-03:** Retry & Timeout Logic — Implement 30s timeout per call using `AbortController`. If LLM returns malformed JSON, retry up to 2 times with a prompt reminder before throwing `LLMResponseParseError`.
- **D-04:** Gemini Configuration — Pass API key via `x-gemini-api-key` header or `GEMINI_API_KEY` env var. Default model: `gemini-1.5-flash`.
- **D-05:** Ollama Configuration — Endpoint `http://localhost:11434` (configurable via `OLLAMA_HOST` env var). Default model: `llama3.2` or request body `model` parameter.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & ADRs
- `.planning/PROJECT.md` — LLM Gateway, ADR-002 (Dual LLM Ollama + Gemini)
- `.planning/REQUIREMENTS.md` — FR-5.1 through FR-5.7 (LLM Gateway functional requirements), NFR-3 (Reliability)
- `.planning/ROADMAP.md` — Phase 3 deliverables and UAT criteria

### Existing Types & Context
- `shared/src/index.ts` — `FieldMetadata`, `AutofillRequest`, `UserProfile`
- `backend/src/types/profile.ts` — Zod schemas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/src/index.ts`: `FieldMetadata`, `UserProfile`, `AutofillResponse`.
- `backend/src/services/profileStore.ts`: Loads `UserProfile` object.

### Established Patterns
- Express 5 + TypeScript strict mode in `@autofiller/backend`.
- Vitest unit tests with mocked network calls.

### Integration Points
- Phase 3 produces `LLMGateway` which Phase 4 will mount onto `POST /autofill`.

</code_context>

<specifics>
## Specific Ideas

Follow Provider Pattern:
```ts
export interface LLMProvider {
  mapFields(fields: FieldMetadata[], profile: UserProfile): Promise<Record<string, string>>;
}
```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-LLM Gateway (Ollama + Gemini)*
*Context gathered: 2026-08-13*
