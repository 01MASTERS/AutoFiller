# AutoFiller — Milestone 2 (v1.1) Requirements

> **Milestone:** 2 — Advanced Form Controls & Multi-Profile (v1.1)  
> **Target:** Expand form input coverage to Google Forms dropdowns, radio groups, checkboxes, and dates via synthetic DOM simulation, and introduce multi-profile persona management.

---

## Functional Requirements

### FR-7: Advanced Google Form DOM Extraction & Option Parsing
- **FR-7.1**: Detect dropdown fields (`role="listbox"`, Google Forms menu selectors, or `<select>`) and extract label, required status, and listed options.
- **FR-7.2**: Detect single-select radio button groups (`role="radiogroup"` or `role="radio"`) and extract group label, required status, and choice options.
- **FR-7.3**: Detect multi-select checkbox groups (`role="group"` / `role="checkbox"`) and extract group label and individual checkbox choice texts.
- **FR-7.4**: Detect date input controls (`input[type="date"]` or Google Forms date component wrappers) and extract format constraints.
- **FR-7.5**: Extend `FieldMetadata` schema in `@autofiller/shared` to include `controlType: 'text' | 'dropdown' | 'radio' | 'checkbox' | 'date'` and `options?: string[]`.

### FR-8: LLM Gateway Support for Option & Constrained Fields
- **FR-8.1**: Update `promptBuilder.ts` with explicit instructions directing the LLM to choose strictly from the provided `options` list for radio and dropdown fields.
- **FR-8.2**: Support array-valued responses for multi-select checkbox groups (e.g. `fieldId: ["Option A", "Option C"]`).
- **FR-8.3**: Support date generation and formatting matching the form's expected pattern (YYYY-MM-DD or DD/MM/YYYY).
- **FR-8.4**: Validate LLM selections in `responseParser.ts` to ensure selected values exist within the field's allowed options.

### FR-9: Advanced Form Filler (Synthetic DOM & ARIA Interaction)
- **FR-9.1**: Locate matching radio option element and dispatch native `click`, `mousedown`, `mouseup`, and `change` events.
- **FR-9.2**: Locate matching checkboxes, compare with current `aria-checked` status, and dispatch click events to reach desired checked state.
- **FR-9.3**: Open Google Forms dropdown menus, locate option element matching LLM selection, trigger selection click, and close menu.
- **FR-9.4**: Populate date picker inputs and dispatch input/change events.
- **FR-9.5**: Apply visual green highlight animation to filled container blocks (radiogroups, checkbox groups, dropdown wrappers).

### FR-10: Multi-Profile Backend Store & Switching API
- **FR-10.1**: Directory-based profile storage (`backend/profiles/*.json`) with default profile fallback (`default.json`).
- **FR-10.2**: Endpoint `GET /profiles` to list available profiles with metadata (ID, name, description).
- **FR-10.3**: Endpoint `POST /profiles/switch` (`{ profileId: string }`) to set the active profile.
- **FR-10.4**: `GET /profile` returns the currently active profile data.
- **FR-10.5**: Input validation and graceful fallback if a requested profile file is missing or invalid.

### FR-11: Extension Multi-Profile Switcher UI
- **FR-11.1**: Add "Active Profile" selector dropdown to the extension popup header.
- **FR-11.2**: Auto-fetch profiles from `GET /profiles` on popup mount.
- **FR-11.3**: Persist active profile selection in Chrome local storage and sync with backend on change.
- **FR-11.4**: Display active profile name and log profile switch events to the Debug Log dashboard.

---

## Non-Functional Requirements

### NFR-6: Performance & Interaction Responsiveness
- Auto-fill cycle on a 15-field form with text, radios, checkboxes, and dropdowns must complete in <10s.
- Synthetic event delays between dropdown open and click kept minimal (<50ms) to ensure smooth filling.

### NFR-7: Reliability & Graceful Fallback
- If an LLM selects an invalid option for a dropdown/radio, skip that field gracefully without crashing the fill cycle.
- If a custom Google Form dropdown cannot be expanded, log a warning with field metadata and continue filling remaining fields.

### NFR-8: Code Quality & Test Coverage
- Strict TypeScript across shared types, backend, and extension.
- Vitest unit tests covering option extraction, prompt generation with choice constraints, response parsing, and multi-profile switching.
- Clean production builds (`npm run build`).

---

## User Stories

### US-4: Radio, Dropdown & Checkbox Auto-Filling
> As a user filling out a job application, I want AutoFiller to automatically select my graduation year from a dropdown, select my work authorization status from radio buttons, and check my programming skills from checkbox lists so that I don't have to select every single control manually.

### US-5: Multi-Profile Persona Switching
> As a candidate with multiple resumes (e.g., Full Stack Engineer vs. AI/ML Specialist), I want to switch profiles in the extension popup with one click so that my answers match the specific role I'm applying for.
