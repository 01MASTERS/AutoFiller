import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('GET /test-form', () => {
  it('returns 200 OK HTML document containing Google Form input fixtures', async () => {
    const response = await request(app).get('/test-form');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('AutoFiller Test Form');
    expect(response.text).toContain('role="listitem"');
    expect(response.text).toContain('entry.101');
    expect(response.text).toContain('entry.102');
    expect(response.text).toContain('entry.103');
    expect(response.text).toContain('entry.104');
  });
});
