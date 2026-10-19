import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Dynamic Backend Options Test Form E2E (Plan 24-03)', () => {
  it('GET /test-forms/dynamic-options returns 200 OK HTML with dynamic dropdown and cascading fixtures', async () => {
    const response = await request(app).get('/test-forms/dynamic-options');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Dynamic & Backend-Fetched Options QA');
    expect(response.text).toContain('id="countryCode"');
    expect(response.text).toContain('aria-busy="true"');
    expect(response.text).toContain('id="country"');
    expect(response.text).toContain('id="state"');
    expect(response.text).toContain('disabled');
    expect(response.text).toContain('id="role-combobox"');
    expect(response.text).toContain('role="combobox"');
    expect(response.text).toContain('role="listbox"');
    expect(response.text).toContain('Frontend Engineer');
    expect(response.text).toContain('Backend Engineer');
  });

  it('GET /test-forms hub lists dynamic-options fixture with correct metadata', async () => {
    const response = await request(app).get('/test-forms');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('/test-forms/dynamic-options');
    expect(response.text).toContain('Dynamic Backend Options');
    expect(response.text).toContain('Dynamic / Async');
  });
});
