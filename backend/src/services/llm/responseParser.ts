import { LLMParseError } from './types.js';

export function parseLLMJsonResponse(rawResponse: string): Record<string, string> {
  if (!rawResponse || typeof rawResponse !== 'string') {
    throw new LLMParseError('Empty or invalid response from LLM', String(rawResponse));
  }

  let cleaned = rawResponse.trim();

  // Check for code block inside rawResponse
  const codeBlockMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // Strip leading/trailing backticks if any
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new LLMParseError(
      `Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`,
      rawResponse
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new LLMParseError('Parsed JSON is not a plain object', rawResponse);
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value);
    } else {
      throw new LLMParseError(
        `Value for key "${key}" is not a string (got ${typeof value})`,
        rawResponse
      );
    }
  }

  return result;
}
