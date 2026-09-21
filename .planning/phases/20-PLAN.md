# Phase 20 Implementation Plan: Multi-Profile Backend Store & Switching API

## Phase Objective
Implement multi-persona profile JSON storage in `backend/profiles/` with active profile persistence and REST API endpoints (`GET /profiles`, `POST /profiles/switch`, `GET /profiles/:id`, `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id`, `GET /profile`), while preserving 100% backward compatibility with existing profile data and autofill endpoints.

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Shared** | [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts) | Only has single `UserProfile` interface | Add `ProfileSummary`, `ProfilesListResponse`, `SwitchProfileRequest`, `SwitchProfileResponse`, and `profileId` to `AutofillRequest` |
| **Backend** | [`backend/src/types/profile.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/types/profile.ts) | Single profile schema | Add `switchProfileRequestSchema`, `createProfileRequestSchema`, and update `autofillRequestSchema` with `profileId` |
| **Backend** | [`backend/src/services/profileStore.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/profileStore.ts) | Single `profile.json` reader/writer | Refactor to multi-profile directory manager with `.active` file tracking, automatic seed migration, and CRUD methods |
| **Backend** | `backend/profiles/` (NEW DIR) | Does not exist | Create directory initialized with `default.json` (from existing `profile.json`), `product-manager.json`, and `data-scientist.json` |
| **Backend** | [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts) | Only has `GET /profile` | Add `GET /profiles`, `GET /profiles/:id`, `POST /profiles/switch`, `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| **Backend** | [`backend/src/__tests__/profile.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/__tests__/profile.test.ts) | Tests single `GET /profile` | Expand to test complete multi-profile listing, switching, fetching, creating, updating, and deleting |

---

## Detailed Task Breakdown

### Task 1: Shared Types & Schema Extensions
**Files to Modify**:
- [MODIFY] [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts)
- [MODIFY] [`backend/src/types/profile.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/types/profile.ts)

**Action**:
1. In `shared/src/index.ts`:
   - Add `ProfileSummary`, `ProfilesListResponse`, `SwitchProfileRequest`, `SwitchProfileResponse`.
   - Add `profileId?: string` to `AutofillRequest`.
2. In `backend/src/types/profile.ts`:
   - Add `switchProfileRequestSchema` (`{ profileId: z.string() }`).
   - Add `createProfileRequestSchema` (`{ id: z.string().regex(/^[a-zA-Z0-9_-]+$/), profile: userProfileSchema }`).
   - Update `autofillRequestSchema` with `profileId: z.string().optional()`.

---

### Task 2: Multi-Profile Store & Persona Seed Files
**Files to Create/Modify**:
- [MODIFY] [`backend/src/services/profileStore.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/profileStore.ts)
- [NEW] `backend/profiles/default.json`
- [NEW] `backend/profiles/product-manager.json`
- [NEW] `backend/profiles/data-scientist.json`

**Action**:
1. Implement directory initialization logic in `ProfileStore`:
   - If `backend/profiles/` does not exist, create it.
   - If `backend/profile.json` exists, copy it to `backend/profiles/default.json` so current user data is fully preserved.
   - If persona starters don't exist, create realistic `product-manager.json` and `data-scientist.json` personas.
2. Implement active profile tracking:
   - Read from `backend/profiles/.active` (or fallback to `default`).
   - `setActiveProfile(profileId)` writes `profileId` into `backend/profiles/.active`.
3. Implement methods:
   - `listProfiles(): ProfileSummary[]`
   - `getActiveProfileId(): string`
   - `getProfile(profileId?: string): UserProfile`
   - `saveProfile(profile: UserProfile, profileId?: string): void`
   - `createProfile(profileId: string, profile: UserProfile): void`
   - `deleteProfile(profileId: string): boolean` (disallows deleting active profile)

---

### Task 3: Multi-Profile REST Endpoints & Autofill Integration
**Files to Modify**:
- [MODIFY] [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts)

**Action**:
1. Add endpoints:
   - `GET /profiles`: Returns `ProfilesListResponse` with all profiles and `activeProfileId`.
   - `GET /profiles/:id`: Returns full `UserProfile` for given ID (or 404 if not found).
   - `POST /profiles/switch`: Validates `{ profileId }`, switches active profile, logs switch, and returns `SwitchProfileResponse`.
   - `POST /profiles`: Validates `{ id, profile }`, writes new profile file, returns 201 Created.
   - `PUT /profiles/:id`: Validates body as `userProfileSchema`, updates profile file.
   - `DELETE /profiles/:id`: Deletes profile (returns 400 if attempting to delete active profile).
2. Update `GET /profile`:
   - Calls `ProfileStore.getProfile()` (which returns the active profile).
3. Update `POST /autofill`:
   - If `body.profileId` is provided, calls `ProfileStore.getProfile(body.profileId)`.
   - Otherwise, uses active profile.

---

### Task 4: Integration Test Suite & Verification
**Files to Modify**:
- [MODIFY] [`backend/src/__tests__/profile.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/__tests__/profile.test.ts)

**Action**:
1. Add comprehensive tests:
   - `GET /profiles` returns list with `activeProfileId`.
   - `GET /profiles/:id` returns specific profile JSON.
   - `GET /profiles/invalid-id` returns 404.
   - `POST /profiles/switch` changes active profile and returns updated profile.
   - Subsequent `GET /profile` returns the newly active profile.
   - `POST /profiles` creates a new profile.
   - `PUT /profiles/:id` updates an existing profile.
   - `DELETE /profiles/:id` removes profile.
   - `DELETE /profiles/:id` on active profile returns 400 Bad Request.
   - `POST /autofill` uses specified `profileId` when provided.
2. Verify all monorepo tests pass: `npm test`.
3. Verify build succeeds: `npm run build`.

---

## Verification Criteria
- All 215 existing tests continue to pass.
- All new multi-profile endpoints pass with 100% assertions.
- Existing user data in `backend/profile.json` remains intact.
- Production build succeeds with 0 errors.
- ZERO git commits made during phase execution (strict user rule).
