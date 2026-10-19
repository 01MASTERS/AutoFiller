# AutoFiller — Roadmap

## Completed Milestones

- **[Milestone 1: Production-Ready v1.0](milestones/v1.0-ROADMAP.md)** — Shipped 2026-09-03 (Phases 1–11, 71 tests passing, Audit: [v1.0-MILESTONE-AUDIT.md](v1.0-MILESTONE-AUDIT.md))

---

## Milestone 2: Universal Multi-Platform Form Filling Engine (v1.1)

> Expanding AutoFiller beyond Google Forms into a universal form-filling engine supporting diverse job applications and ATS platforms (including Workday, Greenhouse, Lever, company career portals, and generic web forms) with smart field detection and synthetic DOM simulation.

### Phase 12: Advanced Google Form DOM Extraction & Option Parsing

**Status**: `completed`  
**Scope**: Enhance DOM reader to scan dropdowns (`role="listbox"` / `<select>`), single-select radio groups (`role="radiogroup"` / `role="radio"`), multi-select checkboxes (`role="checkbox"`), and date pickers (`input[type="date"]`). Extract choices into `FieldMetadata.options`.  
**Deliverables**:

- Extended `FieldMetadata` in `@autofiller/shared` with `controlType` and `options?: string[]`
- Enhanced `domReader.ts` to traverse Google Forms compound containers
- Option extraction logic parsing aria-labels, text spans, and data attributes
- Unit tests with mock DOM structures for radios, checkboxes, and dropdowns

### Phase 13: LLM Gateway Enhancement for Constrained & Choice Fields

**Status**: `completed`  
**Scope**: Extend prompt builder and response parser to handle discrete choice constraints, array outputs for multi-select checkboxes, and date formatting.  
**Deliverables**:

- Extended prompt instructions enforcing valid option selection
- Checkbox array-mapping support (`Record<string, string | string[]>`)
- Date formatting alignment with profile date fields
- Strict option validation in response parser
- Unit tests for single-choice and multi-choice field matching

### Phase 14: Content Script Advanced Form Filler (Synthetic DOM Interaction)

**Status**: `completed`  
**Scope**: Build synthetic interaction handlers in `formFiller.ts` to click radio buttons, toggle checkboxes according to LLM array values, open and select dropdown options, and inject date values.  
**Deliverables**:

- Control-type dispatch architecture with 6 handlers (text, radio, checkbox, dropdown, combobox, date)
- Radio button click and synthetic event dispatcher
- Checkbox toggle logic comparing `aria-checked` with desired state
- Dropdown opener, option seeker, and menu close handler (native + ARIA)
- Date input setter and change triggers
- Visual feedback styling for compound container elements
- Type-safety guards with skipped-field tracking (`FillResult.skippedCount`)
- Backward-compatible fallback for fields without metadata
- 20 unit tests covering all control types, type mismatches, and mixed-field scenarios

### Phase 15: Universal DOM Reader & Smart Field Extraction Engine

**Status**: `completed`  
**Scope**: Build a platform-agnostic DOM reader that detects form fields across standard HTML5 forms, ARIA containers, and custom career page layouts, intelligently resolving labels, field types, and options.  
**Deliverables**:

- Heuristic label resolution engine (associated `<label>`, parent wrapping, preceding text/legend, `aria-label`, placeholder)
- Comprehensive control-type classifier (`text`, `select`, `combobox`, `radio`, `checkbox`, `date`, `file`)
- Universal option extractor for native `<select>`, ARIA listboxes, and custom dropdown menus
- Structured `FieldMetadata` extraction on arbitrary web forms
- Unit test suite with varied DOM layout fixtures (14 new tests, 102 total extension tests)

### Phase 16: Universal Multi-Origin Manifest & Navigation Architecture

**Status**: `completed`  
**Scope**: Adapt extension manifest, permissions, and service worker lifecycle to support universal form filling across all career portals and dynamic Single-Page Applications.  
**Deliverables**:

- Manifest V3 permission expansion (`all_frames: true`, `run_at: 'document_idle'`, `<all_urls>` / host permissions)
- Platform & ATS environment detection (Greenhouse, Lever, Workday, generic)
- SPA route and page mutation observer to detect dynamic form step transitions (`navigationObserver.ts`)
- Iframe discovery to access embedded career forms (`iframeDiscovery.ts`)
- Unit tests for platform detection and lifecycle handlers (9 new tests, 111 total extension tests)

### Phase 17: Universal Form Filler & Multi-Platform Control Simulators

**Status**: `completed`  
**Scope**: Generalize synthetic interaction engine to accurately fill and trigger events on any web control, from standard inputs to complex custom comboboxes, custom radios, and checkboxes.  
**Deliverables**:

- Universal native element injector with complete event dispatch (`focus`, `input`, `change`, `blur`)
- Custom UI select/combobox simulator (trigger click, option seekers, popover settlement, close)
- Universal radio & checkbox state reconcilers
- Non-intrusive green glow visual confirmation overlay across varied CSS styles
- Unit tests for universal control simulators (11 new tests, 122 total extension tests, 194 monorepo tests)

### Phase 18: ATS Platform Heuristics & Adaptations (Greenhouse, Lever, Workday)

**Status**: `completed`  
**Scope**: Specialized heuristics and edge case handling for the most prevalent ATS portals: Greenhouse, Lever, and Workday.  
**Deliverables**:

- Greenhouse adapter: personal details, social links, resume upload annotation, Chosen/Select2 synchronization, demographic surveys
- Lever adapter: multi-section layout (`.section-candidate-wrapper`, `.section-links-wrapper`), single full name unpacking, bracketed social links, custom question cards, demographic surveys
- Workday adapter: multi-step wizard step detection, compound personal details, prompt combobox buttons, shadow DOM piercing
- Post-scan integration pipeline in `fieldDiscovery.ts` without mutating generic DOM reader functionality
- Graceful error recovery and skipped field telemetry (`resume_upload` user guidance)
- Unit tests for platform adapters (5 test suites, 127 total extension tests, 199 monorepo tests)

