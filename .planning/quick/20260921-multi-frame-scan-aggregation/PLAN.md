# Quick Task: Multi-Frame Scan Aggregation & Frame-Aware Form Filling

**Slug**: `multi-frame-scan-aggregation`
**Date**: 2026-09-21
**Goal**: Resolve race conditions on ATS/job pages containing child iframes (reCAPTCHA, LinkedIn widgets, tracking pixels, or embedded ATS forms) by replacing the blind `chrome.tabs.sendMessage` broadcast with targeted frame discovery, top-frame prioritization, response aggregation, and frame-aware fill routing.

---

## 1. Problem Statement
On pages like `careers.adobe.com` (SmartRecruiters ATS) and other career portals, third-party child `<iframe>` elements (reCAPTCHA, LinkedIn widgets, cookies) exist alongside the primary application form.
Because `manifest.ts` specifies `all_frames: true`, `contentScript.iife.ts` runs in every frame.
Calling `chrome.tabs.sendMessage(activeTab.id, { action: 'SCAN_FIELDS' })` without `{ frameId }` broadcasts to all frames and resolves on whichever frame replies first.
Empty child iframes with 0 fields execute in <1ms and reply before the main form finishes scanning (which takes ~35ms for deep Angular 20 / Shadow DOM components). The background worker was receiving `fields: []` and aborting with `"No fillable text fields found on this form"`.

## 2. Architecture & Design: "Aggregate All, Filter None"
1. **Frame Discovery**:
   - Query all active frame IDs using `chrome.webNavigation.getAllFrames({ tabId })` (with fallback to `chrome.scripting.executeScript({ target: { tabId, allFrames: true } })`, and defaulting to `[0]`).
   - Add `'webNavigation'` to `manifest.ts` permissions.
2. **Deterministic Frame Probing**:
   - Query the top frame (`frameId: 0`) explicitly: `chrome.tabs.sendMessage(tabId, { action: 'SCAN_FIELDS' }, { frameId: 0 })`.
   - Query all discovered child frames (`frameId > 0`) individually: `chrome.tabs.sendMessage(tabId, { action: 'SCAN_FIELDS' }, { frameId })`.
   - Discard responses with 0 fields or errors (e.g. reCAPTCHA / widgets).
   - Retain and tag all fields with their origin `frameId`.
   - Aggregate all discovered fields, deduplicating by field ID.
   - Only return an error if the aggregated fields list across all frames is empty.
3. **Frame-Aware Filling**:
   - Partition field mappings by `field.frameId` (defaulting to 0).
   - Dispatch `FILL_FIELDS` messages targeted directly to each frame that contains mapped elements: `chrome.tabs.sendMessage(activeTab.id, { action: 'FILL_FIELDS', mappings, fields }, { frameId })`.
   - Combine fill results (counts, filled fields, failure/skipped reasons) across all frames into a unified `FillResult`.

## 3. Scope of Changes
- `shared/src/index.ts`: Add optional `frameId?: number` to `FieldMetadata`.
- `backend/src/types/profile.ts`: Add `frameId: z.number().optional()` to `fieldMetadataSchema`.
- `extension/src/manifest.ts`: Add `'webNavigation'` to `permissions`.
- `extension/src/background/background.ts`: Implement `getTabFrameIds`, multi-frame scan aggregation, and frame-aware `FILL_FIELDS` distribution.
- `extension/src/__tests__/background.test.ts`: Update existing tests to verify `{ frameId: 0 }` routing, and add tests for multi-frame aggregation and embedded iframe workflows.

## 4. Verification Plan
- `npm test -w extension`: Verify all extension unit and integration tests pass.
- `npm test -w backend`: Verify backend tests pass.
- `npm run build`: Verify TypeScript compilation and bundling for the monorepo.
