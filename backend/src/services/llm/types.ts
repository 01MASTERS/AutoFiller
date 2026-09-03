import { FieldMetadata, FieldMappingValue, UserProfile } from '@autofiller/shared';

export interface LLMOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface LLMProvider {
  mapFields(
    fields: FieldMetadata[],
    profile: UserProfile,
    options?: LLMOptions,
  ): Promise<Record<string, FieldMappingValue>>;
  fetchAvailableModels?(options?: LLMOptions): Promise<string[]>;
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export class LLMParseError extends Error {
  constructor(
    message: string,
    public rawResponse?: string,
  ) {
    super(message);
    this.name = 'LLMParseError';
  }
}
