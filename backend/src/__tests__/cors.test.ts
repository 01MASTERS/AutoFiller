import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('CORS Middleware', () => {
  it('allows chrome-extension:// origins', async () => {
    const origin = 'chrome-extension://abcdefghijklmnopqrstuvwxyz';
    const response = await request(app).get('/health').set('Origin', origin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  it('allows http://localhost origins', async () => {
    const origin = 'http://localhost:5173';
    const response = await request(app).get('/health').set('Origin', origin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  it('handles OPTIONS preflight requests', async () => {
    const origin = 'chrome-extension://abcdefghijklmnopqrstuvwxyz';
    const response = await request(app)
      .options('/autofill')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  it('blocks unauthorized origins with 403', async () => {
    const origin = 'https://unauthorized-domain.com';
    const response = await request(app).get('/health').set('Origin', origin);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('status', 'error');
  });
});
