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
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: #334155;
      --accent: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    h1 { margin: 0; font-size: 20px; color: var(--text); }
    .controls {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .btn {
      background: var(--card-bg);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn:hover { background: var(--border); }
    .btn-primary { background: var(--accent); border-color: var(--accent); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .filter-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
    input[type="text"] {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 12px;
      border-radius: 6px;
      flex-grow: 1;
      min-width: 200px;
    }
    .log-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .log-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    .log-item:last-child { border-bottom: none; }
    .log-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }
    .time { color: var(--muted); font-size: 12px; }
    .level {
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
    }
    .level-INFO { background: rgba(59,130,246,0.2); color: #93c5fd; }
    .level-SUCCESS { background: rgba(16,185,129,0.2); color: #6ee7b7; }
    .level-WARN { background: rgba(245,158,11,0.2); color: #fde68a; }
    .level-ERROR { background: rgba(239,68,68,0.2); color: #fca5a5; }
    .tag { color: #a78bfa; font-weight: 600; }
    .tag-ERROR { color: #f87171 !important; font-weight: 700; }
    .tag-WARN { color: #fbbf24 !important; font-weight: 700; }
    .tag-SUCCESS { color: #34d399 !important; font-weight: 700; }
    .source { color: var(--muted); }
    .message { color: var(--text); }
    .toggle-btn {
      margin-left: auto;
      background: transparent;
      border: none;
      color: var(--muted);
      font-size: 11px;
      padding: 3px 6px;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .toggle-btn:hover {
      background: rgba(255,255,255,0.08);
      color: var(--text);
    }
    .details {
      color: #cbd5e1;
      font-size: 11px;
      margin-top: 6px;
      background: rgba(0,0,0,0.3);
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.05);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      overflow-y: auto;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚡ AutoFiller — Activity & Debug Logs</h1>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-primary" onclick="copyLogs()">📋 Copy Logs to Clipboard</button>
      <button class="btn" onclick="clearLogs()">🗑️ Clear Logs</button>
    </div>
  </div>

  <div class="controls">
    <button class="btn filter-btn active" onclick="setFilter('')">ALL</button>
    <button class="btn filter-btn" onclick="setFilter('SUCCESS')">SUCCESS</button>
    <button class="btn filter-btn" onclick="setFilter('ERROR')">ERROR</button>
    <button class="btn filter-btn" onclick="setFilter('INFO')">INFO</button>
    <button class="btn filter-btn" onclick="setFilter('WARN')">WARN</button>
    <input type="text" id="search-input" placeholder="Search logs..." oninput="fetchLogs()" />
    <button class="btn" onclick="fetchLogs()">🔄 Refresh</button>
  </div>

  <div class="log-container" id="log-container">
    <div style="color:var(--muted); padding: 15px;">Loading activity logs...</div>
  </div>

  <script>
    let activeLevel = '';
    let currentLogs = [];
    const expandedIds = new Set();

    function setFilter(level) {
      activeLevel = level;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      fetchLogs(true);
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
          if (!forceRender && areLogsEqual(currentLogs, newLogs)) {
            return;
          }
          currentLogs = newLogs;
          renderLogs(currentLogs);
        }
      } catch (err) {
        document.getElementById('log-container').innerHTML = '<div style="color:var(--danger); padding:15px;">Failed to load logs</div>';
      }
    }

    function renderLogs(logs) {
      const container = document.getElementById('log-container');
      if (logs.length === 0) {
        container.innerHTML = '<div style="color:var(--muted); padding:15px;">No log entries found.</div>';
        return;
      }

      // Preserve scroll positions of open details elements before updating DOM
      const scrollMap = new Map();
      document.querySelectorAll('.details').forEach(el => {
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
          ? '<button class="toggle-btn" id="toggle-btn-' + l.id + '" onclick="toggleLog(\\'' + l.id + '\\')" title="' + (isExpanded ? 'Collapse details' : 'Expand details') + '"><span id="icon-' + l.id + '">' + (isExpanded ? '▲' : '▼') + '</span></button>'
          : '';

        const detailsStr = hasDetails
          ? '<div class="details ' + (isExpanded ? '' : 'hidden') + '" id="details-' + l.id + '">' + escapeHtml(JSON.stringify(l.details, null, 2)) + '</div>'
          : '';

        return '<div class="log-item" id="log-item-' + l.id + '">' +
          '<div class="log-header">' +
            '<span class="time">[' + date + ']</span> ' +
            '<span class="level level-' + l.level + '">' + l.level + '</span> ' +
            '<span class="source">[' + l.source + ']</span> ' +
            '<span class="tag tag-' + l.level + '">#' + l.tag + ':</span> ' +
            (isLongMsg
              ? '<span class="message ' + (isExpanded ? 'hidden' : '') + '" id="msg-trunc-' + l.id + '">' + escapeHtml(shortMsg) + '</span>' +
                '<span class="message ' + (isExpanded ? '' : 'hidden') + '" id="msg-full-' + l.id + '">' + escapeHtml(msg) + '</span>'
              : '<span class="message">' + escapeHtml(msg) + '</span>') +
            toggleBtn +
          '</div>' +
          detailsStr +
        '</div>';
      }).join('');

      // Restore scroll positions
      scrollMap.forEach((top, id) => {
        const el = document.getElementById(id);
        if (el) el.scrollTop = top;
      });
    }

    function toggleLog(id) {
      const btn = document.getElementById('toggle-btn-' + id);
      const icon = document.getElementById('icon-' + id);
      const details = document.getElementById('details-' + id);
      const msgTrunc = document.getElementById('msg-trunc-' + id);
      const msgFull = document.getElementById('msg-full-' + id);

      if (expandedIds.has(id)) {
        expandedIds.delete(id);
        if (icon) icon.textContent = '▼';
        if (btn) btn.title = 'Expand details';
        if (details) details.classList.add('hidden');
        if (msgTrunc) msgTrunc.classList.remove('hidden');
        if (msgFull) msgFull.classList.add('hidden');
      } else {
        expandedIds.add(id);
        if (icon) icon.textContent = '▲';
        if (btn) btn.title = 'Collapse details';
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
      alert('Logs copied to clipboard (' + currentLogs.length + ' entries)!');
    }

    async function clearLogs() {
      if (confirm('Clear all log entries?')) {
        await fetch('/logs', { method: 'DELETE' });
        expandedIds.clear();
        fetchLogs(true);
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
