---
task: popup-error-brevity
created: 2026-09-02
status: in-progress
description: Format and truncate UI popup errors into brief summaries and preserve verbose stack traces in logs page only
---

# Quick Task: Brief Popup Error Display & Logs-Only Verbosity

## Objective
Prevent massive raw API stack traces, URLs, and JSON blobs (such as Google Generative AI 429 quota exceed responses) from overflowing and breaking the Chrome extension popup UI. Keep the popup error message short, clean, and actionable (e.g. "Gemini API Quota Exceeded (429). See Debug Logs for details"), while sending the full raw diagnostics exclusively to the Debug Log Dashboard (`/logs-ui`).

## Implementation Steps
1. **Backend ([`backend/src/services/llm/geminiProvider.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/geminiProvider.ts))**:
   - Keep `error.message` concise (e.g. "Gemini Quota Exceeded (429 Rate Limit) - Google AI Studio quota exhausted").
   - Attach the verbose raw Google API error payload to `error.cause` so it gets recorded in `LoggerService` details without polluting the high-level error message.
2. **Popup UI Formatting ([`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts))**:
   - Implement `formatPopupErrorMessage(rawError)`:
     - Recognize common categories: Quota (429), Auth (401/403), Model (404), Ollama offline, Backend connection, Zero mappings, etc.
     - Return a clean 1-sentence message with "See Debug Logs for details."
     - Strip raw URLs, JSON braces, and Google error prefixes.
     - Enforce a max length constraint.
3. **Popup CSS ([`extension/src/popup/popup.css`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.css))**:
   - Add `max-height: 80px; overflow-y: auto; line-height: 1.4; word-break: break-word;` to `.status-banner` so it can never overflow the popup layout.
4. **Unit Tests & Verification**:
   - Add unit test for error formatting in `extension/src/__tests__/popup.test.ts`.
   - Run `npm test` across workspace.
   - Re-build extension bundle (`npm run build -w extension`) so `extension/dist` reflects the fix.
