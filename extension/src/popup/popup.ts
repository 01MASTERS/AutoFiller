import {
  HealthResponse,
  ModelsResponse,
  UserProfile,
  ProfileSummary,
  ProfilesListResponse,
  SwitchProfileResponse,
} from '@autofiller/shared';
import { ExtensionLogger } from '../utils/logger.js';

export interface PopupSettings {
  provider: 'ollama' | 'gemini';
  ollamaModel: string;
  geminiModel: string;
  geminiApiKey: string;
}

export function updateBackendStatusUI(status: 'online' | 'offline' | 'checking') {
  const pill = document.getElementById('backend-status-pill');
  if (!pill) return;

  pill.className = `status-pill ${status}`;
  const pillText = pill.querySelector('.pill-text');
  if (pillText) {
    pillText.textContent =
      status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking';
  }
}

export function formatPopupErrorMessage(rawError?: string): string {
  if (!rawError) return 'Auto-fill failed. Check Debug Logs.';

  const err = String(rawError).trim();

  if (/quota|429|resource_exhausted|rate.?limit/i.test(err)) {
    return 'Gemini API quota exceeded (429). See Debug Logs for details.';
  }
  if (/api_key_invalid|invalid api key|api key not valid|401|403|unauthorized/i.test(err)) {
    return 'Gemini API key invalid or unauthorized. Check settings.';
  }
  if (/model.*not found|model.*not supported|404/i.test(err)) {
    return 'Selected AI model not found. Check settings or Debug Logs.';
  }
  if (/ollama.*(offline|not reachable|connection refused|11434)/i.test(err)) {
    return 'Ollama offline. Run "ollama serve" or check OLLAMA_HOST.';
  }
  if (/backend.*(offline|connection|cannot connect|failed to fetch|3456)/i.test(err)) {
    return 'Backend server offline (port 3456). Start with start.bat.';
  }
  if (/content script not loaded/i.test(err)) {
    return 'Page not loaded. Refresh this tab and try again.';
  }
  if (/no fillable text fields|scan_no_fields/i.test(err)) {
    return 'No fillable text fields found on this form.';
  }
  if (/zero.*mapping|no matching field mappings/i.test(err)) {
    return 'No matching profile data found for this form.';
  }

  // Strip embedded URLs, stack traces, JSON brackets
  let clean = err
    .replace(/\[GoogleGenerativeAI Error\]:.*$/i, '')
    .replace(/\[\s*\{.*$/s, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[{}[\]"]/g, '')
    .trim();

  const firstSentence = clean.split(/[.\n]/)[0]?.trim();
  clean = firstSentence || clean;

  if (clean.length > 70) {
    clean = clean.substring(0, 70).trim() + '...';
  }

  return clean ? `${clean}. (See Debug Logs)` : 'Auto-fill failed. See Debug Logs.';
}

export function updateStatusBannerUI(
  state: 'idle' | 'analyzing' | 'filling' | 'done' | 'partial' | 'error',
  details?: {
    filledCount?: number;
    failedCount?: number;
    skippedCount?: number;
    error?: string;
    durationMs?: number;
    llmDurationMs?: number;
    scanDurationMs?: number;
    fillDurationMs?: number;
  },
) {
  const banner = document.getElementById('status-banner');
  const textEl = document.getElementById('status-text');
  if (!banner || !textEl) return;

  banner.className = `status-banner ${state}`;

  switch (state) {
    case 'analyzing':
      textEl.textContent = 'Analyzing form & matching fields...';
      banner.removeAttribute('title');
      break;
    case 'filling':
      textEl.textContent = 'Filling form fields...';
      banner.removeAttribute('title');
      break;
    case 'done': {
      const timeStr = details?.durationMs
        ? ` in ${(details.durationMs / 1000).toFixed(1)}s`
        : '';
      textEl.textContent = `Filled ${details?.filledCount || 0} fields${timeStr}!`;
      banner.removeAttribute('title');
      break;
    }
    case 'partial': {
      const timeStr = details?.durationMs
        ? ` in ${(details.durationMs / 1000).toFixed(1)}s`
        : '';
      textEl.textContent = `Filled ${details?.filledCount || 0} fields${timeStr} (${details?.failedCount || 0} failed)`;
      banner.title = 'Click to open Debug Log Dashboard';
      break;
    }
    case 'error': {
      textEl.textContent = formatPopupErrorMessage(details?.error);
      banner.title = 'Click to open Debug Log Dashboard';
      break;
    }
    case 'idle':
    default:
      textEl.textContent = 'Ready to auto-fill form fields';
      banner.removeAttribute('title');
      break;
  }
}

export async function loadSettings(): Promise<PopupSettings> {
  const defaults: PopupSettings = {
    provider: 'ollama',
    ollamaModel: 'llama3.2',
    geminiModel: 'gemini-1.5-flash',
    geminiApiKey: '',
  };

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return defaults;
  }

  const stored = await chrome.storage.local.get([
    'provider',
    'ollamaModel',
    'geminiModel',
    'geminiApiKey',
  ]);

  const settings: PopupSettings = {
    provider: stored.provider || defaults.provider,
    ollamaModel: stored.ollamaModel || defaults.ollamaModel,
    geminiModel: stored.geminiModel || defaults.geminiModel,
    geminiApiKey: stored.geminiApiKey || defaults.geminiApiKey,
  };

  const providerSelect = document.getElementById('provider-select') as HTMLSelectElement | null;
  const ollamaSelect = document.getElementById('ollama-model-select') as HTMLSelectElement | null;
  const geminiSelect = document.getElementById('gemini-model-select') as HTMLSelectElement | null;
  const geminiInput = document.getElementById('gemini-key-input') as HTMLInputElement | null;

  if (providerSelect) providerSelect.value = settings.provider;
  if (geminiInput) geminiInput.value = settings.geminiApiKey;

  if (ollamaSelect && settings.ollamaModel) {
    populateModelDropdown('ollama', [settings.ollamaModel], settings.ollamaModel);
  }
  if (geminiSelect && settings.geminiModel) {
    populateModelDropdown('gemini', [settings.geminiModel], settings.geminiModel);
  }

  toggleProviderSettingsUI(settings.provider);

  return settings;
}

export async function saveSettings(): Promise<PopupSettings> {
  const providerSelect = document.getElementById('provider-select') as HTMLSelectElement | null;
  const ollamaSelect = document.getElementById('ollama-model-select') as HTMLSelectElement | null;
  const geminiSelect = document.getElementById('gemini-model-select') as HTMLSelectElement | null;
  const geminiInput = document.getElementById('gemini-key-input') as HTMLInputElement | null;

  const settings: PopupSettings = {
    provider: (providerSelect?.value as 'ollama' | 'gemini') || 'ollama',
    ollamaModel: ollamaSelect?.value || 'llama3.2',
    geminiModel: geminiSelect?.value || 'gemini-1.5-flash',
    geminiApiKey: geminiInput?.value.trim() || '',
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set(settings);
  }

  toggleProviderSettingsUI(settings.provider);
  return settings;
}

export function toggleProviderSettingsUI(provider: 'ollama' | 'gemini') {
  const ollamaCard = document.getElementById('ollama-settings');
  const geminiCard = document.getElementById('gemini-settings');

  if (provider === 'gemini') {
    ollamaCard?.classList.add('hidden');
    geminiCard?.classList.remove('hidden');
  } else {
    ollamaCard?.classList.remove('hidden');
    geminiCard?.classList.add('hidden');
  }
}

export async function fetchProviderModels(
  provider: 'ollama' | 'gemini',
  apiKey?: string,
  preferredModel?: string,
): Promise<string[]> {
  const statusMsgEl = document.getElementById(`${provider}-status-msg`);
  const refreshBtn = document.getElementById(`refresh-${provider}-btn`);
  const refreshIcon = refreshBtn?.querySelector('.refresh-icon');

  if (refreshIcon) refreshIcon.classList.add('spin');
  if (statusMsgEl) {
    statusMsgEl.className = 'helper-text';
    statusMsgEl.textContent = 'Fetching available models...';
    statusMsgEl.classList.remove('hidden');
  }

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-gemini-api-key'] = apiKey;
    }

    const url = `http://localhost:3456/models?provider=${provider}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as ModelsResponse;
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = (await res.json()) as ModelsResponse;
    if (data.status === 'success' && Array.isArray(data.models) && data.models.length > 0) {
      populateModelDropdown(provider, data.models, preferredModel);
      await saveSettings();
      if (statusMsgEl) {
        statusMsgEl.className = 'helper-text success';
        statusMsgEl.textContent = `Loaded ${data.models.length} model(s)`;
      }
      return data.models;
    }

    throw new Error(data.error || 'No models returned');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (statusMsgEl) {
      statusMsgEl.className = 'helper-text error';
      statusMsgEl.textContent = errorMsg;
    }
    return [];
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('spin');
  }
}

export function populateModelDropdown(
  provider: 'ollama' | 'gemini',
  models: string[],
  preferredModel?: string,
) {
  const selectEl = document.getElementById(`${provider}-model-select`) as HTMLSelectElement | null;
  if (!selectEl) return;

  const targetValue = preferredModel || selectEl.value;
  selectEl.innerHTML = '';

  models.forEach((model) => {
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = model;
    selectEl.appendChild(opt);
  });

  if (targetValue && models.includes(targetValue)) {
    selectEl.value = targetValue;
  } else if (models.length > 0) {
    selectEl.value = models[0];
  }
}

export async function checkBackendHealth() {
  updateBackendStatusUI('checking');
  try {
    const res = await fetch('http://localhost:3456/health');
    if (res.ok) {
      const data = (await res.json()) as HealthResponse;
      if (data.status === 'ok') {
        updateBackendStatusUI('online');
        return true;
      }
    }
    updateBackendStatusUI('offline');
    return false;
  } catch {
    updateBackendStatusUI('offline');
    return false;
  }
}

export function updateProfilePreviewUI(
  profile: {
    name: string;
    email?: string;
    headline?: string;
  },
  badgeState: 'Loaded' | 'Cached' | 'Offline' = 'Loaded',
) {
  const nameEl = document.getElementById('profile-name');
  const emailEl = document.getElementById('profile-email');
  const headlineEl = document.getElementById('profile-headline');
  const badgeEl = document.getElementById('profile-badge');

  if (nameEl) nameEl.textContent = profile.name;
  if (emailEl && profile.email) emailEl.textContent = profile.email;
  if (headlineEl) headlineEl.textContent = profile.headline || '';

  if (badgeEl) {
    badgeEl.textContent = badgeState;
    badgeEl.className = `badge ${
      badgeState === 'Loaded'
        ? 'success-badge'
        : badgeState === 'Cached'
        ? 'cached-badge'
        : 'offline-badge'
    }`;
  }
}

export async function fetchProfilesList(
  preferredProfileId?: string,
): Promise<ProfileSummary[]> {
  const selectEl = document.getElementById('profile-select') as HTMLSelectElement | null;
  const refreshBtn = document.getElementById('refresh-profiles-btn');
  const refreshIcon = refreshBtn?.querySelector('.refresh-icon');

  if (refreshIcon) refreshIcon.classList.add('spin');

  try {
    const res = await fetch('http://localhost:3456/profiles', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as ProfilesListResponse;
      if (data.status === 'success' && Array.isArray(data.profiles)) {
        if (selectEl) {
          selectEl.innerHTML = '';
          for (const p of data.profiles) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.headline ? `${p.name} — ${p.headline}` : p.name;
            selectEl.appendChild(opt);
          }
          const activeId =
            preferredProfileId || data.activeProfileId || data.profiles[0]?.id || 'default';
          selectEl.value = activeId;
          selectEl.setAttribute('data-active-id', activeId);
        }

        const activeSummary =
          data.profiles.find((p) => p.id === (preferredProfileId || data.activeProfileId)) ||
          data.profiles[0];

        if (activeSummary) {
          updateProfilePreviewUI(
            {
              name: activeSummary.name,
              headline: activeSummary.headline,
            },
            'Loaded',
          );
        }

        // Also fetch active profile email
        try {
          const profileRes = await fetch('http://localhost:3456/profile', { cache: 'no-store' });
          if (profileRes.ok) {
            const profileData = (await profileRes.json()) as UserProfile;
            updateProfilePreviewUI(
              {
                name: profileData.name,
                email: profileData.email,
                headline:
                  activeSummary?.headline ||
                  (profileData.custom && typeof profileData.custom.Headline === 'string'
                    ? profileData.custom.Headline
                    : undefined),
              },
              'Loaded',
            );
          }
        } catch {}

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({
            cachedProfiles: data.profiles,
            activeProfileId: preferredProfileId || data.activeProfileId,
          });
        }

        return data.profiles;
      }
    }
    throw new Error('Failed to fetch profiles list from backend');
  } catch {
    // Offline fallback from chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(['cachedProfiles', 'activeProfileId']);
        if (
          stored.cachedProfiles &&
          Array.isArray(stored.cachedProfiles) &&
          stored.cachedProfiles.length > 0
        ) {
          if (selectEl) {
            selectEl.innerHTML = '';
            for (const p of stored.cachedProfiles as ProfileSummary[]) {
              const opt = document.createElement('option');
              opt.value = p.id;
              opt.textContent = p.headline ? `${p.name} — ${p.headline}` : p.name;
              selectEl.appendChild(opt);
            }
            const activeId = stored.activeProfileId || stored.cachedProfiles[0].id;
            selectEl.value = activeId;
            selectEl.setAttribute('data-active-id', activeId);
          }

          const cachedActive =
            (stored.cachedProfiles as ProfileSummary[]).find(
              (p) => p.id === stored.activeProfileId,
            ) || stored.cachedProfiles[0];

          updateProfilePreviewUI(
            {
              name: cachedActive.name,
              headline: cachedActive.headline,
            },
            'Cached',
          );

          return stored.cachedProfiles as ProfileSummary[];
        }
      } catch {}
    }

    updateProfilePreviewUI({ name: 'Default Profile' }, 'Offline');
    return [];
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('spin');
  }
}

export async function switchActiveProfile(profileId: string): Promise<boolean> {
  const selectEl = document.getElementById('profile-select') as HTMLSelectElement | null;
  const previousId = selectEl?.getAttribute('data-active-id') || 'default';

  try {
    const res = await fetch('http://localhost:3456/profiles/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    });

    if (res.ok) {
      const data = (await res.json()) as SwitchProfileResponse;
      if (data.status === 'success' && data.profile) {
        selectEl?.setAttribute('data-active-id', profileId);
        if (selectEl) {
          const hasOption = Array.from(selectEl.options).some((opt) => opt.value === profileId);
          if (!hasOption) {
            const opt = document.createElement('option');
            opt.value = profileId;
            opt.textContent = data.profile.name || profileId;
            selectEl.appendChild(opt);
          }
          selectEl.value = profileId;
        }

        const headline =
          (data.profile.custom &&
            typeof data.profile.custom.Headline === 'string' &&
            data.profile.custom.Headline) ||
          (Array.isArray(data.profile.experience) && data.profile.experience[0]?.title) ||
          undefined;

        updateProfilePreviewUI(
          {
            name: data.profile.name,
            email: data.profile.email,
            headline,
          },
          'Loaded',
        );

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ activeProfileId: profileId });
        }

        await ExtensionLogger.log(
          'INFO',
          'EXTENSION_POPUP',
          'PROFILE_SWITCH',
          `Switched active persona to ${profileId} (${data.profile.name})`,
          { profileId, name: data.profile.name },
        );

        return true;
      }
    }
    throw new Error(`Profile switch returned status ${res.status}`);
  } catch (err) {
    if (selectEl) selectEl.value = previousId;
    await ExtensionLogger.log(
      'WARN',
      'EXTENSION_POPUP',
      'PROFILE_SWITCH_FAILED',
      `Failed to switch profile to ${profileId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

export async function fetchProfilePreview() {
  await fetchProfilesList();
}

export function bindPopupEvents() {
  const providerSelect = document.getElementById('provider-select') as HTMLSelectElement | null;
  const ollamaSelect = document.getElementById('ollama-model-select') as HTMLSelectElement | null;
  const geminiSelect = document.getElementById('gemini-model-select') as HTMLSelectElement | null;
  const geminiInput = document.getElementById('gemini-key-input') as HTMLInputElement | null;
  const refreshOllamaBtn = document.getElementById('refresh-ollama-btn');
  const refreshGeminiBtn = document.getElementById('refresh-gemini-btn');
  const autofillBtn = document.getElementById('autofill-btn');
  const openLogsBtn = document.getElementById('open-logs-btn');
  const openProfileEditorBtn = document.getElementById('open-profile-editor-btn');

  openProfileEditorBtn?.addEventListener('click', () => {
    ExtensionLogger.log(
      'INFO',
      'EXTENSION_POPUP',
      'PROFILE_EDITOR_UI_OPEN',
      'User opened Profile Editor Web Dashboard',
    );
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'http://localhost:3456/profile-ui' });
    } else if (typeof window !== 'undefined') {
      window.open('http://localhost:3456/profile-ui', '_blank');
    }
  });

  openLogsBtn?.addEventListener('click', () => {
    ExtensionLogger.log(
      'INFO',
      'EXTENSION_POPUP',
      'LOGS_UI_OPEN',
      'User opened Debug Log Dashboard',
    );
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'http://localhost:3456/logs-ui' });
    } else if (typeof window !== 'undefined') {
      window.open('http://localhost:3456/logs-ui', '_blank');
    }
  });

  const statusBanner = document.getElementById('status-banner');
  statusBanner?.addEventListener('click', () => {
    if (statusBanner.classList.contains('error')) {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: 'http://localhost:3456/logs-ui' });
      } else if (typeof window !== 'undefined') {
        window.open('http://localhost:3456/logs-ui', '_blank');
      }
    }
  });

  providerSelect?.addEventListener('change', async () => {
    const settings = await saveSettings();
    ExtensionLogger.log(
      'INFO',
      'EXTENSION_POPUP',
      'PROVIDER_SWITCH',
      `Switched provider to ${settings.provider}`,
    );

    const selectEl = document.getElementById(
      `${settings.provider}-model-select`,
    ) as HTMLSelectElement | null;
    const activeModel =
      settings.provider === 'gemini' ? settings.geminiModel : settings.ollamaModel;

    if (!selectEl || selectEl.options.length <= 1) {
      if (settings.provider === 'ollama') {
        await fetchProviderModels('ollama', undefined, activeModel);
      } else if (settings.provider === 'gemini' && settings.geminiApiKey) {
        await fetchProviderModels('gemini', settings.geminiApiKey, activeModel);
      }
    }
  });

  ollamaSelect?.addEventListener('change', async () => {
    const settings = await saveSettings();
    ExtensionLogger.log(
      'INFO',
      'EXTENSION_POPUP',
      'MODEL_CHANGE',
      `Selected Ollama model: ${settings.ollamaModel}`,
    );
  });

  geminiSelect?.addEventListener('change', async () => {
    const settings = await saveSettings();
    ExtensionLogger.log(
      'INFO',
      'EXTENSION_POPUP',
      'MODEL_CHANGE',
      `Selected Gemini model: ${settings.geminiModel}`,
    );
  });

  geminiInput?.addEventListener('blur', async () => {
    const settings = await saveSettings();
    if (settings.geminiApiKey) {
      await fetchProviderModels('gemini', settings.geminiApiKey, settings.geminiModel);
    }
  });

  const profileSelect = document.getElementById('profile-select') as HTMLSelectElement | null;
  const refreshProfilesBtn = document.getElementById('refresh-profiles-btn');

  profileSelect?.addEventListener('change', async () => {
    if (profileSelect.value) {
      await switchActiveProfile(profileSelect.value);
    }
  });

  refreshProfilesBtn?.addEventListener('click', async () => {
    await ExtensionLogger.log(
      'INFO',
      'EXTENSION_POPUP',
      'REFRESH_PROFILES_CLICK',
      'User refreshed profiles from backend',
    );
    await fetchProfilesList(profileSelect?.value);
  });

  refreshOllamaBtn?.addEventListener('click', async () => {
    ExtensionLogger.log('INFO', 'EXTENSION_POPUP', 'REFRESH_CLICK', 'User refreshed Ollama models');
    const settings = await saveSettings();
    await fetchProviderModels('ollama', undefined, settings.ollamaModel);
  });

  refreshGeminiBtn?.addEventListener('click', async () => {
    ExtensionLogger.log('INFO', 'EXTENSION_POPUP', 'REFRESH_CLICK', 'User refreshed Gemini models');
    const settings = await saveSettings();
    await fetchProviderModels('gemini', settings.geminiApiKey, settings.geminiModel);
  });

  autofillBtn?.addEventListener('click', async () => {
    updateStatusBannerUI('analyzing');
    const settings = await saveSettings();
    const activeModel =
      settings.provider === 'gemini' ? settings.geminiModel : settings.ollamaModel;
    const currentProfileSelect = document.getElementById('profile-select') as HTMLSelectElement | null;
    const activeProfileId = currentProfileSelect?.value || undefined;

    ExtensionLogger.log(
      'INFO',
      'EXTENSION_POPUP',
      'TRIGGER_AUTOFILL_CLICK',
      `Auto-fill form clicked with provider: ${settings.provider}, model: ${activeModel}, profile: ${activeProfileId || 'default'}`,
    );

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'TRIGGER_AUTOFILL',
        options: {
          provider: settings.provider,
          model: activeModel,
          apiKey: settings.geminiApiKey,
          profileId: activeProfileId,
        },
      });
    }
  });

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.action === 'STATUS_UPDATE') {
        updateStatusBannerUI(message.currentState, {
          filledCount: message.filledCount,
          failedCount: message.failedCount,
          skippedCount: message.skippedCount,
          error: message.error,
          durationMs: message.durationMs,
          llmDurationMs: message.llmDurationMs,
          scanDurationMs: message.scanDurationMs,
          fillDurationMs: message.fillDurationMs,
        });
      }
    });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const settings = await loadSettings();
    const isOnline = await checkBackendHealth();
    bindPopupEvents();
    await fetchProfilesList();

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(['autofillStatus']);
        if (stored.autofillStatus) {
          updateStatusBannerUI(
            stored.autofillStatus.currentState,
            stored.autofillStatus,
          );
        }
      } catch {
        // Ignore storage errors on init
      }
    }

    if (isOnline) {
      if (settings.provider === 'ollama') {
        fetchProviderModels('ollama', undefined, settings.ollamaModel);
      } else if (settings.provider === 'gemini' && settings.geminiApiKey) {
        fetchProviderModels('gemini', settings.geminiApiKey, settings.geminiModel);
      }
    }
  });
}
