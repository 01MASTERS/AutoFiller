---
status: complete
date: 2026-09-21
slug: multi-frame-scan-aggregation
---

# Multi-Frame Scan Aggregation & Frame-Aware Form Filling — Summary

## Accomplishments
1. **Multi-Frame Scan Discovery & Top-Frame Prioritization**:
   - Implemented `getTabFrameIds(tabId)` in `background.ts`, resolving frame IDs via `chrome.webNavigation.getAllFrames` with fallback to `chrome.scripting.executeScript({ allFrames: true })` and defaulting to `[0]` (top frame).
   - Added `'webNavigation'` permission to `extension/src/manifest.ts`.
   - Guaranteed that the top frame (`frameId: 0`) is explicitly and deterministically scanned first via `chrome.tabs.sendMessage(activeTab.id, { action: 'SCAN_FIELDS' }, { frameId: 0 })`.
   - Prevented race conditions where fast 0-field responses from auxiliary child iframes (reCAPTCHA widgets, LinkedIn trackers, empty helper iframes) resolved the broadcast Promise before the top frame or rich ATS form finished scanning.

2. **"Aggregate All, Filter None" Multi-Frame Architecture**:
   - Queries child frames (`frameId > 0`) individually and concurrently.
   - Filters out frames returning 0 fields or errors without failing the overall scan.
   - Preserves and aggregates every valid field discovered in any frame, tagging each field with its originating `frameId`.
   - Deduplicates fields by ID to prevent duplicate inputs from same-origin child frames.
   - Only triggers `"No fillable text fields found on this form"` when all frames return 0 fields.

3. **Frame-Aware Form Filling**:
   - Partitioned the backend LLM field mappings by origin `frameId`.
   - Dispatches targeted `FILL_FIELDS` messages to the exact frame holding the respective elements: `chrome.tabs.sendMessage(activeTab.id, { action: 'FILL_FIELDS', mappings, fields }, { frameId })`.
   - Aggregates fill metrics (`filledCount`, `failedCount`, `skippedCount`, `filledFields`, failure/skipped reasons) across all frames into a unified `FillResult`.

4. **Schema & Shared Types Update**:
   - Added optional `frameId?: number` to `FieldMetadata` in `@autofiller/shared`.
   - Updated `fieldMetadataSchema` in `backend/src/types/profile.ts` to include `frameId: z.number().optional()`.

5. **Test Coverage & Verification**:
   - Added unit tests in `extension/src/__tests__/background.test.ts` for:
     - `getTabFrameIds` across `webNavigation`, `scripting`, and fallback modes.
     - Multi-frame aggregation where top frame and child frames contain fields while empty child frames are ignored.
     - Embedded cross-origin iframes where top frame has 0 fields and a child iframe holds the form.
     - Error resilience when an auxiliary iframe rejects.
   - All 254 tests passing (158 in extension, 96 in backend). Clean production monorepo build.
