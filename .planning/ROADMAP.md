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
**Status**: `planned`  
**Scope**: Build a platform-agnostic DOM reader that detects form fields across standard HTML5 forms, ARIA containers, and custom career page layouts, intelligently resolving labels, field types, and options.  
**Deliverables**:
- Heuristic label resolution engine (associated `<label>`, parent wrapping, preceding text/legend, `aria-label`, placeholder)
- Comprehensive control-type classifier (`text`, `select`, `combobox`, `radio`, `checkbox`, `date`, `file`)
- Universal option extractor for native `<select>`, ARIA listboxes, and custom dropdown menus
- Structured `FieldMetadata` extraction on arbitrary web forms
- Unit test suite with varied DOM layout fixtures

### Phase 16: Universal Multi-Origin Manifest & Navigation Architecture
**Status**: `planned`  
**Scope**: Adapt extension manifest, permissions, and service worker lifecycle to support universal form filling across all career portals and dynamic Single-Page Applications.  
**Deliverables**:
- Manifest V3 permission expansion (`activeTab`, `<all_urls>` / host permissions)
- Platform & ATS environment detection (Greenhouse, Lever, Workday, generic)
- SPA route and page mutation observer to detect dynamic form step transitions
- Iframe discovery to access embedded career forms
- Unit tests for platform detection and lifecycle handlers

### Phase 17: Universal Form Filler & Multi-Platform Control Simulators
**Status**: `planned`  
**Scope**: Generalize synthetic interaction engine to accurately fill and trigger events on any web control, from standard inputs to complex custom comboboxes, custom radios, and checkboxes.  
**Deliverables**:
- Universal native element injector with complete event dispatch (`focus`, `input`, `change`, `blur`)
- Custom UI select/combobox simulator (trigger click, option seekers, popover settlement, close)
- Universal radio & checkbox state reconcilers
- Non-intrusive green glow visual confirmation overlay across varied CSS styles
- Unit tests for universal control simulators

### Phase 18: ATS Platform Heuristics & Adaptations (Greenhouse, Lever, Workday)
**Status**: `planned`  
**Scope**: Specialized heuristics and edge case handling for the most prevalent ATS portals: Greenhouse, Lever, and Workday.  
**Deliverables**:
- Greenhouse adapter: personal details, resume upload annotation, custom question blocks
- Lever adapter: multi-section layout, personal data, demographic radio buttons
- Workday adapter: dynamic multi-step wizard, custom dropdown search boxes, shadow DOM traversal
- Graceful error recovery and skipped field telemetry
- Unit tests for platform adapters

### Phase 19: Multi-Platform E2E Testing, Mock Fixtures & Verification
**Status**: `planned`  
**Scope**: Comprehensive end-to-end testing with realistic mock forms representing Greenhouse, Lever, Workday, and generic career pages.  
**Deliverables**:
- Mock HTML fixtures for Greenhouse, Lever, Workday, and standard HTML5 career forms
- Automated E2E verification tests executing scan → LLM map → fill cycles
- Latency and performance benchmarking (<10s fill time)
- Verification report and milestone documentation

---

## Future Milestones (Post v1.1)

### Phase 20: Multi-Profile Backend Store & Switching API
**Status**: `future`  
**Scope**: Enable multiple persona profile JSON files in `backend/profiles/` with switching REST endpoints (`GET /profiles`, `POST /profiles/switch`, `GET /profile`).

### Phase 21: Extension Multi-Profile Switcher UI & Storage Sync
**Status**: `future`  
**Scope**: Add profile switcher dropdown to extension popup UI, persist selection in Chrome storage, and synchronize active profile with backend.

### Phase 22: Profile Editor UI (Web Dashboard)
**Status**: `future`  
**Scope**: Web-based visual profile editor served from backend (`GET /profile-ui`) for creating, editing, and previewing persona profiles.

### Phase 23: Chrome Web Store Publishing & Security Review
**Status**: `future`  
**Scope**: Security hardening, packaging, manifest audit, store listing assets, and Chrome Web Store submission.
