import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('GET /profile', () => {
  it('returns 200 OK with valid profile JSON', async () => {
    const response = await request(app).get('/profile');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('email');
    expect(response.body).toHaveProperty('phone');
    expect(typeof response.body.name).toBe('string');
  });
});
