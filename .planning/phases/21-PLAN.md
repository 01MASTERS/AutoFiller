# Phase 21 Implementation Plan: Extension Multi-Profile Switcher UI & Storage Sync

## Phase Objective
Implement the Chrome extension multi-profile switcher UI in the popup, persist persona selections in Chrome local storage, synchronize active persona state with the backend REST API, and wire the active profile into the autofill execution pipeline.

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Extension UI** | [`extension/src/popup/popup.html`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.html) | Static `#profile-name` and `#profile-email` display | Add `#profile-select` dropdown, `#refresh-profiles-btn` refresh button, `#profile-headline` span, and `#profile-badge` state indicator |
| **Extension Styling** | [`extension/src/popup/popup.css`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.css) | Basic `.profile-info` flex styles | Add styling for `.profile-select-group`, `.profile-select`, `.profile-headline`, `.header-actions`, and spinner animations |
| **Extension Popup Logic** | [`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts) | Only calls `fetchProfilePreview()` to `GET /profile` | Add `fetchProfilesList()`, `switchActiveProfile()`, storage persistence (`cachedProfiles`, `activeProfileId`), offline fallback, and wire `profileId` into `TRIGGER_AUTOFILL` |
| **Extension Background** | [`extension/src/background/background.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/background/background.ts) | `handleTriggerAutofill` posts without `profileId` | Accept `profileId?: string` in options, read stored `activeProfileId` as fallback, and send `profileId` to `POST /autofill` |
| **Popup Tests** | [`extension/src/__tests__/popup.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/popup.test.ts) | Tests models, health, and error formatting | Add tests for profile dropdown population, switching, storage persistence, offline fallback, and autofill forwarding |
| **Background Tests** | [`extension/src/__tests__/background.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/background.test.ts) | Tests autofill pipeline without profile verification | Add tests verifying `profileId` propagation to backend `POST /autofill` |

---

## Detailed Task Breakdown

### Task 1: Popup Markup & CSS Enhancements
**Files to Modify**:
- [MODIFY] [`extension/src/popup/popup.html`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.html)
- [MODIFY] [`extension/src/popup/popup.css`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.css)

**Actions**:
1. In `popup.html`:
   - Upgrade `.profile-card`:
     - Header contains title ("Active Profile"), refresh button (`#refresh-profiles-btn`), and status badge (`#profile-badge`).
     - Body contains profile select dropdown (`<select id="profile-select" class="form-select profile-select">`).
     - Profile details contain name (`#profile-name`), headline (`#profile-headline`), and email (`#profile-email`).
2. In `popup.css`:
   - Style `.profile-select-group`, `.profile-select` with subtle accent border on focus.
   - Style `.profile-headline` with muted font, ellipsis truncation, and 11px size.
   - Ensure header actions layout smoothly with badge and icon button.

---

### Task 2: Popup Profile Management & Storage Synchronization
**Files to Modify**:
- [MODIFY] [`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts)

**Actions**:
1. Import `ProfilesListResponse`, `SwitchProfileResponse`, `ProfileSummary`, `UserProfile` from `@autofiller/shared`.
2. Define storage helpers for active profile:
   - Keys: `activeProfileId: string`, `cachedProfiles: ProfileSummary[]`, `cachedActiveProfile: UserProfile`.
3. Implement `fetchProfilesList(preferredProfileId?: string): Promise<ProfileSummary[]>`:
   - Starts refresh spinner on `#refresh-profiles-btn`.
   - Calls `GET http://localhost:3456/profiles`.
   - Populates `<select id="profile-select">` with `<option value="id">Name — Headline</option>`.
   - Sets dropdown value to active profile.
   - Updates `#profile-name`, `#profile-headline`, `#profile-email`.
   - Saves to `chrome.storage.local`.
   - Updates `#profile-badge` to "Loaded".
   - If network fails: reads `cachedProfiles` and `activeProfileId` from `chrome.storage.local`, renders UI, and sets badge to "Offline" or "Cached".
4. Implement `switchActiveProfile(profileId: string): Promise<boolean>`:
   - Dispatches `POST http://localhost:3456/profiles/switch` with `{ profileId }`.
   - On success: saves `activeProfileId` to storage, updates preview display, and logs `PROFILE_SWITCH` with `ExtensionLogger`.
   - On failure: reverts dropdown selection and shows error in status banner.
5. Bind events in `bindPopupEvents()`:
   - Change listener on `#profile-select` $\to$ calls `switchActiveProfile`.
   - Click listener on `#refresh-profiles-btn` $\to$ calls `fetchProfilesList`.
6. Update autofill click handler:
   - Gets current selected profile ID (`profileSelect?.value`).
   - Passes `profileId: selectedProfileId` in `TRIGGER_AUTOFILL` options message.
7. On `DOMContentLoaded`:
   - Read cached profiles from storage first (instant render).
   - If backend is online, run `fetchProfilesList()`.

---

### Task 3: Background Service Worker Persona Forwarding
**Files to Modify**:
- [MODIFY] [`extension/src/background/background.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/background/background.ts)

**Actions**:
1. Update `handleTriggerAutofill` options interface:
   ```ts
   options?: {
     provider?: 'ollama' | 'gemini';
     model?: string;
     apiKey?: string;
     profileId?: string;
   }
   ```
2. Resolve target `profileId`:
   - If `options?.profileId` is provided, use it.
   - Else check `chrome.storage.local.get(['activeProfileId'])`.
3. Forward `profileId` to backend:
   ```ts
   body: JSON.stringify({
     fields: scanResponse.fields,
     provider: options?.provider || 'ollama',
     model: options?.model,
     profileId: activeProfileId,
   })
   ```
4. Include `profileId` in log messages:
   - `Starting autofill workflow (provider: ..., model: ..., profile: ${activeProfileId || 'default'})`

---

### Task 4: Comprehensive Test Suite & Verification
**Files to Modify**:
- [MODIFY] [`extension/src/__tests__/popup.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/popup.test.ts)
- [MODIFY] [`extension/src/__tests__/background.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/background.test.ts)

**Actions**:
1. In `popup.test.ts`:
   - Test `fetchProfilesList` populates `#profile-select` with profiles and selects active.
   - Test changing `#profile-select` sends `POST /profiles/switch`, updates storage, and logs switch.
   - Test offline fallback loads cached profiles from storage when fetch fails.
   - Test clicking `#refresh-profiles-btn` triggers profile re-fetch.
   - Test clicking `#autofill-btn` includes `profileId` in runtime message.
2. In `background.test.ts`:
   - Test `handleTriggerAutofill` sends explicit `profileId` in backend payload.
   - Test `handleTriggerAutofill` reads stored `activeProfileId` from Chrome storage if omitted from options.
3. Verification commands:
   - `npm run test -w extension`
   - `npm run test -w backend`
   - `npm test` (all 229+ tests passing)
   - `npm run build` (clean compilation)

---

## Verification Criteria
- All 229 existing monorepo tests continue to pass.
- New popup and background tests pass with 100% assertions.
- Switching profiles in popup updates active persona preview and storage.
- Auto-fill workflow passes selected persona to backend `/autofill`.
- Clean production build with zero TypeScript or Vite errors.
- **ZERO GIT COMMITS** (strict user rule).
