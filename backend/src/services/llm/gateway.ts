import { FieldMetadata, FieldMappingValue, UserProfile } from '@autofiller/shared';
import { LLMOptions, LLMParseError, LLMProvider, LLMProviderError } from './types.js';
import { OllamaProvider } from './ollamaProvider.js';
import { GeminiProvider } from './geminiProvider.js';

export class LLMGateway {
  private ollamaProvider: LLMProvider;
  private geminiProvider: LLMProvider;

  constructor(customProviders?: { ollama?: LLMProvider; gemini?: LLMProvider }) {
    this.ollamaProvider = customProviders?.ollama || new OllamaProvider();
    this.geminiProvider = customProviders?.gemini || new GeminiProvider();
  }

  async mapFields(
    providerName: 'ollama' | 'gemini',
    fields: FieldMetadata[],
    profile: UserProfile,
    options?: LLMOptions,
  ): Promise<Record<string, FieldMappingValue>> {
    const provider = providerName === 'gemini' ? this.geminiProvider : this.ollamaProvider;
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await provider.mapFields(fields, profile, options);
      } catch (err) {
        if (err instanceof LLMParseError) {
          lastError = err;
          if (attempt < maxRetries) {
            continue;
          }
        }
        throw err;
      }
    }

    throw lastError || new LLMProviderError('LLM gateway failed after retries');
  }

  async getAvailableModels(
    providerName: 'ollama' | 'gemini',
    options?: LLMOptions,
  ): Promise<string[]> {
    const provider = providerName === 'gemini' ? this.geminiProvider : this.ollamaProvider;
    if (provider.fetchAvailableModels) {
      return await provider.fetchAvailableModels(options);
    }
    return providerName === 'gemini' ? ['gemini-1.5-flash', 'gemini-1.5-pro'] : ['llama3.2'];
  }
}
