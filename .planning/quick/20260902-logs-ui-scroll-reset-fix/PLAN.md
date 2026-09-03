---
task: logs-ui-scroll-reset-fix
created: 2026-09-02
status: in-progress
description: Fix automatic scroll reset in expanded log details caused by 3s polling re-renders
---

# Quick Task: Fix Logs UI Internal Scrollbar Auto-Scroll Reset

## Problem
In the Debug Log Dashboard (`/logs-ui`), `setInterval(fetchLogs, 3000)` polls for new logs every 3 seconds and blindly calls `renderLogs()`, which replaces `container.innerHTML = ...`. This completely destroys the expanded `<div class="details">` elements and re-creates them with `scrollTop = 0`, causing the internal scrollbar to jump to the top automatically while the user is reading or scrolling through expanded log JSON.

Additionally, `expandedIndices` tracked numeric array indices instead of log IDs, which causes index shifts whenever new logs are prepended.

## Solution
1. Modify `/logs-ui` script in `backend/src/routes/api.ts`:
   - Add `areLogsEqual(prev, next)` check in `fetchLogs()`: skip DOM re-renders entirely if logs haven't changed.
   - Save and restore `scrollTop` of all `.details` elements across re-renders.
   - Switch from index-based `expandedIndices` to ID-based `expandedIds` using `l.id`.
2. Verify with test suite.
3. Update `STATE.md` and generate `SUMMARY.md`.
