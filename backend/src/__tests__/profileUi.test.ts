import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Profile Editor UI Web Dashboard Endpoints', () => {
  it('GET /profile-ui returns 200 OK HTML document for visual profile editor', async () => {
    const response = await request(app).get('/profile-ui');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('AutoFiller — Persona Profile Editor');
    expect(response.text).toContain('id="persona-list"');
    expect(response.text).toContain('id="new-persona-btn"');
    expect(response.text).toContain('id="tab-visual-btn"');
    expect(response.text).toContain('id="tab-json-btn"');
    expect(response.text).toContain('id="visual-form-view"');
    expect(response.text).toContain('id="json-editor-view"');
    expect(response.text).toContain('id="json-textarea"');
    expect(response.text).toContain('id="save-profile-btn"');
    expect(response.text).toContain('id="set-active-btn"');
    expect(response.text).toContain('id="delete-profile-btn"');
    expect(response.text).toContain('id="new-persona-modal"');
  });

  it('GET /profiles-ui returns 200 OK HTML document as route alias', async () => {
    const response = await request(app).get('/profiles-ui');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('AutoFiller — Persona Profile Editor');
    expect(response.text).toContain('id="persona-list"');
    expect(response.text).toContain('id="save-profile-btn"');
  });

  it('includes interactive client script and API interaction logic', async () => {
    const response = await request(app).get('/profile-ui');

    expect(response.text).toContain('/profiles');
    expect(response.text).toContain('/profiles/switch');
    expect(response.text).toContain('loadProfiles');
    expect(response.text).toContain('selectPersona');
    expect(response.text).toContain('showToast');
    expect(response.text).toContain('Candidate Headline');
    expect(response.text).toContain('Work Experience');
    expect(response.text).toContain('Education');
    expect(response.text).toContain('Skills & Competencies');
    expect(response.text).toContain('Custom Question Answers');
  });
});
