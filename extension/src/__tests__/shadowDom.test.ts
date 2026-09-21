import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractFormFields,
  findFieldElement,
  detectPlatform,
  getAllDOMRoots,
  deepClosest,
  deepGetElementById,
  deepQuerySelectorAll,
} from '../content/domReader.js';
import { fillFormFields } from '../content/formFiller.js';

describe('Deep Shadow DOM & SmartRecruiters ATS Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Shadow DOM Traversal & Utilities', () => {
    it('traverses deeply nested open shadow roots (3 levels) in natural DFS document order', () => {
      // Level 0: Document
      const rootHost = document.createElement('app-root');
      document.body.appendChild(rootHost);
      const shadow0 = rootHost.attachShadow({ mode: 'open' });

      // Level 1: Page wrapper
      const pageHost = document.createElement('job-application-page');
      shadow0.appendChild(pageHost);
      const shadow1 = pageHost.attachShadow({ mode: 'open' });

      // Level 2: Form component
      const fieldHost = document.createElement('spl-form-field');
      shadow1.appendChild(fieldHost);
      const shadow2 = fieldHost.attachShadow({ mode: 'open' });

      const input = document.createElement('input');
      input.id = 'deep-input';
      input.type = 'text';
      shadow2.appendChild(input);

      const roots = getAllDOMRoots(document);
      expect(roots).toContain(document);
      expect(roots).toContain(shadow0);
      expect(roots).toContain(shadow1);
      expect(roots).toContain(shadow2);

      // Verify deepGetElementById finds element inside level 2 shadow root
      const foundEl = deepGetElementById('deep-input', document);
      expect(foundEl).toBe(input);

      // Verify deepQuerySelectorAll finds element across all roots
      const allInputs = deepQuerySelectorAll(document, 'input');
      expect(allInputs).toHaveLength(1);
      expect(allInputs[0]).toBe(input);
    });

    it('pierces shadow boundaries using deepClosest to find outer containers', () => {
      const container = document.createElement('div');
      container.className = 'form-group ats-section';
      document.body.appendChild(container);

      const customInput = document.createElement('spl-input');
      container.appendChild(customInput);
      const shadow = customInput.attachShadow({ mode: 'open' });

      const innerInput = document.createElement('input');
      innerInput.type = 'text';
      shadow.appendChild(innerInput);

      // Standard closest() stops at shadow boundary and returns null
      expect(innerInput.closest('.form-group')).toBeNull();

      // deepClosest() pierces shadow root host to find the container
      const foundContainer = deepClosest(innerInput, '.ats-section');
      expect(foundContainer).toBe(container);
    });
  });

  describe('Angular 20 & SmartRecruiters Web Components Form Extraction', () => {
    it('discovers fields inside nested shadow DOM components where standard querySelector returns 0', () => {
      // Mock page layout with Web Components
      const appRoot = document.createElement('spl-job-application');
      document.body.appendChild(appRoot);
      const appShadow = appRoot.attachShadow({ mode: 'open' });

      // Section 1: Personal info
      const section = document.createElement('div');
      section.className = 'form-section';
      appShadow.appendChild(section);

      // Field 1: First Name inside spl-form-field -> spl-input
      const fnField = document.createElement('spl-form-field');
      section.appendChild(fnField);
      const fnShadow = fnField.attachShadow({ mode: 'open' });
      fnShadow.innerHTML = `
        <label id="fn-lbl">First Name <span class="required">*</span></label>
        <div class="control-wrapper">
          <input id="fn-inp" type="text" name="firstName" aria-labelledby="fn-lbl" required />
        </div>
      `;

      // Field 2: Last Name inside spl-form-field -> spl-input
      const lnField = document.createElement('spl-form-field');
      section.appendChild(lnField);
      const lnShadow = lnField.attachShadow({ mode: 'open' });
      lnShadow.innerHTML = `
        <label id="ln-lbl">Last Name <span class="required">*</span></label>
        <div class="control-wrapper">
          <input id="ln-inp" type="text" name="lastName" aria-labelledby="ln-lbl" required />
        </div>
      `;

      // Field 3: Email inside spl-form-field
      const emailField = document.createElement('spl-form-field');
      section.appendChild(emailField);
      const emailShadow = emailField.attachShadow({ mode: 'open' });
      emailShadow.innerHTML = `
        <label id="em-lbl">Email Address <span class="required">*</span></label>
        <div class="control-wrapper">
          <input id="em-inp" type="email" name="email" aria-labelledby="em-lbl" required />
        </div>
      `;

      // Field 4: Phone inside spl-form-field
      const phoneField = document.createElement('spl-form-field');
      section.appendChild(phoneField);
      const phoneShadow = phoneField.attachShadow({ mode: 'open' });
      phoneShadow.innerHTML = `
        <label id="ph-lbl">Phone Number</label>
        <div class="control-wrapper">
          <input id="ph-inp" type="tel" name="phoneNumber" aria-labelledby="ph-lbl" />
        </div>
      `;

      // Verify that standard document.querySelectorAll finds ZERO inputs (the bug reported by the user!)
      const standardInputs = document.querySelectorAll('input');
      expect(standardInputs).toHaveLength(0);

      // Now test extractFormFields with our deep shadow DOM traversal engine
      const fields = extractFormFields(document);

      expect(fields).toHaveLength(4);

      const [fn, ln, em, ph] = fields;

      expect(fn.name).toBe('firstName');
      expect(fn.label).toBe('First Name');
      expect(fn.required).toBe(true);
      expect(fn.controlType).toBe('text');
      expect(fn.platform).toBe('smartrecruiters');
      expect(fn.platformFieldType).toBe('personal');

      expect(ln.name).toBe('lastName');
      expect(ln.label).toBe('Last Name');
      expect(ln.required).toBe(true);

      expect(em.name).toBe('email');
      expect(em.label).toBe('Email Address');
      expect(em.type).toBe('email');

      expect(ph.name).toBe('phoneNumber');
      expect(ph.label).toBe('Phone Number');
    });

    it('extracts custom dropdowns, radio groups, and checkboxes nested inside shadow DOM', () => {
      const app = document.createElement('smart-apply-form');
      document.body.appendChild(app);
      const appShadow = app.attachShadow({ mode: 'open' });

      // Dropdown inside shadow DOM
      const selectField = document.createElement('spl-form-field');
      appShadow.appendChild(selectField);
      const selectShadow = selectField.attachShadow({ mode: 'open' });
      selectShadow.innerHTML = `
        <label id="country-lbl">Country</label>
        <select id="country-select" name="country" aria-labelledby="country-lbl">
          <option value="">Select Country</option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="IN">India</option>
        </select>
      `;

      // Radio group inside shadow DOM
      const radioField = document.createElement('spl-form-field');
      appShadow.appendChild(radioField);
      const radioShadow = radioField.attachShadow({ mode: 'open' });
      radioShadow.innerHTML = `
        <label id="auth-lbl">Are you authorized to work in the US?</label>
        <div role="radiogroup" aria-labelledby="auth-lbl">
          <label><input type="radio" name="workAuth" value="yes" /> Yes</label>
          <label><input type="radio" name="workAuth" value="no" /> No</label>
        </div>
      `;

      // Checkbox inside shadow DOM
      const consentField = document.createElement('spl-form-field');
      appShadow.appendChild(consentField);
      const consentShadow = consentField.attachShadow({ mode: 'open' });
      consentShadow.innerHTML = `
        <label>
          <input type="checkbox" name="termsConsent" id="consent-cb" required />
          I agree to the privacy policy
        </label>
      `;

      const fields = extractFormFields(document);
      expect(fields.length).toBeGreaterThanOrEqual(3);

      const dropdownField = fields.find((f) => f.name === 'country');
      expect(dropdownField).toBeDefined();
      expect(dropdownField?.controlType).toBe('dropdown');
      expect(dropdownField?.options).toHaveLength(4);

      const radioFieldMeta = fields.find((f) => f.name === 'workAuth');
      expect(radioFieldMeta).toBeDefined();
      expect(radioFieldMeta?.controlType).toBe('radio');
      expect(radioFieldMeta?.options).toHaveLength(2);

      const consentMeta = fields.find((f) => f.name === 'termsConsent');
      expect(consentMeta).toBeDefined();
      expect(consentMeta?.controlType).toBe('checkbox');
      expect(consentMeta?.required).toBe(true);
    });

    it('resolves labels from shadow host attributes and Angular formControlName', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      // Angular 20 custom component with label attribute and formcontrolname
      const customComponent = document.createElement('spl-input');
      customComponent.setAttribute('label', 'Current Salary Expectation');
      customComponent.setAttribute('formcontrolname', 'salaryExpectation');
      container.appendChild(customComponent);

      const shadow = customComponent.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <input type="text" formcontrolname="salaryExpectation" />
      `;

      const fields = extractFormFields(document);
      expect(fields).toHaveLength(1);
      expect(fields[0].label).toBe('Current Salary Expectation');
      expect(fields[0].name).toBe('salaryExpectation');
    });
  });

  describe('Full Scan -> Find -> Fill Lifecycle in Shadow DOM', () => {
    it('successfully finds and fills elements located inside nested shadow roots', async () => {
      const host = document.createElement('spl-job-application');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });

      shadow.innerHTML = `
        <spl-form-field>
          <label id="lbl-fn">First Name</label>
          <input id="fn" type="text" name="firstName" aria-labelledby="lbl-fn" />
        </spl-form-field>
        <spl-form-field>
          <label id="lbl-role">Primary Role</label>
          <select id="role" name="role" aria-labelledby="lbl-role">
            <option value="">Select Role</option>
            <option value="frontend">Frontend Engineer</option>
            <option value="backend">Backend Engineer</option>
            <option value="fullstack">Full Stack Engineer</option>
          </select>
        </spl-form-field>
      `;

      // 1. Scan
      const fields = extractFormFields(document);
      expect(fields).toHaveLength(2);

      const fnField = fields.find((f) => f.name === 'firstName')!;
      const roleField = fields.find((f) => f.name === 'role')!;

      // 2. Verify findFieldElement pierces shadow root to locate the live element
      const fnEl = findFieldElement(fnField, document);
      expect(fnEl).not.toBeNull();
      expect(fnEl?.id).toBe('fn');

      const roleEl = findFieldElement(roleField, document);
      expect(roleEl).not.toBeNull();
      expect(roleEl?.id).toBe('role');

      // 3. Fill
      const mappings = {
        [fnField.id]: 'Alex Developer',
        [roleField.id]: 'Full Stack Engineer',
      };

      const result = await fillFormFields(mappings, fields, document);

      expect(result.status).toBe('success');
      expect(result.filledCount).toBe(2);
      expect(result.failedCount).toBe(0);

      // Verify DOM values inside shadow root were populated
      const innerInput = shadow.querySelector('#fn') as HTMLInputElement;
      const innerSelect = shadow.querySelector('#role') as HTMLSelectElement;

      expect(innerInput.value).toBe('Alex Developer');
      expect(innerSelect.value).toBe('fullstack');
    });
  });

  describe('Platform Detection', () => {
    it('detects smartrecruiters from jobs.smartrecruiters.com hostname', () => {
      const originalLocation = window.location;
      try {
        delete (window as any).location;
        (window as any).location = {
          hostname: 'jobs.smartrecruiters.com',
          pathname: '/company/job/12345/apply',
        };
        expect(detectPlatform(document)).toBe('smartrecruiters');
      } finally {
        (window as any).location = originalLocation;
      }
    });

    it('detects smartrecruiters from DOM signatures like spl-job-application', () => {
      const el = document.createElement('spl-job-application');
      document.body.appendChild(el);
      expect(detectPlatform(document)).toBe('smartrecruiters');
    });
  });
});
