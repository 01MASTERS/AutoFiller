# AutoFiller — Roadmap

## Completed Milestones

- **[Milestone 1: Production-Ready v1.0](milestones/v1.0-ROADMAP.md)** — Shipped 2026-09-03 (Phases 1–11, 71 tests passing, Audit: [v1.0-MILESTONE-AUDIT.md](v1.0-MILESTONE-AUDIT.md))

---

## Milestone 2: Advanced Form Elements & Multi-Profile (v1.1)

> Expanding form input coverage beyond text fields, adding complex interaction support, and introducing multi-profile persona management.

### Phase 12: Advanced Form Elements (Playwright Integration)
**Status**: `ready`  
**Scope**: Integrate Playwright / synthetic DOM dispatch to handle dropdowns (`select`), checkboxes, radio buttons, and date pickers — simulating human-like interaction.

### Phase 13: Multi-Profile Support
**Status**: `planned`  
**Scope**: Support multiple user profiles with a profile switcher in the popup and backend storage.

### Phase 14: Profile Editor UI
**Status**: `planned`  
**Scope**: Web-based profile editor served from the backend (`GET /profile-ui`).

### Phase 15: Multi-Provider Forms
**Status**: `planned`  
**Scope**: Extend DOM reader and filler beyond Google Forms to Typeform, JotForm, and Microsoft Forms.

### Phase 16: Chrome Web Store Publishing
**Status**: `planned`  
**Scope**: Package, security review, store assets, and publish to Chrome Web Store.
