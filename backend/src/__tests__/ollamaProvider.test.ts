import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../services/llm/ollamaProvider.js';
import { LLMProviderError } from '../services/llm/types.js';
import { FieldMetadata, UserProfile } from '@autofiller/shared';

describe('OllamaProvider', () => {
  const fields: FieldMetadata[] = [{ id: 'entry.1', label: 'Name' }];
  const profile: UserProfile = { name: 'Alice', email: 'alice@example.com', phone: '123' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('successfully calls Ollama REST API and returns mapping', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ response: '{"entry.1": "Alice"}' }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider('http://localhost:11434');
    const result = await provider.mapFields(fields, profile);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"model":"llama3.2"'),
      }),
    );
    expect(result).toEqual({ 'entry.1': 'Alice' });
  });

  it('throws LLMProviderError on fetch connection failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider('http://localhost:11434');
    await expect(provider.mapFields(fields, profile)).rejects.toThrow(LLMProviderError);
  });

  it('throws LLMProviderError on non-200 HTTP status', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const provider = new OllamaProvider();
    await expect(provider.mapFields(fields, profile)).rejects.toThrow(LLMProviderError);
  });
});
