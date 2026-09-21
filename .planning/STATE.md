# AutoFiller — Project State

> Living document tracking project memory, decisions, and learnings.

## Current State

| Field | Value |
|---|---|
| **Milestone** | 3 — Multi-Profile Support & Publishing (v1.2) [IN PROGRESS] |
| **Current Phase** | Phase 22: Profile Editor UI (Web Dashboard) [COMPLETED] |
| **Next Phase** | Phase 23: Chrome Web Store Publishing & Security Review |
| **Status** | Phase 22 complete — Web-based visual profile editor dashboard served from backend (`GET /profile-ui` & `GET /profiles-ui`) with dual Visual Form & Raw JSON editors, persona switching/creation modal, delete safety guards, and extension popup launcher button (`#open-profile-editor-btn`). 241/241 monorepo tests passing. Clean production build. Ready for Phase 23. |
| **Last Updated** | 2026-09-19 |

## Decision Log

| # | Decision | Rationale | Date |
|---|---|---|---|
| ADR-001 | Profile stored in local backend (JSON file + Node.js server) | Security, extensibility, LLM proximity, testability | 2026-08-13 |
| ADR-002 | Dual LLM: Ollama (default) + Gemini (cloud) | Free local + quality cloud fallback | 2026-08-13 |
| ADR-003 | Google Forms only in v1.0, text inputs only | Focused scope, consistent DOM | 2026-08-13 |
| ADR-004 | Manifest V3 | V2 deprecated, service workers, future-proof | 2026-08-13 |
| ADR-005 | TypeScript strict mode | Type safety, better LLM code gen, catch bugs early | 2026-08-13 |
| ADR-006 | Vite bundler for extension | Fast builds, good Chrome extension plugin support | 2026-08-13 |
| ADR-007 | Vitest for testing | Fast, Vite-compatible, modern | 2026-08-13 |
| ADR-008 | Popup UI (not side panel) | Simpler UX, standard Chrome extension pattern | 2026-08-13 |
| ADR-009 | In-Browser DOM Simulation for Advanced Controls (v1.1) | Zero external processes; fast, native event dispatch in active tab | 2026-09-03 |
| ADR-010 | Multi-Profile File Store Architecture (v1.2) | Modular persona JSON files with instant REST switching (deferred to Milestone 3) | 2026-09-03 |
| ADR-011 | Standalone IIFE Content Script (`.iife.ts`) | Google Forms CSP blocks dynamic imports (`import()`) in ESM content script loaders | 2026-09-03 |
| ADR-012 | Universal Multi-Platform Expansion for v1.1 | Expand AutoFiller beyond Google Forms into a universal form-filling engine (Workday, Greenhouse, Lever, career portals) | 2026-09-19 |
| ADR-013 | Heuristic Label Resolution Cascade & DOM Order Sorting | Resolve labels via explicit ARIA $\to$ label[for] $\to$ wrapping $\to$ legend $\to$ container headings; sort fields by compareDocumentPosition | 2026-09-19 |
| ADR-014 | Manifest V3 Multi-Frame (`all_frames: true`) & SPA Route Observation | Enable content script in cross-origin ATS iframes; intercept pushState/popstate and observe dynamic form mutations for multi-step wizards | 2026-09-19 |
| ADR-015 | Modular Universal Form Filler Engine & Full Lifecycle Event Dispatch | Decompose interaction engine into dedicated simulators; dispatch complete focus $\to$ prototype setter $\to$ input $\to$ change $\to$ blur sequence across standard, rich text, and custom controls | 2026-09-19 |
| ADR-016 | Platform Heuristic Adapters as Post-Scan Refinement Passes | Keep generic DOM reader clean and universal; run specialized ATS heuristics (Greenhouse, Lever, Workday) only on recognized domains | 2026-09-19 |
| ADR-017 | Multi-Platform Mock Form Fixtures & Interactive QA Hub | Reusable mock HTML fixtures in `@autofiller/shared` served via backend `GET /test-forms` for automated Vitest E2E regression and live browser QA | 2026-09-19 |
| ADR-018 | Multi-Profile Directory Store with Pointer File & Dual Mirroring | Store personas in `backend/profiles/*.json` with `.active` file; mirror changes to legacy `profile.json` to guarantee zero data loss and external tool compatibility | 2026-09-19 |
| ADR-019 | Popup Multi-Profile Switcher with Resilient Local Cache & Autofill Forwarding | Persist persona summaries in `chrome.storage.local` to enable instant offline rendering; pass active `profileId` through background worker to `/autofill` | 2026-09-19 |
| ADR-020 | Dedicated Backend HTML Generator for Profile Editor Dashboard | Keep backend routes clean by delegating HTML generation to a dedicated module (`profileUiHtml.ts`); consume existing Phase 20 REST endpoints client-side for zero backend architectural friction | 2026-09-19 |

