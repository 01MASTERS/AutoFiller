import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Multi-Platform Test Form Fixtures Endpoints', () => {
  it('GET /test-form returns 200 OK HTML document containing Google Form input fixtures', async () => {
    const response = await request(app).get('/test-form');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('AutoFiller Test Form');
    expect(response.text).toContain('role="listitem"');
    expect(response.text).toContain('entry.101');
    expect(response.text).toContain('entry.102');
    expect(response.text).toContain('entry.103');
    expect(response.text).toContain('entry.104');
    expect(response.text).toContain('entry.105');
    expect(response.text).toContain('Alternate Phone Number');
  });

  it('GET /test-forms returns 200 OK HTML Hub with links to all test fixtures', async () => {
    const response = await request(app).get('/test-forms');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('AutoFiller Test Forms Hub');
    expect(response.text).toContain('/test-forms/greenhouse');
    expect(response.text).toContain('/test-forms/lever');
    expect(response.text).toContain('/test-forms/workday');
    expect(response.text).toContain('/test-forms/career');
    expect(response.text).toContain('/test-form');
  });

  it('GET /test-forms/greenhouse returns 200 OK HTML Greenhouse application fixture', async () => {
    const response = await request(app).get('/test-forms/greenhouse');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('id="application_form"');
    expect(response.text).toContain('job_application[first_name]');
    expect(response.text).toContain('job_application[last_name]');
    expect(response.text).toContain('job_application[email]');
    expect(response.text).toContain('job_application[resume]');
    expect(response.text).toContain('job_application_gender');
    expect(response.text).toContain('eeoc_fields');
  });

  it('GET /test-forms/lever returns 200 OK HTML Lever application fixture', async () => {
    const response = await request(app).get('/test-forms/lever');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('lever-job-page');
    expect(response.text).toContain('section-candidate-wrapper');
    expect(response.text).toContain('name="name"');
    expect(response.text).toContain('name="urls[LinkedIn]"');
    expect(response.text).toContain('section-custom-questions');
    expect(response.text).toContain('section-eeo');
  });

  it('GET /test-forms/workday returns 200 OK HTML Workday application fixture', async () => {
    const response = await request(app).get('/test-forms/workday');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('data-automation-id="workdayApplicationRoot"');
    expect(response.text).toContain('data-automation-id="wizardStep"');
    expect(response.text).toContain('data-automation-id="formField-legalNameSection_firstName"');
    expect(response.text).toContain('data-automation-id="select-country-prompt"');
    expect(response.text).toContain('data-automation-id="popupList"');
  });

  it('GET /test-forms/career returns 200 OK HTML Generic HTML5 Career fixture', async () => {
    const response = await request(app).get('/test-forms/career');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('career-card');
    expect(response.text).toContain('Software Engineer Application');
    expect(response.text).toContain('id="applicant-name"');
    expect(response.text).toContain('id="primary-role"');
    expect(response.text).toContain('name="years_exp"');
    expect(response.text).toContain('name="skills"');
  });

  it('GET /test-forms/google-forms alias returns 200 OK HTML fixture', async () => {
    const response = await request(app).get('/test-forms/google-forms');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('AutoFiller Test Form (Google Form Fixture)');
  });
});
