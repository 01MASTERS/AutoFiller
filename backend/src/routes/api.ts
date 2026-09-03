import { Router, Request, Response, NextFunction } from 'express';
import { HealthResponse, AutofillResponse, FieldMetadata } from '@autofiller/shared';
import { ProfileStore } from '../services/profileStore.js';
import { autofillRequestSchema } from '../types/profile.js';
import { LLMGateway } from '../services/llm/gateway.js';
import { LLMProviderError, LLMParseError } from '../services/llm/types.js';
import { ZodError } from 'zod';

import { LoggerService } from '../services/loggerService.js';
import { LogEntry, LogLevel, LogSource, LogsResponse } from '@autofiller/shared';

export const apiRouter = Router();
let llmGatewayInstance = new LLMGateway();
const logger = LoggerService.getInstance();

export function setLLMGateway(gateway: LLMGateway): void {
  llmGatewayInstance = gateway;
}

apiRouter.get('/health', (req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

apiRouter.get('/logs', (req: Request, res: Response) => {
  const level = req.query.level as LogLevel | undefined;
  const source = req.query.source as LogSource | undefined;
  const query = req.query.query as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  const logs = logger.getLogs({ level, source, query, limit });
  const response: LogsResponse = {
    status: 'success',
    logs,
    total: logs.length,
  };
  res.json(response);
});

apiRouter.post('/logs', (req: Request, res: Response) => {
  const { level, source, tag, message, details, timestamp } = req.body || {};
  if (!level || !source || !tag || !message) {
    res.status(400).json({ status: 'error', error: 'Missing required log fields' });
    return;
  }

  const log = logger.addLog({
    level,
    source,
    tag,
    message,
    details,
    timestamp,
  });

  res.json({ status: 'success', log });
});

apiRouter.delete('/logs', (req: Request, res: Response) => {
  logger.clearLogs();
  res.json({ status: 'success', message: 'Logs cleared' });
});
apiRouter.get('/logs-ui', (req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoFiller — Activity & Debug Logs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(14, 18, 28, 0.75);
      --card-solid: #0d121c;
      --border: rgba(255, 255, 255, 0.08);
      --border-subtle: rgba(255, 255, 255, 0.04);
      --text: #f1f5f9;
      --text-muted: #64748b;
      --text-dim: #94a3b8;
      --accent: #6366f1;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      background: radial-gradient(1200px 800px at 50% -120px, rgba(99, 102, 241, 0.08), rgba(56, 189, 248, 0.04) 40%, transparent 80%), var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .container {
      width: 100%;
      max-width: 1380px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Header Bar */
    .header {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      letter-spacing: -0.01em;
    }
    .system-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-family: var(--font-mono);
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #34d399;
      padding: 3px 9px;
      border-radius: 20px;
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 8px #34d399;
      animation: livePulse 2s infinite ease-in-out;
    }
    @keyframes livePulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.85); }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      color: var(--text-dim);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      font-family: var(--font-mono);
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.15);
    }
    .btn-primary {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.35);
      color: #a5b4fc;
    }
    .btn-primary:hover {
      background: rgba(99, 102, 241, 0.22);
      border-color: #6366f1;
      color: #fff;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }

    /* Control Filter Panel */
    .controls-panel {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Category Filter Strip */
    .category-strip {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .strip-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-right: 6px;
      user-select: none;
    }
    .cat-btn {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-subtle);
      color: var(--text-dim);
      font-size: 11.5px;
      padding: 4px 11px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .cat-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.1);
    }
    .cat-btn.active {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
      font-weight: 600;
    }

    /* Level and Search Strip */
    .filter-search-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .level-pills {
      display: flex;
      gap: 4px;
      background: rgba(0, 0, 0, 0.35);
      padding: 3px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
    }
    .level-pill {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      padding: 4px 9px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .level-pill:hover {
      color: #cbd5e1;
      background: rgba(255, 255, 255, 0.03);
    }
    .level-pill.active {
      color: #fff;
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.12);
      font-weight: 600;
    }
    .count-chip {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
    }

    .command-search {
      flex: 1;
      min-width: 240px;
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 10px;
      color: var(--text-muted);
      font-size: 12px;
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 6px 32px 6px 30px;
      outline: none;
      transition: all 0.15s ease;
    }
    .search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
      background: rgba(0, 0, 0, 0.5);
    }
    .kbd-shortcut {
      position: absolute;
      right: 9px;
      font-size: 10px;
      font-family: var(--font-mono);
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.06);
      padding: 1px 5px;
      border-radius: 3px;
      pointer-events: none;
    }

    /* Stream Feed */
    .stream-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 16px 36px -10px rgba(0,0,0,0.5);
    }

    .stream-feed {
      font-family: var(--font-mono);
      font-size: 12px;
      max-height: 700px;
      overflow-y: auto;
    }

    .stream-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 9px 18px;
      border-bottom: 1px solid var(--border-subtle);
      transition: background 0.12s ease;
      cursor: pointer;
      position: relative;
    }
    .stream-row:last-child { border-bottom: none; }
    .stream-row:hover { background: rgba(255, 255, 255, 0.025); }
    .stream-row.expanded { background: rgba(255, 255, 255, 0.035); }

    /* Glowing Dots */
    .glow-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-top: 6px;
      flex-shrink: 0;
    }
    .dot-ERROR { background: #f87171; box-shadow: 0 0 9px rgba(248, 113, 113, 0.8); }
    .dot-WARN { background: #fbbf24; box-shadow: 0 0 8px rgba(251, 191, 36, 0.8); }
    .dot-SUCCESS { background: #34d399; box-shadow: 0 0 8px rgba(52, 211, 153, 0.8); }
    .dot-INFO { background: #60a5fa; box-shadow: 0 0 6px rgba(96, 165, 250, 0.6); }

    .time-col {
      color: var(--text-muted);
      font-size: 11px;
      white-space: nowrap;
      padding-top: 2px;
      user-select: none;
    }

    .badge-col {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .badge-ERROR {
      background: rgba(239, 68, 68, 0.14);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .badge-WARN {
      background: rgba(245, 158, 11, 0.14);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.25);
    }
    .badge-SUCCESS {
      background: rgba(16, 185, 129, 0.14);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .badge-INFO {
      background: rgba(59, 130, 246, 0.14);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.25);
    }

    .source-col {
      color: var(--text-muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .tag-col {
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .tag-ERROR { color: #f87171; font-weight: 700; }
    .tag-WARN { color: #fbbf24; }
    .tag-SUCCESS { color: #34d399; }
    .tag-INFO { color: #a78bfa; }

    .message-col {
      flex: 1;
      word-break: break-word;
      color: #e2e8f0;
      line-height: 1.5;
    }

    /* Row Hover Action Buttons */
    .row-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      opacity: 0;
      transition: opacity 0.15s ease;
      margin-left: auto;
      padding-top: 1px;
    }
    .stream-row:hover .row-actions { opacity: 1; }
    .stream-row.expanded .row-actions { opacity: 1; }

    .row-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-dim);
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.12s ease;
      font-family: var(--font-mono);
    }
    .row-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    /* Details Drawer */
    .details-drawer {
      margin-top: 8px;
      background: #04060a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 12px 14px;
      color: #cbd5e1;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      overflow-y: auto;
      box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
      position: relative;
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 6px;
      margin-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      font-size: 10px;
      user-select: none;
    }
    .copy-payload-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-dim);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      cursor: pointer;
    }
    .copy-payload-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    .hidden { display: none !important; }

    /* Toast */
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #182030;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-family: var(--font-mono);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
      opacity: 0;
      transform: translateY(8px);
      transition: all 0.2s ease;
      pointer-events: none;
      z-index: 1000;
    }
    #toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="brand-section">
        <div class="brand-badge">
          <span style="font-size: 16px;">⚡</span>
          <span>AutoFiller</span>
          <span style="color:var(--text-muted); font-size:12px; font-weight:400;">/</span>
          <span style="color:var(--text-dim); font-size:13px; font-weight:500;">Diagnostics & Activity</span>
        </div>
        <div class="system-pill">
          <span class="pulse-dot"></span>
          <span id="connection-status">Live Connected (3s)</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="copyAllLogs()">📋 Copy Stream</button>
        <button class="btn btn-danger" onclick="clearAllLogs()">🗑️ Clear</button>
      </div>
    </div>

    <!-- Controls Panel -->
    <div class="controls-panel">
      <!-- Category Options -->
      <div class="category-strip">
        <span class="strip-label">Category:</span>
        <button class="cat-btn active" id="cat-all" onclick="setCategory('')">All Categories</button>
        <button class="cat-btn" id="cat-llm" onclick="setCategory('LLM')">🤖 LLM & API</button>
        <button class="cat-btn" id="cat-scan" onclick="setCategory('SCAN')">📄 Form Scanning</button>
        <button class="cat-btn" id="cat-fill" onclick="setCategory('FILL')">✍️ Form Filling</button>
        <button class="cat-btn" id="cat-bg" onclick="setCategory('BG')">🧩 Background</button>
        <button class="cat-btn" id="cat-popup" onclick="setCategory('POPUP')">🎛️ Popup</button>
      </div>

      <!-- Level & Search Filter Strip -->
      <div class="filter-search-strip">
        <div class="level-pills">
          <button class="level-pill active" id="chip-all" onclick="setLevelFilter('')">
            <span>ALL</span>
            <span class="count-chip" id="cnt-all">0</span>
          </button>
          <button class="level-pill" id="chip-error" onclick="setLevelFilter('ERROR')">
            <span>ERRORS</span>
            <span class="count-chip" id="cnt-error" style="color:#f87171;">0</span>
          </button>
          <button class="level-pill" id="chip-warn" onclick="setLevelFilter('WARN')">
            <span>WARNINGS</span>
            <span class="count-chip" id="cnt-warn" style="color:#fbbf24;">0</span>
          </button>
          <button class="level-pill" id="chip-success" onclick="setLevelFilter('SUCCESS')">
            <span>SUCCESS</span>
            <span class="count-chip" id="cnt-success" style="color:#34d399;">0</span>
          </button>
          <button class="level-pill" id="chip-info" onclick="setLevelFilter('INFO')">
            <span>INFO</span>
            <span class="count-chip" id="cnt-info">0</span>
          </button>
        </div>

        <div class="command-search">
          <span class="search-icon">🔍</span>
          <input type="text" id="search-input" class="search-input" placeholder="Search parameters, tags, fields..." oninput="applyFiltersAndRender()" />
          <span class="kbd-shortcut">/</span>
        </div>

        <button class="btn" onclick="fetchLogs(true)" title="Force refresh">🔄 Refresh</button>
      </div>
    </div>

    <!-- Log Stream Card -->
    <div class="stream-card">
      <div class="stream-feed" id="stream-feed">
        <div style="color:var(--text-muted); padding: 24px; text-align:center; font-family:var(--font-mono); font-size:12px;">Loading activity stream...</div>
      </div>
    </div>
  </div>

  <div id="toast">Copied to clipboard!</div>

  <script>
    let activeLevel = '';
    let activeCategory = '';
    let rawLogs = [];
    const expandedIds = new Set();

    // '/' to focus search
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== document.getElementById('search-input')) {
        e.preventDefault();
        document.getElementById('search-input').focus();
      }
    });

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function setCategory(cat) {
      activeCategory = cat;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = document.getElementById(cat ? 'cat-' + cat.toLowerCase() : 'cat-all');
      if (activeBtn) activeBtn.classList.add('active');
      applyFiltersAndRender();
    }

    function setLevelFilter(level) {
      activeLevel = level;
      document.querySelectorAll('.level-pill').forEach(b => b.classList.remove('active'));
      const activePill = document.getElementById(level ? 'chip-' + level.toLowerCase() : 'chip-all');
      if (activePill) activePill.classList.add('active');
      applyFiltersAndRender();
    }

    function matchesCategory(log, cat) {
      if (!cat) return true;
      const s = (log.source || '').toUpperCase();
      const t = (log.tag || '').toUpperCase();

      if (cat === 'LLM') {
        return s === 'LLM_GATEWAY' || t.startsWith('LLM_') || t.startsWith('MODELS_');
      }
      if (cat === 'SCAN') {
        return t.includes('SCAN');
      }
      if (cat === 'FILL') {
        return t.includes('FILL');
      }
      if (cat === 'BG') {
        return s === 'BACKGROUND';
      }
      if (cat === 'POPUP') {
        return s === 'EXTENSION_POPUP';
      }
      return true;
    }

    function updateCounters(logs) {
      let err = 0, warn = 0, succ = 0, info = 0;
      logs.forEach(l => {
        if (l.level === 'ERROR') err++;
        else if (l.level === 'WARN') warn++;
        else if (l.level === 'SUCCESS') succ++;
        else if (l.level === 'INFO') info++;
      });
      document.getElementById('cnt-all').textContent = logs.length;
      document.getElementById('cnt-error').textContent = err;
      document.getElementById('cnt-warn').textContent = warn;
      document.getElementById('cnt-success').textContent = succ;
      document.getElementById('cnt-info').textContent = info;
    }

    function areLogsEqual(prev, next) {
      if (!prev || !next) return false;
      if (prev.length !== next.length) return false;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].id !== next[i].id || prev[i].timestamp !== next[i].timestamp) {
          return false;
        }
      }
      return true;
    }

    async function fetchLogs(forceRender = false) {
      try {
        const res = await fetch('/logs?limit=500');
        const data = await res.json();
        if (data.status === 'success') {
          const newLogs = data.logs || [];
          if (!forceRender && areLogsEqual(rawLogs, newLogs)) {
            return;
          }
          rawLogs = newLogs;
          applyFiltersAndRender();
        }
      } catch (err) {
        document.getElementById('stream-feed').innerHTML = '<div style="color:#f87171; padding:24px; text-align:center; font-family:var(--font-mono); font-size:12px;">Failed to connect to backend logs service.</div>';
      }
    }

    function applyFiltersAndRender() {
      const query = (document.getElementById('search-input')?.value || '').trim().toLowerCase();

      // Filter by category, level, and search text
      const filtered = rawLogs.filter(l => {
        if (activeLevel && l.level !== activeLevel) return false;
        if (activeCategory && !matchesCategory(l, activeCategory)) return false;
        if (query) {
          const matchMsg = (l.message || '').toLowerCase().includes(query);
          const matchTag = (l.tag || '').toLowerCase().includes(query);
          const matchSrc = (l.source || '').toLowerCase().includes(query);
          const matchDet = l.details ? JSON.stringify(l.details).toLowerCase().includes(query) : false;
          if (!matchMsg && !matchTag && !matchSrc && !matchDet) return false;
        }
        return true;
      });

      updateCounters(rawLogs);
      renderFeed(filtered);
    }

    function renderFeed(logs) {
      const container = document.getElementById('stream-feed');
      if (logs.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); padding:32px; text-align:center; font-family:var(--font-mono); font-size:12px;">No matching log events in selected category / filter.</div>';
        return;
      }

      // Preserve scroll offsets of open details drawers
      const scrollMap = new Map();
      document.querySelectorAll('.details-drawer').forEach(el => {
        if (el.id && el.scrollTop > 0) {
          scrollMap.set(el.id, el.scrollTop);
        }
      });

      container.innerHTML = logs.map(l => {
        const date = new Date(l.timestamp).toLocaleTimeString();
        const msg = l.message || '';
        const isLongMsg = msg.length > 140;
        const shortMsg = isLongMsg ? msg.substring(0, 140) + '...' : msg;
        const hasDetails = Boolean(l.details);
        const isExpandable = isLongMsg || hasDetails;
        const isExpanded = expandedIds.has(l.id);

        const detailsDrawer = hasDetails
          ? '<div class="details-drawer ' + (isExpanded ? '' : 'hidden') + '" id="details-' + l.id + '">' +
              '<div class="drawer-header">' +
                '<span>JSON DIAGNOSTIC PAYLOAD</span>' +
                '<button class="copy-payload-btn" onclick="event.stopPropagation(); copyPayload(\\'' + l.id + '\\')">Copy Payload</button>' +
              '</div>' +
              '<div id="payload-content-' + l.id + '">' + escapeHtml(JSON.stringify(l.details, null, 2)) + '</div>' +
            '</div>'
          : '';

        return '<div class="stream-row ' + (isExpanded ? 'expanded' : '') + '" id="row-' + l.id + '" onclick="toggleRow(\\'' + l.id + '\\', ' + isExpandable + ')">' +
          '<span class="glow-dot dot-' + l.level + '"></span>' +
          '<span class="time-col">' + date + '</span>' +
          '<span class="badge-col badge-' + l.level + '">' + l.level + '</span>' +
          '<span class="source-col">[' + l.source + ']</span>' +
          '<span class="tag-col tag-' + l.level + '">#' + l.tag + ':</span>' +
          '<div class="message-col">' +
            (isLongMsg
              ? '<span id="msg-trunc-' + l.id + '" class="' + (isExpanded ? 'hidden' : '') + '">' + escapeHtml(shortMsg) + '</span>' +
                '<span id="msg-full-' + l.id + '" class="' + (isExpanded ? '' : 'hidden') + '">' + escapeHtml(msg) + '</span>'
              : '<span>' + escapeHtml(msg) + '</span>') +
            detailsDrawer +
          '</div>' +
          '<div class="row-actions">' +
            (isExpandable ? '<button class="row-btn" id="inspect-btn-' + l.id + '" onclick="event.stopPropagation(); toggleRow(\\'' + l.id + '\\', true)">' + (isExpanded ? 'Close' : 'Inspect') + '</button>' : '') +
            '<button class="row-btn" onclick="event.stopPropagation(); copySingleRow(\\'' + l.id + '\\')">Copy</button>' +
          '</div>' +
        '</div>';
      }).join('');

      // Restore scroll positions inside drawers
      scrollMap.forEach((top, id) => {
        const el = document.getElementById(id);
        if (el) el.scrollTop = top;
      });
    }

    function toggleRow(id, isExpandable) {
      if (!isExpandable) return;
      const row = document.getElementById('row-' + id);
      const details = document.getElementById('details-' + id);
      const btn = document.getElementById('inspect-btn-' + id);
      const msgTrunc = document.getElementById('msg-trunc-' + id);
      const msgFull = document.getElementById('msg-full-' + id);

      if (expandedIds.has(id)) {
        expandedIds.delete(id);
        if (row) row.classList.remove('expanded');
        if (btn) btn.textContent = 'Inspect';
        if (details) details.classList.add('hidden');
        if (msgTrunc) msgTrunc.classList.remove('hidden');
        if (msgFull) msgFull.classList.add('hidden');
      } else {
        expandedIds.add(id);
        if (row) row.classList.add('expanded');
        if (btn) btn.textContent = 'Close';
        if (details) details.classList.remove('hidden');
        if (msgTrunc) msgTrunc.classList.add('hidden');
        if (msgFull) msgFull.classList.remove('hidden');
      }
    }

    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function copyPayload(id) {
      const log = rawLogs.find(l => l.id === id);
      if (log && log.details) {
        await navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
        showToast('Copied JSON payload to clipboard');
      }
    }

    async function copySingleRow(id) {
      const log = rawLogs.find(l => l.id === id);
      if (log) {
        const text = '[' + log.timestamp + '] [' + log.level + '] [' + log.source + '] #' + log.tag + ': ' + log.message + (log.details ? '\\n' + JSON.stringify(log.details, null, 2) : '');
        await navigator.clipboard.writeText(text);
        showToast('Copied event to clipboard');
      }
    }

    async function copyAllLogs() {
      const text = rawLogs.map(l =>
        '[' + l.timestamp + '] [' + l.level + '] [' + l.source + '] #' + l.tag + ': ' + l.message + (l.details ? ' ' + JSON.stringify(l.details) : '')
      ).join('\\n');

      await navigator.clipboard.writeText(text);
      showToast('Copied ' + rawLogs.length + ' logs to clipboard');
    }

    async function clearAllLogs() {
      if (confirm('Clear all activity logs?')) {
        await fetch('/logs', { method: 'DELETE' });
        rawLogs = [];
        expandedIds.clear();
        applyFiltersAndRender();
        showToast('Logs cleared');
      }
    }

    fetchLogs();
    setInterval(fetchLogs, 3000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

apiRouter.get('/profile', (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = ProfileStore.getProfile();
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/models', async (req: Request, res: Response, next: NextFunction) => {
  const providerParam = (req.query.provider as string) || 'ollama';
  const provider = providerParam === 'gemini' ? 'gemini' : 'ollama';

  try {
    const apiKey = (req.headers['x-gemini-api-key'] as string) || (req.query.apiKey as string);

    const models = await llmGatewayInstance.getAvailableModels(provider, { apiKey });
    res.json({
      status: 'success',
      provider,
      models,
    });
  } catch (error) {
    if (error instanceof LLMProviderError) {
      LoggerService.getInstance().addLog({
        level: 'WARN',
        source: 'LLM_GATEWAY',
        tag: 'MODELS_FETCH_ERROR',
        message: `Failed to fetch models for ${provider}: ${error.message}`,
        details: {
          provider,
          error: error.message,
          cause: error.cause instanceof Error ? error.cause.message : String(error.cause || ''),
        },
      });

      res.status(502).json({
        status: 'error',
        provider,
        models: [],
        error: error.message,
      });
      return;
    }
    next(error);
  }
});

apiRouter.post('/autofill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = autofillRequestSchema.parse(req.body);
    const profile = ProfileStore.getProfile();

    const provider = body.provider || 'ollama';
    const apiKey = (req.headers['x-gemini-api-key'] as string) || body.apiKey;
    const model = body.model;

    const mappings = await llmGatewayInstance.mapFields(provider, body.fields, profile, {
      apiKey,
      model,
    });

    const mappedKeys = new Set(Object.keys(mappings));
    const unmappedFields = body.fields
      .filter((f) => !mappedKeys.has(f.id))
      .map((f) => ({ id: f.id, label: f.label, type: f.type }));

    if (mappedKeys.size === 0) {
      LoggerService.getInstance().addLog({
        level: 'WARN',
        source: 'LLM_GATEWAY',
        tag: 'LLM_ZERO_MAPPINGS',
        message: `LLM (${provider}/${model || 'default'}) returned 0 field mappings: none of the ${body.fields.length} scanned field(s) matched the user profile`,
        details: {
          provider,
          model,
          fieldsScannedCount: body.fields.length,
          fieldsScanned: body.fields.map((f) => ({ id: f.id, label: f.label })),
          unmappedFields,
          profileSampleKeys: Object.keys(profile),
          hint: 'The user profile does not contain matching values for these form field questions.',
        },
      });
    } else {
      LoggerService.getInstance().addLog({
        level: 'SUCCESS',
        source: 'BACKEND_API',
        tag: 'LLM_RESPONSE',
        message: `LLM (${provider}/${model || 'default'}) mapped ${mappedKeys.size}/${body.fields.length} field(s): ${JSON.stringify(mappings)}`,
        details: {
          provider,
          model,
          mappings,
          mappedCount: mappedKeys.size,
          unmappedCount: unmappedFields.length,
          unmappedFields,
          fieldsScanned: body.fields.map((f) => ({ id: f.id, label: f.label })),
        },
      });
    }

    const response: AutofillResponse = {
      status: 'success',
      mappings,
    };

    res.json(response);
  } catch (error) {
    const reqFields = Array.isArray(req.body?.fields) ? req.body.fields : [];
    const reqProvider = req.body?.provider || 'ollama';
    const reqModel = req.body?.model || 'default';

    if (error instanceof ZodError) {
      const errorMsg = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      LoggerService.getInstance().addLog({
        level: 'ERROR',
        source: 'BACKEND_API',
        tag: 'REQUEST_VALIDATION_ERROR',
        message: `Invalid request payload to /autofill: ${errorMsg}`,
        details: { issues: error.issues, body: req.body },
      });
      next(error);
      return;
    }

    if (error instanceof LLMProviderError || error instanceof LLMParseError) {
      const errorMsg = error.message;
      let errorTag = 'LLM_ERROR';
      if (/quota|429|rate.?limit/i.test(errorMsg)) {
        errorTag = 'LLM_QUOTA_EXCEEDED';
      } else if (/invalid.*key|unauthorized|401|403/i.test(errorMsg)) {
        errorTag = 'LLM_AUTH_ERROR';
      } else if (/timeout/i.test(errorMsg)) {
        errorTag = 'LLM_TIMEOUT';
      } else if (error instanceof LLMParseError) {
        errorTag = 'LLM_PARSE_ERROR';
      } else if (/not reachable|connection refused|daemon/i.test(errorMsg)) {
        errorTag = 'LLM_CONNECTION_FAILED';
      }

      LoggerService.getInstance().addLog({
        level: 'ERROR',
        source: 'LLM_GATEWAY',
        tag: errorTag,
        message: `LLM API Error (${reqProvider}/${reqModel}): ${errorMsg}`,
        details: {
          errorTag,
          errorType: error.name,
          errorMessage: error.message,
          provider: reqProvider,
          model: reqModel,
          fieldsScannedCount: reqFields.length,
          fieldsScanned: reqFields.map((f: FieldMetadata) => ({ id: f.id, label: f.label })),
          cause: error instanceof LLMProviderError && error.cause
            ? (error.cause instanceof Error ? { message: error.cause.message, stack: error.cause.stack } : String(error.cause))
            : undefined,
          rawResponse: error instanceof LLMParseError ? error.rawResponse : undefined,
        },
      });

      const response: AutofillResponse = {
        status: 'error',
        mappings: {},
        error: error.message,
      };
      res.status(502).json(response);
      return;
    }

    LoggerService.getInstance().addLog({
      level: 'ERROR',
      source: 'BACKEND_API',
      tag: 'INTERNAL_SERVER_ERROR',
      message: `Unexpected backend error during autofill: ${error instanceof Error ? error.message : String(error)}`,
      details: {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
      },
    });

    next(error);
  }
});

