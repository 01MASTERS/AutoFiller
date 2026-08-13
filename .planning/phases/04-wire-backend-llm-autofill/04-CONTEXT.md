# Phase 4 Context — Wire Backend (LLM + Profile → AutoFill Endpoint)

## Context & Objectives

Phase 4 connects the components built in Phase 2 (`ProfileStore`) and Phase 3 (`LLMGateway`, `OllamaProvider`, `GeminiProvider`) into the `POST /autofill` HTTP endpoint.

Key Requirements:
- Extract user profile using `ProfileStore.getProfile()`.
- Validate incoming request body (`fields`, `provider`, `model`, `apiKey`).
- Allow `apiKey` for Gemini to be supplied via HTTP header `x-gemini-api-key` or request body `apiKey`.
- Dispatch field matching request through `LLMGateway`.
- Return `{ status: 'success', mappings }` on success.
- Return `{ status: 'error', error: string, mappings: {} }` with appropriate status code (502 Bad Gateway / 400 Bad Request) when LLM calls fail.

## Architectural Decisions
- Provider defaults to `'ollama'` if omitted in request.
- `x-gemini-api-key` header takes precedence over request body `apiKey` when selecting Gemini provider.
