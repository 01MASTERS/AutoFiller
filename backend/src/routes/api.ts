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
  <title>AutoFiller — Activity & Debug Log Dashboard</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: rgba(255,255,255,0.1);
      --primary: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
    }
    body { font-family: monospace, sans-serif; background: var(--bg); color: var(--text); padding: 24px; margin: 0; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    h1 { font-size: 22px; margin: 0; color: #60a5fa; }
    .controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    .btn { padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text); font-weight: 600; cursor: pointer; }
    .btn:hover { background: #334155; }
    .btn-primary { background: var(--primary); border: none; }
    .btn-primary:hover { background: #2563eb; }
    .filter-btn.active { border-color: var(--primary); background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
    input[type="text"] { padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text); flex-grow: 1; max-width: 300px; }
    .log-container { background: #090d16; border: 1px solid var(--border); border-radius: 8px; padding: 12px; max-height: 70vh; overflow-y: auto; }
    .log-item { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; line-height: 1.5; font-family: 'Consolas', monospace; }
    .time { color: var(--muted); }
    .level { font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin: 0 4px; }
    .level-INFO { background: rgba(59,130,246,0.2); color: #93c5fd; }
    .level-SUCCESS { background: rgba(16,185,129,0.2); color: #6ee7b7; }
    .level-WARN { background: rgba(245,158,11,0.2); color: #fde68a; }
    .level-ERROR { background: rgba(239,68,68,0.2); color: #fca5a5; }
    .tag { color: #a78bfa; font-weight: 600; }
    .source { color: var(--muted); }
    .message { color: var(--text); }
    .details { color: #cbd5e1; font-size: 11px; margin-top: 4px; background: rgba(255,255,255,0.03); padding: 6px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; }
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
    <div style="color:var(--muted)">Loading activity logs...</div>
  </div>

  <script>
    let activeLevel = '';
    let currentLogs = [];

    function setFilter(level) {
      activeLevel = level;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      fetchLogs();
    }

    async function fetchLogs() {
      const query = document.getElementById('search-input').value.trim();
      let url = '/logs?limit=500';
      if (activeLevel) url += '&level=' + activeLevel;
      if (query) url += '&query=' + encodeURIComponent(query);

      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') {
          currentLogs = data.logs || [];
          renderLogs(currentLogs);
        }
      } catch (err) {
        document.getElementById('log-container').innerHTML = '<div style="color:var(--danger)">Failed to load logs</div>';
      }
    }

    function renderLogs(logs) {
      const container = document.getElementById('log-container');
      if (logs.length === 0) {
        container.innerHTML = '<div style="color:var(--muted)">No log entries found.</div>';
        return;
      }

      container.innerHTML = logs.map(l => {
        const date = new Date(l.timestamp).toLocaleTimeString();
        const detailsStr = l.details ? '<div class="details">' + JSON.stringify(l.details, null, 2) + '</div>' : '';
        return '<div class="log-item">' +
          '<span class="time">[' + date + ']</span> ' +
          '<span class="level level-' + l.level + '">' + l.level + '</span> ' +
          '<span class="source">[' + l.source + ']</span> ' +
          '<span class="tag">#' + l.tag + ':</span> ' +
          '<span class="message">' + escapeHtml(l.message) + '</span>' +
          detailsStr +
        '</div>';
      }).join('');
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
        fetchLogs();
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
  try {
    const providerParam = (req.query.provider as string) || 'ollama';
    const provider = providerParam === 'gemini' ? 'gemini' : 'ollama';
    const apiKey = (req.headers['x-gemini-api-key'] as string) || (req.query.apiKey as string);

    const models = await llmGatewayInstance.getAvailableModels(provider, { apiKey });
    res.json({
      status: 'success',
      provider,
      models,
    });
  } catch (error) {
    if (error instanceof LLMProviderError) {
      res.status(502).json({
        status: 'error',
        provider: (req.query.provider as string) === 'gemini' ? 'gemini' : 'ollama',
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

    const mappings = await llmGatewayInstance.mapFields(
      provider,
      body.fields,
      profile,
      { apiKey, model }
    );

    LoggerService.getInstance().addLog({
      level: 'SUCCESS',
      source: 'BACKEND_API',
      tag: 'LLM_RESPONSE',
      message: `LLM (${provider}/${model || 'default'}) mapped ${Object.keys(mappings).length} field(s): ${JSON.stringify(mappings)}`,
      details: {
        provider,
        model,
        mappings,
        fieldsScanned: body.fields.map((f) => ({ id: f.id, label: f.label })),
      },
    });

    const response: AutofillResponse = {
      status: 'success',
      mappings,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      next(error);
      return;
    }

    if (error instanceof LLMProviderError || error instanceof LLMParseError) {
      const response: AutofillResponse = {
        status: 'error',
        mappings: {},
        error: error.message,
      };
      res.status(502).json(response);
      return;
    }

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
