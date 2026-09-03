---
task: logs-ui-scroll-reset-fix
created: 2026-09-02
status: complete
description: Fix automatic scroll reset in expanded log details caused by 3s polling re-renders
---

# Quick Task Summary: Fix Logs UI Internal Scrollbar Auto-Scroll Reset

## Root Cause
In `/logs-ui` (`backend/src/routes/api.ts`), a 3-second interval (`setInterval(fetchLogs, 3000)`) polled the backend for logs and called `renderLogs()`, which executed `container.innerHTML = logs.map(...).join('')`. Every 3 seconds, all DOM elements (including any open `<div class="details">` containers) were destroyed and recreated with default `scrollTop = 0`. As a result, while scrolling or reading expanded JSON in the internal scrollbar, the element would jump back to the top every 3 seconds.

Additionally, `expandedIndices` tracked numeric array indices instead of log IDs, which caused expanded states to shift whenever new logs were prepended.

## Changes Made
1. **Skipped unnecessary re-renders ([`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts))**:
   - Added `areLogsEqual(prev, next)` in `/logs-ui` script to verify if log IDs and timestamps changed. If logs have not changed, `renderLogs()` is not called.
2. **Scroll position preservation**:
   - Recorded `scrollTop` for all open `.details` elements into a map before any DOM re-rendering.
   - Restored `scrollTop` for all matching `.details` elements immediately after re-rendering.
3. **ID-based expansion tracking**:
   - Replaced index-based `expandedIndices` with `expandedIds = new Set()` keyed by `l.id`, keeping expanded states stable regardless of incoming logs.

## Verification
- Ran `npm test` across all workspaces: 67/67 tests passed (26 extension + 41 backend).
