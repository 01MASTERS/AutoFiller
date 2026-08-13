# Phase 3: LLM Gateway (Ollama + Gemini) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 3-LLM Gateway (Ollama + Gemini)
**Areas discussed:** Provider error and fallback behavior

---

## Provider Error & Fallback Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit provider failure (Fail fast) | Return error status with clear, actionable message if selected provider fails or is unreachable | ✓ |
| Automatic fallback | Automatically retry via Gemini if Ollama fails and Gemini API key is available | |

**User's choice:** Explicit provider failure (Fail fast with clear error message)
**Notes:** Prevents unexpected cloud API usage when user intended to run locally via Ollama.

---

## Agent's Discretion

| Area | Decision | Rationale |
|------|----------|-----------|
| Prompt Engineering | System prompt instructs flat JSON `{ fieldId: value }`, using native JSON mode | Standardized output across providers |
| Retry & Timeout | 30s timeout via `AbortController`, up to 2 retries on malformed JSON | Fulfills FR-5.6 and FR-5.7 requirements |
| Gemini Config | SDK `@google/generative-ai`, key via header/env, default `gemini-1.5-flash` | Lightweight, fast, low cost |
| Ollama Config | HTTP `http://localhost:11434/api/generate`, default model `llama3.2` | Standard Ollama REST endpoint |

## Deferred Ideas

None — discussion stayed within phase scope.
