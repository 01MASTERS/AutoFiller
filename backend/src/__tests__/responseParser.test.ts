import { describe, it, expect } from 'vitest';
import { parseLLMJsonResponse } from '../services/llm/responseParser.js';
import { LLMParseError } from '../services/llm/types.js';

describe('responseParser', () => {
  it('parses valid raw JSON string', () => {
    const raw = '{"entry.123": "Jane Doe", "entry.456": "jane@example.com"}';
    const result = parseLLMJsonResponse(raw);
    expect(result).toEqual({
      'entry.123': 'Jane Doe',
      'entry.456': 'jane@example.com'
    });
  });

  it('strips markdown json code fences', () => {
    const raw = '```json\n{"entry.123": "Jane Doe"}\n```';
    const result = parseLLMJsonResponse(raw);
    expect(result).toEqual({ 'entry.123': 'Jane Doe' });
  });

  it('strips plain markdown code fences without language tag', () => {
    const raw = '```\n{"entry.123": "Jane Doe"}\n```';
    const result = parseLLMJsonResponse(raw);
    expect(result).toEqual({ 'entry.123': 'Jane Doe' });
  });

  it('coerces numbers and booleans to strings', () => {
    const raw = '{"entry.123": 12345, "entry.456": true}';
    const result = parseLLMJsonResponse(raw);
    expect(result).toEqual({
      'entry.123': '12345',
      'entry.456': 'true'
    });
  });

  it('throws LLMParseError on invalid JSON string', () => {
    const raw = 'This is not JSON';
    expect(() => parseLLMJsonResponse(raw)).toThrow(LLMParseError);
  });

  it('throws LLMParseError on non-object JSON (array)', () => {
    const raw = '["entry.123", "Jane Doe"]';
    expect(() => parseLLMJsonResponse(raw)).toThrow(LLMParseError);
  });

  it('throws LLMParseError on nested non-primitive values', () => {
    const raw = '{"entry.123": {"nested": "object"}}';
    expect(() => parseLLMJsonResponse(raw)).toThrow(LLMParseError);
  });
});
