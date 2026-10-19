/**
 * @file platformAdapters.test.ts
 * @vitest-environment jsdom
 * Unit tests for Greenhouse, Lever, and Workday platform adapters,
 * Shadow DOM traversal, and error recovery telemetry.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractFormFields, detectPlatform } from '../content/domReader.js';
import { queryDeepAll, detectWorkdayWizardStep } from '../content/domReader/adapters/workdayAdapter.js';
import { fillFormFields } from '../content/formFiller.js';
import type { FieldMetadata } from '@autofiller/shared';

describe('ATS Platform Adapters & Heuristics', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // =========================================================================
  // 1. Greenhouse Adapter
  // =========================================================================
  describe('Greenhouse Adapter', () => {
    it('normalizes personal fields, social links, resume upload, and Chosen/Select2 widgets', () => {
      document.body.innerHTML = `
        <form id="application_form" data-source="greenhouse">
          <div class="field">
            <label for="first_name">First Name <span class="asterisk">*</span> (Required):</label>
            <input type="text" id="first_name" name="job_application[first_name]" required />
          </div>
          <div class="field">
            <label for="last_name">Last Name <span class="asterisk">*</span>:</label>
            <input type="text" id="last_name" name="job_application[last_name]" required />
          </div>
          <div class="field">
            <label for="email">Email <span class="asterisk">*</span>:</label>
            <input type="email" id="email" name="job_application[email]" required />
          </div>
          <div class="field">
            <label for="phone">Phone <span class="asterisk">*</span>:</label>
            <input type="tel" id="phone" name="job_application[phone]" />
          </div>
          <div class="field">
            <label for="linkedin_url">LinkedIn Profile (optional):</label>
            <input type="url" id="linkedin_url" name="job_application[answers_attributes][0][text_value]" />
          </div>
          <div class="field" data-field="resume">
            <label for="resume">Resume / CV *</label>
            <input type="file" id="resume" name="resume" />
          </div>
          <div class="field">
            <label for="job_application_gender">Gender Select One...</label>
            <div class="select2-container">
              <select id="job_application_gender" name="job_application[gender]">
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="declined">Decline to Self-Identify</option>
              </select>
            </div>
          </div>
        </form>
      `;

      expect(detectPlatform(document)).toBe('greenhouse');

      const fields = extractFormFields(document, { includeFileInputs: true });

      // First Name
      const fn = fields.find((f) => f.name === 'job_application[first_name]');
      expect(fn).toBeDefined();
      expect(fn?.label).toBe('First Name');
      expect(fn?.platform).toBe('greenhouse');
      expect(fn?.platformFieldType).toBe('personal');
      expect(fn?.section).toBe('personal');

      // Email
      const email = fields.find((f) => f.name === 'job_application[email]');
      expect(email?.label).toBe('Email');
      expect(email?.platformFieldType).toBe('personal');

      // Social link
      const li = fields.find((f) => f.name?.includes('answers_attributes') || f.label === 'LinkedIn Profile');
      expect(li?.label).toBe('LinkedIn Profile');
      expect(li?.platformFieldType).toBe('social_link');
      expect(li?.section).toBe('links');

      // Resume upload
      const resume = fields.find((f) => f.id === 'resume');
      expect(resume?.label).toBe('Resume / CV (File Upload)');
      expect(resume?.platformFieldType).toBe('resume_upload');

      // Gender (Select2)
      const gender = fields.find((f) => f.id.includes('gender') || f.name?.includes('gender'));
      expect(gender?.label).toBe('Gender');
      expect(gender?.platformFieldType).toBe('demographic');
      expect(gender?.section).toBe('demographics');
      expect(gender?.options?.map((o) => o.label)).toEqual(['Select...', 'Male', 'Female', 'Decline to Self-Identify']);
    });
  });

  // =========================================================================
  // 2. Lever Adapter
  // =========================================================================
  describe('Lever Adapter', () => {
    it('classifies section wrappers, parses single Full Name, social network brackets, and EEO demographics', () => {
      document.body.innerHTML = `
        <div class="lever-job-page">
          <form id="application-form" action="https://jobs.lever.co/company/job/apply">
            <div class="section-candidate-wrapper">
              <input type="text" name="name" placeholder="Full name" id="lever-name" />
              <input type="email" name="email" placeholder="Email" id="lever-email" />
              <input type="text" name="org" placeholder="Current company" id="lever-org" />
            </div>

            <div class="section-links-wrapper">
              <input type="url" name="urls[LinkedIn]" placeholder="LinkedIn URL" id="lever-li" />
              <input type="url" name="urls[GitHub]" placeholder="GitHub URL" id="lever-gh" />
              <input type="url" name="urls[Portfolio]" placeholder="Portfolio URL" id="lever-port" />
            </div>

            <div class="section-cards-wrapper">
              <div class="application-question">
                <div class="card-field-title">Are you authorized to work in the US? *</div>
                <div class="options">
                  <label class="lever-radio-label">
                    <input type="radio" name="auth" value="yes" />
                    <span></span><span>Yes</span>
                  </label>
                  <label class="lever-radio-label">
                    <input type="radio" name="auth" value="no" />
                    <span></span><span>No</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="section-eeo-wrapper" id="demographic-survey">
              <div class="application-question">
                <div class="card-field-title">Voluntary Self-Identification: Veteran Status (Optional)</div>
                <select name="eeo[veteran]" id="lever-vet">
                  <option value="not_veteran">I am not a veteran</option>
                  <option value="veteran">I am a veteran</option>
                </select>
              </div>
            </div>
          </form>
        </div>
      `;

      expect(detectPlatform(document)).toBe('lever');

      const fields = extractFormFields(document);

      // Full Name
      const nameField = fields.find((f) => f.name === 'name');
      expect(nameField?.label).toBe('Full Name');
      expect(nameField?.platform).toBe('lever');
      expect(nameField?.platformFieldType).toBe('personal');
      expect(nameField?.section).toBe('candidate');

      // Current Company
      const orgField = fields.find((f) => f.name === 'org');
      expect(orgField?.label).toBe('Current Company');
      expect(orgField?.platformFieldType).toBe('experience');
      expect(orgField?.section).toBe('candidate');

      // Social links parsed from brackets
      const liField = fields.find((f) => f.name === 'urls[LinkedIn]');
      expect(liField?.label).toBe('LinkedIn URL');
      expect(liField?.platformFieldType).toBe('social_link');
      expect(liField?.section).toBe('links');

      const ghField = fields.find((f) => f.name === 'urls[GitHub]');
      expect(ghField?.label).toBe('GitHub URL');

      // Custom question
      const authField = fields.find((f) => f.name === 'auth');
      expect(authField?.platformFieldType).toBe('custom_question');
      expect(authField?.section).toBe('custom_questions');

      // EEO Question
      const vetField = fields.find((f) => f.name === 'eeo[veteran]');
      expect(vetField?.label).toBe('Veteran Status');
      expect(vetField?.platformFieldType).toBe('demographic');
      expect(vetField?.section).toBe('demographics');
    });
  });

  // =========================================================================
  // 3. Workday Adapter
  // =========================================================================
  describe('Workday Adapter', () => {
    it('detects active wizard step, normalizes compound field sections, and annotates prompt comboboxes', () => {
      document.body.innerHTML = `
        <div data-automation-id="jobApplicationWrapper">
          <div data-automation-id="pageHeader">
            <h2 data-automation-id="activeStep">My Information</h2>
          </div>

          <div data-automation-id="formField-legalNameSection_firstName">
            <label data-automation-id="formLabel">First Name <abbr title="required">*</abbr></label>
            <input type="text" data-automation-id="legalNameSection_firstName" id="wd-fn" />
          </div>

          <div data-automation-id="formField-phoneSection_phoneNumber">
            <label data-automation-id="formLabel">Phone Number <abbr title="required">*</abbr></label>
            <input type="tel" data-automation-id="phoneSection_phoneNumber" id="wd-phone" />
          </div>

          <div data-automation-id="formField-country">
            <label data-automation-id="formLabel">Country</label>
            <div data-automation-id="select-country">
              <button type="button" data-automation-id="promptButton" aria-haspopup="listbox" id="wd-country-btn">
                <span data-automation-id="promptLabel">Select Country</span>
              </button>
            </div>
          </div>
        </div>
      `;

      expect(detectPlatform(document)).toBe('workday');
      expect(detectWorkdayWizardStep(document)).toBe('My Information');

      const fields = extractFormFields(document);

      // First Name compound field
      const fn = fields.find((f) => f.id === 'legalnamesection_firstname' || f.id === 'wd-fn');
      expect(fn).toBeDefined();
      expect(fn?.label).toBe('First Name');
      expect(fn?.platform).toBe('workday');
      expect(fn?.platformFieldType).toBe('personal');
      expect(fn?.section).toBe('My Information');

      // Phone
      const phone = fields.find((f) => f.id === 'phonesection_phonenumber' || f.id === 'wd-phone');
      expect(phone?.label).toBe('Phone Number');
      expect(phone?.platformFieldType).toBe('personal');

      // Prompt button as combobox
      const country = fields.find((f) => f.id.includes('country'));
      expect(country).toBeDefined();
      expect(country?.controlType).toBe('combobox');
    });

    it('traverses deep Shadow DOM elements via queryDeepAll', () => {
      const container = document.createElement('div');
      const host = document.createElement('div');
      host.id = 'shadow-host';
      container.appendChild(host);
      document.body.appendChild(container);

      // Attach shadow root if attachShadow is supported
      if (typeof host.attachShadow === 'function') {
        const shadow = host.attachShadow({ mode: 'open' });
        const shadowInput = document.createElement('input');
        shadowInput.type = 'text';
        shadowInput.id = 'shadow-input';
        shadow.appendChild(shadowInput);

        const found = queryDeepAll('#shadow-input', document);
        expect(found).toHaveLength(1);
        expect(found[0].id).toBe('shadow-input');
      }
    });
  });

  // =========================================================================
  // 4. Telemetry & Recovery Behavior
  // =========================================================================
  describe('Error Recovery & Telemetry', () => {
    it('skips resume upload fields and provides clear browser sandbox manual action notice', async () => {
      document.body.innerHTML = `
        <form>
          <input type="file" id="resume-input" data-autofiller-id="resume_field" />
        </form>
      `;

      const field: FieldMetadata = {
        id: 'resume_field',
        label: 'Resume / CV',
        controlType: 'file',
        platformFieldType: 'resume_upload',
      };

      const result = await fillFormFields({ resume_field: '/path/to/resume.pdf' }, [field], document);

      expect(result.status).toBe('error');
      expect(result.skippedFields).toEqual(['resume_field']);
      expect(result.skippedReasons?.['resume_field']).toContain('browser security sandbox');
      expect(result.skippedReasons?.['resume_field']).toContain('manual attachment required');
    });
  });
});
