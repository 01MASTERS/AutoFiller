# Phase 20 Context: Multi-Profile Backend Store & Switching API

## Phase Summary
Phase 20 initiates **Milestone 3 (Multi-Profile Persona Management & Switching)**. It upgrades AutoFiller's profile backend from a single static `profile.json` into a modular multi-profile store capable of hosting multiple persona JSON files in `backend/profiles/` (e.g. Software Engineer, Product Manager, Data Scientist). It introduces RESTful switching endpoints (`GET /profiles`, `POST /profiles/switch`, `GET /profiles/:id`, `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id`), persists the active profile selection, and preserves 100% backward compatibility for existing autofill calls and the legacy `GET /profile` endpoint.

---

## Core Objectives & Architectural Scope

1. **Multi-Profile Directory Architecture (`backend/profiles/`)**:
   - Establish `backend/profiles/` as the canonical repository for persona JSON files.
   - Non-destructive migration: on startup, seamlessly copy existing `backend/profile.json` into `backend/profiles/default.json` so user custom profile data is preserved with zero data loss.
   - Provide realistic persona starter templates:
     - `default.json`: Primary user persona (seeded from current `profile.json`).
     - `product-manager.json`: Technical Product Manager persona.
     - `data-scientist.json`: AI/ML and Data Science persona.
   - Active profile persistence: maintain active profile selection in `backend/profiles/.active` (defaulting to `'default'`).

2. **Shared Data Contracts (`@autofiller/shared`)**:
   - `ProfileSummary`: `{ id: string, name: string, headline?: string, filename: string, isActive: boolean }`.
   - `ProfilesListResponse`: `{ status: 'success', activeProfileId: string, profiles: ProfileSummary[] }`.
   - `SwitchProfileRequest`: `{ profileId: string }`.
   - `SwitchProfileResponse`: `{ status: 'success', activeProfileId: string, message?: string, profile?: UserProfile }`.
   - Update `AutofillRequest` to support optional `profileId?: string`.

3. **Multi-Profile Store (`backend/src/services/profileStore.ts`)**:
   - Refactor `ProfileStore` to manage directory-based profile storage:
     - `getProfilesDir()`: Resolves `PROFILES_DIR` or `<cwd>/profiles` (with fallback to `backend/profiles`).
     - `listProfiles()`: Reads all `.json` files in profiles directory, parses summaries, and flags `isActive`.
     - `getActiveProfileId()` / `setActiveProfile(id)`: Reads/writes `.active` file.
     - `getProfile(id?)`: Returns requested profile or active profile if `id` is omitted.
     - `saveProfile(profile, id?)`: Validates and saves profile.
     - `createProfile(id, profile)`: Creates new profile.
     - `deleteProfile(id)`: Deletes profile (rejects active profile deletion).

4. **REST API Endpoints (`backend/src/routes/api.ts`)**:
   - `GET /profiles`: Returns list of all persona profiles and `activeProfileId`.
   - `GET /profiles/:id`: Returns full profile JSON for given ID (404 if not found).
   - `POST /profiles/switch`: Switches active persona, persists to `.active`, returns new profile.
   - `POST /profiles`: Creates new persona profile with Zod validation.
   - `PUT /profiles/:id`: Updates existing persona profile.
   - `DELETE /profiles/:id`: Deletes profile (cannot delete active profile).
   - `GET /profile`: Unchanged public interface; returns current active profile (100% backward compatibility).
   - `POST /autofill`: Supports optional `profileId` parameter in body, defaulting to active profile.

5. **Comprehensive Testing**:
   - Update `backend/src/__tests__/profile.test.ts` to test all multi-profile CRUD and switching routes.
   - Verify `POST /autofill` uses active or explicitly specified profile.
   - Verify all 215 monorepo tests pass without regression.

---

## Verification Strategy
- **Baseline Regression**: Ensure all 215 existing monorepo tests pass.
- **Multi-Profile Unit & Integration Tests**: Validate `ProfileStore` and Express routes for switching, listing, creating, and error handling.
- **Build Verification**: `npm run build` succeeds cleanly across all packages.
