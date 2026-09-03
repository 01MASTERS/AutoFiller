---
status: complete
date: 2026-09-03
slug: content-script-csp-iife-fix
---

# Content Script CSP IIFE Fix & Dynamic Injection Recovery — Summary

## Accomplishments
1. **Resolved Google Forms CSP Dynamic Import Block**:
   - Replaced default Vite/CRXJS content script loader with a standalone IIFE bundle (`contentScript.iife.ts`).
   - Output bundle `dist/src/content/contentScript.iife.js` inlines all dependencies and executes immediately without calling `import()`, completely immune to host page Content Security Policy restrictions.
2. **Added Programmatic Injection Fallback**:
   - Enhanced `background.ts` to catch `chrome.tabs.sendMessage` connection errors and automatically inject `src/content/contentScript.iife.js` via `chrome.scripting.executeScript`.
   - Prevents connection errors on tabs that were already open before an extension reload.
3. **Improved Active Tab Resolution**:
   - Added `lastFocusedWindow: true` fallback to `chrome.tabs.query` in case `currentWindow: true` yields no active tab.
4. **Enhanced Diagnostic Logging**:
   - Recorded `originalError` and `injectionError` in `SCAN_FIELDS_FAIL` logs for transparent debugging.
5. **Full Test Suite & Build Verification**:
   - Added unit tests in `background.test.ts` for dynamic injection recovery and error fallback.
   - 132/132 unit tests passing (65 extension, 67 backend).
   - Clean production build across all workspaces.
