# AutoFiller — Roadmap

> Phase-based roadmap for v1.0 production-ready release.

## Milestone 1: Production-Ready v1.0

**Goal**: A working Chrome extension that auto-fills Google Forms text inputs using LLM-powered field matching with Ollama (default) and Gemini support.

---

### Phase 1: Project Scaffolding & Build Pipeline
**Status**: `completed`
**Scope**: Set up the monorepo structure, TypeScript config, Vite build for extension, Node.js backend scaffold, ESLint + Prettier, and basic CI.

**Deliverables**:
- Monorepo directory structure (`extension/`, `backend/`, `shared/`)
- TypeScript configuration (strict mode)
- Vite build config for Chrome extension (Manifest V3)
- Node.js + Express backend scaffold
- ESLint + Prettier configs
- `package.json` scripts: `dev`, `build`, `test`, `lint`
- Basic `manifest.json` with required permissions
- README with setup instructions

**UAT**:
- [x] `npm install` succeeds
- [x] `npm run build` produces a loadable Chrome extension
- [x] `npm run dev` starts backend + watches extension
- [x] Extension loads in Chrome without errors
- [x] ESLint + Prettier pass on all files

---

### Phase 2: Profile Store & Backend API
**Status**: `completed`
**Scope**: Implement the backend server with profile JSON loading and REST API endpoints.

**Deliverables**:
- `profile.json` schema and sample data
- `GET /health` endpoint
- `GET /profile` endpoint
- `POST /autofill` endpoint (stub — returns empty mappings)
- CORS configuration (allow chrome-extension origin)
- Input validation + error handling
- Vitest tests for all endpoints

**UAT**:
- [x] Backend starts and serves `/health`
- [x] `/profile` returns the profile JSON
- [x] `/autofill` accepts field metadata and returns stub response
- [x] CORS headers correct
- [x] All API tests pass

---

### Phase 3: LLM Gateway (Ollama + Gemini)
**Status**: `completed`
**Scope**: Build the unified LLM gateway that calls Ollama or Gemini to map form fields to profile values.

**Deliverables**:
- `LLMGateway` interface with `mapFields(fields, profile)` method
- `OllamaProvider` implementation (HTTP to localhost:11434)
- `GeminiProvider` implementation (@google/generative-ai SDK)
- Prompt template for field-to-profile mapping
- Response parsing + JSON validation
- Retry logic (2 retries on malformed response)
- 30s timeout per call
- Vitest tests with mocked LLM responses

**UAT**:
- [x] Ollama provider sends correct prompt and parses response
- [x] Gemini provider sends correct prompt and parses response
- [x] Malformed responses trigger retry
- [x] Timeout fires correctly
- [x] All unit tests pass with mocked responses

---

### Phase 4: Wire Backend — LLM + Profile → AutoFill Endpoint
**Status**: `completed`
**Scope**: Connect the LLM gateway to the `/autofill` endpoint so it returns real field→value mappings.

**Deliverables**:
- `/autofill` endpoint uses LLM gateway to process field metadata
- Provider selection via request body parameter
- Ollama model name configurable via request body
- Gemini API key passed via request header
- End-to-end backend flow: receive fields → load profile → call LLM → return mappings
- Integration tests

**UAT**:
- [x] `/autofill` with Ollama returns correct field mappings (mocked)
- [x] `/autofill` with Gemini returns correct field mappings (mocked)
- [x] Error responses when LLM unavailable
- [x] Integration tests pass

---

### Phase 5: Content Script — Google Form DOM Reader
**Status**: `completed`
**Scope**: Build the content script that reads Google Form fields from the DOM.

**Deliverables**:
- Google Forms page detection (`docs.google.com/forms/*`)
- DOM traversal to find text input fields
- Field metadata extraction (label, placeholder, aria-label, required)
- Structured JSON output of field metadata
- Message passing to background worker
- Unit tests with mock DOM fixtures

