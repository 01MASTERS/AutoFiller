---
task: popup-log-auto-dismiss
created: 2026-10-07
status: complete
description: Auto-dismiss status banner and helper log messages on extension popup after a short duration instead of remaining indefinitely
---

# Quick Task Summary: Auto-Dismiss Popup Status and Log Messages

## Problem
After an auto-fill operation finished (either successfully or with an error), the status banner log message (`#status-banner`) on the extension popup remained displayed permanently. It never reverted back to the idle state (`"Ready to auto-fill form fields"`). Additionally, because terminal states (`done`/`partial`/`error`) were stored in `chrome.storage.local`, opening the extension popup hours or days later would still show the old stale status log from the previous run. Model loading helper logs (`#ollama-status-msg` / `#gemini-status-msg`) also stayed visible indefinitely once shown.

## Changes Made
1. **Popup Status Banner Auto-Reset ([`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts))**:
   - Updated `updateStatusBannerUI`:
     - Clears any previous timer when new state arrives.
     - For terminal states (`done`, `partial`, `error`), schedules an auto-dismiss timeout (5000ms by default, configurable via `autoResetDelayMs`).
     - Once expired, resets status banner class to `idle` and restores `"Ready to auto-fill form fields"`.
     - Automatically resets `autofillStatus` in `chrome.storage.local` to `{ currentState: 'idle' }`.
   - On popup startup (`DOMContentLoaded`):
     - Checks timestamp of any stored terminal status. If older than 5 seconds, ignores the stale status and resets to idle. If younger than 5 seconds, displays it for the remaining seconds before auto-dismissing.
2. **Model Status Messages Auto-Hide ([`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts))**:
   - In `fetchProviderModels`, set a 5-second timer on `statusMsgEl` so `"Loaded X model(s)"` or error helper texts automatically hide (`classList.add('hidden')`) instead of remaining on screen.
3. **Background Worker Cleanup ([`extension/src/background/background.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/background/background.ts))**:
   - In `updateStatusState`, when reaching a terminal state (`done`, `partial`, `error`), schedules a 5-second background timer to reset stored `autofillStatus` to `idle` in `chrome.storage.local`.
4. **Unit Tests & Build ([`extension/src/__tests__/popup.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/popup.test.ts), [`extension/src/__tests__/background.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/background.test.ts))**:
   - Added 4 new test cases in `popup.test.ts` for timer auto-dismiss on `done`, `error`, non-dismiss on `analyzing`, and cancellation on state changes.
   - Added background test in `background.test.ts` verifying background storage reset after 5s.
   - Re-built `extension/dist` bundle (`npm run build -w extension`).

## Verification
- `npm test -w extension`: 19 passed (196 tests).
- `npm test -w backend`: 14 passed (101 tests).
- Total: 297/297 tests passed across all workspaces.
