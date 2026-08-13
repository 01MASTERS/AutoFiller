import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('POST /autofill', () => {
  it('returns 200 OK with stub mappings for valid AutofillRequest', async () => {
    const validPayload = {
      fields: [
        { id: 'entry.123', label: 'Full Name', required: true },
        { id: 'entry.456', label: 'Email Address' },
      ],
      provider: 'ollama',
    };

    const response = await request(app).post('/autofill').send(validPayload);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('mappings');
    expect(typeof response.body.mappings).toBe('object');
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
});
