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
