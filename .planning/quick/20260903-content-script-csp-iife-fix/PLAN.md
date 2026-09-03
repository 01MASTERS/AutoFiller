---
status: complete
date: 2026-09-03
slug: content-script-csp-iife-fix
---

# Fix Content Script Not Loaded on Google Forms (CSP + Dynamic Injection)

## Problem
Users experience "Content script not loaded on this tab. Please refresh the page tab and try again." on Google Forms (`docs.google.com/forms/*`) regardless of refreshing.

## Root Cause
1. Google Forms enforces a strict Content Security Policy (`script-src`) that disallows dynamic `import()` of external URLs.
2. The `@crxjs/vite-plugin` bundles content scripts into an async loader:
   ```javascript
   (async () => {
     const { onExecute } = await import(chrome.runtime.getURL("assets/..."));
   })();
   ```
   When injected into Google Forms, the browser's CSP rejects the `await import(...)` call. Consequently, the content script module never executes and `chrome.runtime.onMessage.addListener` is never registered.
3. Refreshing the tab repeats the CSP violation every time.
4. Additionally, when tabs were open before the extension was reloaded, no fallback programmatic injection was performed by the background worker.

## Solution
1. Rename `contentScript.ts` to `contentScript.iife.ts` and update `manifest.ts`. CRXJS recognizes the `.iife.ts` suffix and inlines all dependencies into a standalone, single-file IIFE bundle (`src/content/contentScript.iife.js`) without any dynamic `import()` or external chunk loader.
2. Update `background.ts` to add automatic programmatic injection fallback via `chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/contentScript.iife.js'] })`. If the content script is not yet running on an active tab, the service worker injects it and retries communication seamlessly.
3. Add robust `activeTab` query fallback using `lastFocusedWindow: true` if `currentWindow: true` returns no tabs.
