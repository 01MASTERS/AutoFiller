/**
 * @file e2eUniversalAutofill.test.ts
 * @vitest-environment jsdom
 * End-to-End Multi-Platform Integration Test Suite for AutoFiller v1.1
 * Validates the complete Scan -> Map -> Fill cycle, platform heuristics,
 * error resilience, and performance latency across Greenhouse, Lever,
 * Workday, Generic HTML5 Career Portals, and Google Forms.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractFormFields, detectPlatform } from '../content/domReader.js';
import { fillFormFields } from '../content/formFiller/index.js';
import {
  mockGreenhouseFormHtml,
  mockLeverFormHtml,
  mockWorkdayFormHtml,
  mockCareerFormHtml,
  mockGoogleFormHtml,
  FieldMappingValue,
  UserProfile,
} from '@autofiller/shared';

const mockProfile: UserProfile = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  phone: '555-123-4567',
  address: '123 Market St, San Francisco, CA',
  skills: ['TypeScript', 'React', 'Node.js', 'Python'],
  links: {
    LinkedIn: 'https://linkedin.com/in/janedoe',
    GitHub: 'https://github.com/janedoe',
    Portfolio: 'https://janedoe.dev',
    Twitter: 'https://twitter.com/janedoe',
  },
  custom: {
    first_name: 'Jane',
    last_name: 'Doe',
    role: 'Fullstack Engineer',
    company: 'Acme Technologies',
    years_exp: '5+',
    authorized_us: 'yes',
    visa_sponsorship: 'no',
    gender: 'Female',
    race: 'Asian',
    veteran_status: 'I am not a veteran',
    country: 'United States of America',
    city: 'San Francisco',
    bio: 'Passionate senior engineer with 6+ years building distributed frontend & cloud systems.',
  },
};

describe('Multi-Platform E2E Form Autofill Pipeline', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
  });

  // =========================================================================
  // 1. Greenhouse ATS Application E2E
  // =========================================================================
  describe('Greenhouse E2E Lifecycle', () => {
    it('executes full scan -> map -> fill lifecycle with platform heuristics', async () => {
      document.documentElement.innerHTML = mockGreenhouseFormHtml;

      // 1. Scan Phase
      const scanStart = performance.now();
      const fields = extractFormFields(document, { includeFileInputs: true });
      const scanDuration = performance.now() - scanStart;

      expect(scanDuration).toBeLessThan(1000);
      expect(detectPlatform(document)).toBe('greenhouse');
      expect(fields.length).toBeGreaterThanOrEqual(10);

      // Verify platform adapter classifications
      const firstNameField = fields.find((f) => f.name === 'job_application[first_name]');
      const emailField = fields.find((f) => f.name === 'job_application[email]');
      const resumeField = fields.find((f) => f.name === 'job_application[resume]' || f.id.includes('resume'));
      const linkedinField = fields.find((f) => f.label === 'LinkedIn Profile' || f.name?.includes('answers_attributes'));
      const genderField = fields.find((f) => f.id.includes('gender') || f.name?.includes('gender'));

      expect(firstNameField?.platformFieldType).toBe('personal');
      expect(emailField?.platformFieldType).toBe('personal');
      expect(resumeField?.platformFieldType).toBe('resume_upload');
      expect(linkedinField?.platformFieldType).toBe('social_link');
      expect(genderField?.platformFieldType).toBe('demographic');
      expect(genderField?.section).toBe('demographics');

      // 2. Map Phase (simulating LLM mapping)
      const mappings: Record<string, FieldMappingValue> = {};
      for (const field of fields) {
        if (field.name === 'job_application[first_name]' || field.id === 'first_name') {
          mappings[field.id] = 'Jane';
        } else if (field.name === 'job_application[last_name]' || field.id === 'last_name') {
          mappings[field.id] = 'Doe';
        } else if (field.name === 'job_application[email]' || field.id === 'email') {
          mappings[field.id] = 'jane.doe@example.com';
        } else if (field.name === 'job_application[phone]' || field.id === 'phone') {
          mappings[field.id] = '555-123-4567';
        } else if (field.platformFieldType === 'resume_upload') {
          mappings[field.id] = 'resume.pdf';
        } else if (field.id.includes('0_text_value') || field.label.includes('LinkedIn')) {
          mappings[field.id] = 'https://linkedin.com/in/janedoe';
        } else if (field.id.includes('1_text_value') || field.label.includes('GitHub')) {
          mappings[field.id] = 'https://github.com/janedoe';
        } else if (field.id.includes('2_text_value') || field.label.includes('Portfolio')) {
          mappings[field.id] = 'https://janedoe.dev';
        } else if (field.id === 'why_acme' || field.label.includes('Acme Corp')) {
          mappings[field.id] = 'Excited to contribute to Acme platform scalability.';
        } else if (field.id.includes('gender')) {
          mappings[field.id] = 'Female';
        } else if (field.id.includes('race')) {
          mappings[field.id] = 'Asian';
        } else if (field.id.includes('veteran_status')) {
          mappings[field.id] = 'I am not a veteran';
        }
      }

      // 3. Fill Phase
      const fillStart = performance.now();
      const fillResult = await fillFormFields(mappings, fields, document);
      const fillDuration = performance.now() - fillStart;

      expect(fillDuration).toBeLessThan(10000);
      expect(fillResult.filledCount).toBeGreaterThanOrEqual(8);

      // Verify DOM value mutations
      expect((document.getElementById('first_name') as HTMLInputElement).value).toBe('Jane');
      expect((document.getElementById('last_name') as HTMLInputElement).value).toBe('Doe');
      expect((document.getElementById('email') as HTMLInputElement).value).toBe('jane.doe@example.com');
      expect((document.getElementById('phone') as HTMLInputElement).value).toBe('555-123-4567');
      expect((document.getElementById('job_application_answers_attributes_0_text_value') as HTMLInputElement).value).toBe('https://linkedin.com/in/janedoe');
      expect((document.getElementById('why_acme') as HTMLTextAreaElement).value).toBe('Excited to contribute to Acme platform scalability.');

      // Verify Select2 dropdown option selection
      const genderSelect = document.getElementById('job_application_gender') as HTMLSelectElement;
      expect(genderSelect.value).toBe('female');

      // Verify resume upload skipped with security explanation
      if (resumeField) {
        expect(fillResult.skippedFields).toContain(resumeField.id);
        expect(fillResult.skippedReasons?.[resumeField.id]).toContain('manual attachment required');
      }
    });
  });

  // =========================================================================
  // 2. Lever ATS Application E2E
  // =========================================================================
  describe('Lever E2E Lifecycle', () => {
    it('executes full scan -> map -> fill lifecycle with section taxonomy & custom questions', async () => {
      document.documentElement.innerHTML = mockLeverFormHtml;

      // 1. Scan Phase
      const scanStart = performance.now();
      const fields = extractFormFields(document);
      const scanDuration = performance.now() - scanStart;

      expect(scanDuration).toBeLessThan(1000);
      expect(detectPlatform(document)).toBe('lever');
      expect(fields.length).toBeGreaterThanOrEqual(7);

      // Verify section taxonomy from Lever adapter
      const nameField = fields.find((f) => f.name === 'name');
      const emailField = fields.find((f) => f.name === 'email');
      const orgField = fields.find((f) => f.name === 'org');
      const linkedinField = fields.find((f) => f.name === 'urls[LinkedIn]');
      const authRadio = fields.find((f) => f.name === 'authorized_us');
      const visaRadio = fields.find((f) => f.name === 'visa_sponsorship');
      const genderSelect = fields.find((f) => f.name === 'eeo[gender]' || f.id.includes('gender'));

      expect(nameField?.label).toBe('Full Name');
      expect(nameField?.section).toBe('candidate');
      expect(nameField?.platformFieldType).toBe('personal');
      expect(emailField?.section).toBe('candidate');
      expect(orgField?.section).toBe('candidate');
      expect(linkedinField?.section).toBe('links');
      expect(linkedinField?.platformFieldType).toBe('social_link');
      expect(authRadio?.section).toBe('custom_questions');
      expect(genderSelect?.section).toBe('demographics');

      // 2. Map Phase
      const mappings: Record<string, FieldMappingValue> = {};
      if (nameField) mappings[nameField.id] = 'Jane Doe';
      if (emailField) mappings[emailField.id] = 'jane.doe@example.com';
      if (orgField) mappings[orgField.id] = 'Acme Technologies';
      if (linkedinField) mappings[linkedinField.id] = 'https://linkedin.com/in/janedoe';
      if (authRadio) mappings[authRadio.id] = 'yes';
      if (visaRadio) mappings[visaRadio.id] = 'no';
      if (genderSelect) mappings[genderSelect.id] = 'Female';

      // 3. Fill Phase
      const fillResult = await fillFormFields(mappings, fields, document);
      expect(fillResult.status).toBe('success');
      expect(fillResult.filledCount).toBe(Object.keys(mappings).length);

      // Verify DOM mutations
      expect((document.getElementById('lever-name') as HTMLInputElement).value).toBe('Jane Doe');
      expect((document.getElementById('lever-email') as HTMLInputElement).value).toBe('jane.doe@example.com');
      expect((document.getElementById('lever-org') as HTMLInputElement).value).toBe('Acme Technologies');
      expect((document.getElementById('lever-linkedin') as HTMLInputElement).value).toBe('https://linkedin.com/in/janedoe');

      // Verify custom styled radio selection
      const authRadioChecked = document.querySelector('input[name="authorized_us"][value="yes"]') as HTMLInputElement;
      expect(authRadioChecked.checked).toBe(true);

      const visaRadioChecked = document.querySelector('input[name="visa_sponsorship"][value="no"]') as HTMLInputElement;
      expect(visaRadioChecked.checked).toBe(true);

      // Verify gender dropdown
      const leverGender = document.getElementById('lever-gender') as HTMLSelectElement;
      expect(leverGender.value).toBe('female');
    });
  });

  // =========================================================================
  // 3. Workday ATS Application E2E
  // =========================================================================
  describe('Workday E2E Lifecycle', () => {
    it('executes full scan -> map -> fill lifecycle with wizard step detection and prompt combobox', async () => {
      document.documentElement.innerHTML = mockWorkdayFormHtml;

      // 1. Scan Phase
      const scanStart = performance.now();
      const fields = extractFormFields(document);
      const scanDuration = performance.now() - scanStart;

      expect(scanDuration).toBeLessThan(200);
      expect(detectPlatform(document)).toBe('workday');
      expect(fields.length).toBeGreaterThanOrEqual(6);

      // Verify Workday wizard step detection & compound personal fields
      const firstNameField = fields.find((f) => f.name === 'legalNameSection_firstName');
      const lastNameField = fields.find((f) => f.name === 'legalNameSection_lastName');
      const emailField = fields.find((f) => f.name === 'email');
      const phoneField = fields.find((f) => f.name === 'phone-number');
      const cityField = fields.find((f) => f.name === 'addressSection_city');
      const countryCombobox = fields.find((f) => f.id.includes('select-country-prompt') || f.label.includes('Country'));

      expect(firstNameField?.section).toBe('My Information');
      expect(lastNameField?.section).toBe('My Information');
      expect(firstNameField?.label).toContain('First Name');
      expect(countryCombobox?.controlType).toBe('combobox');

      // 2. Map Phase
      const mappings: Record<string, FieldMappingValue> = {};
      if (firstNameField) mappings[firstNameField.id] = 'Jane';
      if (lastNameField) mappings[lastNameField.id] = 'Doe';
      if (emailField) mappings[emailField.id] = 'jane.doe@example.com';
      if (phoneField) mappings[phoneField.id] = '555-123-4567';
      if (cityField) mappings[cityField.id] = 'San Francisco';
      if (countryCombobox) mappings[countryCombobox.id] = 'United States of America';

      // 3. Fill Phase
      const fillResult = await fillFormFields(mappings, fields, document);
      expect(fillResult.status).toBe('success');
      expect(fillResult.filledCount).toBe(Object.keys(mappings).length);

      // Verify DOM mutations
      expect((document.getElementById('legalNameSection_firstName') as HTMLInputElement).value).toBe('Jane');
      expect((document.getElementById('legalNameSection_lastName') as HTMLInputElement).value).toBe('Doe');
      expect((document.getElementById('email') as HTMLInputElement).value).toBe('jane.doe@example.com');
      expect((document.getElementById('phone-number') as HTMLInputElement).value).toBe('555-123-4567');
      expect((document.getElementById('addressSection_city') as HTMLInputElement).value).toBe('San Francisco');

      // Verify Workday prompt button combobox interaction with body portal
      const selectedSpan = document.querySelector('[data-automation-id="prompt-selected-value"]') as HTMLElement;
      expect(selectedSpan.textContent).toContain('United States of America');
    });
  });

  // =========================================================================
  // 4. Generic HTML5 Career Portal E2E
  // =========================================================================
  describe('Generic Career Portal E2E Lifecycle', () => {
    it('executes full scan -> map -> fill on standard HTML5 form controls', async () => {
      document.documentElement.innerHTML = mockCareerFormHtml;

      // 1. Scan Phase
      const fields = extractFormFields(document);
      expect(fields.length).toBeGreaterThanOrEqual(7);

      const nameField = fields.find((f) => f.id === 'name' || f.name === 'name' || f.id === 'applicant-name');
      const emailField = fields.find((f) => f.id === 'email' || f.name === 'email' || f.id === 'applicant-email');
      const roleSelect = fields.find((f) => f.id === 'role' || f.id === 'primary-role' || f.name === 'role');
      const expRadio = fields.find((f) => f.name === 'years_exp');
      const skillsCheckbox = fields.find((f) => f.name === 'skills');
      const bioTextarea = fields.find((f) => f.id === 'bio' || f.name === 'bio' || f.id === 'applicant-bio');

      expect(roleSelect?.controlType).toBe('dropdown');
      expect(expRadio?.controlType).toBe('radio');
      expect(skillsCheckbox?.controlType).toBe('checkbox');

      // 2. Map Phase
      const mappings: Record<string, FieldMappingValue> = {};
      if (nameField) mappings[nameField.id] = 'Jane Doe';
      if (emailField) mappings[emailField.id] = 'jane.doe@example.com';
      if (roleSelect) mappings[roleSelect.id] = 'Fullstack Engineer';
      if (expRadio) mappings[expRadio.id] = '5+';
      if (skillsCheckbox) mappings[skillsCheckbox.id] = ['TypeScript', 'React'];
      if (bioTextarea) mappings[bioTextarea.id] = 'Dedicated engineer with proven track record.';

      // 3. Fill Phase
      const fillResult = await fillFormFields(mappings, fields, document);
      expect(fillResult.status).toBe('success');
      expect(fillResult.filledCount).toBe(Object.keys(mappings).length);

      // Verify values
      expect((document.getElementById('applicant-name') as HTMLInputElement).value).toBe('Jane Doe');
      expect((document.getElementById('applicant-email') as HTMLInputElement).value).toBe('jane.doe@example.com');
      expect((document.getElementById('primary-role') as HTMLSelectElement).value).toBe('fullstack');

      const checkedExp = document.querySelector('input[name="years_exp"][value="5+"]') as HTMLInputElement;
      expect(checkedExp.checked).toBe(true);

      const tsCheck = document.querySelector('input[name="skills"][value="ts"]') as HTMLInputElement;
      const reactCheck = document.querySelector('input[name="skills"][value="react"]') as HTMLInputElement;
      const pythonCheck = document.querySelector('input[name="skills"][value="python"]') as HTMLInputElement;

      expect(tsCheck.checked).toBe(true);
      expect(reactCheck.checked).toBe(true);
      expect(pythonCheck.checked).toBe(false);

      expect((document.getElementById('applicant-bio') as HTMLTextAreaElement).value).toBe('Dedicated engineer with proven track record.');
    });
  });

  // =========================================================================
  // 5. Classic Google Form E2E
  // =========================================================================
  describe('Google Forms E2E Lifecycle', () => {
    it('executes full scan -> map -> fill on role="listitem" Google Form fixture', async () => {
      document.documentElement.innerHTML = mockGoogleFormHtml;

      const fields = extractFormFields(document);
      expect(fields.length).toBeGreaterThanOrEqual(7);

      const skillsField = fields.find((f) => f.label.includes('Technical Skills'));
      const expField = fields.find((f) => f.label.includes('Experience Level'));

      expect(skillsField).toBeDefined();
      expect(skillsField?.controlType).toBe('checkbox');
      expect(skillsField?.selectionMode).toBe('multiple');

      expect(expField).toBeDefined();
      expect(expField?.controlType).toBe('radio');

      const mappings: Record<string, FieldMappingValue> = {
        'entry.101': 'Jane Doe',
        'entry.102': 'jane.doe@example.com',
        'entry.103': '555-123-4567',
        'entry.105': '555-987-6543',
        'entry.104': 'Hello from Google Forms test!',
        [skillsField!.id]: ['JavaScript', 'TypeScript'],
        [expField!.id]: 'Senior',
      };

      const fillResult = await fillFormFields(mappings, fields, document);
      expect(fillResult.status).toBe('success');
      expect(fillResult.filledCount).toBe(7);

      expect((document.querySelector('input[name="entry.101"]') as HTMLInputElement).value).toBe('Jane Doe');
      expect((document.querySelector('input[name="entry.102"]') as HTMLInputElement).value).toBe('jane.doe@example.com');
      expect((document.querySelector('textarea[name="entry.104"]') as HTMLTextAreaElement).value).toBe('Hello from Google Forms test!');

      const jsCb = document.querySelector('[role="checkbox"][aria-label="JavaScript"]');
      const tsCb = document.querySelector('[role="checkbox"][aria-label="TypeScript"]');
      const pyCb = document.querySelector('[role="checkbox"][aria-label="Python"]');
      const seniorRadio = document.querySelector('[role="radio"][data-value="Senior"]');

      expect(jsCb?.getAttribute('aria-checked')).toBe('true');
      expect(tsCb?.getAttribute('aria-checked')).toBe('true');
      expect(pyCb?.getAttribute('aria-checked')).toBe('false');
      expect(seniorRadio?.getAttribute('aria-checked')).toBe('true');
    });
  });

  // =========================================================================
  // 6. Error Resilience & Partial Fills
  // =========================================================================
  describe('Error Resilience & Graceful Handling', () => {
    it('handles empty mappings with error response', async () => {
      const result = await fillFormFields({}, [], document);
      expect(result.status).toBe('error');
      expect(result.error).toBe('No mappings provided');
    });

    it('gracefully handles missing DOM elements in mappings', async () => {
      document.documentElement.innerHTML = `<form><input type="text" id="existing_field" /></form>`;
      const fields = extractFormFields(document);

      const mappings: Record<string, FieldMappingValue> = {
        existing_field: 'Existing Value',
        non_existent_field: 'Ghost Value',
      };

      const result = await fillFormFields(mappings, fields, document);
      expect(result.filledCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failedFields).toContain('non_existent_field');
    });

    it('gracefully handles disabled or readonly inputs', async () => {
      document.documentElement.innerHTML = `
        <form>
          <input type="text" id="editable" />
          <input type="text" id="locked" disabled />
        </form>
      `;
      const fields = extractFormFields(document);

      const mappings: Record<string, FieldMappingValue> = {
        editable: 'Editable Value',
        locked: 'Should Not Fill',
      };

      const result = await fillFormFields(mappings, fields, document);
      expect(result.filledCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failedFields).toContain('locked');
      expect((document.getElementById('editable') as HTMLInputElement).value).toBe('Editable Value');
    });
  });

  // =========================================================================
  // 7. Latency & Performance Benchmarks (FR-16.3, NFR-11)
  // =========================================================================
  describe('Performance & Latency Benchmarks', () => {
    it('executes DOM field extraction under 200ms across all platforms', () => {
      const fixtures = [
        { name: 'Greenhouse', html: mockGreenhouseFormHtml },
        { name: 'Lever', html: mockLeverFormHtml },
        { name: 'Workday', html: mockWorkdayFormHtml },
        { name: 'Generic Career', html: mockCareerFormHtml },
        { name: 'Google Forms', html: mockGoogleFormHtml },
      ];

      for (const fixture of fixtures) {
        document.documentElement.innerHTML = fixture.html;
        const start = performance.now();
        const fields = extractFormFields(document, { includeFileInputs: true });
        const duration = performance.now() - start;

        expect(fields.length).toBeGreaterThan(0);
        expect(duration).toBeLessThan(200);
      }
    });

    it('executes synthetic field filling in under 50ms per field (<10s total)', async () => {
      document.documentElement.innerHTML = mockCareerFormHtml;
      const fields = extractFormFields(document);

      const mappings: Record<string, FieldMappingValue> = {
        'applicant-name': 'Jane Doe',
        'applicant-email': 'jane.doe@example.com',
        'applicant-phone': '555-123-4567',
        'primary-role': 'Fullstack Engineer',
        'years_exp': '5+',
        'skills': ['TypeScript', 'React'],
        'applicant-bio': 'Experienced developer.',
      };

      const fieldCount = Object.keys(mappings).length;
      const start = performance.now();
      const result = await fillFormFields(mappings, fields, document);
      const totalDuration = performance.now() - start;
      const perFieldDuration = totalDuration / fieldCount;

      expect(result.status).toBe('success');
      expect(totalDuration).toBeLessThan(10000);
      expect(perFieldDuration).toBeLessThan(50);
    });
  });
});