## Patterns

- **Message passing**: Chrome extension messaging API (`chrome.runtime.sendMessage`, `chrome.tabs.sendMessage`) for popup ↔ background ↔ content script
- **HTTP gateway**: Background worker → backend server via `fetch()`
- **Provider pattern**: `LLMGateway` interface with `OllamaProvider` and `GeminiProvider` implementations
- **Dynamic script injection fallback**: Background service worker uses `chrome.scripting.executeScript` to inject content script on tabs opened prior to extension reload
- **Heuristic label resolution**: Cascade through explicit ARIA labels, `<label for="...">`, wrapping labels, fieldset legends, container headings, and clean placeholders
- **DOM order sorting**: Discovered fields sorted by live DOM `compareDocumentPosition` to ensure visual top-to-bottom sequence across arbitrary HTML layouts
- **SPA route observation**: Monkey-patched `history.pushState` and `history.replaceState` coupled with `popstate`/`hashchange` to detect single-page application view transitions without full page reloads
- **Platform adapter pipeline**: Modulates discovered fields via lightweight signatures (`isGreenhousePage`, `isLeverPage`, `isWorkdayPage`) without coupling core scanner to vendor DOM structures

## Surprises / Gotchas

- **Google Forms Content Security Policy (CSP)**: `docs.google.com` enforces strict `script-src` CSP directives. Default Vite/CRXJS content script builds use an async loader (`await import(chrome.runtime.getURL(...))`) which is blocked by the host page's CSP. Renaming to `contentScript.iife.ts` instructs CRXJS to inline all dependencies into a standalone IIFE bundle, completely bypassing dynamic imports and CSP restrictions.
- **Matrix Grid Rows vs Parent Headings**: An element's explicit `aria-label` or `aria-labelledby` on itself must precede ancestor container headings, otherwise multi-choice grid rows inherit the table title instead of their respective row names.
- **Embedded Job Widgets (Iframes)**: Many career pages (e.g. `careers.company.com`) embed Greenhouse or Lever forms inside `<iframe>` elements. Setting `all_frames: true` in the manifest ensures the extension content script runs directly inside the child frame context.
- **JSDOM `CSS.escape` Absence**: In Node/JSDOM environments, `window.CSS.escape` is undefined. Using native `CSS.escape` crashes unit tests with `ReferenceError`. An `escapeCss` utility with character-by-character regex fallback is required.
- **Base ID Precedence**: Control scanners prioritize `name` attribute over `id` attribute when creating `field.id`. Adapters and test fixtures targeting compound fields must check both `f.id` and `f.name`.

## Quick Tasks Completed

| Task | Description | Date | Status |
|---|---|---|---|
| `detailed-llm-form-logs` | Detailed LLM response mappings & filled form field values added to backend/extension logs & Debug Dashboard | 2026-08-13 | complete ✓ |
| `log-expand-collapse-ui` | Right-aligned expand chevron icon (▼ / ▲) for long messages and JSON details in Debug Log Dashboard | 2026-08-13 | complete ✓ |
| `field-formatting-constraints` | Explicit field formatting & constraint handling rules added to prompt builder (phone 10-digit stripping, name splitting, format matching) | 2026-09-02 | complete ✓ |
| `logs-ui-scroll-reset-fix` | Fix automatic scroll reset in expanded log details caused by 3s polling re-renders | 2026-09-02 | complete ✓ |
| `rich-debug-logging` | Comprehensive debug diagnostics for API quota (429), auth, unmapped fields, and DOM fill failure reasons | 2026-09-02 | complete ✓ |
| `popup-error-brevity` | Format and truncate UI popup errors into brief summaries and preserve verbose stack traces in logs page only | 2026-09-02 | complete ✓ |
| `content-script-csp-iife-fix` | Fix content script blocked by Google Forms CSP by compiling to standalone IIFE (`.iife.ts`) and adding dynamic injection fallback in background worker | 2026-09-03 | complete ✓ |
| `dropdown-options-and-selection-fix` | Extract options from closed Google Forms dropdowns, show options in logs, relay content script logs, and simulate full pointerdown/mousedown/mouseup/click sequence for reliable selection | 2026-09-03 | complete ✓ |
| `dropdown-options-selection-fix` | Fix dropdown genuine selection via trigger resolution, coordinate-aware clicks, hover simulation, and reactive settlement; eliminate fake forced insertion | 2026-09-06 | complete ✓ |

## Open Questions

_(None — all initial questions resolved during milestone setup)_
