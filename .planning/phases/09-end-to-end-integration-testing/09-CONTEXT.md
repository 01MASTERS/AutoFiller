# Phase 9 Context — End-to-End Integration & Testing

## Context & Objectives

Phase 9 completes Milestone 1 (Production-Ready v1.0). It validates the full end-to-end flow across popup, background service worker, backend Express server, dual LLM gateway, content script, and Google Form DOM filling. It also introduces a test form endpoint, user-friendly error recovery guidance, and complete production documentation.

## Locked Design Decisions

| Decision | Selection | Rationale |
|---|---|---|
| **E2E Test Environment** | Mock Google Form HTML page served by backend at `GET /test-form` | Enables instant manual QA and automated testing without external Google Form dependencies |
| **Error Recovery Guidance** | Actionable user guidance in Popup status banner for common failures (e.g., "Run `ollama run llama3.2`", "Start backend server on port 3456") | Helps users quickly resolve local service offline state |
| **Release Documentation** | Step-by-step production `README.md` with system architecture diagram, setup guide, Ollama CLI commands, Gemini API key instructions, and Chrome extension loading guide | Production-ready documentation for developers and end users |

## Technical Specifications

### New / Modified Artifacts
- `backend/src/routes/api.ts` — Add `GET /test-form` endpoint serving a realistic Google Form test HTML page
- `extension/src/popup/popup.ts` — Enhance error message resolution to include actionable troubleshooting hints
- `README.md` — Final production-ready documentation with architecture mermaid diagram and setup steps
- `backend/src/__tests__/testForm.test.ts` — Integration test for `GET /test-form` endpoint
