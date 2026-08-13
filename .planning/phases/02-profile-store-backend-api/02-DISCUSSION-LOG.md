# Phase 2: Profile Store & Backend API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 2-Profile Store & Backend API
**Areas discussed:** /autofill payload schema contract

---

## /autofill Payload Schema Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Detailed field objects | Request: `{ fields: FieldMetadata[], provider?: 'ollama' | 'gemini', model?: string }`. Response: `{ status: 'success' | 'error', mappings: Record<string, string>, error?: string }` | ✓ |
| Simple key-value map | Request: `{ fields: Record<string, string> }`. Response: `{ mappings: Record<string, string> }` | |
| Rich structured response | Request: `{ fields: FieldMetadata[] }`. Response: `{ matches: Array<{ fieldId: string, value: string, confidence: number }> }` | |

**User's choice:** Detailed field objects with ID, label, placeholder, aria-label, and type
**Notes:** Provides sufficient context for LLM prompt construction while keeping mapping response simple and predictable.

---

## Agent's Discretion

| Area | Decision | Rationale |
|------|----------|-----------|
| Profile JSON storage | `backend/profile.json` (configurable via `PROFILE_PATH`) | Easy to locate, default fallback created automatically if missing |
| CORS security | Allow `chrome-extension://*` and `http://localhost:*` | Restricts access to extension and dev environments |
| Input validation | Zod validation middleware | Strong runtime guarantees for API payloads |

## Deferred Ideas

None — discussion stayed within phase scope.
