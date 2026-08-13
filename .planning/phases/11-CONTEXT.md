# Phase 11 Context: Systematic Event & Error Logging System (Debug Log Viewer)

## Phase Summary
Phase 11 builds a central systematic logging system across extension components (popup, background service worker, content script) and the backend server. It tracks success, info, warning, and error events with clear timestamps and process tags, auto-updates on every phase completion / runtime event, and provides a standalone web-based Debug Log Viewer dashboard served at `http://localhost:3456/logs-ui` with 1-click clipboard copy and level filtering.

## Agreed Architecture & Design Decisions

### 1. Centralized Logger Utility
- **Shared Event Schema**:
  ```ts
  export interface LogEntry {
    id: string;
    timestamp: string; // ISO string
    level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
    source: 'EXTENSION_POPUP' | 'BACKGROUND' | 'CONTENT_SCRIPT' | 'BACKEND_API' | 'LLM_GATEWAY';
    tag: string; // e.g., 'SCAN_FIELDS', 'LLM_FETCH', 'DOM_FILL', 'PHASE_EVENT'
    message: string;
    details?: Record<string, unknown>;
  }
  ```
- **Extension Storage**: Retains up to 500 most recent log entries in `chrome.storage.local` under `activityLogs` ring buffer (auto-prunes oldest entries).
- **Backend Logging**: In-memory ring buffer (500 logs) + automatic logging for all Express HTTP requests, LLM gateway events, profile loads, and model discovery.
- **Log Aggregation Endpoint**: `POST /logs` to push logs from extension to backend, and `GET /logs` to retrieve merged logs.

### 2. Standalone Debug Log Dashboard UI (`http://localhost:3456/logs-ui`)
- **Web UI Route**: Served at `http://localhost:3456/logs-ui`.
- **UI Design**: Modern dark-themed dashboard with real-time log polling (every 2s or on-demand refresh).
- **Filtering**: Level filter buttons (`ALL`, `SUCCESS`, `ERROR`, `INFO`, `WARN`) and search filter input box.
- **Actions**:
  - **Copy Logs to Clipboard**: 1-click button to copy current/filtered log output to clipboard for quick debugging.
  - **Clear Logs**: 1-click button to reset log buffer.
- **Popup Quick Link**: A prominent "Open Log Viewer" button in the extension popup opening `http://localhost:3456/logs-ui`.

### 3. Automatic Event & Phase Logging Triggers
- Auto-log extension events: popup load, provider switch, model discovery, `SCAN_FIELDS` dispatch, field extraction count, `/autofill` request payload, LLM response timing, `FILL_FIELDS` result, and errors with stack traces.
- Auto-log phase milestone completions to give historical audit trail.

## Downstream Guidelines for Plan & Execution
- Shared: Add `LogEntry`, `LogFilterOptions`, and `LogsResponse` in `@autofiller/shared`.
- Backend: Implement logger middleware, `/logs` REST endpoints, and `logs-ui` HTML dashboard template.
- Extension: Implement `Logger` helper in `extension/src/utils/logger.ts`, wire into background worker & content scripts, and add "View Logs" link in popup.
- Tests: Add Vitest unit tests for logger ring buffer, API `/logs` endpoints, and popup log trigger integration.
