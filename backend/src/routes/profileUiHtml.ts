/**
 * Profile Editor UI (Web Dashboard) HTML/CSS/JS generator.
 * Provides a self-contained, responsive web application for managing persona profiles.
 */

export function renderProfileEditorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoFiller — Persona Profile Editor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(14, 18, 28, 0.75);
      --card-solid: #0d121c;
      --card-hover: rgba(26, 33, 50, 0.6);
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(99, 102, 241, 0.5);
      --text: #f1f5f9;
      --text-muted: #64748b;
      --text-dim: #94a3b8;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-success: #10b981;
      --accent-warning: #f59e0b;
      --accent-danger: #ef4444;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, Menlo, monospace;
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      background: radial-gradient(1200px 800px at 50% -120px, rgba(99, 102, 241, 0.08), rgba(56, 189, 248, 0.04) 40%, transparent 80%), var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 20px;
    }

    .container {
      width: 100%;
      max-width: 1400px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1;
    }

    /* Top Navigation Header */
    .top-header {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-icon {
      width: 26px;
      height: 26px;
      color: var(--accent);
    }

    .brand-title {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(90deg, #818cf8, #38bdf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-left: 6px;
      padding-left: 8px;
      border-left: 1px solid var(--border);
    }

    .header-links {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-link {
      color: var(--text-dim);
      font-size: 12px;
      text-decoration: none;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: rgba(15, 23, 42, 0.5);
      transition: all 0.15s ease;
    }

    .header-link:hover {
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.2);
    }

    /* Toast Notification */
    #toast {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      padding: 10px 18px;
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      display: none;
      align-items: center;
      gap: 8px;
      animation: fadeIn 0.2s ease;
    }

    #toast.success { background: #064e3b; color: #6ee7b7; border: 1px solid #059669; }
    #toast.error { background: #7f1d1d; color: #fca5a5; border: 1px solid #dc2626; }
    #toast.info { background: #1e1b4b; color: #c7d2fe; border: 1px solid #4f46e5; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Main Two-Column Layout */
    .workspace {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 16px;
      flex: 1;
      min-height: 700px;
    }

    /* Left Sidebar */
    .sidebar {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: calc(100vh - 100px);
      position: sticky;
      top: 16px;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .sidebar-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
    }

    .search-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: rgba(15, 23, 42, 0.6);
      color: var(--text);
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s ease;
    }

    .search-input:focus {
      border-color: var(--accent);
    }

    .persona-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      flex: 1;
      padding-right: 4px;
    }

    .persona-card {
      padding: 10px 12px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.15s ease;
    }

    .persona-card:hover {
      background: var(--card-hover);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .persona-card.active-item {
      border-color: var(--accent);
      background: rgba(99, 102, 241, 0.1);
    }

    .persona-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .persona-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }

    .persona-headline {
      font-size: 11px;
      color: #60a5fa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .persona-id-tag {
      font-size: 10px;
      font-family: var(--font-mono);
      color: var(--text-muted);
    }

    .badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .badge-active {
      background: rgba(16, 185, 129, 0.2);
      color: #6ee7b7;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    /* Main Editor Area */
    .editor-panel {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Editor Toolbar */
    .editor-toolbar {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border);
      background: rgba(15, 23, 42, 0.7);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .editor-target-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .editor-target-title {
      font-size: 16px;
      font-weight: 700;
    }

    .editor-target-id {
      font-size: 11px;
      font-family: var(--font-mono);
      padding: 2px 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-dim);
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tabs-nav {
      display: flex;
      background: rgba(15, 23, 42, 0.8);
      padding: 3px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }

    .tab-btn {
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      border: none;
      background: transparent;
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn.active {
      background: var(--accent);
      color: #fff;
    }

    .btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #fff;
      box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
    }

    .btn-secondary {
      background: rgba(15, 23, 42, 0.6);
      border-color: var(--border);
      color: var(--text);
    }

    .btn-secondary:hover {
      background: rgba(30, 41, 59, 0.8);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.25);
    }

    /* Editor Body */
    .editor-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .form-section {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px;
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 10px;
    }

    .field-label {
      font-size: 11.5px;
      font-weight: 500;
      color: var(--text-dim);
    }

    .field-input, .field-textarea {
      width: 100%;
      padding: 8px 10px;
      background: rgba(7, 9, 14, 0.7);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 12.5px;
      outline: none;
      font-family: var(--font-sans);
      transition: border-color 0.15s ease;
    }

    .field-input:focus, .field-textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }

    .field-textarea {
      resize: vertical;
      min-height: 60px;
    }

    /* Sub-items (Experience, Education, Custom Fields) */
    .sub-item-card {
      background: rgba(7, 9, 14, 0.5);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 12px;
      margin-bottom: 10px;
      position: relative;
    }

    .sub-item-remove {
      position: absolute;
      top: 10px;
      right: 10px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .sub-item-remove:hover {
      color: var(--accent-danger);
      background: rgba(239, 68, 68, 0.1);
    }

    /* Skills Chips */
    .skills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }

    .skill-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      font-size: 11.5px;
      color: #c7d2fe;
    }

    .skill-chip-remove {
      cursor: pointer;
      color: #a5b4fc;
      font-weight: 700;
      font-size: 13px;
    }

    .skill-chip-remove:hover {
      color: var(--accent-danger);
    }

    .skill-add-row {
      display: flex;
      gap: 8px;
    }

    /* JSON Editor View */
    #json-editor-view {
      display: none;
      flex-direction: column;
      gap: 12px;
      height: 100%;
    }

    .json-textarea {
      width: 100%;
      height: 520px;
      background: #05070a;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      color: #38bdf8;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      padding: 14px;
      outline: none;
      resize: vertical;
    }

    .json-textarea:focus {
      border-color: var(--accent);
    }

    .json-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .json-error {
      display: none;
      padding: 8px 12px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-sm);
      color: #fca5a5;
      font-size: 12px;
      font-family: var(--font-mono);
    }

    /* Modal Dialog */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
    }

    .modal-dialog {
      background: #0d121c;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      width: 440px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }

    .modal-title {
      font-size: 16px;
      font-weight: 700;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div id="toast"></div>

  <div class="container">
    <!-- Top Header -->
    <header class="top-header">
      <div class="brand">
        <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <h1 class="brand-title">AutoFiller</h1>
        <span class="brand-subtitle">Persona Profile Editor</span>
      </div>
      <div class="header-links">
        <a href="/logs-ui" class="header-link" target="_blank">Activity & Debug Logs</a>
        <a href="/test-forms" class="header-link" target="_blank">Test Forms Hub</a>
      </div>
    </header>

    <!-- Workspace -->
    <main class="workspace">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Personas</span>
          <button id="new-persona-btn" class="btn btn-primary" style="padding: 4px 8px; font-size: 11px;">+ New</button>
        </div>
        <input type="text" id="search-input" class="search-input" placeholder="Filter personas..." />
        <div id="persona-list" class="persona-list">
          <!-- Populated dynamically via GET /profiles -->
        </div>
      </aside>

      <!-- Editor Panel -->
      <section class="editor-panel">
        <!-- Toolbar -->
        <div class="editor-toolbar">
          <div class="editor-target-info">
            <h2 id="target-persona-name" class="editor-target-title">Select a Persona</h2>
            <span id="target-persona-id" class="editor-target-id">none</span>
            <span id="target-active-badge" class="badge badge-active" style="display: none;">Active</span>
          </div>
          <div class="toolbar-actions">
            <div class="tabs-nav">
              <button id="tab-visual-btn" class="tab-btn active" type="button">Visual Form</button>
              <button id="tab-json-btn" class="tab-btn" type="button">Raw JSON</button>
            </div>
            <button id="set-active-btn" class="btn btn-secondary" type="button">Set as Active</button>
            <button id="save-profile-btn" class="btn btn-primary" type="button">Save Profile</button>
            <button id="delete-profile-btn" class="btn btn-danger" type="button">Delete</button>
          </div>
        </div>

        <!-- Editor Body -->
        <div class="editor-body">
          <!-- Visual Form View -->
          <div id="visual-form-view">
            <!-- Personal Info -->
            <div class="form-section">
              <div class="section-title">Personal Information</div>
              <div class="grid-2">
                <div class="field-group">
                  <label class="field-label" for="input-name">Full Name</label>
                  <input type="text" id="input-name" class="field-input" placeholder="e.g. Jane Doe" />
                </div>
                <div class="field-group">
                  <label class="field-label" for="input-email">Email Address</label>
                  <input type="email" id="input-email" class="field-input" placeholder="e.g. jane@example.com" />
                </div>
              </div>
              <div class="grid-2">
                <div class="field-group">
                  <label class="field-label" for="input-phone">Primary Phone</label>
                  <input type="tel" id="input-phone" class="field-input" placeholder="e.g. +1 555-123-4567" />
                </div>
                <div class="field-group">
                  <label class="field-label" for="input-alt-phone">Alternate Phone</label>
                  <input type="tel" id="input-alt-phone" class="field-input" placeholder="Optional" />
                </div>
              </div>
              <div class="field-group">
                <label class="field-label" for="input-address">Address / Location</label>
                <input type="text" id="input-address" class="field-input" placeholder="e.g. San Francisco, CA" />
              </div>
            </div>

            <!-- Professional Headline -->
            <div class="form-section">
              <div class="section-title">Professional Headline / Role Focus</div>
              <div class="field-group">
                <label class="field-label" for="input-headline">Candidate Headline</label>
                <input type="text" id="input-headline" class="field-input" placeholder="e.g. Senior Machine Learning & AI Engineer" />
              </div>
            </div>

            <!-- Skills -->
            <div class="form-section">
              <div class="section-title">Skills & Competencies</div>
              <div id="skills-list" class="skills-container"></div>
              <div class="skill-add-row">
                <input type="text" id="input-new-skill" class="field-input" style="max-width: 260px;" placeholder="Add skill (e.g. TypeScript, PyTorch)" />
                <button id="add-skill-btn" class="btn btn-secondary" type="button">+ Add Skill</button>
              </div>
            </div>

            <!-- Work Experience -->
            <div class="form-section">
              <div class="section-title">
                <span>Work Experience</span>
                <button id="add-experience-btn" class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px;" type="button">+ Add Experience</button>
              </div>
              <div id="experience-list"></div>
            </div>

            <!-- Education -->
            <div class="form-section">
              <div class="section-title">
                <span>Education</span>
                <button id="add-education-btn" class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px;" type="button">+ Add Education</button>
              </div>
              <div id="education-list"></div>
            </div>

            <!-- Web & Social Links -->
            <div class="form-section">
              <div class="section-title">
                <span>Links & Portfolios</span>
                <button id="add-link-btn" class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px;" type="button">+ Add Link</button>
              </div>
              <div id="links-list"></div>
            </div>

            <!-- Custom Question Answers -->
            <div class="form-section">
              <div class="section-title">
                <span>Custom Question Answers (Work Authorization, Salary, Relocation)</span>
                <button id="add-custom-btn" class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px;" type="button">+ Add Field</button>
              </div>
              <div id="custom-fields-list"></div>
            </div>
          </div>

          <!-- Raw JSON View -->
          <div id="json-editor-view">
            <div class="json-toolbar">
              <span class="field-label">JSON Source Code</span>
              <div style="display: flex; gap: 8px;">
                <button id="format-json-btn" class="btn btn-secondary" type="button">Format JSON</button>
                <button id="copy-json-btn" class="btn btn-secondary" type="button">Copy to Clipboard</button>
              </div>
            </div>
            <div id="json-error-box" class="json-error"></div>
            <textarea id="json-textarea" class="json-textarea" spellcheck="false"></textarea>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- Create Persona Modal -->
  <div id="new-persona-modal" class="modal-overlay">
    <div class="modal-dialog">
      <h3 class="modal-title">Create New Persona Profile</h3>
      <div class="field-group">
        <label class="field-label" for="modal-persona-id">Persona Identifier (ID)</label>
        <input type="text" id="modal-persona-id" class="field-input" placeholder="e.g. backend-lead, ai-researcher" />
        <span style="font-size: 10.5px; color: var(--text-muted);">Letters, numbers, hyphens, and underscores only.</span>
      </div>
      <div class="field-group">
        <label class="field-label" for="modal-persona-name">Full Name</label>
        <input type="text" id="modal-persona-name" class="field-input" placeholder="e.g. Jane Doe" />
      </div>
      <div class="field-group">
        <label class="field-label" for="modal-persona-template">Starter Template</label>
        <select id="modal-persona-template" class="field-input">
          <option value="clone">Clone Current Active Persona</option>
          <option value="software-engineer">Software Engineer Template</option>
          <option value="product-manager">Product Manager Template</option>
          <option value="data-scientist">Data Scientist & AI Template</option>
          <option value="blank">Blank Profile</option>
        </select>
      </div>
      <div class="modal-actions">
        <button id="modal-cancel-btn" class="btn btn-secondary" type="button">Cancel</button>
        <button id="modal-create-btn" class="btn btn-primary" type="button">Create Persona</button>
      </div>
    </div>
  </div>

  <!-- Client-Side Dashboard Script -->
  <script>
    let allProfiles = [];
    let currentProfileId = null;
    let currentActiveId = null;
    let currentProfileData = null;
    let currentViewMode = 'visual';

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = type;
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }

    async function loadProfiles(selectId = null) {
      try {
        const res = await fetch('/profiles');
        const data = await res.json();
        if (data.status === 'success') {
          allProfiles = data.profiles;
          currentActiveId = data.activeProfileId;
          renderPersonaList();

          const targetId = selectId || currentProfileId || currentActiveId || allProfiles[0]?.id;
          if (targetId) {
            await selectPersona(targetId);
          }
        }
      } catch (err) {
        showToast('Failed to load profiles: ' + err.message, 'error');
      }
    }

    function renderPersonaList() {
      const listEl = document.getElementById('persona-list');
      const filter = (document.getElementById('search-input').value || '').toLowerCase();
      listEl.innerHTML = '';

      const filtered = allProfiles.filter(p =>
        p.name.toLowerCase().includes(filter) ||
        p.id.toLowerCase().includes(filter) ||
        (p.headline && p.headline.toLowerCase().includes(filter))
      );

      if (filtered.length === 0) {
        listEl.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 8px;">No personas found</div>';
        return;
      }

      for (const p of filtered) {
        const card = document.createElement('div');
        card.className = 'persona-card' + (p.id === currentProfileId ? ' active-item' : '');
        card.onclick = () => selectPersona(p.id);

        const headerRow = document.createElement('div');
        headerRow.className = 'persona-header-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'persona-name';
        nameSpan.textContent = p.name;
        headerRow.appendChild(nameSpan);

        if (p.id === currentActiveId) {
          const badge = document.createElement('span');
          badge.className = 'badge badge-active';
          badge.textContent = 'Active';
          headerRow.appendChild(badge);
        }

        card.appendChild(headerRow);

        if (p.headline) {
          const headlineSpan = document.createElement('span');
          headlineSpan.className = 'persona-headline';
          headlineSpan.textContent = p.headline;
          card.appendChild(headlineSpan);
        }

        const idTag = document.createElement('span');
        idTag.className = 'persona-id-tag';
        idTag.textContent = p.id;
        card.appendChild(idTag);

        listEl.appendChild(card);
      }
    }

    async function selectPersona(profileId) {
      currentProfileId = profileId;
      renderPersonaList();

      try {
        const res = await fetch('/profiles/' + profileId);
        if (!res.ok) throw new Error('Failed to fetch profile details');
        const data = await res.json();
        currentProfileData = data;

        // Update toolbar
        document.getElementById('target-persona-name').textContent = data.name;
        document.getElementById('target-persona-id').textContent = profileId;
        const activeBadge = document.getElementById('target-active-badge');
        activeBadge.style.display = profileId === currentActiveId ? 'inline-block' : 'none';

        // Update Delete button status
        const deleteBtn = document.getElementById('delete-profile-btn');
        if (profileId === currentActiveId) {
          deleteBtn.disabled = true;
          deleteBtn.title = 'Cannot delete active persona. Switch first.';
          deleteBtn.style.opacity = '0.4';
          deleteBtn.style.cursor = 'not-allowed';
        } else {
          deleteBtn.disabled = false;
          deleteBtn.title = 'Delete persona profile';
          deleteBtn.style.opacity = '1';
          deleteBtn.style.cursor = 'pointer';
        }

        // Render in both views
        populateVisualForm(data);
        populateJsonEditor(data);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    function populateVisualForm(data) {
      document.getElementById('input-name').value = data.name || '';
      document.getElementById('input-email').value = data.email || '';
      document.getElementById('input-phone').value = data.phone || '';
      document.getElementById('input-alt-phone').value = data['alternate phone'] || data.alternatePhone || '';
      document.getElementById('input-address').value = data.address || '';

      const headline = (data.custom && data.custom.Headline) || (data.experience && data.experience[0]?.title) || '';
      document.getElementById('input-headline').value = headline;

      // Render Skills
      renderSkills(data.skills || []);

      // Render Experience
      renderExperienceList(data.experience || []);

      // Render Education
      renderEducationList(data.education || []);

      // Render Links
      renderLinksList(data.links || {});

      // Render Custom Fields
      renderCustomFieldsList(data.custom || {});
    }

    function populateJsonEditor(data) {
      const textarea = document.getElementById('json-textarea');
      textarea.value = JSON.stringify(data, null, 2);
      document.getElementById('json-error-box').style.display = 'none';
    }

    function renderSkills(skills) {
      const container = document.getElementById('skills-list');
      container.innerHTML = '';
      skills.forEach((skill, idx) => {
        const chip = document.createElement('span');
        chip.className = 'skill-chip';
        chip.innerHTML = skill + ' <span class="skill-chip-remove" onclick="removeSkill(' + idx + ')">&times;</span>';
        container.appendChild(chip);
      });
    }

    function removeSkill(index) {
      if (!currentProfileData.skills) return;
      currentProfileData.skills.splice(index, 1);
      renderSkills(currentProfileData.skills);
    }

    function renderExperienceList(list) {
      const container = document.getElementById('experience-list');
      container.innerHTML = '';
      list.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'sub-item-card';
        card.innerHTML = \`
          <button type="button" class="sub-item-remove" onclick="removeExperience(\${idx})">&times;</button>
          <div class="grid-2">
            <div class="field-group">
              <label class="field-label">Job Title</label>
              <input type="text" class="field-input exp-title" value="\${item.title || ''}" />
            </div>
            <div class="field-group">
              <label class="field-label">Company</label>
              <input type="text" class="field-input exp-company" value="\${item.company || ''}" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Duration</label>
            <input type="text" class="field-input exp-duration" value="\${item.duration || ''}" placeholder="e.g. 2023 - Present" />
          </div>
          <div class="field-group">
            <label class="field-label">Description / Responsibilities</label>
            <textarea class="field-textarea exp-desc">\${item.description || ''}</textarea>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function removeExperience(index) {
      if (!currentProfileData.experience) return;
      currentProfileData.experience.splice(index, 1);
      renderExperienceList(currentProfileData.experience);
    }

    function renderEducationList(list) {
      const container = document.getElementById('education-list');
      container.innerHTML = '';
      list.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'sub-item-card';
        card.innerHTML = \`
          <button type="button" class="sub-item-remove" onclick="removeEducation(\${idx})">&times;</button>
          <div class="grid-2">
            <div class="field-group">
              <label class="field-label">Degree / Field of Study</label>
              <input type="text" class="field-input edu-degree" value="\${item.degree || ''}" />
            </div>
            <div class="field-group">
              <label class="field-label">School / University</label>
              <input type="text" class="field-input edu-school" value="\${item.school || ''}" />
            </div>
          </div>
          <div class="grid-3">
            <div class="field-group">
              <label class="field-label">Graduation Year</label>
              <input type="text" class="field-input edu-year" value="\${item['Graduation year'] || item.year || ''}" />
            </div>
            <div class="field-group">
              <label class="field-label">Start Date</label>
              <input type="text" class="field-input edu-start" value="\${item['start date'] || ''}" />
            </div>
            <div class="field-group">
              <label class="field-label">End Date</label>
              <input type="text" class="field-input edu-end" value="\${item['end date'] || ''}" />
            </div>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function removeEducation(index) {
      if (!currentProfileData.education) return;
      currentProfileData.education.splice(index, 1);
      renderEducationList(currentProfileData.education);
    }

    function renderLinksList(links) {
      const container = document.getElementById('links-list');
      container.innerHTML = '';
      Object.entries(links).forEach(([key, val], idx) => {
        const row = document.createElement('div');
        row.className = 'grid-2';
        row.style.marginBottom = '8px';
        row.innerHTML = \`
          <input type="text" class="field-input link-key" value="\${key}" placeholder="Platform (e.g. LinkedIn)" />
          <div style="display: flex; gap: 6px;">
            <input type="text" class="field-input link-val" value="\${val}" placeholder="https://..." />
            <button type="button" class="sub-item-remove" style="position: static;" onclick="removeLink('\${key}')">&times;</button>
          </div>
        \`;
        container.appendChild(row);
      });
    }

    function removeLink(key) {
      if (currentProfileData.links) {
        delete currentProfileData.links[key];
        renderLinksList(currentProfileData.links);
      }
    }

    function renderCustomFieldsList(custom) {
      const container = document.getElementById('custom-fields-list');
      container.innerHTML = '';
      Object.entries(custom).forEach(([key, val]) => {
        if (key === 'Headline') return; // Handled in top card
        const row = document.createElement('div');
        row.className = 'grid-2';
        row.style.marginBottom = '8px';
        row.innerHTML = \`
          <input type="text" class="field-input custom-key" value="\${key}" placeholder="Question Name" />
          <div style="display: flex; gap: 6px;">
            <input type="text" class="field-input custom-val" value="\${val}" placeholder="Answer value" />
            <button type="button" class="sub-item-remove" style="position: static;" onclick="removeCustomField('\${key}')">&times;</button>
          </div>
        \`;
        container.appendChild(row);
      });
    }

    function removeCustomField(key) {
      if (currentProfileData.custom) {
        delete currentProfileData.custom[key];
        renderCustomFieldsList(currentProfileData.custom);
      }
    }

    function collectVisualFormData() {
      const headline = document.getElementById('input-headline').value.trim();

      // Collect experiences
      const expCards = document.querySelectorAll('#experience-list .sub-item-card');
      const experience = [];
      expCards.forEach(card => {
        const title = card.querySelector('.exp-title').value.trim();
        const company = card.querySelector('.exp-company').value.trim();
        const duration = card.querySelector('.exp-duration').value.trim();
        const description = card.querySelector('.exp-desc').value.trim();
        if (title || company) {
          experience.push({ title, company, duration, description });
        }
      });

      // Collect education
      const eduCards = document.querySelectorAll('#education-list .sub-item-card');
      const education = [];
      eduCards.forEach(card => {
        const degree = card.querySelector('.edu-degree').value.trim();
        const school = card.querySelector('.edu-school').value.trim();
        const year = card.querySelector('.edu-year').value.trim();
        const startDate = card.querySelector('.edu-start').value.trim();
        const endDate = card.querySelector('.edu-end').value.trim();
        if (degree || school) {
          const item = { degree, school };
          if (year) item['Graduation year'] = year;
          if (startDate) item['start date'] = startDate;
          if (endDate) item['end date'] = endDate;
          education.push(item);
        }
      });

      // Collect links
      const linkRows = document.querySelectorAll('#links-list .grid-2');
      const links = {};
      linkRows.forEach(row => {
        const key = row.querySelector('.link-key').value.trim();
        const val = row.querySelector('.link-val').value.trim();
        if (key && val) links[key] = val;
      });

      // Collect custom fields
      const customRows = document.querySelectorAll('#custom-fields-list .grid-2');
      const custom = {};
      if (headline) custom.Headline = headline;
      customRows.forEach(row => {
        const key = row.querySelector('.custom-key').value.trim();
        const val = row.querySelector('.custom-val').value.trim();
        if (key && val) custom[key] = val;
      });

      return {
        name: document.getElementById('input-name').value.trim(),
        email: document.getElementById('input-email').value.trim(),
        phone: document.getElementById('input-phone').value.trim(),
        address: document.getElementById('input-address').value.trim(),
        skills: currentProfileData?.skills || [],
        experience,
        education,
        links,
        custom,
      };
    }

    async function saveCurrentPersona() {
      if (!currentProfileId) return;

      let payload = null;
      if (currentViewMode === 'visual') {
        payload = collectVisualFormData();
      } else {
        const jsonText = document.getElementById('json-textarea').value;
        try {
          payload = JSON.parse(jsonText);
        } catch (err) {
          document.getElementById('json-error-box').style.display = 'block';
          document.getElementById('json-error-box').textContent = 'JSON Syntax Error: ' + err.message;
          showToast('Invalid JSON format', 'error');
          return;
        }
      }

      try {
        const res = await fetch('/profiles/' + currentProfileId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.status === 'success') {
          showToast('Profile "' + currentProfileId + '" saved successfully!', 'success');
          await loadProfiles(currentProfileId);
        } else {
          showToast('Save failed: ' + (data.error || 'Server error'), 'error');
        }
      } catch (err) {
        showToast('Save error: ' + err.message, 'error');
      }
    }

    async function setActivePersona() {
      if (!currentProfileId) return;
      try {
        const res = await fetch('/profiles/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: currentProfileId }),
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          currentActiveId = currentProfileId;
          showToast('Active persona switched to "' + currentProfileId + '"', 'success');
          await loadProfiles(currentProfileId);
        } else {
          showToast('Switch failed: ' + (data.error || 'Server error'), 'error');
        }
      } catch (err) {
        showToast('Switch error: ' + err.message, 'error');
      }
    }

    async function deletePersona() {
      if (!currentProfileId) return;
      if (currentProfileId === currentActiveId) {
        showToast('Cannot delete active persona profile.', 'error');
        return;
      }

      if (!confirm('Are you sure you want to delete profile "' + currentProfileId + '"? This action cannot be undone.')) {
        return;
      }

      try {
        const res = await fetch('/profiles/' + currentProfileId, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          showToast('Profile deleted successfully', 'success');
          currentProfileId = currentActiveId;
          await loadProfiles(currentActiveId);
        } else {
          showToast('Delete failed: ' + (data.error || 'Server error'), 'error');
        }
      } catch (err) {
        showToast('Delete error: ' + err.message, 'error');
      }
    }

    // Modal creation logic
    function openCreateModal() {
      document.getElementById('modal-persona-id').value = '';
      document.getElementById('modal-persona-name').value = '';
      document.getElementById('new-persona-modal').style.display = 'flex';
      document.getElementById('modal-persona-id').focus();
    }

    function closeCreateModal() {
      document.getElementById('new-persona-modal').style.display = 'none';
    }

    async function createNewPersona() {
      const id = document.getElementById('modal-persona-id').value.trim();
      const name = document.getElementById('modal-persona-name').value.trim();
      const template = document.getElementById('modal-persona-template').value;

      if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        alert('Please enter a valid Profile ID (letters, numbers, dashes, and underscores only).');
        return;
      }

      let profileSeed = {
        name: name || 'New Persona',
        email: 'user@example.com',
        phone: '+1 555-000-0000',
        skills: ['Communication', 'Problem Solving'],
        experience: [],
        education: [],
        links: {},
        custom: {},
      };

      if (template === 'clone' && currentProfileData) {
        profileSeed = JSON.parse(JSON.stringify(currentProfileData));
        if (name) profileSeed.name = name;
      } else if (template === 'software-engineer') {
        profileSeed = {
          name: name || 'Software Engineer',
          email: 'swe@example.com',
          phone: '+1 555-123-4567',
          address: 'San Francisco, CA',
          skills: ['TypeScript', 'Node.js', 'React', 'Python', 'SQL', 'Git'],
          experience: [{ title: 'Fullstack Software Engineer', company: 'Tech Inc', duration: '2023 - Present', description: 'Engineered web applications and APIs.' }],
          education: [{ degree: 'B.S. Computer Science', school: 'University', 'Graduation year': '2023' }],
          links: { GitHub: 'https://github.com', LinkedIn: 'https://linkedin.com' },
          custom: { Headline: 'Fullstack Software Engineer', 'Work Authorization': 'Yes' },
        };
      } else if (template === 'product-manager') {
        profileSeed = {
          name: name || 'Product Manager',
          email: 'pm@example.com',
          phone: '+1 555-234-5678',
          address: 'New York, NY',
          skills: ['Product Strategy', 'PRDs', 'Agile / Scrum', 'User Research', 'SQL', 'A/B Testing'],
          experience: [{ title: 'Technical Product Manager', company: 'Product Co', duration: '2023 - Present', description: 'Led sprint roadmaps, feature specs, and stakeholder alignment.' }],
          education: [{ degree: 'B.S. in Business & Engineering', school: 'University', 'Graduation year': '2023' }],
          links: { LinkedIn: 'https://linkedin.com' },
          custom: { Headline: 'Technical Product Manager', 'Work Authorization': 'Yes' },
        };
      } else if (template === 'data-scientist') {
        profileSeed = {
          name: name || 'Data Scientist',
          email: 'ai@example.com',
          phone: '+1 555-345-6789',
          address: 'Austin, TX',
          skills: ['Python', 'PyTorch', 'Machine Learning', 'Deep Learning', 'LLMs', 'SQL', 'Docker'],
          experience: [{ title: 'Machine Learning Engineer', company: 'AI Labs', duration: '2023 - Present', description: 'Built and evaluated generative AI and predictive models.' }],
          education: [{ degree: 'M.S. in Data Science', school: 'University', 'Graduation year': '2023' }],
          links: { GitHub: 'https://github.com', LinkedIn: 'https://linkedin.com' },
          custom: { Headline: 'AI & Data Science Specialist', 'Work Authorization': 'Yes' },
        };
      }

      try {
        const res = await fetch('/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, profile: profileSeed }),
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          closeCreateModal();
          showToast('Persona "' + id + '" created successfully!', 'success');
          await loadProfiles(id);
        } else {
          alert('Creation failed: ' + (data.error || 'Server error'));
        }
      } catch (err) {
        alert('Creation error: ' + err.message);
      }
    }

    // Event listeners
    document.addEventListener('DOMContentLoaded', () => {
      loadProfiles();

      document.getElementById('search-input').addEventListener('input', renderPersonaList);
      document.getElementById('save-profile-btn').addEventListener('click', saveCurrentPersona);
      document.getElementById('set-active-btn').addEventListener('click', setActivePersona);
      document.getElementById('delete-profile-btn').addEventListener('click', deletePersona);

      document.getElementById('new-persona-btn').addEventListener('click', openCreateModal);
      document.getElementById('modal-cancel-btn').addEventListener('click', closeCreateModal);
      document.getElementById('modal-create-btn').addEventListener('click', createNewPersona);

      // Tabs
      const tabVisualBtn = document.getElementById('tab-visual-btn');
      const tabJsonBtn = document.getElementById('tab-json-btn');
      const visualView = document.getElementById('visual-form-view');
      const jsonView = document.getElementById('json-editor-view');

      tabVisualBtn.addEventListener('click', () => {
        if (currentViewMode === 'json') {
          // Sync from JSON to Visual
          try {
            const parsed = JSON.parse(document.getElementById('json-textarea').value);
            currentProfileData = parsed;
            populateVisualForm(parsed);
          } catch (err) {
            showToast('Invalid JSON syntax: cannot switch back to visual form', 'error');
            return;
          }
        }
        currentViewMode = 'visual';
        tabVisualBtn.classList.add('active');
        tabJsonBtn.classList.remove('active');
        visualView.style.display = 'block';
        jsonView.style.display = 'none';
      });

      tabJsonBtn.addEventListener('click', () => {
        if (currentViewMode === 'visual') {
          // Sync from Visual to JSON
          const collected = collectVisualFormData();
          currentProfileData = collected;
          populateJsonEditor(collected);
        }
        currentViewMode = 'json';
        tabJsonBtn.classList.add('active');
        tabVisualBtn.classList.remove('active');
        visualView.style.display = 'none';
        jsonView.style.display = 'flex';
      });

      // Format & Copy JSON
      document.getElementById('format-json-btn').addEventListener('click', () => {
        const textarea = document.getElementById('json-textarea');
        try {
          const parsed = JSON.parse(textarea.value);
          textarea.value = JSON.stringify(parsed, null, 2);
          document.getElementById('json-error-box').style.display = 'none';
          showToast('JSON formatted', 'info');
        } catch (err) {
          document.getElementById('json-error-box').style.display = 'block';
          document.getElementById('json-error-box').textContent = 'JSON Syntax Error: ' + err.message;
        }
      });

      document.getElementById('copy-json-btn').addEventListener('click', () => {
        const textarea = document.getElementById('json-textarea');
        navigator.clipboard.writeText(textarea.value).then(() => {
          showToast('Copied JSON to clipboard', 'info');
        });
      });

      // Add Sub-items
      document.getElementById('add-skill-btn').addEventListener('click', () => {
        const input = document.getElementById('input-new-skill');
        const skill = input.value.trim();
        if (skill) {
          if (!currentProfileData.skills) currentProfileData.skills = [];
          if (!currentProfileData.skills.includes(skill)) {
            currentProfileData.skills.push(skill);
            renderSkills(currentProfileData.skills);
          }
          input.value = '';
        }
      });

      document.getElementById('input-new-skill').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('add-skill-btn').click();
        }
      });

      document.getElementById('add-experience-btn').addEventListener('click', () => {
        if (!currentProfileData.experience) currentProfileData.experience = [];
        currentProfileData.experience.unshift({ title: '', company: '', duration: '', description: '' });
        renderExperienceList(currentProfileData.experience);
      });

      document.getElementById('add-education-btn').addEventListener('click', () => {
        if (!currentProfileData.education) currentProfileData.education = [];
        currentProfileData.education.unshift({ degree: '', school: '', 'Graduation year': '' });
        renderEducationList(currentProfileData.education);
      });

      document.getElementById('add-link-btn').addEventListener('click', () => {
        if (!currentProfileData.links) currentProfileData.links = {};
        const key = prompt('Enter link platform (e.g. Portfolio, Twitter, Blog):');
        if (key && key.trim()) {
          currentProfileData.links[key.trim()] = '';
          renderLinksList(currentProfileData.links);
        }
      });

      document.getElementById('add-custom-btn').addEventListener('click', () => {
        if (!currentProfileData.custom) currentProfileData.custom = {};
        const key = prompt('Enter custom question name (e.g. Expected Salary, Work Authorization, Notice Period):');
        if (key && key.trim()) {
          currentProfileData.custom[key.trim()] = '';
          renderCustomFieldsList(currentProfileData.custom);
        }
      });
    });
  </script>
</body>
</html>`;
}
