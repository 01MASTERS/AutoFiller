import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { setLLMGateway, apiRouter } from '../routes/api.js';
import { LLMGateway } from '../services/llm/gateway.js';
import { LLMProviderError } from '../services/llm/types.js';

describe('GET /models API', () => {
  let mockGateway: LLMGateway;

  beforeEach(() => {
    mockGateway = new LLMGateway();
    setLLMGateway(mockGateway);
  });

  it('returns Ollama models when provider=ollama', async () => {
    vi.spyOn(mockGateway, 'getAvailableModels').mockResolvedValue(['llama3.2', 'mistral']);

    const res = await request(app).get('/models?provider=ollama');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'success',
      provider: 'ollama',
      models: ['llama3.2', 'mistral'],
    });
  });

  it('returns Gemini models when provider=gemini and API key provided', async () => {
    vi.spyOn(mockGateway, 'getAvailableModels').mockResolvedValue(['gemini-1.5-flash', 'gemini-1.5-pro']);

    const res = await request(app)
      .get('/models?provider=gemini')
      .set('x-gemini-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'success',
      provider: 'gemini',
      models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    });
  });

  it('handles LLMProviderError and returns 502 with error message', async () => {
    vi.spyOn(mockGateway, 'getAvailableModels').mockRejectedValue(
      new LLMProviderError('Ollama service offline')
    );

    const res = await request(app).get('/models?provider=ollama');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      status: 'error',
      provider: 'ollama',
      models: [],
      error: 'Ollama service offline',
    });
  });
});
