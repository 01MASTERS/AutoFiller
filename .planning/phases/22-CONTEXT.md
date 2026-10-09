# Phase 22 Context: Profile Editor UI (Web Dashboard)

## Phase Summary
Phase 22 builds upon the multi-profile backend store (Phase 20) and extension persona switcher (Phase 21) by providing a full-featured, web-based visual dashboard served directly by the backend server (`GET /profile-ui`). This gives users a dedicated, ergonomic web interface to view, create, edit, customize, validate, and manage persona profiles with real-time feedback, dual visual/JSON editing modes, and direct active profile switching.

---

## Core Objectives & Architectural Scope

1. **Self-Contained Web Dashboard (`backend/src/routes/profileUiHtml.ts`)**:
   - Render a responsive, modern HTML5 web application served at `GET /profile-ui` (and alias `GET /profiles-ui`).
   - Match the high design aesthetics of `GET /logs-ui` and `GET /test-forms`:
     - Dark-mode glassmorphic theme with indigo/sky accents.
     - Inter typography for UI controls and JetBrains Mono for JSON / code views.
     - Zero external build tooling required for the dashboard itself (pure vanilla HTML/CSS/JS executed in browser).

2. **Persona Management & Navigation (Sidebar)**:
   - Sidebar listing all persona profiles fetched dynamically via `GET /profiles`.
   - Real-time search/filter input to quickly find personas.
   - Clear active persona indicator badge ("Active").
   - One-click "Set as Active" action calling `POST /profiles/switch`.
   - "+ New Persona" button launching a creation modal.
   - Delete persona button with confirmation guard (blocked on the active profile).

3. **Dual-Mode Profile Editor (Main Workspace)**:
   - **Visual Form Editor Mode**:
     - **Personal Details**: Full Name, Email, Phone, Alternate Phone, Address.
     - **Headline & Summary**: Custom job title / candidate headline (e.g. "Fullstack Software Engineer").
     - **Work Experience**: Dynamic array editor (Title, Company, Duration, Description) with Add/Remove buttons.
     - **Education**: Dynamic array editor (Degree, School, Graduation Year, Start/End Dates) with Add/Remove buttons.
     - **Skills**: Interactive tag list with instant chip addition and removal.
     - **Links**: Key-value manager for LinkedIn, GitHub, Portfolio, Twitter, etc.
     - **Custom Question Answers**: Key-value manager for platform-specific questions (e.g. Expected Salary, Work Authorization, Sponsorship, Notice Period).
   - **Raw JSON Editor Mode**:
     - Monospaced code editor with syntax formatting ("Format JSON"), validation indicator, and "Copy JSON" action.
     - Real-time two-way synchronization between Visual and JSON tabs.

4. **Action Toolbar & Status Feedback**:
   - Floating/sticky action bar with "Save Changes", "Discard", and "Set as Active" buttons.
   - Animated notification toast (success, error, warning) for user feedback.
   - Live navigation links to `/logs-ui` (Debug Dashboard) and `/test-forms` (Test Forms Hub).

5. **Extension Popup Integration**:
   - Add an "Edit Profiles" button (`#open-profile-editor-btn`) in the extension popup's Profile Card header.
   - Clicking the button opens `http://localhost:3456/profile-ui` in a new browser tab.

6. **Comprehensive Automated Testing**:
   - `backend/src/__tests__/profileUi.test.ts`:
     - Verifies `GET /profile-ui` and `GET /profiles-ui` return 200 OK with `text/html`.
     - Verifies HTML contains core elements (sidebar, visual editor, JSON tab, action buttons).
   - `extension/src/__tests__/popup.test.ts`:
     - Verifies clicking `#open-profile-editor-btn` opens the web dashboard URL.

---

## Verification Strategy
- **Backend Route Testing**: Verify endpoint serving, content-type headers, and HTML layout.
- **Extension UI Testing**: Verify popup button interaction and tab creation.
- **Monorepo Suite**: Full regression run (`npm test`) across all 236+ tests.
- **Production Build Check**: Clean build (`npm run build`).
