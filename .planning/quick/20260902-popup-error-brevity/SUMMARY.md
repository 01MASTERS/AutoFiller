---
task: popup-error-brevity
created: 2026-09-02
status: complete
description: Concise human-readable error summaries in popup UI and verbose traces in logs page only
---

# Quick Task Summary: Concise Popup UI Errors with Logs-Only Verbosity

## Problem
When an API error occurred (such as a Gemini 429 quota exhaustion), the raw verbose multi-paragraph GoogleGenerativeAI error response—including URLs, RPC JSON violations, and stack traces—was rendered verbatim into the Chrome extension popup's status banner. This caused a massive wall of red text that overflowed across the extension popup.

## Solution
1. **Gemini Provider ([`backend/src/services/llm/geminiProvider.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/geminiProvider.ts))**:
   - `LLMProviderError` now uses the concise classification summary as `message` and passes the verbose raw error as `cause`.
   - The full raw error payload, URL list, and RPC violation JSON are stored in `LoggerService` details, visible in the Debug Log Dashboard (`/logs-ui`).
2. **Popup Error Formatter ([`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts))**:
   - Implemented `formatPopupErrorMessage`:
     - Quota Exceeded (429) -> `"Gemini API quota exceeded (429). See Debug Logs for details."`
     - Auth / Key error -> `"Gemini API key invalid or unauthorized. Check settings."`
     - Model not found -> `"Selected AI model not found. Check settings or Debug Logs."`
     - Ollama offline -> `"Ollama offline. Run \"ollama serve\" or check OLLAMA_HOST."`
     - Backend unreachable -> `"Backend server offline (port 3456). Start with start.bat."`
     - Fallback: Strips URLs, stack traces, and brackets, truncating to max 70 chars + `"(See Debug Logs)"`.
3. **Popup Interactive Link & CSS ([`extension/src/popup/popup.css`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.css), [`popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts))**:
   - Added tooltip and click listener to `#status-banner`: clicking the red error banner immediately opens `http://localhost:3456/logs-ui` in a new tab.
   - Added `word-break: break-word; line-height: 1.4;` and pointer cursor on error hover.
4. **Rebuilt Extension**:
   - Rebuilt `extension/dist` bundle with updated CSS, popup scripts, and manifest.

## Verification
- Added 2 unit tests in `extension/src/__tests__/popup.test.ts` testing `formatPopupErrorMessage` and `updateStatusBannerUI` with a full GoogleGenerativeAI 429 payload.
- Full workspace test suite passing (71/71 tests: 28 extension + 43 backend).
