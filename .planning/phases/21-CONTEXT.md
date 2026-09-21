# Phase 21 Context: Extension Multi-Profile Switcher UI & Storage Sync

## Phase Summary
Phase 21 delivers the frontend extension counterpart to Phase 20's backend multi-profile store. It adds a persona profile switcher to the extension popup UI, persists the active profile in Chrome storage (`chrome.storage.local`), enables real-time synchronization with the backend (`GET /profiles`, `POST /profiles/switch`), updates the active profile preview card, and wires persona selection directly into the autofill workflow so users can switch resumes/personas (e.g. Software Engineer, Product Manager, Data Scientist) with a single click.

---

## Core Objectives & Architectural Scope

1. **Popup UI Multi-Profile Switcher (`extension/src/popup/popup.html` & `popup.css`)**:
   - Upgrade the Profile Card into an interactive Persona Switcher:
     - Profile select dropdown (`#profile-select`) dynamically populated with all available persona profiles.
     - Formats options with persona name and headline/role (e.g., "Rittik Sharma — Machine Learning & AI Intern").
     - Refresh button (`#refresh-profiles-btn`) with smooth spinner animation to reload profiles from backend on demand.
     - Active profile metadata display: name (`#profile-name`), headline (`#profile-headline`), and email (`#profile-email`).
     - Visual badge indicating sync state: "Loaded" (synced with backend), "Cached" (offline mode), or "Error".

2. **Storage Synchronization & Offline Resilience (`extension/src/popup/popup.ts`)**:
   - Query `GET http://localhost:3456/profiles` on popup initialization.
   - Cache profile summaries and active profile ID in `chrome.storage.local` (`cachedProfiles`, `activeProfileId`).
   - If backend is offline or unreachable:
     - Render immediately from `chrome.storage.local` cached profiles so popup UI is never blocked or blank.
     - Display a "Cached" or "Offline" indicator.
   - On dropdown change:
     - Optimistically update local UI and storage.
     - Dispatch `POST http://localhost:3456/profiles/switch` with `{ profileId }`.
     - Log `PROFILE_SWITCH` event to Debug Logs via `ExtensionLogger`.
     - Revert with error notification if backend rejects the switch.

3. **Autofill Pipeline Persona Forwarding (`extension/src/background/background.ts`)**:
   - Extend `handleTriggerAutofill` to accept optional `profileId`.
   - Fall back to `activeProfileId` stored in `chrome.storage.local` if not explicitly supplied.
   - Forward `profileId` in the `POST http://localhost:3456/autofill` request body.
   - Include the active persona in `AUTOFILL_START` and `AUTOFILL_SUCCESS` logs for transparent auditability in the Debug Dashboard.

4. **Comprehensive Automated Testing (`extension/src/__tests__/`)**:
   - In [`popup.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/popup.test.ts):
     - Populating profile selector with multiple persona profiles.
     - Selecting a profile dispatches switch request, updates storage, and updates preview text.
     - Offline fallback to cached storage when backend is unavailable.
     - Refresh profiles button behavior.
     - Forwarding active `profileId` when triggering autofill.
   - In [`background.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/background.test.ts):
     - Autofill trigger forwards `profileId` to `POST /autofill`.
     - Reading `activeProfileId` from Chrome storage when options omit `profileId`.
   - Ensure all 229 monorepo tests continue to pass with zero regressions.

---

## Verification Strategy
- **Unit & DOM Tests**: Vitest + jsdom verifying dropdown population, event binding, storage sync, and DOM updates.
- **Autofill E2E Integration**: Verify background worker includes `profileId` in backend payload.
- **Monorepo Suite**: Run `npm test` across all 3 packages (`shared`, `extension`, `backend`).
- **Production Build**: Verify `npm run build` generates clean bundles.
