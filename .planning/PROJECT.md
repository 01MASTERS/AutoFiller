# AutoFiller

> A Chrome extension that auto-fills Google Forms using an LLM-powered field-matching engine. Users enable autofill from a popup UI; the extension analyzes form fields, matches them against a stored user profile, and fills inputs intelligently.

## Project Identity

| Field | Value |
|---|---|
| **Name** | AutoFiller |
| **Type** | Chrome Extension (Manifest V3) |
| **Language** | TypeScript (latest stable) |
| **Repository** | https://github.com/01MASTERS/AutoFiller.git |
| **Owner** | 01MASTERS |
| **Status** | Milestone 2 (v1.1) — Universal Multi-Platform ATS Expansion |

## Current State

AutoFiller v1.0 was completed and shipped on 2026-09-03. Google Forms advanced controls (dropdowns, radio buttons, checkboxes, dates) were implemented and verified in Phases 12–14.
- **Shipped Version:** v1.0
- **Milestone 1 Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- **Milestone 1 Audit:** [v1.0-MILESTONE-AUDIT.md](v1.0-MILESTONE-AUDIT.md)
- **Active Test Suite:** 160 tests passing across extension (88) and backend (72)
- **Core Capabilities:** Intelligent form autofilling with Ollama & Gemini, dynamic model discovery, Google Forms advanced controls (dropdowns, radios, checkboxes, dates) with genuine DOM simulation, standalone IIFE content script, and dark-mode debug log viewer (`/logs-ui`).

## Milestone 2 Goals: Universal Multi-Platform Form Filling Engine (v1.1)

- **Goal:** Expand AutoFiller from Google Forms into a universal form-filling engine supporting diverse job applications and ATS platforms (including Workday, Greenhouse, Lever, company career portals, and generic web forms) with smart field detection and synthetic interaction.
- **Phase 12:** Advanced Google Form DOM Extraction & Option Parsing (Completed)
- **Phase 13:** LLM Gateway Enhancement for Constrained & Choice Fields (Completed)
- **Phase 14:** Content Script Advanced Form Filler (Synthetic DOM Interaction) (Completed)
- **Phase 15:** Universal DOM Reader & Smart Field Extraction Engine (Planned)
- **Phase 16:** Universal Multi-Origin Manifest & Navigation Architecture (Planned)
- **Phase 17:** Universal Form Filler & Multi-Platform Control Simulators (Planned)
- **Phase 18:** ATS Platform Heuristics & Adaptations (Workday, Greenhouse, Lever) (Planned)
- **Phase 19:** Multi-Platform E2E Testing, Mock Fixtures & Verification (Planned)
- **Future Milestones:** Multi-Profile Persona Management (Phases 20–21), Profile Editor UI (Phase 22), Chrome Web Store Publishing (Phase 23)

## Problem Statement

Filling out Google Forms repeatedly (especially for job applications) is tedious and error-prone. Existing auto-fill solutions don't use AI to understand field context, leading to mismatches between profile data and form fields.

## Solution

A Chrome extension with:
1. **Popup UI** — Toggle autofill on/off, view status, configure settings
2. **LLM-Powered Field Matching** — Uses an LLM to analyze form field labels/context and determine which profile data maps to which field
3. **Dual LLM Support** — Local (Ollama, any model) as default, cloud (Gemini) as alternative
4. **Backend Profile Server** — A small local Node.js server that stores the user profile and serves it via API to the extension

## Target Users

- **Primary**: Job seekers filling out many Google Forms application forms
- **Secondary**: Anyone who repeatedly fills Google Forms with the same personal data

## Architecture

```
┌─────────────────────────────┐
│   Chrome Extension (MV3)    │
│  ┌───────────┐ ┌──────────┐ │
│  │  Popup UI │ │ Content  │ │
│  │ (toggle,  │ │  Script  │ │
│  │  status)  │ │ (DOM     │ │
│  └─────┬─────┘ │  reader  │ │
│        │       │  + filler)│ │
│  ┌─────┴─────┐ └────┬─────┘ │
│  │Background │      │       │
│  │  Worker   │◄─────┘       │
│  │(orchestr.)│              │
│  └─────┬─────┘              │
└────────┼────────────────────┘
         │ HTTP
┌────────▼────────────────────┐
│   Local Backend (Node.js)   │
│  ┌──────────┐ ┌───────────┐ │
│  │ Profile  │ │   LLM     │ │
│  │  Store   │ │  Gateway  │ │
│  │ (JSON)   │ │(Ollama/   │ │
│  │          │ │ Gemini)   │ │
│  └──────────┘ └───────────┘ │
└─────────────────────────────┘
```

### Component Breakdown

| Component | Role | Tech |
|---|---|---|
| **Popup UI** | Toggle autofill, show status, LLM config | HTML + CSS + TypeScript |
| **Content Script** | Read Google Form DOM, extract field metadata, fill values | TypeScript |
| **Background Worker** | Service worker; orchestrates content script ↔ backend communication | TypeScript (Service Worker) |
| **Backend Server** | Serves profile data, proxies LLM calls, returns field→value mappings | Node.js + Express + TypeScript |
| **Profile Store** | Hard-coded user profile (JSON file on disk) | JSON |
| **LLM Gateway** | Unified interface to Ollama (local) and Gemini (cloud) | TypeScript |

