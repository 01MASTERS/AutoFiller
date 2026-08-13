# Phase 8 Context — Popup UI

## Context & Objectives

Phase 8 builds the extension Popup UI served when clicking the extension icon. It allows users to trigger auto-fill, select LLM provider (`ollama` vs `gemini`), configure model names and API keys, view live backend health, and track real-time filling status.

## Locked Design Decisions

| Decision | Selection | Rationale |
|---|---|---|
| **Design Aesthetic** | Premium dark mode with glassmorphism cards, modern typography, vibrant accent colors, and smooth micro-animations | High visual quality, modern extension feel, matches project aesthetic guidelines |
| **Status & Health** | Live backend health indicator (`Online` / `Offline`) via `/health` ping + real-time fill progress badge (`Idle`, `Analyzing...`, `Filling...`, `Done!`, `Error`) | Clear feedback on server availability and active AI processing |
| **Settings Management** | Instant auto-save to `chrome.storage.local` as inputs/selectors change + prominent one-click "Auto-Fill Form" button | Zero friction configuration, settings persist across popup reopens |
| **Profile Preview** | Expandable card displaying active profile name & email loaded from backend `GET /profile` | Confirms user profile identity being used for AI auto-fill |

## Technical Specifications

### File Placement
- `extension/src/popup/popup.html` — Main popup HTML layout
- `extension/src/popup/popup.css` — Vanilla CSS design system with CSS custom properties (dark mode palette, glassmorphism backdrop filters, pulse badges)
- `extension/src/popup/popup.ts` — Interactive logic: storage binding, backend health polling, live status listener, profile fetch, and `TRIGGER_AUTOFILL` dispatch
- `extension/src/__tests__/popup.test.ts` — JSDOM tests for settings binding and message dispatching

### Key Elements
- **Header**: App title + active backend connection status pill (`Online` / `Offline`)
- **Action Area**: Primary "Auto-Fill Form" button with loading spinner
- **Live Status Badge**: Status banner showing current state (`Analyzing form...`, `Filling fields...`, `Filled 5 fields!`)
- **Profile Quick Preview Card**: Expandable card showing active profile name & email fetched from backend `/profile`
- **LLM Settings Card**:
  - Provider Dropdown (`Ollama (Local)` / `Gemini (Cloud)`)
  - Ollama Model Input (default `llama3.2`, visible when Ollama selected)
  - Gemini API Key Input (password-masked input, visible when Gemini selected)