apiRouter.get('/test-form', (req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Google Form QA Test Fixture — AutoFiller</title>
  <style>
    body { font-family: sans-serif; background: #f1f5f9; padding: 30px; max-width: 600px; margin: auto; }
    .form-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    h1 { color: #1e293b; font-size: 20px; margin-bottom: 20px; }
    .item { margin-bottom: 20px; }
    .heading { font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #334155; }
    input, textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    .required-star { color: #ef4444; }
  </style>
</head>
<body>
  <div class="form-card">
    <h1>AutoFiller Test Form (Google Form Fixture)</h1>
    <form>
      <div role="listitem" class="item">
        <div role="heading" class="heading">Full Name <span class="required-star">*</span></div>
        <input type="text" name="entry.101" aria-label="Full Name" required placeholder="Enter your full name" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Email Address <span class="required-star">*</span></div>
        <input type="email" name="entry.102" aria-label="Email Address" required placeholder="name@example.com" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Phone Number</div>
        <input type="tel" name="entry.103" aria-label="Phone Number" placeholder="(555) 000-0000" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Alternate Phone Number</div>
        <input type="tel" name="entry.105" aria-label="Alternate Phone Number" placeholder="(555) 000-0000" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Short Bio</div>
        <textarea name="entry.104" aria-label="Short Bio" placeholder="Tell us about yourself..."></textarea>
      </div>
    </form>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
