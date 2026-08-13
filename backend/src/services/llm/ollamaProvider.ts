import { FieldMetadata, UserProfile } from '@autofiller/shared';
import { LLMOptions, LLMProvider, LLMProviderError } from './types.js';
import { buildFieldMappingPrompt } from './promptBuilder.js';
import { parseLLMJsonResponse } from './responseParser.js';

export class OllamaProvider implements LLMProvider {
  private host: string;

  constructor(host?: string) {
    this.host = host || process.env.OLLAMA_HOST || 'http://localhost:11434';
  }

  async mapFields(
    fields: FieldMetadata[],
    profile: UserProfile,
    options?: LLMOptions
  ): Promise<Record<string, string>> {
    const prompt = buildFieldMappingPrompt(fields, profile);
    const model = options?.model || 'llama3.2';
    const timeoutMs = options?.timeoutMs || 30000;
    const url = `${this.host.replace(/\/$/, '')}/api/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt: prompt.combinedPrompt,
          format: 'json',
          stream: false
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        throw new LLMProviderError(
          `Ollama API returned HTTP status ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as { response?: string };
      if (!data || typeof data.response !== 'string') {
        throw new LLMProviderError('Ollama API returned an empty response payload');
      }

      return parseLLMJsonResponse(data.response);
    } catch (err) {
      if (err instanceof LLMProviderError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LLMProviderError(`Ollama request timed out after ${timeoutMs}ms`, err);
      }
      throw new LLMProviderError(
        `Ollama not reachable at ${this.host}. Ensure Ollama is running. (${err instanceof Error ? err.message : String(err)})`,
        err
      );
    }
  }

  async fetchAvailableModels(options?: LLMOptions): Promise<string[]> {
    const timeoutMs = options?.timeoutMs || 10000;
    const url = `${this.host.replace(/\/$/, '')}/api/tags`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new LLMProviderError(
          `Ollama tags API returned status ${response.status}`
        );
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      if (Array.isArray(data?.models) && data.models.length > 0) {
        return data.models.map((m) => m.name);
      }
      return ['llama3.2'];
    } catch (err) {
      if (err instanceof LLMProviderError) throw err;
      throw new LLMProviderError(
        `Ollama service not reachable at ${this.host}. Ensure Ollama is running. (${err instanceof Error ? err.message : String(err)})`,
        err
      );
    }
  }
}
