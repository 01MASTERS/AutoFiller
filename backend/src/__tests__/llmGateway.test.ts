import { describe, it, expect, vi } from 'vitest';
import { LLMGateway } from '../services/llm/gateway.js';
import { LLMParseError, LLMProvider } from '../services/llm/types.js';
import { FieldMetadata, UserProfile } from '@autofiller/shared';

describe('LLMGateway', () => {
  const fields: FieldMetadata[] = [{ id: 'entry.1', label: 'Name' }];
  const profile: UserProfile = { name: 'Charlie', email: 'c@example.com', phone: '789' };

  it('routes to Ollama provider when requested', async () => {
    const mockOllama: LLMProvider = {
      mapFields: vi.fn().mockResolvedValue({ 'entry.1': 'Charlie' }),
    };
    const mockGemini: LLMProvider = {
      mapFields: vi.fn(),
    };

    const gateway = new LLMGateway({ ollama: mockOllama, gemini: mockGemini });
    const result = await gateway.mapFields('ollama', fields, profile);

    expect(mockOllama.mapFields).toHaveBeenCalled();
    expect(mockGemini.mapFields).not.toHaveBeenCalled();
    expect(result).toEqual({ 'entry.1': 'Charlie' });
  });

  it('routes to Gemini provider when requested', async () => {
    const mockOllama: LLMProvider = {
      mapFields: vi.fn(),
    };
    const mockGemini: LLMProvider = {
      mapFields: vi.fn().mockResolvedValue({ 'entry.1': 'Charlie' }),
    };

    const gateway = new LLMGateway({ ollama: mockOllama, gemini: mockGemini });
    const result = await gateway.mapFields('gemini', fields, profile, { apiKey: 'key' });

    expect(mockGemini.mapFields).toHaveBeenCalled();
    expect(mockOllama.mapFields).not.toHaveBeenCalled();
    expect(result).toEqual({ 'entry.1': 'Charlie' });
  });

  it('retries up to 2 times on LLMParseError and succeeds if second attempt passes', async () => {
    const mapFieldsMock = vi
      .fn()
      .mockRejectedValueOnce(new LLMParseError('Malformed JSON', 'bad text'))
      .mockResolvedValueOnce({ 'entry.1': 'Charlie' });

    const mockOllama: LLMProvider = { mapFields: mapFieldsMock };
    const gateway = new LLMGateway({ ollama: mockOllama });

    const result = await gateway.mapFields('ollama', fields, profile);

    expect(mapFieldsMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ 'entry.1': 'Charlie' });
  });

  it('throws error when retries are exhausted on repeated LLMParseError', async () => {
    const mapFieldsMock = vi
      .fn()
      .mockRejectedValue(new LLMParseError('Malformed JSON', 'bad text'));

    const mockOllama: LLMProvider = { mapFields: mapFieldsMock };
    const gateway = new LLMGateway({ ollama: mockOllama });

    await expect(gateway.mapFields('ollama', fields, profile)).rejects.toThrow(LLMParseError);
    expect(mapFieldsMock).toHaveBeenCalledTimes(3);
  });
});
