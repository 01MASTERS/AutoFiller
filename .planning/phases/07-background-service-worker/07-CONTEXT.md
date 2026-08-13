# Phase 7 Context — Background Service Worker

## Context & Objectives

Phase 7 builds the Chrome Extension background service worker (Manifest V3 service worker) that orchestrates communication between the popup UI, content script, and backend API.

## Locked Design Decisions

| Decision | Selection | Rationale |
|---|---|---|
| **Orchestration Flow** | Full pipeline orchestration (`TRIGGER_AUTOFILL` -> content `SCAN_FIELDS` -> backend `POST /autofill` -> content `FILL_FIELDS`) | Centralizes workflow logic in background worker, reducing complexity in popup |
| **Backend Configuration** | `http://localhost:3456` default with `chrome.storage.local` settings override | Flexible development and testing while providing sensible default |
| **State Machine & Broadcast** | `idle` -> `analyzing` -> `filling` -> `done`/`error` status state machine broadcast via `chrome.runtime.sendMessage` and saved in `chrome.storage.local` | Keeps popup UI smoothly synchronized with active filling state |

## Technical Specifications

### File Placement
- `extension/src/background/background.ts` — Background service worker entry point & orchestration pipeline
- `extension/src/manifest.ts` — Declare `background.service_worker` pointing to `src/background/background.ts`
- `extension/src/__tests__/background.test.ts` — Unit tests for pipeline orchestration & state machine

### Message Action Interface
- Incoming Action: `'TRIGGER_AUTOFILL'` with `{ provider?, model?, apiKey? }`
- Outgoing Actions to Content Script: `'SCAN_FIELDS'`, `'FILL_FIELDS'`
- Outgoing State Updates to Popup: `'STATUS_UPDATE'` with `{ state, filledCount?, failedCount?, error? }`
