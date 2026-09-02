---
task: rich-debug-logging
created: 2026-09-02
status: complete
description: Enhance end-to-end debugging and error logging for API quota, auth, unmapped fields, and DOM fill failures
---

# Quick Task Summary: Comprehensive Debug Logging & Error Diagnostics

## Problem
Previously, when autofill failed or some fields were not filled, the Debug Log Dashboard lacked critical diagnostic information:
1. Backend errors in `/autofill` and `/models` were not being sent to `LoggerService` at all (they were only caught to respond with 502/500).
2. API quota exhaustion (`429 Rate Limit`), auth issues (`401/403`), and Ollama model errors were generic without actionable guidance.
3. If an LLM matched 0 fields or only some fields, there was no visibility into which fields were left unmapped or why.
4. When a DOM fill failed, the specific failure reason per field (missing selector, empty mapping, setter error) was lost.

## Changes Made
1. **Shared Types ([`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts))**:
   - Added `failureReasons?: Record<string, string>` to `FillResult` to track per-field failure details.
2. **Gemini Error Classification ([`backend/src/services/llm/geminiProvider.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/geminiProvider.ts))**:
   - Classified Quota Exceeded (`429 Rate Limit`), Invalid API Key (`401/403`), and Model Not Found (`404`) with troubleshooting hints.
   - Checked `promptFeedback.blockReason` for safety blocks.
3. **Ollama Diagnostics ([`backend/src/services/llm/ollamaProvider.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/ollamaProvider.ts))**:
   - Extracted JSON error messages from Ollama HTTP response bodies, providing hints when a model needs to be pulled (`ollama pull <model>`).
4. **Backend Routes Diagnostics ([`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts))**:
   - Added categorized logging on errors: `LLM_QUOTA_EXCEEDED`, `LLM_AUTH_ERROR`, `LLM_TIMEOUT`, `LLM_PARSE_ERROR`, `LLM_CONNECTION_FAILED`, `MODELS_FETCH_ERROR`.
   - Included `unmappedFields` breakdown on every response.
   - Added `LLM_ZERO_MAPPINGS` warning when profile has no matching values for scanned fields.
   - Color-coded tags in `/logs-ui` for quick visual diagnosis.
5. **Content Script & Form Filler ([`extension/src/content/formFiller.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/formFiller.ts), [`contentScript.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/contentScript.ts))**:
   - Recorded `failureReasons` for missing elements or assignment failures.
   - Logged `DOM_SCAN_EMPTY`, `DOM_SCAN_SUCCESS`, and `DOM_FILL_PARTIAL` with field lists.
6. **Background Worker ([`extension/src/background/background.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/background/background.ts))**:
   - Logged URL and hints when content script is not loaded or when 0 fields are found.
   - Logged detailed network errors when backend server is unreachable.
   - Logged `failureReasons` on `AUTOFILL_PARTIAL`.

## Verification
- Added test cases in `backend/src/__tests__/autofill.test.ts` for `LLM_QUOTA_EXCEEDED` and `LLM_ZERO_MAPPINGS`.
- Updated test in `extension/src/__tests__/formFiller.test.ts` to assert `failureReasons`.
- Full test suite passing (69/69 tests: 26 extension + 43 backend).
