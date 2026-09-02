---
task: rich-debug-logging
created: 2026-09-02
status: in-progress
description: Enhance end-to-end debugging and error logging for API quota, auth, unmapped fields, and DOM fill failures
---

# Quick Task: Comprehensive Debug Logging & Error Classification

## Objective
Provide detailed, actionable logging for all failure modes and debugging points during autofill operations, including:
1. **API Error Classification**: Specifically classify and log Google Gemini Quota Exceeded (429 Rate Limit), Invalid API Key (401/403), Model Not Found (404), and Timeout errors with troubleshooting hints.
2. **Ollama Error Details**: Log exact HTTP status and server error payloads (e.g. model not installed 404, daemon unreachable).
3. **Backend Error Logging in `/autofill` and `/models`**: Ensure errors thrown during autofill or model fetching are recorded to `LoggerService` with full diagnostics (currently errors were only logged on success).
4. **Field Mapping Diagnostics**:
   - Explicitly log unmapped fields (fields found on the page that the LLM could not match to profile data).
   - Log `LLM_ZERO_MAPPINGS` warning when 0 fields matched the user profile.
5. **DOM Fill Failure Reasons**: Capture `failureReasons` per field in `formFiller.ts` (element missing from DOM, empty mapping, event dispatch failure) and log them to `ExtensionLogger`.
6. **Dashboard UI Enhancements**: Display error details and tags prominently in `/logs-ui`.

## Implementation Plan
1. Update `shared/src/index.ts`: Add `failureReasons?: Record<string, string>` to `FillResult`.
2. Update `backend/src/services/llm/geminiProvider.ts`: Classify quota (429), auth (401/403), not-found (404) errors with human-friendly descriptions.
3. Update `backend/src/services/llm/ollamaProvider.ts`: Extract detailed error responses from Ollama API when non-200.
4. Update `backend/src/routes/api.ts`:
   - Add comprehensive `LoggerService` error logging inside `/autofill` and `/models` catch blocks with categorized tags (`LLM_QUOTA_EXCEEDED`, `LLM_AUTH_ERROR`, `LLM_TIMEOUT`, `LLM_PARSE_ERROR`, etc.).
   - Log `unmappedFields` list alongside `mappings` in `LLM_RESPONSE` and log `LLM_ZERO_MAPPINGS` when empty.
5. Update `extension/src/content/formFiller.ts`: Track specific failure reason per failed field in `failureReasons`.
6. Update `extension/src/content/contentScript.ts`: Pass `failureReasons` to `ExtensionLogger.log`.
7. Update `extension/src/background/background.ts`: Enhance logging for empty mappings, scan failures, and backend HTTP errors.
8. Run full test suite to verify no regressions.
9. Commit atomically and update GSD state.
