# Quick Task: Fix Profile Editor UI & Raw JSON Save & Persistence

**Slug**: `profile-ui-save-fix`
**Date**: 2026-09-24
**Goal**: Fix the Profile Editor UI (`/profile-ui`) and Raw JSON editor so that changing values in the Visual Form or Raw JSON persists correctly, does not lose fields (e.g., Alternate Phone, custom fields, special characters), does not get overwritten by stale cached HTTP GET requests, and updates immediately across both editors and the extension popup.

---

## 1. Problem Statement
When editing a persona in the Profile Editor dashboard (`http://localhost:3456/profile-ui`):
1. **Field Loss in `collectVisualFormData()`**:
   - The Alternate Phone input (`#input-alt-phone`) is present in the DOM, but `collectVisualFormData()` omitted it completely, causing alternate phone numbers to be deleted on save.
   - `collectVisualFormData()` did not preserve base properties of `currentProfileData`, silently deleting any custom top-level profile properties.
   - Custom fields with empty values or falsy values were dropped, and custom keys with quotes or special characters broke due to unescaped HTML attributes.
2. **Destructive Tab Switching**:
   - Switching between "Visual Form" and "Raw JSON" tabs invoked lossy collection, stripping fields when transitioning to JSON and resetting custom fields when transitioning back.
3. **Stale Cache Reversion ("Shows saved but doesnt")**:
   - After `PUT /profiles/:id` succeeded with a "Saved successfully" toast, `saveCurrentPersona` invoked `loadProfiles(currentProfileId)` which re-queried `GET /profiles` and `GET /profiles/:id`.
   - The backend API endpoints lacked `Cache-Control: no-store` headers, causing browser heuristic HTTP caching to return stale pre-save profile data and overwrite the UI back to old values.
   - List item removals (skills, experience, education, links, custom fields) re-rendered the entire lists from stale objects, wiping out concurrent edits in other rows.

## 2. Proposed Architecture & Fixes
1. **Schema & Types**:
   - Update `userProfileSchema` in `backend/src/types/profile.ts` and `UserProfile` in `shared/src/index.ts` to explicitly recognize `alternatephone` alongside `alternatePhone` and `'alternate phone'`.
2. **Backend HTTP Cache Control**:
   - Add `res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')` to all profile endpoints in `backend/src/routes/api.ts` (`GET /profiles`, `GET /profiles/:id`, `GET /profile`, `PUT /profiles/:id`, `POST /profiles`, `POST /profiles/switch`, `DELETE /profiles/:id`).
3. **Profile Editor UI (`profileUiHtml.ts`)**:
   - **Safe DOM & Escaping**: Implement `escapeHtml` utility for safe attribute and text rendering without broken quotes or inline script injection.
   - **Full Form Collection**: In `collectVisualFormData()`, clone `currentProfileData` as base, collect `input-alt-phone` (setting `alternatePhone`, `'alternate phone'`, and `alternatephone`), and collect all custom fields and links safely.
   - **Direct DOM Removal**: Replace fragile inline `onclick` string attributes with direct event listeners (`row.remove()`) so removing one row does not wipe out uncommitted edits in other rows.
   - **Lossless Tab Sync**: When switching from Visual to JSON, serialize the full merged profile data. When switching from JSON to Visual, parse and populate the visual form.
   - **Immediate In-Memory Update on Save**: On successful `PUT`, update `currentProfileData` directly with the backend's returned validated profile (`data.profile`), populate both Visual Form and Raw JSON views with the saved profile, and refresh the persona sidebar list (`refreshPersonaListOnly()`) without doing a full re-fetch that can re-trigger stale reads.
   - **Cache-Busting Fetches**: Add `cache: 'no-store'` and `?_t=${Date.now()}` to all client-side fetches.
4. **Extension Popup Synchronization**:
   - Add `cache: 'no-store'` to `fetchProfilesList()` in `extension/src/popup/popup.ts` to ensure the popup always receives the latest profile updates without caching delays.

## 3. Verification Plan
- Unit tests: Run `npm test` across backend and extension.
- Integration tests: Run Vitest tests for profile endpoints and profile UI.
- Browser test: Use `browser_subagent` to verify editing in Visual Form, editing in Raw JSON, persistence after save, and page reload.
