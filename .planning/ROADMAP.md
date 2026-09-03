# AutoFiller — Roadmap

## Completed Milestones

- **[Milestone 1: Production-Ready v1.0](milestones/v1.0-ROADMAP.md)** — Shipped 2026-09-03 (Phases 1–11, 71 tests passing, Audit: [v1.0-MILESTONE-AUDIT.md](v1.0-MILESTONE-AUDIT.md))

---

## Milestone 2: Advanced Form Controls & Multi-Profile (v1.1)

> Expanding form input coverage to Google Forms dropdowns, radio groups, checkboxes, and date pickers via synthetic DOM simulation, and introducing multi-profile persona management.

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
**Status**: `planned`  
**Scope**: Build synthetic interaction handlers in `formFiller.ts` to click radio buttons, toggle checkboxes according to LLM array values, open and select dropdown options, and inject date values.  
**Deliverables**:
- Radio button click and synthetic event dispatcher
- Checkbox toggle logic comparing `aria-checked` with desired state
- Dropdown opener, option seeker, and menu close handler
- Date input setter and change triggers
- Visual feedback styling for compound container elements
- Unit tests with mock DOM

### Phase 15: Multi-Profile Backend Store & Switching API
**Status**: `planned`  
**Scope**: Enable multiple persona profile JSON files in `backend/profiles/` with switching REST endpoints.  
**Deliverables**:
- `ProfileStore` refactored to support multiple profiles directory
- Default profile setup (`default.json`, `work.json`, etc.)
- `GET /profiles` endpoint listing available profiles
- `POST /profiles/switch` endpoint setting active profile ID
- `GET /profile` returns active profile data
- Unit tests for profile listing, switching, and error cases

### Phase 16: Extension Multi-Profile Switcher UI & Storage Sync
**Status**: `planned`  
**Scope**: Add profile switcher dropdown to extension popup UI, persist selection, and synchronize active profile with backend.  
**Deliverables**:
- "Profile" dropdown selector in extension popup
- Fetch profile list from backend on popup mount
- Persist active profile in Chrome storage and notify backend
- Profile change event logging in Debug Log Viewer
- Unit tests for popup profile switching logic

### Phase 17: Milestone 2 End-to-End Integration, Testing & Verification
**Status**: `planned`  
**Scope**: Full integration testing with mock complex Google Forms (text + radio + checkbox + dropdown + date), error handling, and performance validation.  
**Deliverables**:
- Comprehensive integration tests in extension and backend
- Mock complex Google Form fixture verifying end-to-end fill
- Performance timing assertions (<10s fill)
- Documentation and README updates

---

## Future Milestones (Post v1.1)

### Phase 18: Profile Editor UI (Web Dashboard)
**Status**: `future`  
**Scope**: Web-based visual profile editor served from backend (`GET /profile-ui`) for creating and editing persona profiles.

### Phase 19: Multi-Provider Forms
**Status**: `future`  
**Scope**: Extend DOM reader and filler beyond Google Forms to Typeform, JotForm, and Microsoft Forms.

### Phase 20: Chrome Web Store Publishing
**Status**: `future`  
**Scope**: Package extension, security review, store assets, and publish to Chrome Web Store.
