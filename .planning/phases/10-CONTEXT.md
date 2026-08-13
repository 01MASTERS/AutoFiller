# Phase 10 Context: Dynamic Model Discovery & Provider Management UI

## Phase Summary
Phase 10 implements dynamic model discovery for both Ollama and Google Gemini providers, featuring auto-fetching, explicit refresh icon triggers, loading indicators, and robust offline/error fallback UI in the Chrome extension popup.

## Agreed Architecture & Design Decisions

### 1. Backend Endpoint Design
- **Unified Route**: `GET /models?provider=ollama` and `GET /models?provider=gemini`
- **Authentication**: For Gemini, `x-gemini-api-key` header passes the API key to the backend.
- **Ollama Proxy**: Backend queries `GET http://localhost:11434/api/tags` and returns an array of model names e.g., `["llama3.2:latest", "mistral:latest", "phi3:latest"]`.
- **Gemini Model Discovery**: Backend uses Google Generative AI SDK / REST to list available models (e.g. `["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"]`) filtered for content generation models.

### 2. Model Fetch Triggers
- **Ollama Models**:
  - Initial fetch when extension popup loads / backend status connects.
  - On-demand fetch whenever the user clicks the provider **Refresh icon button**.
- **Gemini Models**:
  - Fetched when the user enters/pastes their Gemini API Key into the key input box and clicks the **Refresh icon button** (or on input blur).
  - On-demand re-fetch whenever the user clicks the **Refresh icon button**.

### 3. Extension Popup UI & Refresh Controls
- **Provider Selector**: Dropdown to switch between Ollama (Local) and Google Gemini (Cloud).
- **Dynamic Model Select Dropdown**: Replaces fixed text input with a dynamic HTML `<select>` dropdown populated with models returned from the backend.
- **Refresh Icon Button**: Inline button next to provider/key inputs with spinning animation during network requests.
- **Status & Fallbacks**:
  - Clear badge / notification if Ollama is offline or Gemini API key is invalid.
  - Graceful fallback: allows typing a custom model string if model list fetch fails.
  - Selected provider and model persist in `chrome.storage.local`.

## Downstream Guidelines for Plan & Execution
- Upstream: `/autofill` endpoint stays compatible with selected `provider` and `model` fields.
- Backend: Add unit tests for `GET /models` endpoint covering both providers and error states.
- Extension: Add unit tests for popup model loading, refresh button events, and storage persistence.
