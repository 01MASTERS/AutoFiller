import { GoogleGenerativeAI } from '@google/generative-ai';
import { FieldMetadata, UserProfile } from '@autofiller/shared';
import { LLMOptions, LLMProvider, LLMProviderError } from './types.js';
import { buildFieldMappingPrompt } from './promptBuilder.js';
import { parseLLMJsonResponse } from './responseParser.js';

export class GeminiProvider implements LLMProvider {
  async mapFields(
    fields: FieldMetadata[],
    profile: UserProfile,
    options?: LLMOptions,
  ): Promise<Record<string, string>> {
    const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new LLMProviderError(
        'Gemini API key not provided. Set GEMINI_API_KEY or pass key in settings.',
      );
    }

    const modelName = options?.model || 'gemini-1.5-flash';
    const timeoutMs = options?.timeoutMs || 30000;
    const prompt = buildFieldMappingPrompt(fields, profile);

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
      },
      systemInstruction: prompt.systemPrompt,
    });

    try {
      const generatePromise = model.generateContent(prompt.userPrompt);
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new LLMProviderError(`Gemini request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        if (typeof timer === 'object' && 'unref' in timer) {
          timer.unref();
        }
      });

      const result = await Promise.race([generatePromise, timeoutPromise]);
      const responseText = result.response.text();

      if (!responseText) {
        throw new LLMProviderError('Gemini API returned an empty response text');
      }

      return parseLLMJsonResponse(responseText);
    } catch (err) {
      if (err instanceof LLMProviderError) {
        throw err;
      }
      throw new LLMProviderError(
        `Gemini API request failed: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }
  }

  async fetchAvailableModels(options?: LLMOptions): Promise<string[]> {
    const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new LLMProviderError('Gemini API key is required to list available models.');
    }

    const timeoutMs = options?.timeoutMs || 10000;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new LLMProviderError(
          `Gemini API returned status ${response.status}: Invalid API Key or access denied`,
        );
      }

      const data = (await response.json()) as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
      };

      if (Array.isArray(data?.models) && data.models.length > 0) {
        const generationModels = data.models
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''));

        if (generationModels.length > 0) {
          return generationModels;
        }
      }

      return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
    } catch (err) {
      if (err instanceof LLMProviderError) throw err;
      throw new LLMProviderError(
        `Failed to fetch Gemini models: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }
  }
}
