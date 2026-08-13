# AutoFiller

> Auto-fill Google Forms using AI-powered field matching.

AutoFiller is a Chrome extension (Manifest V3) backed by a local Node.js server that intelligently maps form fields to stored user profiles using local (Ollama) or cloud (Gemini) LLMs.

## Features

- **Chrome Extension (Manifest V3)**: Popup UI for toggling autofill, selecting LLMs, and checking status.
- **LLM Field Matching**: Dual provider support with Ollama (local, default) and Gemini (cloud).
- **Backend Profile Store**: Local Node.js + Express backend serving profile data and managing LLM requests securely.

## Architecture

```
┌─────────────────────────────┐
│   Chrome Extension (MV3)    │
│  ┌───────────┐ ┌──────────┐ │
│  │  Popup UI │ │ Content  │ │
│  │ (toggle,  │ │  Script  │ │
│  │  status)  │ │ (DOM     │ │
│  └─────┬─────┘ │  reader  │ │
│        │       │  + filler)│ │
│  ┌─────┴─────┐ └────┬─────┘ │
│  │Background │      │       │
│  │  Worker   │◄─────┘       │
│  │(orchestr.)│              │
│  └─────┬─────┘              │
└────────┼────────────────────┘
         │ HTTP
┌────────▼────────────────────┐
│   Local Backend (Node.js)   │
│  ┌──────────┐ ┌───────────┐ │
│  │ Profile  │ │   LLM     │ │
│  │  Store   │ │  Gateway  │ │
│  │ (JSON)   │ │(Ollama/   │ │
│  │          │ │ Gemini)   │ │
│  └──────────┘ └───────────┘ │
└─────────────────────────────┘
```

## Prerequisites

- **Node.js**: 20 LTS or higher
- **npm**: 9+
- **Chrome**: 120+
- **Ollama** (optional): Installed locally for offline field matching (`http://localhost:11434`)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/01MASTERS/AutoFiller.git
cd AutoFiller

# Install dependencies
npm install

# Start backend + extension dev watcher concurrently
npm run dev
```

## Development Commands

- `npm run dev`: Start backend server with `tsx watch` and extension build in watch mode simultaneously.
- `npm run build`: Build shared types, extension bundle, and backend TS server.
- `npm run test`: Run Vitest tests across workspaces.
- `npm run lint`: Run ESLint across all TypeScript source files.
- `npm run format`: Format TypeScript files with Prettier.

## Loading the Extension in Chrome

1. Run `npm run build` (or `npm run dev`).
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in upper right).
4. Click **Load unpacked**.
5. Select the `extension/dist/` directory inside this project.

## Project Structure

```
AutoFiller/
├── extension/     # Chrome extension source (Vite + CRXJS)
├── backend/       # Node.js + Express backend server
├── shared/        # Shared TypeScript types package
└── .planning/     # Project planning & roadmap docs
```

## License

MIT
