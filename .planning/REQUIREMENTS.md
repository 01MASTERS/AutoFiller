# AutoFiller — Milestone 2 (v1.1) Requirements

> **Milestone:** 2 — Universal Multi-Platform Form Filling Engine (v1.1)  
> **Target:** Expand AutoFiller beyond Google Forms into a universal form-filling engine supporting diverse job applications and ATS platforms (including Workday, Greenhouse, Lever, company career pages, and generic web forms) with smart field detection and synthetic DOM simulation.

---

## Completed Requirements (Phases 12–14 Foundation)

### FR-7: Advanced Google Form DOM Extraction & Option Parsing (Completed)
- **FR-7.1**: Detect dropdown fields (`role="listbox"`, Google Forms menu selectors, or `<select>`) and extract label, required status, and listed options.
- **FR-7.2**: Detect single-select radio button groups (`role="radiogroup"` or `role="radio"`) and extract group label, required status, and choice options.
- **FR-7.3**: Detect multi-select checkbox groups (`role="group"` / `role="checkbox"`) and extract group label and individual checkbox choice texts.
- **FR-7.4**: Detect date input controls (`input[type="date"]` or Google Forms date component wrappers) and extract format constraints.
- **FR-7.5**: Extend `FieldMetadata` schema in `@autofiller/shared` to include `controlType: 'text' | 'dropdown' | 'radio' | 'checkbox' | 'date'` and `options?: string[]`.

### FR-8: LLM Gateway Support for Option & Constrained Fields (Completed)
- **FR-8.1**: Update `promptBuilder.ts` with explicit instructions directing the LLM to choose strictly from the provided `options` list for radio and dropdown fields.
- **FR-8.2**: Support array-valued responses for multi-select checkbox groups (e.g. `fieldId: ["Option A", "Option C"]`).
- **FR-8.3**: Support date generation and formatting matching the form's expected pattern (YYYY-MM-DD or DD/MM/YYYY).
- **FR-8.4**: Validate LLM selections in `responseParser.ts` to ensure selected values exist within the field's allowed options.

### FR-9: Advanced Form Filler (Synthetic DOM & ARIA Interaction) (Completed)
- **FR-9.1**: Locate matching radio option element and dispatch native `click`, `mousedown`, `mouseup`, and `change` events.
- **FR-9.2**: Locate matching checkboxes, compare with current `aria-checked` status, and dispatch click events to reach desired checked state.
- **FR-9.3**: Open Google Forms dropdown menus, locate option element matching LLM selection, trigger selection click, and close menu.
- **FR-9.4**: Populate date picker inputs and dispatch input/change events.
- **FR-9.5**: Apply visual green highlight animation to filled container blocks (radiogroups, checkbox groups, dropdown wrappers).

---

## Active Milestone Requirements (Universal Multi-Platform ATS Expansion)

### FR-12: Universal Smart DOM Reader & Field Extraction
- **FR-12.1**: Universal form element scanning across standard HTML5 forms (`<form>`), ARIA containers (`role="form"`), section wrappers, and dynamic page views.
- **FR-12.2**: Context-aware label resolution using priority cascade:
  1. `<label for="inputId">` association
  2. Wrapping parent `<label>` element
  3. Preceding heading/text element or fieldset `<legend>`
  4. Explicit `aria-label` or `aria-labelledby` referenced text
  5. Input `placeholder` or `name` fallback
- **FR-12.3**: Universal control type classification:
  - Text & Numeric: `input[type="text"]`, `email`, `tel`, `url`, `number`, `textarea`, `contenteditable`.
  - Dropdown / Select: native `<select>`, ARIA `role="combobox"`, `role="listbox"`, and custom UI select wrappers (React-Select, Material UI, Tailwind, Angular).
  - Radio Groups: `role="radiogroup"`, grouped `input[type="radio"]` by name attribute, and label/span choice items.
  - Checkbox Groups: `input[type="checkbox"]`, `role="checkbox"`, multi-select choice buttons.
  - Date Inputs: `input[type="date"]`, date pickers, compound month/day/year inputs.
  - File Upload: detect resume/CV file dropzones and annotate with upload metadata.
- **FR-12.4**: Smart option extraction: parse options from native `<option>`, ARIA `role="option"`, visible menus, data attributes, and sibling option lists.

### FR-13: Universal Multi-Origin Manifest & Navigation Architecture
- **FR-13.1**: Update extension `manifest.json` permissions (`activeTab`, `<all_urls>` or broad web match patterns) enabling form detection across any career portal.
- **FR-13.2**: Page & ATS platform detection: detect known ATS environments (Greenhouse, Lever, Workday, Taleo, Ashby, SmartRecruiters) and gracefully handle arbitrary company career sites.
- **FR-13.3**: Single-Page Application (SPA) navigation tracking: observe URL/route changes and multi-step application wizards without requiring manual page reload.
- **FR-13.4**: Iframe form discovery: identify and access embedded job application forms (e.g. embedded Greenhouse/Lever iframes) within parent career domains.

