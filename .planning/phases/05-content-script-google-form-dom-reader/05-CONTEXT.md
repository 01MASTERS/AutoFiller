# Phase 5 Context — Content Script (Google Form DOM Reader)

## Context & Objectives

Phase 5 builds the content script for the Chrome Extension that runs on Google Form pages (`docs.google.com/forms/*`). It detects input fields and extracts structured `FieldMetadata[]`.

## Locked Design Decisions

| Decision | Selection | Rationale |
|---|---|---|
| **DOM Parsing Strategy** | Dedicated Google Forms selectors (`[role="listitem"]`, `.freebirdFormviewerViewItemsItemItem`, headings, `aria-label`) | Handles Google Forms DOM structure reliably across themes and form types |
| **Trigger Mechanism** | On-demand scan via `chrome.runtime.onMessage` listener | Lightweight, avoids unnecessary background scanning until requested by extension |
| **Message Passing** | Handles message action `'SCAN_FIELDS'` returning `{ status: 'success', fields: FieldMetadata[] }` | Seamless integration with service worker and popup UI |

## Technical Specifications

### File Placement
- `extension/src/content/domReader.ts` — DOM traversal & `FieldMetadata` extraction logic
- `extension/src/content/contentScript.ts` — Extension entry point registering `chrome.runtime.onMessage` listener
- `extension/src/__tests__/domReader.test.ts` — JSDOM unit tests with Google Form DOM fixtures

### Target Fields (v1.0 Scope)
- Text inputs (`input[type="text"]`, `input[type="email"]`, `input[type="tel"]`, `input:not([type])`)
- Multi-line text (`textarea`)