**UAT**:
- [x] Content script activates only on Google Forms pages
- [x] Correctly extracts fields from a real Google Form DOM structure
- [x] Sends structured metadata to background worker
- [x] All unit tests pass

---

### Phase 6: Content Script — Form Filler
**Status**: `completed`
**Scope**: Build the form filling logic that injects values into Google Form fields.

**Deliverables**:
- Receive field→value mappings from background worker
- DOM element lookup and value setting
- Event dispatching (`input`, `change`, `blur`) for Google Forms validation
- Visual feedback (green border flash on filled fields)
- Fill result reporting (success/partial/error per field)
- Unit tests with mock DOM

**UAT**:
- [x] Values correctly injected into text input fields
- [x] Google Forms recognizes the filled values (events dispatched)
- [x] Visual feedback appears and fades
- [x] Fill results reported back
- [x] All unit tests pass

---

### Phase 7: Background Service Worker
**Status**: `completed`
**Scope**: Build the background service worker that orchestrates communication between popup, content script, and backend.

**Deliverables**:
- Message listeners for popup messages (toggle, config)
- Message listeners for content script messages (field metadata, fill results)
- HTTP client to call backend `/autofill` endpoint
- State management (idle → analyzing → filling → done/error)
- State broadcast to popup
- Error handling + timeout
- Unit tests

**UAT**:
- [x] Receives messages from popup and content script
- [x] Calls backend and forwards response to content script
- [x] State transitions work correctly
- [x] Errors propagated to popup
- [x] All unit tests pass

---

### Phase 8: Popup UI
**Status**: `completed`
**Scope**: Build the extension popup with toggle, LLM config, and status display.

**Deliverables**:
- Popup HTML + CSS (clean, modern design)
- "Fill Form" button
- Enable/disable toggle
- LLM provider dropdown (Ollama / Gemini)
- Ollama model name input
- Gemini API key input (masked)
- Status indicator (idle, analyzing, filling, done, error)
- Backend connection indicator
- Settings persistence in Chrome local storage
- Integration with background service worker

**UAT**:
- [x] Popup opens and displays all controls
- [x] Toggle enables/disables auto-fill
- [x] LLM selector switches provider
- [x] Status updates in real-time during auto-fill
- [x] Settings persist across popup close/reopen
- [x] Looks polished and professional

---

### Phase 9: End-to-End Integration & Testing
**Status**: `completed`
**Scope**: Wire everything together, end-to-end testing, error scenarios, polish.

**Deliverables**:
- Full integration: popup → background → backend → LLM → content script → form fill
- E2E test with a real/mock Google Form
- Error scenario tests (backend down, Ollama down, invalid Gemini key, no fields found)
- Performance benchmarks (fill time on 10/20/50 field forms)
- README finalization
- Bug fixes from testing

**UAT**:
- [x] Complete auto-fill flow works end-to-end
- [x] All error scenarios handled gracefully
- [x] Fill time <10s on 20-field form
- [x] README has clear setup + usage instructions
- [x] All tests pass
- [x] Production build loads and works in Chrome

---

## Future Roadmap (Post v1.0)

### Phase 10: Advanced Form Elements (Playwright Integration)
**Status**: `future`
**Scope**: Integrate Playwright to handle dropdowns, checkboxes, radio buttons, date pickers — simulating human-like interaction.

### Phase 11: Multi-Profile Support
**Status**: `future`
**Scope**: Support multiple profiles with a profile switcher in the popup.

### Phase 12: Profile Editor UI
**Status**: `future`
**Scope**: Web-based profile editor served from the backend.

### Phase 13: Multi-Provider Forms
**Status**: `future`
**Scope**: Extend to Typeform, JotForm, Microsoft Forms, etc.

### Phase 14: Chrome Web Store Publishing
**Status**: `future`
**Scope**: Package, review, and publish to Chrome Web Store.
