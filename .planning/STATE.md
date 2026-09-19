# AutoFiller — Project State

> Living document tracking project memory, decisions, and learnings.

## Current State

| Field | Value |
|---|---|
| **Milestone** | 2 — Universal Multi-Platform Form Filling Engine (v1.1) |
| **Current Phase** | 16 — Universal Multi-Origin Manifest & Navigation Architecture |
| **Next Phase** | 17 — Universal Form Filler & Multi-Platform Control Simulators |
| **Status** | Phase 15 completed — Universal DOM Reader & Smart Field Extraction Engine shipped. Greenhouse, Lever, Workday, and standard HTML5 support verified with 174/174 tests passing. |
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

## Patterns

- **Message passing**: Chrome extension messaging API (`chrome.runtime.sendMessage`, `chrome.tabs.sendMessage`) for popup ↔ background ↔ content script
- **HTTP gateway**: Background worker → backend server via `fetch()`
- **Provider pattern**: `LLMGateway` interface with `OllamaProvider` and `GeminiProvider` implementations
- **Dynamic script injection fallback**: Background service worker uses `chrome.scripting.executeScript` to inject content script on tabs opened prior to extension reload
- **Heuristic label resolution**: Cascade through explicit ARIA labels, `<label for="...">`, wrapping labels, fieldset legends, container headings, and clean placeholders
- **DOM order sorting**: Discovered fields sorted by live DOM `compareDocumentPosition` to ensure visual top-to-bottom sequence across arbitrary HTML layouts

## Surprises / Gotchas

- **Google Forms Content Security Policy (CSP)**: `docs.google.com` enforces strict `script-src` CSP directives. Default Vite/CRXJS content script builds use an async loader (`await import(chrome.runtime.getURL(...))`) which is blocked by the host page's CSP. Renaming to `contentScript.iife.ts` instructs CRXJS to inline all dependencies into a standalone IIFE bundle, completely bypassing dynamic imports and CSP restrictions.
- **Matrix Grid Rows vs Parent Headings**: An element's explicit `aria-label` or `aria-labelledby` on itself must precede ancestor container headings, otherwise multi-choice grid rows inherit the table title instead of their respective row names.

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
