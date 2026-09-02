import { Router, Request, Response, NextFunction } from 'express';
import { HealthResponse, AutofillResponse } from '@autofiller/shared';
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
      --bg: #080c14;
      --card-bg: #0d121f;
      --border: rgba(255, 255, 255, 0.08);
      --border-subtle: rgba(255, 255, 255, 0.04);
      --text: #f1f5f9;
      --muted: #64748b;
      --muted-light: #94a3b8;
      --accent: #3b82f6;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .container {
      width: 100%;
      max-width: 1360px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Header Bar */
    .header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pulse-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: livePulse 2s infinite ease-in-out;
    }
    @keyframes livePulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
    }
    .brand-title {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-status {
      font-size: 11px;
      color: var(--muted);
      font-family: var(--font-mono);
      background: rgba(255,255,255,0.04);
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn {
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      color: var(--muted-light);
      padding: 7px 14px;
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
      background: rgba(255,255,255,0.08);
      color: #fff;
      border-color: rgba(255,255,255,0.15);
    }
    .btn-primary {
      background: rgba(59, 130, 246, 0.12);
      border-color: rgba(59, 130, 246, 0.35);
      color: #93c5fd;
    }
    .btn-primary:hover {
      background: rgba(59, 130, 246, 0.22);
      color: #fff;
      border-color: #3b82f6;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.4);
    }

    /* Controls Bar */
    .controls {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex;
      gap: 4px;
      background: rgba(0,0,0,0.3);
      padding: 3px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
    }
    .filter-chip {
      background: transparent;
      border: 1px solid transparent;
      color: var(--muted);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .filter-chip:hover {
      color: #cbd5e1;
      background: rgba(255,255,255,0.03);
    }
    .filter-chip.active {
      color: #fff;
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.12);
      font-weight: 600;
    }
    .count-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(255,255,255,0.08);
    }

    .search-box {
      flex: 1;
      min-width: 240px;
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-input {
      width: 100%;
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 7px 32px 7px 12px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
    }
    .kbd-shortcut {
      position: absolute;
      right: 10px;
      font-size: 10px;
      font-family: var(--font-mono);
      color: var(--muted);
      background: rgba(255,255,255,0.06);
      padding: 1px 5px;
      border-radius: 3px;
      pointer-events: none;
    }

    /* Log Stream Container */
    .log-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }

    .log-stream {
      font-family: var(--font-mono);
      font-size: 12.5px;
      line-height: 1.6;
      max-height: 700px;
      overflow-y: auto;
    }

    .log-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 18px;
      border-bottom: 1px solid var(--border-subtle);
      transition: background 0.12s ease;
      cursor: pointer;
      position: relative;
    }
    .log-row:last-child { border-bottom: none; }
    .log-row:hover { background: rgba(255,255,255,0.02); }
    .log-row.expanded { background: rgba(255,255,255,0.035); }

    .time {
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
      padding-top: 2px;
      user-select: none;
    }
    .level-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .badge-INFO {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.25);
    }
    .badge-SUCCESS {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .badge-WARN {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.25);
    }
    .badge-ERROR {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .source-tag {
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .event-tag {
      font-weight: 600;
      font-size: 11px;
      white-space: nowrap;
    }
    .tag-INFO { color: #a78bfa; }
    .tag-SUCCESS { color: #34d399; }
    .tag-WARN { color: #fbbf24; }
    .tag-ERROR { color: #f87171; font-weight: 700; }

    .message-body {
      flex: 1;
      word-break: break-word;
      color: #e2e8f0;
    }

    .toggle-icon {
      color: var(--muted);
      font-size: 10px;
      padding: 2px 5px;
      border-radius: 4px;
      transition: all 0.2s;
      user-select: none;
      margin-left: auto;
    }
    .toggle-icon:hover {
      background: rgba(255,255,255,0.08);
      color: #fff;
    }
    .log-row.expanded .toggle-icon {
      color: #fff;
    }

    .details-box {
      margin-top: 8px;
      background: #05070d;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      padding: 12px 14px;
      color: #cbd5e1;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      overflow-y: auto;
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);
    }

    .hidden { display: none !important; }

    /* Toast notification */
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1e293b;
      color: #fff;
      border: 1px solid rgba(255,255,255,0.15);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-family: var(--font-mono);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
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
    <div class="header">
      <div class="brand-section">
        <div class="pulse-dot" title="Live AutoFiller Stream Active"></div>
        <div class="brand-title">
          <span>⚡ AutoFiller</span>
          <span style="font-weight:400; color:var(--muted); font-size:13px;">/</span>
          <span style="font-weight:500; font-size:13px; color:#cbd5e1;">Diagnostics & Logs</span>
        </div>
        <div class="brand-status" id="connection-status">Live Connected (3s)</div>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="copyLogs()">📋 Copy Logs</button>
        <button class="btn btn-danger" onclick="clearLogs()">🗑️ Clear</button>
      </div>
    </div>

    <div class="controls">
      <div class="filter-group">
        <button class="filter-chip active" id="chip-all" onclick="setFilter('')">
          <span>ALL</span>
          <span class="count-tag" id="cnt-all">0</span>
        </button>
        <button class="filter-chip" id="chip-error" onclick="setFilter('ERROR')">
          <span>ERROR</span>
          <span class="count-tag" id="cnt-error" style="color:#f87171;">0</span>
        </button>
        <button class="filter-chip" id="chip-warn" onclick="setFilter('WARN')">
          <span>WARN</span>
          <span class="count-tag" id="cnt-warn" style="color:#fbbf24;">0</span>
        </button>
        <button class="filter-chip" id="chip-success" onclick="setFilter('SUCCESS')">
          <span>SUCCESS</span>
          <span class="count-tag" id="cnt-success" style="color:#34d399;">0</span>
        </button>
        <button class="filter-chip" id="chip-info" onclick="setFilter('INFO')">
          <span>INFO</span>
          <span class="count-tag" id="cnt-info">0</span>
        </button>
      </div>

      <div class="search-box">
        <input type="text" id="search-input" class="search-input" placeholder="Filter by keyword, fid, tag..." oninput="fetchLogs()" />
        <span class="kbd-shortcut">/</span>
      </div>

      <button class="btn" onclick="fetchLogs(true)" title="Force refresh stream">🔄 Refresh</button>
    </div>

    <div class="log-container">
      <div class="log-stream" id="log-stream">
        <div style="color:var(--muted); padding: 20px; font-family:var(--font-mono); font-size:12px;">Loading activity stream...</div>
      </div>
    </div>
  </div>

  <div id="toast">Copied to clipboard!</div>

  <script>
    let activeLevel = '';
    let currentLogs = [];
    const expandedIds = new Set();

    // Focus search on '/'
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

    function setFilter(level) {
      activeLevel = level;
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      const chipId = level ? 'chip-' + level.toLowerCase() : 'chip-all';
      const activeEl = document.getElementById(chipId);
      if (activeEl) activeEl.classList.add('active');
      fetchLogs(true);
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
      const query = document.getElementById('search-input').value.trim();
      let url = '/logs?limit=500';
      if (activeLevel) url += '&level=' + activeLevel;
      if (query) url += '&query=' + encodeURIComponent(query);

      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') {
          const newLogs = data.logs || [];
          updateCounters(newLogs);
          if (!forceRender && areLogsEqual(currentLogs, newLogs)) {
            return;
          }
          currentLogs = newLogs;
          renderLogs(currentLogs);
        }
      } catch (err) {
        document.getElementById('log-stream').innerHTML = '<div style="color:#f87171; padding:20px; font-family:var(--font-mono); font-size:12px;">Failed to connect to backend logs service.</div>';
      }
    }

    function renderLogs(logs) {
      const container = document.getElementById('log-stream');
      if (logs.length === 0) {
        container.innerHTML = '<div style="color:var(--muted); padding:24px; text-align:center; font-family:var(--font-mono); font-size:12px;">No matching log events found.</div>';
        return;
      }

      const scrollMap = new Map();
      document.querySelectorAll('.details-box').forEach(el => {
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

        const toggleBtn = isExpandable
          ? '<span class="toggle-icon" id="icon-' + l.id + '">' + (isExpanded ? '▲' : '▼') + '</span>'
          : '';

        const detailsStr = hasDetails
          ? '<div class="details-box ' + (isExpanded ? '' : 'hidden') + '" id="details-' + l.id + '">' + escapeHtml(JSON.stringify(l.details, null, 2)) + '</div>'
          : '';

        return '<div class="log-row ' + (isExpanded ? 'expanded' : '') + '" id="row-' + l.id + '" onclick="toggleLog(\\'' + l.id + '\\', ' + isExpandable + ')">' +
          '<span class="time">' + date + '</span>' +
          '<span class="level-badge badge-' + l.level + '">' + l.level + '</span>' +
          '<span class="source-tag">[' + l.source + ']</span>' +
          '<span class="event-tag tag-' + l.level + '">#' + l.tag + ':</span>' +
          '<div class="message-body">' +
            (isLongMsg
              ? '<span id="msg-trunc-' + l.id + '" class="' + (isExpanded ? 'hidden' : '') + '">' + escapeHtml(shortMsg) + '</span>' +
                '<span id="msg-full-' + l.id + '" class="' + (isExpanded ? '' : 'hidden') + '">' + escapeHtml(msg) + '</span>'
              : '<span>' + escapeHtml(msg) + '</span>') +
            detailsStr +
          '</div>' +
          toggleBtn +
        '</div>';
      }).join('');

      scrollMap.forEach((top, id) => {
        const el = document.getElementById(id);
        if (el) el.scrollTop = top;
      });
    }

    function toggleLog(id, isExpandable) {
      if (!isExpandable) return;
      const icon = document.getElementById('icon-' + id);
      const row = document.getElementById('row-' + id);
      const details = document.getElementById('details-' + id);
      const msgTrunc = document.getElementById('msg-trunc-' + id);
      const msgFull = document.getElementById('msg-full-' + id);

      if (expandedIds.has(id)) {
        expandedIds.delete(id);
        if (row) row.classList.remove('expanded');
        if (icon) icon.textContent = '▼';
        if (details) details.classList.add('hidden');
        if (msgTrunc) msgTrunc.classList.remove('hidden');
        if (msgFull) msgFull.classList.add('hidden');
      } else {
        expandedIds.add(id);
        if (row) row.classList.add('expanded');
        if (icon) icon.textContent = '▲';
        if (details) details.classList.remove('hidden');
        if (msgTrunc) msgTrunc.classList.add('hidden');
        if (msgFull) msgFull.classList.remove('hidden');
      }
    }

    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function copyLogs() {
      const text = currentLogs.map(l =>
        '[' + l.timestamp + '] [' + l.level + '] [' + l.source + '] #' + l.tag + ': ' + l.message + (l.details ? ' ' + JSON.stringify(l.details) : '')
      ).join('\\n');

      await navigator.clipboard.writeText(text);
      showToast('Copied ' + currentLogs.length + ' logs to clipboard');
    }

    async function clearLogs() {
      if (confirm('Clear all activity logs?')) {
        await fetch('/logs', { method: 'DELETE' });
        expandedIds.clear();
        fetchLogs(true);
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
