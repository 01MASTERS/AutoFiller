/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { extractFormFields, findFieldElement, detectPlatform } from '../content/domReader.js';

describe('Universal DOM Reader & Smart Field Extraction Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ==========================================================================
  // 1. Standard HTML5 Forms & Heuristic Label Resolution
  // ==========================================================================
  describe('Standard HTML5 Forms', () => {
    it('extracts input using explicit <label for="id"> association with boilerplate stripped', () => {
      document.body.innerHTML = `
        <form>
          <div class="form-group">
            <label for="user-email">Email Address <span class="required">*</span> (required):</label>
            <input type="email" id="user-email" name="email" required />
          </div>
        </form>
      `;

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'email',
        name: 'email',
        label: 'Email Address',
        type: 'email',
        controlType: 'text',
        required: true,
      });
    });

    it('extracts input enclosed within wrapping <label>', () => {
      document.body.innerHTML = `
        <form>
          <label class="block">
            <span>LinkedIn Profile URL (optional)</span>
            <input type="url" name="linkedin" placeholder="https://linkedin.com/in/..." />
          </label>
        </form>
      `;

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        name: 'linkedin',
        label: 'LinkedIn Profile URL',
        placeholder: 'https://linkedin.com/in/...',
        type: 'url',
        controlType: 'text',
      });
    });

    it('extracts radio button group inside <fieldset> using <legend> text', () => {
      document.body.innerHTML = `
        <form>
          <fieldset>
            <legend>Are you legally authorized to work in this country? *</legend>
            <label><input type="radio" name="work_auth" value="yes" /> Yes</label>
            <label><input type="radio" name="work_auth" value="no" /> No</label>
          </fieldset>
        </form>
      `;

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        name: 'work_auth',
        label: 'Are you legally authorized to work in this country?',
        type: 'radio',
        controlType: 'radio',
        selectionMode: 'single',
      });
      expect(fields[0].options).toEqual([
        { label: 'Yes', value: 'yes', selected: undefined, disabled: undefined },
        { label: 'No', value: 'no', selected: undefined, disabled: undefined },
      ]);
    });

    it('extracts standalone checkbox (e.g. consent or terms of service)', () => {
      document.body.innerHTML = `
        <form>
          <div class="form-check">
            <input type="checkbox" id="terms" name="agree_terms" required />
            <label for="terms">I consent to the processing of my personal data *</label>
          </div>
        </form>
      `;

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        name: 'agree_terms',
        label: 'I consent to the processing of my personal data',
        controlType: 'checkbox',
        selectionMode: 'single',
        required: true,
      });
    });
  });

  // ==========================================================================
  // 2. Greenhouse Job Board Form Architecture
  // ==========================================================================
  describe('Greenhouse Platform Extraction', () => {
    it('detects Greenhouse platform and extracts candidate personal details and custom questions', () => {
      document.body.innerHTML = `
        <div id="app_body" class="greenhouse-content">
          <form id="application_form">
            <div class="field">
              <label for="first_name">First Name <span class="asterisk">*</span></label>
              <input type="text" id="first_name" name="job_application[first_name]" required autocomplete="given-name" />
            </div>
            <div class="field">
              <label for="last_name">Last Name <span class="asterisk">*</span></label>
              <input type="text" id="last_name" name="job_application[last_name]" required autocomplete="family-name" />
            </div>
            <div class="field">
              <label for="job_application_answers_attributes_0_value">Gender Identity</label>
              <select id="job_application_answers_attributes_0_value" name="job_application[answers_attributes][0][value]">
                <option value="">-- Please select --</option>
                <option value="male">Man</option>
                <option value="female">Woman</option>
                <option value="nonbinary">Non-binary</option>
                <option value="decline">I prefer not to say</option>
              </select>
            </div>
          </form>
        </div>
      `;

      expect(detectPlatform(document)).toBe('greenhouse');

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(3);

      expect(fields[0]).toMatchObject({
        id: 'job_application[first_name]',
        label: 'First Name',
        controlType: 'text',
        platform: 'greenhouse',
        required: true,
      });

      expect(fields[1]).toMatchObject({
        id: 'job_application[last_name]',
        label: 'Last Name',
        controlType: 'text',
        platform: 'greenhouse',
        required: true,
      });

      expect(fields[2]).toMatchObject({
        id: 'job_application[answers_attributes][0][value]',
        label: 'Gender Identity',
        controlType: 'dropdown',
        platform: 'greenhouse',
      });
      expect(fields[2].options).toHaveLength(4);
      expect(fields[2].options?.[0].label).toBe('Man');
    });
  });

  // ==========================================================================
  // 3. Lever Job Board Form Architecture
  // ==========================================================================
  describe('Lever Platform Extraction', () => {
    it('detects Lever platform and extracts application cards, text inputs, and radio groups', () => {
      document.body.innerHTML = `
        <div class="lever-job-page">
          <form id="application-form" action="https://jobs.lever.co/acme/123/apply">
            <div class="section-candidate-wrapper">
              <div class="application-question">
                <label>
                  <span class="text">Full Name</span>
                  <input type="text" name="name" placeholder="John Doe" required />
                </label>
              </div>
              <div class="application-question">
                <label>
                  <span class="text">Current Company</span>
                  <input type="text" name="org" />
                </label>
              </div>
              <div class="application-question" role="radiogroup" aria-label="Will you now or in the future require visa sponsorship?">
                <div class="text">Will you now or in the future require visa sponsorship? *</div>
                <label><input type="radio" name="cards[1][field0]" value="Yes" /> Yes</label>
                <label><input type="radio" name="cards[1][field0]" value="No" /> No</label>
              </div>
            </div>
          </form>
        </div>
      `;

      expect(detectPlatform(document)).toBe('lever');

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(3);

      expect(fields.find((f) => f.name === 'name')).toMatchObject({
        label: 'Full Name',
        controlType: 'text',
        platform: 'lever',
        required: true,
      });

      expect(fields.find((f) => f.name === 'org')).toMatchObject({
        label: 'Current Company',
        controlType: 'text',
        platform: 'lever',
      });

      const radioField = fields.find((f) => f.controlType === 'radio');
      expect(radioField).toBeDefined();
      expect(radioField?.label).toContain('sponsorship');
      expect(radioField?.options).toHaveLength(2);
      expect(radioField?.platform).toBe('lever');
    });
  });

  // ==========================================================================
  // 4. Workday Dynamic Component Architecture
  // ==========================================================================
  describe('Workday Platform Extraction', () => {
    it('detects Workday platform and extracts fields using data-automation-id conventions', () => {
      document.body.innerHTML = `
        <div data-automation-id="jobApplicationWrapper">
          <div data-automation-id="formItem">
            <label data-automation-id="formLabel">Phone Number <span data-automation-id="requiredStar">*</span></label>
            <input type="tel" data-automation-id="textInput" id="phone-input" name="phoneNumber" required />
          </div>
          <div data-automation-id="formItem">
            <label data-automation-id="formLabel">Years of Experience</label>
            <button type="button" role="combobox" aria-haspopup="listbox" data-automation-id="selectYears" id="exp-btn">
              Select Experience
            </button>
            <div role="listbox" id="exp-listbox" style="display: none;">
              <div role="option">0-1 years</div>
              <div role="option">2-4 years</div>
              <div role="option">5+ years</div>
            </div>
          </div>
        </div>
      `;

      expect(detectPlatform(document)).toBe('workday');

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(2);

      expect(fields[0]).toMatchObject({
        id: 'phoneNumber',
        label: 'Phone Number',
        controlType: 'text',
        platform: 'workday',
        required: true,
      });

      expect(fields[1]).toMatchObject({
        label: 'Years of Experience',
        controlType: 'combobox',
        platform: 'workday',
      });
      expect(fields[1].options).toHaveLength(3);
      expect(fields[1].options?.[0].label).toBe('0-1 years');
    });
  });

  // ==========================================================================
  // 5. File Uploads & Security Sandbox Handling
  // ==========================================================================
  describe('File Upload Detection', () => {
    it('excludes file inputs by default to preserve browser sandbox security', () => {
      document.body.innerHTML = `
        <form>
          <label for="resume">Attach Resume / CV</label>
          <input type="file" id="resume" name="resume_file" />
        </form>
      `;

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(0);
    });

    it('extracts file input when includeFileInputs option is enabled', () => {
      document.body.innerHTML = `
        <form>
          <div class="upload-container">
            <label for="resume">Attach Resume / CV (PDF, DOCX) *</label>
            <input type="file" id="resume" name="resume_file" required />
          </div>
        </form>
      `;

      const fields = extractFormFields(document, { includeFileInputs: true });
      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        name: 'resume_file',
        label: 'Attach Resume / CV (PDF, DOCX)',
        controlType: 'file',
        type: 'file',
        required: true,
      });
    });
  });

  // ==========================================================================
  // 6. Noise & Non-Form Element Exclusion
  // ==========================================================================
  describe('Noise Exclusion', () => {
    it('excludes standalone website search bars', () => {
      document.body.innerHTML = `
        <header>
          <input type="search" placeholder="Search open jobs..." />
        </header>
        <main>
          <form>
            <label for="applicant-name">Your Name</label>
            <input type="text" id="applicant-name" name="applicant_name" />
          </form>
        </main>
      `;

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(1);
      expect(fields[0].label).toBe('Your Name');
    });

    it('excludes hidden inputs (e.g. CSRF tokens, honeypots)', () => {
      document.body.innerHTML = `
        <form>
          <input type="hidden" name="csrf_token" value="abc123xyz" />
          <input type="text" name="honeypot" style="display: none;" />
          <label for="cover-letter">Cover Letter</label>
          <textarea id="cover-letter" name="cover_letter"></textarea>
        </form>
      `;

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(1);
      expect(fields[0].label).toBe('Cover Letter');
    });
  });

  // ==========================================================================
  // 7. Element Re-Association via findFieldElement
  // ==========================================================================
  describe('Element Re-Association (findFieldElement)', () => {
    it('re-associates element using data-autofiller-id', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" id="custom-field" data-autofiller-id="field-10" />
        </form>
      `;

      const input = document.getElementById('custom-field')!;
      const found = findFieldElement({ id: 'field-10', label: 'Custom' }, document);
      expect(found).toBe(input);
    });

    it('re-associates element using data-automation-id', () => {
      document.body.innerHTML = `
        <div data-automation-id="workday-text-field">
          <input type="text" />
        </div>
      `;

      const found = findFieldElement(
        { id: 'workday-text-field', label: 'Workday Field' },
        document,
      );
      expect(found).not.toBeNull();
      expect(found?.getAttribute('data-automation-id')).toBe('workday-text-field');
    });

    it('re-associates element using name and controlType', () => {
      document.body.innerHTML = `
        <form>
          <input type="email" name="candidate_email" />
        </form>
      `;

      const input = document.querySelector('input[name="candidate_email"]')!;
      const found = findFieldElement(
        { id: 'candidate_email', name: 'candidate_email', controlType: 'text', label: 'Email' },
        document,
      );
      expect(found).toBe(input);
    });
  });
});
