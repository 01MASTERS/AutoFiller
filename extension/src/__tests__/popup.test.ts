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
  fetchProfilesList,
  switchActiveProfile,
  updateProfilePreviewUI,
  BANNER_AUTO_DISMISS_DELAY_MS,
  clearStatusBannerTimer,
} from '../popup/popup.js';

describe('Popup UI', () => {
  const setStorageMock = vi.fn().mockResolvedValue(undefined);
  const getStorageMock = vi.fn().mockResolvedValue({});
  const sendMessageRuntimeMock = vi.fn().mockResolvedValue(undefined);
  const createTabMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.restoreAllMocks();

    document.body.innerHTML = `
      <div id="backend-status-pill" class="status-pill checking">
        <span class="pill-dot"></span>
        <span class="pill-text">Checking</span>
      </div>
      <button id="open-logs-btn" type="button"></button>
      <button id="open-profile-editor-btn" type="button"></button>
      <button id="autofill-btn">Auto-Fill Form</button>
      <div id="status-banner" class="status-banner idle">
        <span id="status-text">Ready</span>
      </div>
      <button id="refresh-profiles-btn" type="button"><svg class="refresh-icon"></svg></button>
      <span id="profile-badge" class="badge success-badge">Loaded</span>
      <select id="profile-select">
        <option value="default">Default</option>
      </select>
      <div id="profile-name">Jane Doe</div>
      <div id="profile-headline">Software Engineer</div>
      <div id="profile-email">jane@example.com</div>
      <select id="provider-select">
        <option value="ollama">Ollama</option>
        <option value="gemini">Gemini</option>
      </select>
      <div id="ollama-settings">
        <input type="text" id="ollama-model-input" value="llama3.2" />
        <select id="ollama-model-select">
          <option value="llama3.2">llama3.2</option>
        </select>
        <button id="refresh-ollama-btn" type="button"></button>
      </div>
      <div id="gemini-settings" class="hidden">
        <input type="password" id="gemini-key-input" value="" />
        <select id="gemini-model-select">
          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
        </select>
        <button id="refresh-gemini-btn" type="button"></button>
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
      tabs: {
        create: createTabMock,
      },
    });
  });

  afterEach(() => {
    clearStatusBannerTimer();
    vi.useRealTimers();
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

  it('auto-dismisses status banner back to idle after delay when state is done', () => {
    vi.useFakeTimers();
    updateStatusBannerUI('done', { filledCount: 4, durationMs: 1200 });

    const banner = document.getElementById('status-banner');
    const text = document.getElementById('status-text');

    expect(banner?.className).toContain('done');
    expect(text?.textContent).toBe('Filled 4 fields in 1.2s!');

    // Advance partially
    vi.advanceTimersByTime(BANNER_AUTO_DISMISS_DELAY_MS - 1000);
    expect(banner?.className).toContain('done');

    // Advance beyond delay
    vi.advanceTimersByTime(1000);
    expect(banner?.className).toContain('idle');
    expect(text?.textContent).toBe('Ready to auto-fill form fields');
  });

  it('auto-dismisses status banner back to idle after delay when state is error', () => {
    vi.useFakeTimers();
    updateStatusBannerUI('error', { error: 'Gemini Quota Exceeded (429)' });

    const banner = document.getElementById('status-banner');
    const text = document.getElementById('status-text');

    expect(banner?.className).toContain('error');
    expect(text?.textContent).toContain('quota exceeded');

    vi.advanceTimersByTime(BANNER_AUTO_DISMISS_DELAY_MS);
    expect(banner?.className).toContain('idle');
    expect(text?.textContent).toBe('Ready to auto-fill form fields');
  });

  it('does not auto-dismiss status banner when state is analyzing or filling', () => {
    vi.useFakeTimers();
    updateStatusBannerUI('analyzing');

    const banner = document.getElementById('status-banner');
    const text = document.getElementById('status-text');

    vi.advanceTimersByTime(BANNER_AUTO_DISMISS_DELAY_MS * 2);
    expect(banner?.className).toContain('analyzing');
    expect(text?.textContent).toContain('Analyzing form');
  });

  it('cancels existing auto-dismiss timer when a new state arrives', () => {
    vi.useFakeTimers();
    updateStatusBannerUI('done', { filledCount: 3 });

    // New state transition before delay expires
    updateStatusBannerUI('filling');
    const banner = document.getElementById('status-banner');
    const text = document.getElementById('status-text');

    vi.advanceTimersByTime(BANNER_AUTO_DISMISS_DELAY_MS);
    expect(banner?.className).toContain('filling');
    expect(text?.textContent).toBe('Filling form fields...');
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

  it('dispatches TRIGGER_AUTOFILL message on Auto-Fill button click with active profileId', async () => {
    bindPopupEvents();

    const profileSelect = document.getElementById('profile-select') as HTMLSelectElement;
    profileSelect.value = 'default';

    const button = document.getElementById('autofill-btn') as HTMLButtonElement;
    button.click();

    await new Promise((r) => setTimeout(r, 0));

    expect(sendMessageRuntimeMock).toHaveBeenCalledWith({
      action: 'TRIGGER_AUTOFILL',
      options: expect.objectContaining({
        provider: 'ollama',
        model: 'llama3.2',
        profileId: 'default',
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

  describe('Multi-Profile Switcher & Storage Sync', () => {
    const mockProfiles = [
      {
        id: 'default',
        name: 'Rittik Sharma',
        headline: 'AI/ML Engineer & Data Scientist',
        filename: 'default.json',
        isActive: true,
      },
      {
        id: 'product-manager',
        name: 'Rittik Sharma',
        headline: 'Associate Product Manager Intern',
        filename: 'product-manager.json',
        isActive: false,
      },
    ];

    it('fetches profiles list from backend and populates select dropdown', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/profiles')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              status: 'success',
              activeProfileId: 'default',
              profiles: mockProfiles,
            }),
          });
        }
        if (url.endsWith('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              name: 'Rittik Sharma',
              email: 'rittik.ai@gmail.com',
              custom: { Headline: 'AI/ML Engineer & Data Scientist' },
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      vi.stubGlobal('fetch', fetchMock);

      const profiles = await fetchProfilesList();

      expect(profiles).toHaveLength(2);

      const selectEl = document.getElementById('profile-select') as HTMLSelectElement;
      expect(selectEl.options).toHaveLength(2);
      expect(selectEl.value).toBe('default');

      const nameEl = document.getElementById('profile-name');
      const headlineEl = document.getElementById('profile-headline');
      const badgeEl = document.getElementById('profile-badge');

      expect(nameEl?.textContent).toBe('Rittik Sharma');
      expect(headlineEl?.textContent).toContain('AI/ML Engineer');
      expect(badgeEl?.textContent).toBe('Loaded');
      expect(badgeEl?.className).toContain('success-badge');

      // Verify cached in Chrome storage
      expect(setStorageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          activeProfileId: 'default',
          cachedProfiles: mockProfiles,
        }),
      );
    });

    it('switches active profile via switchActiveProfile and updates UI', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          activeProfileId: 'product-manager',
          profile: {
            name: 'Rittik Sharma',
            email: 'rittik.pm@gmail.com',
            experience: [{ title: 'Associate Product Manager Intern' }],
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const success = await switchActiveProfile('product-manager');

      expect(success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3456/profiles/switch',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ profileId: 'product-manager' }),
        }),
      );

      const selectEl = document.getElementById('profile-select') as HTMLSelectElement;
      expect(selectEl.value).toBe('product-manager');

      const emailEl = document.getElementById('profile-email');
      const headlineEl = document.getElementById('profile-headline');
      expect(emailEl?.textContent).toBe('rittik.pm@gmail.com');
      expect(headlineEl?.textContent).toBe('Associate Product Manager Intern');

      expect(setStorageMock).toHaveBeenCalledWith({
        activeProfileId: 'product-manager',
      });
    });

    it('falls back to cached profiles in chrome.storage when backend is offline', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error - backend offline'));
      vi.stubGlobal('fetch', fetchMock);

      getStorageMock.mockResolvedValue({
        cachedProfiles: mockProfiles,
        activeProfileId: 'product-manager',
      });

      const profiles = await fetchProfilesList();

      expect(profiles).toHaveLength(2);

      const selectEl = document.getElementById('profile-select') as HTMLSelectElement;
      expect(selectEl.options).toHaveLength(2);
      expect(selectEl.value).toBe('product-manager');

      const badgeEl = document.getElementById('profile-badge');
      expect(badgeEl?.textContent).toBe('Cached');
      expect(badgeEl?.className).toContain('cached-badge');
    });

    it('reverts dropdown selection if switch request fails', async () => {
      const selectEl = document.getElementById('profile-select') as HTMLSelectElement;
      selectEl.setAttribute('data-active-id', 'default');
      selectEl.value = 'invalid-profile';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ status: 'error', error: 'Profile not found' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const success = await switchActiveProfile('invalid-profile');

      expect(success).toBe(false);
      expect(selectEl.value).toBe('default');
    });

    it('updates preview UI cleanly with updateProfilePreviewUI', () => {
      updateProfilePreviewUI(
        {
          name: 'Alex Rivera',
          email: 'alex@example.com',
          headline: 'VP of Engineering',
        },
        'Cached',
      );

      expect(document.getElementById('profile-name')?.textContent).toBe('Alex Rivera');
      expect(document.getElementById('profile-email')?.textContent).toBe('alex@example.com');
      expect(document.getElementById('profile-headline')?.textContent).toBe('VP of Engineering');
      expect(document.getElementById('profile-badge')?.textContent).toBe('Cached');
      expect(document.getElementById('profile-badge')?.className).toContain('cached-badge');
    });

    it('opens profile editor UI in new tab when open-profile-editor-btn is clicked', () => {
      bindPopupEvents();

      const btn = document.getElementById('open-profile-editor-btn');
      expect(btn).not.toBeNull();
      btn?.click();

      expect(createTabMock).toHaveBeenCalledWith({
        url: 'http://localhost:3456/profile-ui',
      });
    });

    it('opens logs UI in new tab when open-logs-btn is clicked', () => {
      bindPopupEvents();

      const btn = document.getElementById('open-logs-btn');
      expect(btn).not.toBeNull();
      btn?.click();

      expect(createTabMock).toHaveBeenCalledWith({
        url: 'http://localhost:3456/logs-ui',
      });
    });
  });
});