### Phase 19: Multi-Platform E2E Testing, Mock Fixtures & Verification

**Status**: `completed`  
**Scope**: Comprehensive end-to-end testing with realistic mock forms representing Greenhouse, Lever, Workday, and generic career pages.  
**Deliverables**:

- Mock HTML fixtures for Greenhouse, Lever, Workday, Generic Career, and Google Forms (`shared/src/fixtures/mockForms.ts`)
- Backend Test Forms Hub (`GET /test-forms`) and live QA endpoints (`/test-forms/greenhouse`, `/test-forms/lever`, `/test-forms/workday`, `/test-forms/career`)
- Automated E2E verification tests executing scan → LLM map → fill cycles (`e2eUniversalAutofill.test.ts`, 10 tests)
- Latency and performance benchmarking (<200ms scan, <50ms fill per field, <10s total)
- Complete Milestone 2 verification report (215/215 monorepo tests passing)


---

## Future Milestones (Post v1.1)

### Phase 20: Multi-Profile Backend Store & Switching API

**Status**: `completed` (2026-09-19)  
**Scope**: Enable multiple persona profile JSON files in `backend/profiles/` with switching REST endpoints (`GET /profiles`, `POST /profiles/switch`, `GET /profile`, `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id`).
**Deliverables**:

- Multi-profile directory manager (`ProfileStore`) with `.active` pointer file tracking and legacy fallback
- Persona starter seeds (`default.json`, `product-manager.json`, `data-scientist.json`)
- REST endpoints for profile CRUD and active profile switching with audit logging
- Wired `profileId` override into `POST /autofill`
- Full backend integration test coverage (16 tests, 229/229 monorepo tests passing)

### Phase 21: Extension Multi-Profile Switcher UI & Storage Sync

**Status**: `completed` (2026-09-19)  
**Scope**: Add profile switcher dropdown to extension popup UI, persist selection in Chrome storage, and synchronize active profile with backend.
**Deliverables**:

- Interactive popup persona switcher dropdown (`#profile-select`) with live headline and email preview
- Status sync badge ("Loaded", "Cached", "Offline") and manual refresh button (`#refresh-profiles-btn`)
- Chrome storage persistence and resilient offline caching (`chrome.storage.local`)
- Persona selection forwarding in background autofill pipeline (`TRIGGER_AUTOFILL` $\to$ backend `POST /autofill`)
- Full test coverage for popup UI and background worker (144 extension tests, 236/236 monorepo tests passing)

### Phase 22: Profile Editor UI (Web Dashboard)

**Status**: `completed` (2026-09-19)  
**Scope**: Web-based visual profile editor served from backend (`GET /profile-ui` and alias `GET /profiles-ui`) for inspecting, creating, editing, and previewing persona profiles.
**Deliverables**:

- Interactive web dashboard UI (`backend/src/routes/profileUiHtml.ts`) with Google Fonts, glassmorphism, responsive two-column workspace
- Sidebar persona list with live search filtering, active badge, and "+ New" persona launcher
- Dual view modes: Visual Form (personal, headline, work exp, edu, skills chips, links, custom QA) & Raw JSON (format, copy, syntax error check)
- Backend route registration (`GET /profile-ui`, `GET /profiles-ui`) and automated supertest coverage (3 tests, 95 backend tests total)
- Extension popup launcher button (`#open-profile-editor-btn`) with test coverage (146 extension tests total, 241/241 monorepo tests passing)

### Phase 23: Chrome Web Store Publishing & Security Review

**Status**: `future`  
**Scope**: Security hardening, packaging, manifest audit, store listing assets, and Chrome Web Store submission.

### Phase 24: Dynamic Backend Option Detection & Handling for Selects and MCQs

**Status**: `completed` (2026-09-29)  
**Depends on**: Phase 17, Phase 18  
**Scope**: Identify, classify, and handle form fields (native `<select>`, ARIA listboxes, comboboxes, and MCQ radio/checkbox groups) whose options are fetched asynchronously from backend APIs or lazy-loaded on interaction, differentiating them from hardcoded static options and resolving cascading dependencies (such as Country $\to$ State/Region, dynamic search comboboxes).  
**Deliverables**:

- Extended `FieldMetadata` schema in `@autofiller/shared` with `optionSource?: 'static' | 'dynamic' | 'cascading'`, `parentFieldId?: string`, and `optionsLoaded?: boolean`
- Smart heuristic classifier in `domReader/` distinguishing static vs backend-fetched options (via DOM emptiness, placeholder checks, `aria-busy`, remote data attributes, and async combobox traits)
- Cascading field relationship analyzer detecting parent-child dependencies (e.g. Country code $\to$ State/Province, Industry $\to$ Sub-industry)
- Dynamic Option Prober & Mutation Settler in `domReader/` & `formFiller/` that simulates focus/activation, monitors DOM mutations, and settles dynamic backend option lists
- Two-pass / dependency-aware fill execution in `formFiller.ts` ensuring upstream trigger fields are filled and settled before downstream dynamic fields are resolved
- Vitest unit tests & E2E mock fixtures simulating remote API option fetching and cascading dropdown interactions

**Plans**: 3 plans in 3 waves

- [x] 24-01: Shared Schema Extensions & Static vs. Dynamic Option Classification
- [x] 24-02: Dynamic Option Probing & Mutation Settlement Engine
- [x] 24-03: Dependency-Aware Topological Form Filling & JIT Resolution


