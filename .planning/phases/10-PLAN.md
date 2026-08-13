# Phase 10 Implementation Plan: Dynamic Model Discovery & Provider Management UI

## Phase Objective
Implement dynamic model discovery for Ollama and Google Gemini providers, add explicit refresh icon triggers with loading indicators, enable auto-fetching for Ollama on provider switch/load, enable Gemini model fetching on API key entry, and provide a polished Popup UI in the Chrome extension.

## Proposed Tasks

### Task 1: Shared Models API Interface & Backend Route (`/models`)
**Files to Modify/Create**:
- [MODIFY] [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts)
- [MODIFY] [`backend/src/services/llm/types.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/types.ts)
- [MODIFY] [`backend/src/services/llm/ollamaProvider.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/ollamaProvider.ts)
- [MODIFY] [`backend/src/services/llm/geminiProvider.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/geminiProvider.ts)
- [MODIFY] [`backend/src/services/llm/gateway.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/gateway.ts)
- [MODIFY] [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts)
- [NEW] [`backend/src/__tests__/models.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/__tests__/models.test.ts)

**Details**:
1. Add `ModelsResponse` interface in `@autofiller/shared`:
   ```ts
   export interface ModelsResponse {
     status: 'success' | 'error';
     provider: 'ollama' | 'gemini';
     models: string[];
     error?: string;
   }
   ```
2. Update `LLMProvider` in `types.ts` with optional `fetchAvailableModels(options?: LLMOptions): Promise<string[]>`.
3. In `OllamaProvider`: implement `fetchAvailableModels()` by calling `GET http://localhost:11434/api/tags` and mapping `models[].name`.
4. In `GeminiProvider`: implement `fetchAvailableModels()` by querying supported generation models using API key or returning fallback list when unauthenticated.
5. In `LLMGateway`: add `getModels(provider, options)` delegating to the target provider.
6. In `backend/src/routes/api.ts`: add `GET /models` endpoint parsing `provider` query parameter and `x-gemini-api-key` header.
7. Write Vitest unit tests in `models.test.ts` covering `/models` endpoint for Ollama and Gemini.

---

### Task 2: Extension Popup UI & Model Discovery Logic
**Files to Modify/Create**:
- [MODIFY] [`extension/src/popup/popup.html`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.html)
- [MODIFY] [`extension/src/popup/popup.css`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.css)
- [MODIFY] [`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts)
- [NEW] [`extension/src/__tests__/popupModels.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/popupModels.test.ts)

**Details**:
1. Update `popup.html`:
   - Add model dropdown `<select id="ollama-model-select">` and refresh button `<button id="refresh-ollama-btn">` in `#ollama-settings`.
   - Add model dropdown `<select id="gemini-model-select">` and refresh button `<button id="refresh-gemini-btn">` in `#gemini-settings`.
   - Add inline status/warning badges under model settings.
2. Update `popup.css`:
   - Style model input groups, refresh SVG icon buttons, hover states, spinning refresh animation (`@keyframes spin`), and status badges.
3. Update `popup.ts`:
   - Implement `fetchModelsForProvider(provider, apiKey?)` calling `http://localhost:3456/models?provider=...`.
   - Wire provider select switch to trigger Ollama model fetch.
   - Wire Gemini API key blur/change to trigger Gemini model fetch.
   - Wire Refresh icon button click handlers to spin the refresh icon, fetch models, update select options, and save selection to `chrome.storage.local`.
4. Write Vitest unit tests in `popupModels.test.ts` testing dropdown population, refresh click handlers, and model list persistence.

---

### Task 3: Verification & Integration Suite
- Run `npm test` across all packages (`extension` + `backend`).
- Run `npm run build` to verify Chrome extension build.

## Verification Criteria
- [ ] `GET /models?provider=ollama` returns available Ollama models or clean error if service down
- [ ] `GET /models?provider=gemini` returns Gemini models when `x-gemini-api-key` is provided
- [ ] Popup auto-fetches Ollama models on provider switch / popup load
- [ ] Popup fetches Gemini models when Gemini key is entered or refresh button is clicked
- [ ] Refresh buttons animate with spinning icon during fetch
- [ ] Model dropdowns populate dynamically and selection persists across popup reopen
- [ ] All Vitest unit tests pass across extension and backend workspaces
