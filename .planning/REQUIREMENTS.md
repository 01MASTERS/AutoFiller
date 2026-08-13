# AutoFiller — Requirements

> Scoped requirements for v1.0: LLM-powered Google Forms auto-filler Chrome extension.

## Functional Requirements

### FR-1: Chrome Extension Popup UI
- **FR-1.1**: Popup opens when user clicks the extension icon
- **FR-1.2**: Toggle switch to enable/disable auto-fill on the current page
- **FR-1.3**: LLM provider selector (Ollama / Gemini dropdown)
- **FR-1.4**: Status indicator showing current state (idle, analyzing, filling, done, error)
- **FR-1.5**: Connection status to backend server (connected/disconnected)
- **FR-1.6**: Ollama model name input field (default: configurable)
- **FR-1.7**: Gemini API key input field (stored in Chrome local storage, encrypted)

### FR-2: Content Script — Form Reading
- **FR-2.1**: Detect when user is on a Google Forms page (`docs.google.com/forms/*`)
- **FR-2.2**: Extract all visible text input fields from the form DOM
- **FR-2.3**: For each field, extract: label text, placeholder text, aria labels, field type, required flag
- **FR-2.4**: Package field metadata into a structured JSON payload
- **FR-2.5**: Send field metadata to background worker on user trigger

### FR-3: Background Service Worker
- **FR-3.1**: Listen for messages from popup (toggle, config changes)
- **FR-3.2**: Listen for messages from content script (field metadata)
- **FR-3.3**: Forward field metadata to backend server via HTTP
- **FR-3.4**: Receive field→value mappings from backend
- **FR-3.5**: Forward mappings to content script for DOM injection
- **FR-3.6**: Track and broadcast state changes to popup

### FR-4: Backend Server — Profile API
- **FR-4.1**: `GET /health` — Health check endpoint
- **FR-4.2**: `GET /profile` — Return the user profile JSON
- **FR-4.3**: `POST /autofill` — Accept field metadata, return field→value mappings
- **FR-4.4**: Load profile from `profile.json` file on disk at startup
- **FR-4.5**: Profile includes: name, email, phone, address, education, work experience, skills, links (LinkedIn, GitHub, portfolio), and custom key-value pairs

### FR-5: Backend Server — LLM Gateway
- **FR-5.1**: Unified interface for calling Ollama and Gemini
- **FR-5.2**: Ollama: call `POST http://localhost:11434/api/generate` with configurable model
- **FR-5.3**: Gemini: call via `@google/generative-ai` SDK with user-provided API key
- **FR-5.4**: Prompt engineering: Given a list of form fields + user profile, return a JSON mapping of `{fieldId: profileValue}`
- **FR-5.5**: Parse and validate LLM response (must be valid JSON)
- **FR-5.6**: Retry on malformed response (up to 2 retries)
- **FR-5.7**: Timeout: 30s per LLM call

### FR-6: Content Script — Form Filling
- **FR-6.1**: Receive field→value mappings from background worker
- **FR-6.2**: For each mapping, locate the DOM element and set its value
- **FR-6.3**: Dispatch `input`, `change`, and `blur` events to trigger Google Forms' internal validation
- **FR-6.4**: Visual feedback: briefly highlight filled fields (green border flash)
- **FR-6.5**: Report fill results back to background worker (success/partial/error per field)

## Non-Functional Requirements

### NFR-1: Performance
- Auto-fill cycle (trigger → fill) must complete in <10s on a 20-field form
- Extension popup must open in <200ms
- Backend server must start in <3s

### NFR-2: Security
- Profile data never leaves the local machine
- Gemini API key stored encrypted in Chrome local storage
- Backend only accepts requests from `chrome-extension://` origin (CORS)
- No telemetry, no analytics, no external network calls except LLM APIs

### NFR-3: Reliability
- Graceful error handling if Ollama is not running
- Graceful error handling if Gemini API key is invalid
- Graceful error handling if backend server is unreachable
- All errors surfaced in popup UI with actionable messages

### NFR-4: Code Quality
- TypeScript strict mode (`strict: true`)
- ESLint + Prettier configured
- Vitest unit tests with >80% coverage on backend
- Integration tests for LLM gateway (mocked LLM responses)

### NFR-5: Developer Experience
- `npm run dev` — start backend + watch extension build
- `npm run test` — run all tests
- `npm run build` — production build
- Clear README with setup steps

## User Stories

### US-1: Basic Auto-Fill Flow
> As a job seeker, I want to click the AutoFiller extension icon and press "Fill Form" so that my Google Form application is automatically filled with my profile data.

**Acceptance Criteria**:
1. I open a Google Form in Chrome
2. I click the AutoFiller extension icon
3. I see a "Fill Form" button and toggle
4. I click "Fill Form"
5. All text input fields are filled with matching profile data
6. I see a success message in the popup

### US-2: LLM Provider Selection
> As a user, I want to choose between Ollama (local) and Gemini (cloud) for field matching so that I can use whichever is available.

**Acceptance Criteria**:
1. Popup shows a dropdown to select LLM provider
2. Default is Ollama
3. If I select Gemini, I can enter my API key
4. The selected provider is used for the next auto-fill operation

### US-3: Error Feedback
> As a user, I want to see clear error messages when something goes wrong so that I can troubleshoot.

**Acceptance Criteria**:
1. If backend is unreachable → "Backend server not running. Start it with `npm run server`"
2. If Ollama is not running → "Ollama not detected. Install from ollama.com"
3. If Gemini key is invalid → "Invalid Gemini API key. Check your key in settings"
4. If form has no text fields → "No fillable text fields found on this form"

## Verification Criteria

| Requirement | Verification Method |
|---|---|
| FR-1.x (Popup UI) | Manual testing + screenshot |
| FR-2.x (Form reading) | Unit test with mock DOM |
| FR-3.x (Background worker) | Integration test with mock messages |
| FR-4.x (Backend API) | Vitest API tests |
| FR-5.x (LLM Gateway) | Vitest with mocked LLM responses |
| FR-6.x (Form filling) | E2E with test Google Form |
| NFR-1 (Performance) | Timing assertions in tests |
| NFR-2 (Security) | Code review + CORS config test |
| NFR-3 (Reliability) | Error scenario tests |
| NFR-4 (Code quality) | CI lint + coverage report |
