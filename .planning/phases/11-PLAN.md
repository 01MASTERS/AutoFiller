# Phase 11 Implementation Plan: Systematic Event & Error Logging System (Debug Log Viewer)

## Phase Objective
Build a central event and error logging system across extension (popup, background worker, content script) and backend server. Track success, info, warning, and error events with clear timestamps and process tags, auto-update on every runtime process and phase event, and provide a standalone web-based Debug Log Viewer dashboard served at `http://localhost:3456/logs-ui` with level filtering and 1-click copy to clipboard.

## Proposed Tasks

### Task 1: Shared Log Schemas & Backend Logger Service
**Files to Modify/Create**:
- [MODIFY] [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts)
- [NEW] [`backend/src/services/loggerService.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/loggerService.ts)
- [MODIFY] [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts)
- [NEW] [`backend/src/__tests__/logger.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/__tests__/logger.test.ts)

**Details**:
1. Add `LogEntry`, `LogLevel`, `LogSource`, and `LogsResponse` in `@autofiller/shared`.
2. Implement `LoggerService` in backend with 500-entry ring buffer and log filtering capabilities.
3. Add REST routes in `api.ts`:
   - `GET /logs` (returns filtered log array).
   - `POST /logs` (appends new log entry).
   - `DELETE /logs` (clears log buffer).
   - `GET /logs-ui` (serves standalone HTML/JS Debug Log Viewer with dark mode UI, filter buttons, search input, clear button, and 1-click Copy to Clipboard button).
4. Write Vitest unit tests in `logger.test.ts` testing log creation, ring buffer trimming, API endpoints, and filtering.

---

### Task 2: Extension Logger Utility & System Event Instrumentation
**Files to Modify/Create**:
- [NEW] [`extension/src/utils/logger.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/utils/logger.ts)
- [MODIFY] [`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts)
- [MODIFY] [`extension/src/popup/popup.html`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.html)
- [MODIFY] [`extension/src/popup/popup.css`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.css)
- [MODIFY] [`extension/src/background/background.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/background/background.ts)
- [MODIFY] [`extension/src/content/contentScript.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/contentScript.ts)
- [NEW] [`extension/src/__tests__/extensionLogger.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/extensionLogger.test.ts)

**Details**:
1. Build `ExtensionLogger` helper class saving to `chrome.storage.local` ring buffer (max 500 items) and asynchronously pushing logs to `POST /logs` backend endpoint.
2. Instrument key events:
   - `popup.ts`: Log settings loaded, provider changed, model fetched, autofill button clicked.
   - `background.ts`: Log `TRIGGER_AUTOFILL` started, tab queried, `SCAN_FIELDS` response, backend POST payload, `FILL_FIELDS` outcome, and caught errors.
   - `contentScript.ts`: Log DOM fields extracted count and DOM fill result details.
3. Update `popup.html` & `popup.css`: Add a prominent "Logs UI" button/icon in the extension header that opens `http://localhost:3456/logs-ui` in a new tab.
4. Write Vitest unit tests in `extensionLogger.test.ts` testing storage logging, ring buffer auto-pruning, and backend sync.

---

### Task 3: Verification & Integration Suite
- Run `npm test` across `extension` and `backend`.
- Run `npm run build` to verify Chrome extension and backend production builds.

## Verification Criteria
- [ ] `GET /logs-ui` renders the standalone Debug Log Viewer UI dashboard in browser
- [ ] Extension events (popup load, model discovery, scanning, autofill, errors) auto-log to storage and backend
- [ ] Clicking "Logs UI" button in popup header opens `http://localhost:3456/logs-ui`
- [ ] Log Viewer supports filtering by log level (`ALL`, `SUCCESS`, `ERROR`, `INFO`), keyword searching, and clearing logs
- [ ] 1-Click "Copy to Clipboard" copies formatted debug log entries
- [ ] Ring buffer limits log history to 500 entries automatically
- [ ] All unit and integration tests pass
