# Phase 16 Context: Universal Multi-Origin Manifest & Navigation Architecture

## Phase Summary
Phase 16 equips AutoFiller with universal web compatibility, allowing it to operate seamlessly across arbitrary corporate career portals, Applicant Tracking Systems (**Workday, Greenhouse, Lever**), and multi-step Single-Page Applications (SPAs). It expands Manifest V3 permissions and frame match patterns, establishes dynamic SPA route and mutation observation for multi-step form wizards, and enables embedded iframe form discovery.

---

## Core Objectives & Scope

1. **Manifest V3 Universal Permissions & Multi-Frame Registration**:
   - Update `extension/src/manifest.ts` with `all_frames: true` and universal `<all_urls>` match coverage.
   - Update extension description to reflect universal job application autofilling capabilities.
   - Ensure clean CSP compliance across all origins using the standalone IIFE bundle.

2. **Single-Page Application (SPA) Route & Wizard Navigation Tracker**:
   - Modern ATS applications (e.g. Workday multi-step wizards, React/Vue career portals) update form views without triggering browser reloads.
   - Implement an SPA navigation observer in the content script that tracks:
     - `history.pushState`, `history.replaceState`
     - `window.addEventListener('popstate')`, `window.addEventListener('hashchange')`
   - Provide a mutation observer that detects when new form steps or dynamic input containers mount into the DOM.

3. **Embedded Iframe Form Discovery**:
   - Embedded job boards (e.g. Greenhouse or Lever iframes on company career pages).
   - In top-frame: inspect accessible same-origin `<iframe>` documents for forms.
   - Across origins: leverage `all_frames: true` so the content script is actively injected into all frame contexts, enabling the background worker to coordinate multi-frame field discovery and filling.

4. **Observability & Diagnostics**:
   - Log active ATS platform name (`Google Forms`, `Greenhouse`, `Lever`, `Workday`, `Generic`) and frame context (`top-frame` vs `iframe[origin]`) in the Debug Log Viewer.
   - Provide clear telemetry when dynamic step transitions occur.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│ Chrome Tab (e.g. careers.company.com/apply)            │
│                                                        │
│  ┌────────────────────────┐  ┌───────────────────────┐ │
│  │ Top Frame ContentScript│  │ SPA Navigation Tracker│ │
│  │ (Universal Scanner)    │  │ (pushState / popstate)│ │
│  └───────────┬────────────┘  └───────────┬───────────┘ │
│              │                           │             │
│  ┌───────────┴───────────────────────────┴───────────┐ │
│  │ Embedded Iframe (<iframe src="boards.greenhouse">) │ │
│  │ ContentScript (all_frames: true)                  │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────────────────▲────────────────────────────┘
                            │ chrome.tabs.sendMessage
┌───────────────────────────┴────────────────────────────┐
│ Background Service Worker                              │
│ - Coordinates multi-frame scanning & fallback          │
│ - Logs detected platform & route transitions           │
└────────────────────────────────────────────────────────┘
```