## Key Decisions

### ADR-001: Profile Storage — Local Backend Server

**Decision**: Store profile data in a JSON file served by a local Node.js backend, NOT in Chrome storage or bundled with the extension.

**Rationale**:
- **Separation of concerns** — Profile data is decoupled from the extension, making it easy to update without reloading the extension
- **Security** — Sensitive data never enters Chrome's sync storage or gets uploaded to Google's servers
- **Extensibility** — The backend can later support multiple profiles, database storage, profile editing UI
- **LLM proximity** — The backend can call Ollama locally without CORS issues; the extension just makes one HTTP call
- **Testing** — Backend API is independently testable

**Trade-offs**:
- Requires a local server running (acceptable for personal use)
- Slightly more complex setup than Chrome storage
- Not portable across devices without running the server

### ADR-002: LLM Strategy — Dual Provider with Ollama Default

**Decision**: Support both Ollama (local, default) and Gemini (cloud) for field matching.

**Rationale**:
- Ollama = free, private, works offline
- Gemini = higher quality for complex forms, requires API key
- Configurable from the popup UI

### ADR-003: Google Forms Only (v1.0)

**Decision**: Target only Google Forms in v1.0. Text input fields only.

**Rationale**:
- Google Forms has a consistent DOM structure — easier to parse reliably
- Dropdowns, checkboxes, and radio buttons are deferred to a future Playwright-based phase
- Focused scope = higher quality v1.0

### ADR-004: Manifest V3

**Decision**: Use Chrome Manifest V3 (not V2).

**Rationale**:
- V2 is deprecated and will be removed
- V3 uses service workers (better performance, security)
- Future-proof

### ADR-009: In-Browser DOM Simulation for Advanced Form Controls (v1.1)

**Decision**: Automate dropdowns, radio groups, checkboxes, and date pickers directly inside the content script using synthetic mouse/keyboard events and ARIA state manipulation, avoiding external headless browser processes (Playwright).

**Rationale**:
- **Lightweight & Fast**: Zero extra runtime dependencies; no headless Chromium binaries to install or run.
- **Context Preservation**: Operates directly in the user's active session and tab.
- **Security & Simplicity**: No external Node child processes or WebSocket automation servers needed.

### ADR-010: Multi-Profile File Store Architecture (v1.1)

**Decision**: Store user profiles in dedicated files (e.g. `profiles/default.json`, `profiles/work.json`) with an `activeProfileId` setting in `ProfileStore`.

**Rationale**:
- **Modularity**: Users can inspect and edit separate persona JSON files directly.
- **Reliability**: Profile corruption in one file does not affect others.
- **Seamless Switching**: Popup can switch active profiles instantly via REST endpoint `POST /profiles/switch`.

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Extension | Chrome Manifest V3 | - |
| Language | TypeScript | ~5.x (latest stable) |
| Bundler | Vite (with CRXJS or rollup-plugin-chrome-extension) | latest |
| Backend | Node.js + Express | Node 20 LTS, Express 5.x |
| LLM (Local) | Ollama HTTP API | latest |
| LLM (Cloud) | Google Gemini API (@google/generative-ai) | latest |
| Testing | Vitest (unit) + Playwright (E2E, future) | latest |
| Linting | ESLint + Prettier | latest |

## Scope Boundaries

### In Scope (v1.0)
- [x] Chrome extension with popup UI (toggle, status, LLM selector)
- [x] Content script that reads Google Form text input fields
- [x] Background service worker for orchestration
- [x] Local Node.js backend with profile JSON + LLM gateway
- [x] Ollama integration (local LLM, default)
- [x] Gemini integration (cloud LLM, configurable)
- [x] LLM-powered field-to-profile matching
- [x] Auto-fill text input fields on Google Forms
- [x] Unit tests + integration tests
- [x] Production-ready code quality

### Out of Scope (Future)
- [ ] Dropdowns, checkboxes, radio buttons, date pickers
- [ ] Playwright-based human-like form interaction
- [ ] Multi-profile support
- [ ] Profile editing UI
- [ ] Other form providers (Typeform, JotForm, etc.)
- [ ] Chrome Web Store publishing
- [ ] Cloud-hosted backend

## Constraints

- **Privacy**: All profile data stays local. No telemetry.
- **Performance**: Auto-fill should complete within 5 seconds of user trigger.
- **Reliability**: Graceful degradation if LLM is unavailable (show error in popup).
- **Compatibility**: Chrome 120+ (Manifest V3 baseline).

## Non-Functional Requirements

- **Code Quality**: TypeScript strict mode, ESLint, Prettier
- **Documentation**: README with setup instructions, architecture diagram
- **Testing**: >80% unit test coverage on backend + LLM gateway
- **Error Handling**: All LLM calls wrapped with timeout + retry + fallback messaging
