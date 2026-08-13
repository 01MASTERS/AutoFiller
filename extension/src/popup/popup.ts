import { HealthResponse, ModelsResponse, UserProfile } from '@autofiller/shared';
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

export function updateStatusBannerUI(
  state: 'idle' | 'analyzing' | 'filling' | 'done' | 'error',
  details?: { filledCount?: number; failedCount?: number; error?: string }
) {
  const banner = document.getElementById('status-banner');
  const textEl = document.getElementById('status-text');
  if (!banner || !textEl) return;

  banner.className = `status-banner ${state}`;

  switch (state) {
    case 'analyzing':
      textEl.textContent = 'Analyzing form & matching fields...';
      break;
    case 'filling':
      textEl.textContent = 'Filling form fields...';
      break;
    case 'done':
      textEl.textContent = `Auto-filled ${details?.filledCount || 0} fields!`;
      break;
    case 'error': {
      const rawError = details?.error || 'Auto-fill failed';
      if (rawError.includes('Ollama') || rawError.includes('11434')) {
        textEl.textContent = 'Ollama service offline. Run "ollama run llama3.2" to start.';
      } else if (rawError.includes('3456') || rawError.includes('Failed to fetch') || rawError.includes('Backend')) {
        textEl.textContent = 'Backend server offline. Start server with "npm run dev".';
      } else {
        textEl.textContent = rawError;
      }
      break;
    }
    case 'idle':
    default:
      textEl.textContent = 'Ready to auto-fill form fields';
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
  preferredModel?: string
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

    const url = `http://localhost:3456/models?provider=${provider}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`;
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
  preferredModel?: string
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

export async function fetchProfilePreview() {
  const nameEl = document.getElementById('profile-name');
  const emailEl = document.getElementById('profile-email');

  try {
    const res = await fetch('http://localhost:3456/profile');
    if (res.ok) {
      const profile = (await res.json()) as UserProfile;
      if (nameEl) nameEl.textContent = profile.name;
      if (emailEl) emailEl.textContent = profile.email;
    }
  } catch {
    // Keep placeholder profile if server unreachable
  }
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

  openLogsBtn?.addEventListener('click', () => {
    ExtensionLogger.log('INFO', 'EXTENSION_POPUP', 'LOGS_UI_OPEN', 'User opened Debug Log Dashboard');
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'http://localhost:3456/logs-ui' });
    } else if (typeof window !== 'undefined') {
      window.open('http://localhost:3456/logs-ui', '_blank');
    }
  });

  providerSelect?.addEventListener('change', async () => {
    const settings = await saveSettings();
    ExtensionLogger.log('INFO', 'EXTENSION_POPUP', 'PROVIDER_SWITCH', `Switched provider to ${settings.provider}`);

    const selectEl = document.getElementById(`${settings.provider}-model-select`) as HTMLSelectElement | null;
    const activeModel = settings.provider === 'gemini' ? settings.geminiModel : settings.ollamaModel;

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
    ExtensionLogger.log('INFO', 'EXTENSION_POPUP', 'MODEL_CHANGE', `Selected Ollama model: ${settings.ollamaModel}`);
  });

  geminiSelect?.addEventListener('change', async () => {
    const settings = await saveSettings();
    ExtensionLogger.log('INFO', 'EXTENSION_POPUP', 'MODEL_CHANGE', `Selected Gemini model: ${settings.geminiModel}`);
  });

  geminiInput?.addEventListener('blur', async () => {
    const settings = await saveSettings();
    if (settings.geminiApiKey) {
      await fetchProviderModels('gemini', settings.geminiApiKey, settings.geminiModel);
    }
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
    const activeModel = settings.provider === 'gemini' ? settings.geminiModel : settings.ollamaModel;

    ExtensionLogger.log('INFO', 'EXTENSION_POPUP', 'TRIGGER_AUTOFILL_CLICK', `Auto-fill form clicked with provider: ${settings.provider}, model: ${activeModel}`);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'TRIGGER_AUTOFILL',
        options: {
          provider: settings.provider,
          model: activeModel,
          apiKey: settings.geminiApiKey,
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
          error: message.error,
        });
      }
    });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const settings = await loadSettings();
    const isOnline = await checkBackendHealth();
    fetchProfilePreview();
    bindPopupEvents();

    if (isOnline) {
      if (settings.provider === 'ollama') {
        fetchProviderModels('ollama', undefined, settings.ollamaModel);
      } else if (settings.provider === 'gemini' && settings.geminiApiKey) {
        fetchProviderModels('gemini', settings.geminiApiKey, settings.geminiModel);
      }
    }
  });
}
