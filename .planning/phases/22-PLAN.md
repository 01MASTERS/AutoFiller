# Phase 22 Implementation Plan: Profile Editor UI (Web Dashboard)

## Phase Objective
Build and integrate a web-based visual profile editor dashboard served directly by the backend server (`GET /profile-ui`), providing a complete visual management interface for creating, editing, validating, and switching persona profiles, along with direct launch integration from the Chrome extension popup.

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Backend Dashboard** | `backend/src/routes/profileUiHtml.ts` (NEW FILE) | Does not exist | Create modern, responsive HTML/CSS/JS dashboard renderer for Profile Editor with dual visual/JSON editor modes |
| **Backend Routes** | [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts) | Has `logs-ui` and `test-forms` routes | Add `GET /profile-ui` and alias `GET /profiles-ui` serving the rendered HTML |
| **Backend Tests** | `backend/src/__tests__/profileUi.test.ts` (NEW FILE) | Does not exist | Add integration tests verifying `GET /profile-ui` and `GET /profiles-ui` response, content-type, and DOM elements |
| **Extension UI** | [`extension/src/popup/popup.html`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.html) | Only has refresh button and status badge in profile header | Add `#open-profile-editor-btn` to open the Web Dashboard |
| **Extension Logic** | [`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts) | Only opens logs-ui on log button click | Add click handler for `#open-profile-editor-btn` opening `http://localhost:3456/profile-ui` |
| **Extension Tests** | [`extension/src/__tests__/popup.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/popup.test.ts) | Tests logs button click | Add test verifying clicking `#open-profile-editor-btn` opens dashboard |

---

## Detailed Task Breakdown

### Task 1: Dedicated Profile Editor HTML/CSS/JS Generator
**Files to Create**:
- [NEW] `backend/src/routes/profileUiHtml.ts`

**Specifications**:
1. Export `renderProfileEditorHtml(): string`.
2. Responsive two-panel design:
   - **Sidebar**:
     - Header with brand icon and "Persona Profiles".
     - Search filter input (`#search-input`).
     - Persona list (`#persona-list`) showing name, headline, filename, and active badge.
     - "+ Create Persona" button launching modal dialog.
   - **Main Editor Panel**:
     - Top Navigation Bar: active persona title, ID badge, view mode toggle ("Visual Form" vs "Raw JSON"), action buttons ("Save Profile", "Set as Active", "Delete Persona").
     - Toast Notification Container (`#toast`).
     - **Visual Form Container**:
       - Personal Info card: Full Name, Email, Phone, Alternate Phone, Address.
       - Professional Headline card: headline text input.
       - Experience section: dynamic cards with Title, Company, Duration, Description, "+ Add Experience", delete buttons.
       - Education section: dynamic cards with Degree, School, Graduation Year, Start/End date, "+ Add Education", delete buttons.
       - Skills section: interactive pill chips with input and "+ Add Skill".
       - Links section: key-value inputs with "+ Add Link".
       - Custom Fields section: key-value inputs for platform-specific questions with "+ Add Custom Field".
     - **Raw JSON Container**:
       - Syntax textarea with line numbers/monospace font.
       - "Format JSON" and "Copy to Clipboard" buttons.
       - Syntax error validation message box.
   - **Create Persona Modal (`#new-persona-modal`)**:
     - Profile ID input (validated: letters, numbers, dashes, underscores).
     - Persona Name input.
     - Starter Template select (Blank, Software Engineer, Product Manager, Data Scientist).
     - "Create Persona" and "Cancel" buttons.
3. Client-Side JavaScript Logic:
   - Loads personas on startup via `GET /profiles`.
   - Selects active profile and loads full data via `GET /profiles/:id`.
   - Populates both Visual Form inputs and JSON editor.
   - Tab switching synchronizes data between Visual Form and JSON editor.
   - "Save Profile" calls `PUT /profiles/:id` with validation and displays success toast.
   - "Set as Active" calls `POST /profiles/switch` and updates active badges.
   - "Delete Persona" calls `DELETE /profiles/:id` with confirmation (prevents deleting active profile).
   - "Create Persona" calls `POST /profiles` with template seed and switches to new persona.

---

### Task 2: Backend Route Integration
**Files to Modify**:
- [MODIFY] [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts)

**Actions**:
1. Import `renderProfileEditorHtml` from `./profileUiHtml.js`.
2. Register routes:
   ```ts
   apiRouter.get('/profile-ui', (req: Request, res: Response) => {
     res.setHeader('Content-Type', 'text/html; charset=utf-8');
     res.send(renderProfileEditorHtml());
   });
   apiRouter.get('/profiles-ui', (req: Request, res: Response) => {
     res.setHeader('Content-Type', 'text/html; charset=utf-8');
     res.send(renderProfileEditorHtml());
   });
   ```

---

### Task 3: Extension Popup Launcher Integration
**Files to Modify**:
- [MODIFY] [`extension/src/popup/popup.html`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.html)
- [MODIFY] [`extension/src/popup/popup.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/popup/popup.ts)

**Actions**:
1. In `popup.html`:
   - Add `#open-profile-editor-btn` inside `.header-actions` of the `.profile-card`:
     ```html
     <button id="open-profile-editor-btn" class="icon-btn" title="Open Profile Editor Dashboard" type="button">
       <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
         <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
       </svg>
     </button>
     ```
2. In `popup.ts`:
   - In `bindPopupEvents()`:
     - Bind click on `#open-profile-editor-btn` to open `http://localhost:3456/profile-ui` via `chrome.tabs.create` or `window.open`.
     - Log `OPEN_PROFILE_EDITOR_CLICK` via `ExtensionLogger`.

---

### Task 4: Automated Testing & Verification
**Files to Create/Modify**:
- [NEW] `backend/src/__tests__/profileUi.test.ts`
- [MODIFY] [`extension/src/__tests__/popup.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/popup.test.ts)

**Actions**:
1. In `backend/src/__tests__/profileUi.test.ts`:
   - Test `GET /profile-ui` returns 200 OK and `text/html`.
   - Test `GET /profiles-ui` alias returns 200 OK.
   - Test HTML contains `#persona-list`, `#visual-editor-tab`, `#json-editor-tab`, `#save-profile-btn`, and `#new-persona-modal`.
2. In `extension/src/__tests__/popup.test.ts`:
   - Test clicking `#open-profile-editor-btn` opens `http://localhost:3456/profile-ui`.
3. Verification commands:
   - `npm run test -w backend`
   - `npm run test -w extension`
   - `npm test` (all 236+ monorepo tests passing)
   - `npm run build` (clean compilation)

---

## Verification Criteria
- All 236 existing monorepo tests pass.
- New backend `profileUi.test.ts` and extension popup tests pass with 100% assertions.
- `GET /profile-ui` serves an interactive dashboard with zero build errors.
- Popup "Edit Profiles" button launches the web dashboard.
- Clean production build with zero errors.
- **ZERO GIT COMMITS** (strict user rule).
