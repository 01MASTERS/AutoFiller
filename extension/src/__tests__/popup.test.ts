/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadSettings,
  toggleProviderSettingsUI,
  updateBackendStatusUI,
  updateStatusBannerUI,
  checkBackendHealth,
  bindPopupEvents,
  formatPopupErrorMessage,
} from '../popup/popup.js';

describe('Popup UI', () => {
  const setStorageMock = vi.fn().mockResolvedValue(undefined);
  const getStorageMock = vi.fn().mockResolvedValue({});
  const sendMessageRuntimeMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.restoreAllMocks();

    document.body.innerHTML = `
      <div id="backend-status-pill" class="status-pill checking">
        <span class="pill-dot"></span>
        <span class="pill-text">Checking</span>
      </div>
      <button id="autofill-btn">Auto-Fill Form</button>
      <div id="status-banner" class="status-banner idle">
        <span id="status-text">Ready</span>
      </div>
      <div id="profile-name">Jane Doe</div>
      <div id="profile-email">jane@example.com</div>
      <select id="provider-select">
        <option value="ollama">Ollama</option>
        <option value="gemini">Gemini</option>
      </select>
      <div id="ollama-settings">
        <input type="text" id="ollama-model-input" value="llama3.2" />
      </div>
      <div id="gemini-settings" class="hidden">
        <input type="password" id="gemini-key-input" value="" />
      </div>
    `;

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          set: setStorageMock,
          get: getStorageMock,
        },
      },
      runtime: {
        sendMessage: sendMessageRuntimeMock,
        onMessage: { addListener: vi.fn() },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates backend status UI pill class and text', () => {
    updateBackendStatusUI('online');
    const pill = document.getElementById('backend-status-pill');
    expect(pill?.className).toContain('online');
    expect(pill?.textContent).toContain('Online');
  });

  it('updates status banner UI on state transition', () => {
    updateStatusBannerUI('analyzing');
    const text = document.getElementById('status-text');
    expect(text?.textContent).toContain('Analyzing form');
  });

  it('formats raw verbose GoogleGenerativeAI quota error to a brief human-readable banner message', () => {
    const rawVerboseError = `Gemini Quota Exceeded (429 Rate Limit) - Google AI Studio quota exhausted. Wait a minute or check your quota limits at aistudio.google.com: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent: [429 Too Many Requests] You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.7-flash Please retry in 56.925720426s. [{"@type":"type.googleapis.com/google.rpc.Help","links":[{"description":"Learn more about Gemini API quotas","url":"https://ai.google.dev/gemini-api/docs/rate-limits"}]},{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerDayPerFreeTier","quotaDimensions":{"location":"global","model":"gemini-3.7-flash"},"quotaValue":"20"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"56s"}]`;

    const formatted = formatPopupErrorMessage(rawVerboseError);
    expect(formatted).toBe('Gemini API quota exceeded (429). See Debug Logs for details.');

    updateStatusBannerUI('error', { error: rawVerboseError });
    const text = document.getElementById('status-text');
    const banner = document.getElementById('status-banner');
    expect(text?.textContent).toBe('Gemini API quota exceeded (429). See Debug Logs for details.');
    expect(banner?.title).toBe('Click to open Debug Log Dashboard');
  });

  it('formats invalid API key error to a concise prompt to check settings', () => {
    const formatted = formatPopupErrorMessage('Gemini API Key Invalid or Unauthorized - Check your Gemini API Key in extension settings');
    expect(formatted).toBe('Gemini API key invalid or unauthorized. Check settings.');
  });

  it('toggles provider settings visibility', () => {
    toggleProviderSettingsUI('gemini');

    const ollamaCard = document.getElementById('ollama-settings');
    const geminiCard = document.getElementById('gemini-settings');

    expect(ollamaCard?.classList.contains('hidden')).toBe(true);
    expect(geminiCard?.classList.contains('hidden')).toBe(false);
  });

  it('loads settings from chrome.storage.local and updates form inputs', async () => {
    getStorageMock.mockResolvedValue({
      provider: 'gemini',
      ollamaModel: 'mistral',
      geminiApiKey: 'secret-key-123',
    });

    const settings = await loadSettings();

    expect(settings.provider).toBe('gemini');
    expect(settings.geminiApiKey).toBe('secret-key-123');

    const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
    expect(providerSelect.value).toBe('gemini');
  });

  it('dispatches TRIGGER_AUTOFILL message on Auto-Fill button click', async () => {
    bindPopupEvents();

    const button = document.getElementById('autofill-btn') as HTMLButtonElement;
    button.click();

    await new Promise((r) => setTimeout(r, 0));

    expect(sendMessageRuntimeMock).toHaveBeenCalledWith({
      action: 'TRIGGER_AUTOFILL',
      options: expect.objectContaining({
        provider: 'ollama',
        model: 'llama3.2',
      }),
    });
  });

  it('pings /health and updates backend status pill to online when server responds ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const isOnline = await checkBackendHealth();

    expect(isOnline).toBe(true);
    const pill = document.getElementById('backend-status-pill');
    expect(pill?.className).toContain('online');
  });
});
