---
task: popup-log-auto-dismiss
created: 2026-10-07
status: in-progress
description: Auto-dismiss status banner and helper log messages on extension popup after a short duration instead of remaining indefinitely
---

# Quick Task: Auto-Dismiss Popup Status and Log Messages

## Problem
Currently, after auto-filling a form or encountering an error, the status banner (`#status-banner`) on the extension popup displays the result (e.g. "Filled 4 fields in 1.2s!" or "Gemini API quota exceeded...") permanently. It never automatically reverts back to the idle state ("Ready to auto-fill form fields"). Furthermore, because `autofillStatus` is saved to `chrome.storage.local` with terminal states (`done`/`partial`/`error`), reopening the popup hours or days later continues to show the stale log/status message indefinitely. Similarly, model loading status messages remain visible indefinitely once rendered.

## Solution
1. **Popup Status Banner Auto-Reset (`extension/src/popup/popup.ts`)**:
   - In `updateStatusBannerUI`, schedule an auto-dismiss timer (default 5000ms) when entering terminal states (`done`, `partial`, `error`).
   - Automatically revert banner state to `'idle'` ("Ready to auto-fill form fields") and remove tooltip after the delay.
   - Cancel any existing timer when a new state arrives.
   - When resetting to `idle`, persist `autofillStatus: { currentState: 'idle' }` to `chrome.storage.local`.
   - On popup initialization (`DOMContentLoaded`), inspect `stored.autofillStatus.timestamp`:
     - If older than 5 seconds, ignore stale terminal state and reset to `idle`.
     - If younger than 5 seconds, display status and schedule auto-reset for the remainder of the 5s window.
2. **Model Status Message Auto-Hide (`extension/src/popup/popup.ts`)**:
   - In `fetchProviderModels`, auto-hide model helper text (`#ollama-status-msg` / `#gemini-status-msg`) after 5 seconds following successful load or error.
3. **Background Worker Cleanup (`extension/src/background/background.ts`)**:
   - In `updateStatusState`, when setting a terminal state (`done`, `partial`, `error`), schedule a 5-second background timeout to reset stored `autofillStatus` to `idle` so closed popups don't reopen to stale data.
4. **Unit Tests & Verification**:
   - Add unit tests in `extension/src/__tests__/popup.test.ts` covering auto-dismiss timing, timer cancellation, and stale timestamp expiration on load.
   - Run `npm test` across workspace.
   - Rebuild extension (`npm run build -w extension`).
