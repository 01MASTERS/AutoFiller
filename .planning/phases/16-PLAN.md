# Phase 16 Implementation Plan: Universal Multi-Origin Manifest & Navigation Architecture

## Phase Objective
Equip AutoFiller's extension architecture to run seamlessly on any career portal and ATS. Expand Manifest V3 permissions and frame match patterns (`all_frames: true`), build an in-browser SPA navigation and DOM mutation observer to handle dynamic multi-step form wizards (common in Workday, React, and Vue portals), and introduce embedded iframe discovery to autofill jobs hosted inside embedded widgets (e.g. Greenhouse or Lever embeds).

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Extension** | [`extension/src/manifest.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/manifest.ts) | Matches Google Forms and `<all_urls>`, but lacks `all_frames: true` | Add `all_frames: true` and `run_at: 'document_idle'`; update description to universal |
| **Extension** | [`extension/src/content/contentScript.iife.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/contentScript.iife.ts) | Listens to `SCAN_FIELDS` and `FILL_FIELDS` without SPA or frame awareness | Integrate SPA route observation, dynamic form mounting observer, and frame context logging |
| **Extension** | `extension/src/content/navigationObserver.ts` (NEW) | Does not exist | Create SPA route change hooks (`pushState`, `replaceState`, `popstate`, `hashchange`) and debounced form mutation observer |
| **Extension** | `extension/src/content/iframeDiscovery.ts` (NEW) | Does not exist | Create iframe discovery helper to inspect same-origin iframes and annotate frame hierarchy |
| **Extension** | [`extension/src/background/background.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/background/background.ts) | Sends `SCAN_FIELDS` only to top frame | Support multi-frame fallback if top-frame returns 0 fields |
| **Tests** | `extension/src/__tests__/` | 102 passing tests in extension | Add `navigationObserver.test.ts` and `iframeDiscovery.test.ts` (15+ new tests) |

---

## Detailed Task Breakdown

### Task 1: Manifest V3 Multi-Frame Registration & Permissions
**Files to Modify**:
- [MODIFY] [`extension/src/manifest.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/manifest.ts)

**Action**:
1. Add `all_frames: true` and `run_at: 'document_idle'` to `content_scripts` in `manifest.ts`.
2. Update extension description:
   ```typescript
   description: 'AI-powered autofill for Google Forms, Workday, Greenhouse, Lever, and job application forms'
   ```
3. Ensure `host_permissions: ['<all_urls>']` and `permissions: ['activeTab', 'storage', 'scripting']` remain properly configured.

---

### Task 2: SPA Route & Form Mutation Observer
**Files to Create**:
- [NEW] `extension/src/content/navigationObserver.ts`

**Action**:
1. Safely wrap `history.pushState` and `history.replaceState` to dispatch custom `autofiller:routechange` events.
2. Listen for native `popstate` and `hashchange` events.
3. Implement `initFormMutationObserver`:
   - Debounced MutationObserver (e.g. 300ms debounce) that monitors additions of `<form>`, `[role="form"]`, `.application-form`, `[data-automation-id*="form"]`, or major input clusters.
   - Logs `SPA_FORM_STEP_DETECTED` when a dynamic step transition occurs.
4. Export cleanup function for graceful detachment.

---

### Task 3: Embedded Iframe Discovery & Frame Metadata
**Files to Create/Modify**:
- [NEW] `extension/src/content/iframeDiscovery.ts`
- [MODIFY] `extension/src/content/contentScript.iife.ts`

**Action**:
1. Implement `iframeDiscovery.ts`:
   - Check if current execution context is inside an iframe (`const isIframe = window !== window.top`).
   - For top-frame scripts, scan same-origin `<iframe>` elements to see if they encapsulate form inputs.
   - Attach frame metadata (`isIframe`, `frameUrl`, `frameTitle`) to scan responses.
2. In `contentScript.iife.ts`:
   - Initialize navigation tracking and include frame context in `DOM_SCAN_SUCCESS` logs.
   - Gracefully handle messages in both top frame and iframe contexts.

---

### Task 4: Background Service Worker Multi-Frame Coordination
**Files to Modify**:
- [MODIFY] [`extension/src/background/background.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/background/background.ts)

**Action**:
1. In `handleTriggerAutofill`:
   - Send `SCAN_FIELDS` to active tab.
   - If top frame returns 0 fields, or if top frame reports embedded iframes, utilize multi-frame messaging / dynamic injection across all frames via `chrome.scripting.executeScript({ target: { tabId: activeTab.id, allFrames: true }, ... })`.
   - Log detected platform name (`Google Forms`, `Greenhouse`, `Lever`, `Workday`, `Generic`) in `AUTOFILL_START` and status updates.

---

### Task 5: Unit Tests & Monorepo Verification
**Files to Create**:
- [NEW] `extension/src/__tests__/navigationObserver.test.ts`
- [NEW] `extension/src/__tests__/iframeDiscovery.test.ts`

**Test Cases**:
1. Intercepting `history.pushState` and `history.replaceState`.
2. Listening to `popstate` and `hashchange`.
3. MutationObserver detection when new form elements mount dynamically.
4. `isIframe` detection and frame metadata packaging.
5. Scanning same-origin iframe document forms.
6. Multi-frame fallback communication in background service worker.

---

## Verification Commands
```bash
# Extension unit tests
npm run test -w extension

# Full project tests
npm test

# Production bundle build
npm run build
```
