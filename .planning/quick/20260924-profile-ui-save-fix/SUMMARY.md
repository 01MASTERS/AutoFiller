# Quick Task Summary: Fix Profile Editor UI & Raw JSON Save & Persistence

**Slug**: `profile-ui-save-fix`  
**Date**: 2026-09-24  
**Status**: Complete ✓  

---

## 1. Overview of the Problem
The user reported: `"unable to alter or change the values of profile from the UI or raw json from the UI. Shows saved but doesnt."`

Investigation identified five distinct bugs causing this behavior:
1. **Omission in `collectVisualFormData()`**: The UI contained `#input-alt-phone`, but `collectVisualFormData()` never read it. Additionally, `collectVisualFormData()` constructed a completely new object without inheriting `currentProfileData`, dropping top-level fields (e.g. `alternatephone` or any arbitrary custom properties) on save.
2. **Lossy Tab Switching**: Switching from the "Visual Form" tab to the "Raw JSON" tab called `collectVisualFormData()`, which stripped unrecognized fields and dropped empty/falsy custom fields from the textarea.
3. **Unescaped HTML Attributes**: String interpolation in list rendering (`value="${val}"`, `onclick="removeCustomField('${key}')"`) broke on quotes and special characters in custom questions or answers, triggering JS syntax errors.
4. **Destructive List Mutators**: Deleting or adding an item in skills, experience, education, links, or custom fields re-rendered the entire collection from cached objects, destroying concurrent, uncommitted edits in other inputs.
5. **Stale HTTP Caching & Reload Reversion**: After `PUT /profiles/:id` succeeded with a "Saved successfully" toast, `saveCurrentPersona` executed `await loadProfiles(currentProfileId)` which re-queried `GET /profiles` and `GET /profiles/:id`. The Express endpoints lacked `Cache-Control: no-store` headers, causing the browser's heuristic cache to serve stale pre-save JSON and overwrite the form back to old values.

---

## 2. Changes Made

### A. Shared & Backend Schema (`shared/src/index.ts` & `backend/src/types/profile.ts`)
- Added `alternatephone?: string;` alias to `UserProfile` in `@autofiller/shared`.
- Added `alternatephone: z.string().optional()` to `userProfileSchema` in backend validation.
- Synchronized canonical keys (`alternatePhone`, `'alternate phone'`, and `alternatephone`) so any casing convention is recognized.

### B. HTTP Cache Headers & Route Improvements (`backend/src/routes/api.ts`)
- Added explicit HTTP headers to prevent any caching:
  `res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');`
  `res.setHeader('Pragma', 'no-cache');`
  `res.setHeader('Expires', '0');`
  across `GET /profiles`, `GET /profiles/:id`, `POST /profiles`, `POST /profiles/switch`, `PUT /profiles/:id`, `DELETE /profiles/:id`, and `GET /profile`.
- Added `PUT /profile` as an active-profile update endpoint.

### C. Profile Editor Dashboard UI (`backend/src/routes/profileUiHtml.ts`)
- **Safe HTML Escaping**: Added `escapeHtml()` helper applied across all input attributes, textareas, and card contents.
- **Lossless Form Collector**:
  - Clones `currentProfileData` as the base payload instead of constructing an empty object.
  - Reads `#input-alt-phone` and sets `alternatePhone`, `'alternate phone'`, and `alternatephone`.
  - Safely collects all custom fields (even with empty string or falsy values) and links.
- **Non-Destructive DOM Mutators**:
  - Refactored experience cards, education cards, links, and custom field rows to attach direct event listeners (`card.remove()`). Removing a card no longer triggers a global re-render, preserving all other pending user inputs.
  - Adding rows prepends directly to the container DOM without resetting existing inputs.
- **Immediate Save Update Without Stale Re-Fetch**:
  - `saveCurrentPersona()` now immediately adopts the validated `data.profile` returned in the `PUT` response, updating both the Visual Form and Raw JSON textareas.
  - Sidebar persona names and summaries are refreshed via `refreshPersonaListOnly()` without performing a full form reload.
- **Cache-Busting Fetch Requests**:
  - Added `cache: 'no-store'` and timestamp query parameters (`?_t=${Date.now()}`) to all client-side API requests (`GET /profiles`, `GET /profiles/:id`, `PUT /profiles/:id`, `POST /profiles`, `DELETE /profiles/:id`).

### D. Chrome Extension Popup (`extension/src/popup/popup.ts`)
- Added `{ cache: 'no-store' }` to popup `fetch()` calls for profiles to ensure instant pickup of changes made in the dashboard.

---

## 3. Verification & Results
- **Automated Tests**:
  - Monorepo unit/integration test suite: **254 / 254 tests passing** (158 extension, 96 backend).
  - TypeScript build (`npm run build`): Clean zero-error build across `shared`, `extension`, and `backend`.
- **Live UI & Disk Persistence Verification**:
  - Visual form edits (including Alternate Phone, name, custom questions/answers) save cleanly to `backend/profiles/default.json` and mirrored `backend/profile.json`.
  - Raw JSON edits save cleanly and update the Visual Form seamlessly.
  - Switching tabs between Visual Form and Raw JSON preserves 100% of data with zero stripping.
  - Saving persists without UI reversion or stale cache overwrites.
