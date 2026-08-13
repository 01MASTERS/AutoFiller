import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from '../services/llm/geminiProvider.js';
import { LLMProviderError } from '../services/llm/types.js';
import { FieldMetadata, UserProfile } from '@autofiller/shared';

const generateContentMock = vi.fn();
const getGenerativeModelMock = vi.fn().mockImplementation(() => ({
  generateContent: generateContentMock
}));

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: getGenerativeModelMock
    }))
  };
});

describe('GeminiProvider', () => {
  const fields: FieldMetadata[] = [{ id: 'entry.1', label: 'Name' }];
  const profile: UserProfile = { name: 'Bob', email: 'bob@example.com', phone: '456' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws LLMProviderError when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const provider = new GeminiProvider();
    await expect(provider.mapFields(fields, profile)).rejects.toThrow(LLMProviderError);
  });

  it('successfully calls Gemini SDK and returns mapping', async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () => '{"entry.1": "Bob"}'
      }
    });

    const provider = new GeminiProvider();
    const result = await provider.mapFields(fields, profile, { apiKey: 'test-api-key' });

    expect(getGenerativeModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      })
    );
    expect(result).toEqual({ 'entry.1': 'Bob' });
  });

  it('throws LLMProviderError on empty SDK response text', async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () => ''
      }
    });

    const provider = new GeminiProvider();
    await expect(
      provider.mapFields(fields, profile, { apiKey: 'test-api-key' })
    ).rejects.toThrow(LLMProviderError);
  });
});
