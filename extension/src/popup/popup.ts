import { HealthResponse, UserProfile } from '@autofiller/shared';

export interface PopupSettings {
  provider: 'ollama' | 'gemini';
  ollamaModel: string;
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
    geminiApiKey: '',
  };

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return defaults;
  }

  const stored = await chrome.storage.local.get([
    'provider',
    'ollamaModel',
    'geminiApiKey',
  ]);

  const settings: PopupSettings = {
    provider: stored.provider || defaults.provider,
    ollamaModel: stored.ollamaModel || defaults.ollamaModel,
    geminiApiKey: stored.geminiApiKey || defaults.geminiApiKey,
  };

  const providerSelect = document.getElementById(
    'provider-select'
  ) as HTMLSelectElement | null;
  const ollamaInput = document.getElementById(
    'ollama-model-input'
  ) as HTMLInputElement | null;
  const geminiInput = document.getElementById(
    'gemini-key-input'
  ) as HTMLInputElement | null;

  if (providerSelect) providerSelect.value = settings.provider;
  if (ollamaInput) ollamaInput.value = settings.ollamaModel;
  if (geminiInput) geminiInput.value = settings.geminiApiKey;

  toggleProviderSettingsUI(settings.provider);

  return settings;
}

export async function saveSettings() {
  const providerSelect = document.getElementById(
    'provider-select'
  ) as HTMLSelectElement | null;
  const ollamaInput = document.getElementById(
    'ollama-model-input'
  ) as HTMLInputElement | null;
  const geminiInput = document.getElementById(
    'gemini-key-input'
  ) as HTMLInputElement | null;

  const settings: PopupSettings = {
    provider: (providerSelect?.value as 'ollama' | 'gemini') || 'ollama',
    ollamaModel: ollamaInput?.value.trim() || 'llama3.2',
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
  const providerSelect = document.getElementById('provider-select');
  const ollamaInput = document.getElementById('ollama-model-input');
  const geminiInput = document.getElementById('gemini-key-input');
  const autofillBtn = document.getElementById('autofill-btn');

  providerSelect?.addEventListener('change', () => saveSettings());
  ollamaInput?.addEventListener('input', () => saveSettings());
  geminiInput?.addEventListener('input', () => saveSettings());

  autofillBtn?.addEventListener('click', async () => {
    const settings = await saveSettings();

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'TRIGGER_AUTOFILL',
        options: {
          provider: settings.provider,
          model: settings.ollamaModel,
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
  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    checkBackendHealth();
    fetchProfilePreview();
    bindPopupEvents();
  });
}
