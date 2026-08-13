import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  populateModelDropdown,
  fetchProviderModels,
  loadSettings,
  saveSettings,
} from '../popup/popup.js';

describe('Popup Model Discovery', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="provider-select">
        <option value="ollama">Ollama</option>
        <option value="gemini">Gemini</option>
      </select>
      <div id="ollama-settings">
        <button id="refresh-ollama-btn">
          <svg class="refresh-icon"></svg>
        </button>
        <select id="ollama-model-select">
          <option value="llama3.2">llama3.2</option>
        </select>
        <span id="ollama-status-msg" class="helper-text hidden"></span>
      </div>
      <div id="gemini-settings" class="hidden">
        <input type="password" id="gemini-key-input" value="test-key" />
        <button id="refresh-gemini-btn">
          <svg class="refresh-icon"></svg>
        </button>
        <select id="gemini-model-select">
          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
        </select>
        <span id="gemini-status-msg" class="helper-text hidden"></span>
      </div>
    `;

    vi.stubGlobal('fetch', vi.fn());
  });

  it('populates model dropdown correctly', () => {
    populateModelDropdown('ollama', ['llama3.2', 'mistral', 'codellama']);
    const select = document.getElementById('ollama-model-select') as HTMLSelectElement;
    expect(select.options.length).toBe(3);
    expect(select.options[0].value).toBe('llama3.2');
    expect(select.options[1].value).toBe('mistral');
    expect(select.options[2].value).toBe('codellama');
  });

  it('preserves preferred model on populateModelDropdown', () => {
    populateModelDropdown('ollama', ['llama3.2', 'mistral', 'codellama'], 'mistral');
    const select = document.getElementById('ollama-model-select') as HTMLSelectElement;
    expect(select.value).toBe('mistral');
  });

  it('fetches provider models successfully from backend and preserves preferred model', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        provider: 'ollama',
        models: ['llama3.2', 'mistral'],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const models = await fetchProviderModels('ollama', undefined, 'mistral');
    expect(models).toEqual(['llama3.2', 'mistral']);

    const select = document.getElementById('ollama-model-select') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('mistral');

    const statusMsg = document.getElementById('ollama-status-msg');
    expect(statusMsg?.textContent).toContain('Loaded 2 model(s)');
  });

  it('displays error message when model fetch fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        status: 'error',
        error: 'Ollama service offline',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const models = await fetchProviderModels('ollama');
    expect(models).toEqual([]);

    const statusMsg = document.getElementById('ollama-status-msg');
    expect(statusMsg?.textContent).toBe('Ollama service offline');
  });
});