### FR-14: Universal Synthetic Form Filler & Control Simulators
- **FR-14.1**: Standard HTML5 element value setter and complete native event dispatch chain (`pointerdown`, `focus`, `input`, `change`, `blur`).
- **FR-14.2**: Universal custom dropdown simulator: click trigger, wait for options overlay/popover mount, seek matching option by text/value, fire click sequence, and verify close.
- **FR-14.3**: Universal radio button and checkbox reconciler: compare desired LLM state against current element state (`checked`, `aria-checked`) and dispatch coordinate-aware click sequence.
- **FR-14.4**: Workday dynamic component interaction: navigate nested custom components, search-in-dropdown fields, and trigger reactive change events.
- **FR-14.5**: Platform-agnostic visual feedback: apply non-intrusive green glow highlighting to filled elements across arbitrary CSS styles.

### FR-15: ATS Platform Heuristics & Adaptations
- **FR-15.1**: **Greenhouse Adapter**: seamless field extraction and filling on `boards.greenhouse.io` and embedded career widgets.
- **FR-15.2**: **Lever Adapter**: multi-section form support, personal info, custom question lists on `jobs.lever.co`.
- **FR-15.3**: **Workday Adapter**: complex dynamic wizard forms, multi-step progress, custom dropdown search boxes on `*.myworkdayjobs.com`.
- **FR-15.4**: Graceful error recovery: log unfillable or unsupported fields without crashing the active autofill cycle, returning detailed skipped/failure metrics.

### FR-16: Multi-Platform E2E Testing, Mock Fixtures & Verification
- **FR-16.1**: Monorepo mock form fixtures for Greenhouse, Lever, Workday, and generic HTML5 career applications.
- **FR-16.2**: Comprehensive Vitest test suite validating universal DOM extraction, synthetic filling, option matching, and error resilience.
- **FR-16.3**: Performance benchmark: scan and fill cycle completed in <10s for typical multi-field job applications.

---

## Non-Functional Requirements

### NFR-9: Platform Agnostic & Resilient
- Functions smoothly on any modern web form without requiring bespoke hardcoded selectors for every website domain.
- Heuristic fallback ensures generic forms are filled even if a site uses bespoke non-standard CSS frameworks.

### NFR-10: Non-Destructive & Safe
- Never overwrites user-entered data unless explicitly instructed.
- Does not trigger premature form submission or interfere with host application navigation buttons.

### NFR-11: Performance & Responsiveness
- Form DOM scanning executes in <200ms without blocking UI responsiveness.
- Synthetic interaction intervals remain low (<50ms) to ensure smooth filling.

### NFR-12: TypeScript & Test Coverage
- Strict TypeScript mode across shared, extension, and backend workspaces.
- Minimum 80% test coverage across all universal and platform-specific modules.

---

## User Stories

### US-6: Universal Multi-Platform Job Autofill
> As a job seeker applying on company career pages, Greenhouse, Lever, or Workday, I want AutoFiller to automatically scan and fill out the job application form regardless of what platform hosts it, so I can apply to jobs rapidly without manual copy-pasting.

### US-7: Robust Control & Option Handling on Complex ATS Forms
> As an applicant encountering complex dropdowns, radio groups, and multi-select checkboxes on an ATS portal, I want AutoFiller to accurately choose the matching options from my profile without getting stuck on custom dropdown wrappers.

---

## Retained Future Milestone Requirements (Milestone 3 / v1.2 & Beyond)

### FR-10: Multi-Profile Backend Store & Switching API [Deferred to Milestone 3]
- **FR-10.1**: Directory-based profile storage (`backend/profiles/*.json`) with default profile fallback (`default.json`).
- **FR-10.2**: Endpoint `GET /profiles` to list available profiles with metadata (ID, name, description).
- **FR-10.3**: Endpoint `POST /profiles/switch` (`{ profileId: string }`) to set the active profile.
- **FR-10.4**: `GET /profile` returns the currently active profile data.
- **FR-10.5**: Input validation and graceful fallback if a requested profile file is missing or invalid.

### FR-11: Extension Multi-Profile Switcher UI [Deferred to Milestone 3]
- **FR-11.1**: Add "Active Profile" selector dropdown to the extension popup header.
- **FR-11.2**: Auto-fetch profiles from `GET /profiles` on popup mount.
- **FR-11.3**: Persist active profile selection in Chrome local storage and sync with backend on change.
- **FR-11.4**: Display active profile name and log profile switch events to the Debug Log dashboard.

### US-5: Multi-Profile Persona Switching [Deferred to Milestone 3]
> As a candidate with multiple resumes (e.g., Full Stack Engineer vs. AI/ML Specialist), I want to switch profiles in the extension popup with one click so that my answers match the specific role I'm applying for.
