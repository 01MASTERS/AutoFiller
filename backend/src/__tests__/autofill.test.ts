import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { setLLMGateway } from '../routes/api.js';
import { LLMGateway } from '../services/llm/gateway.js';
import { LLMProviderError } from '../services/llm/types.js';

describe('POST /autofill', () => {
  const mapFieldsMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const mockGateway = {
      mapFields: mapFieldsMock,
    } as unknown as LLMGateway;
    setLLMGateway(mockGateway);
  });

  it('returns 200 OK with mapped fields for Ollama provider', async () => {
    mapFieldsMock.mockResolvedValue({
      'entry.123': 'Jane Doe',
      'entry.456': 'jane@example.com',
    });

    const payload = {
      fields: [
        { id: 'entry.123', label: 'Full Name', required: true },
        { id: 'entry.456', label: 'Email Address' },
      ],
      provider: 'ollama',
    };

    const response = await request(app).post('/autofill').send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      mappings: {
        'entry.123': 'Jane Doe',
        'entry.456': 'jane@example.com',
      },
    });
    expect(mapFieldsMock).toHaveBeenCalledWith(
      'ollama',
      payload.fields,
      expect.objectContaining({ name: expect.any(String) }),
      { apiKey: undefined, model: undefined },
    );
  });

  it('returns 200 OK with Gemini provider forwarding header API key and model', async () => {
    mapFieldsMock.mockResolvedValue({
      'entry.123': 'Jane Doe',
    });

    const payload = {
      fields: [{ id: 'entry.123', label: 'Full Name' }],
      provider: 'gemini',
      model: 'gemini-1.5-flash',
    };

    const response = await request(app)
      .post('/autofill')
      .set('x-gemini-api-key', 'custom-header-api-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(mapFieldsMock).toHaveBeenCalledWith('gemini', payload.fields, expect.anything(), {
      apiKey: 'custom-header-api-key',
      model: 'gemini-1.5-flash',
    });
  });

  it('returns 502 Bad Gateway when LLM gateway fails', async () => {
    mapFieldsMock.mockRejectedValue(
      new LLMProviderError('Ollama not reachable at http://localhost:11434'),
    );

    const payload = {
      fields: [{ id: 'entry.123', label: 'Full Name' }],
    };

    const response = await request(app).post('/autofill').send(payload);

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      status: 'error',
      mappings: {},
      error: 'Ollama not reachable at http://localhost:11434',
    });
  });

  it('returns 400 Bad Request when fields array is missing or empty', async () => {
    const invalidPayload = {
      fields: [],
    };

    const response = await request(app).post('/autofill').send(invalidPayload);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('error', 'Invalid request payload');
  });

  it('returns 400 Bad Request when payload is completely invalid', async () => {
    const response = await request(app).post('/autofill').send({ invalid: 'data' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 'error');
  });

  it('records LLM_QUOTA_EXCEEDED error log when quota error is thrown', async () => {
    mapFieldsMock.mockRejectedValue(
      new LLMProviderError('Gemini Quota Exceeded (429 Rate Limit) - Google AI Studio quota exhausted'),
    );

    const payload = {
      fields: [{ id: 'field-1', label: 'Full Name' }],
      provider: 'gemini',
      model: 'gemini-1.5-flash',
    };

    const response = await request(app).post('/autofill').send(payload);

    expect(response.status).toBe(502);

    const logsRes = await request(app).get('/logs?query=QUOTA');
    expect(logsRes.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(logsRes.body.logs[0].tag).toBe('LLM_QUOTA_EXCEEDED');
    expect(logsRes.body.logs[0].level).toBe('ERROR');
  });

  it('records LLM_ZERO_MAPPINGS warning when LLM returns no mappings', async () => {
    mapFieldsMock.mockResolvedValue({});

    const payload = {
      fields: [{ id: 'field-unknown', label: 'Some completely unrelated question' }],
      provider: 'ollama',
    };

    const response = await request(app).post('/autofill').send(payload);

    expect(response.status).toBe(200);

    const logsRes = await request(app).get('/logs?query=ZERO');
    expect(logsRes.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(logsRes.body.logs[0].tag).toBe('LLM_ZERO_MAPPINGS');
    expect(logsRes.body.logs[0].level).toBe('WARN');
  });
});
