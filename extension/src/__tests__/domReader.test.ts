/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { extractFormFields, findFieldElement } from '../content/domReader.js';

describe('extractFormFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ==========================================================================
  // 1. Google Forms Text & Textarea (Preserve Baseline Contracts)
  // ==========================================================================
  describe('Google Forms Text Inputs (Baseline)', () => {
    it('extracts field metadata from standard Google Forms text input container', () => {
      document.body.innerHTML = `
        <div role="listitem">
          <div role="heading">Full Name <span class="freebirdFormviewerViewItemsItemRequiredAsterisk">*</span></div>
          <input type="text" name="entry.123456" aria-label="Full Name" required />
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'entry.123456',
        name: 'entry.123456',
        label: 'Full Name',
        placeholder: undefined,
        ariaLabel: 'Full Name',
        type: 'text',
        controlType: 'text',
        selectionMode: 'single',
        required: true,
      });
    });

    it('extracts textarea input with placeholder and fallback label', () => {
      document.body.innerHTML = `
        <div class="freebirdFormviewerViewItemsItemItem">
          <div class="freebirdFormviewerViewItemsItemItemTitle">Tell us about yourself</div>
          <textarea name="entry.987654" placeholder="Type response here"></textarea>
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'entry.987654',
        name: 'entry.987654',
        label: 'Tell us about yourself',
        placeholder: 'Type response here',
        type: 'textarea',
        controlType: 'textarea',
        selectionMode: 'single',
      });
    });

    it('extracts multiple input fields from a form', () => {
      document.body.innerHTML = `
        <div role="listitem">
          <div role="heading">Email Address</div>
          <input type="email" name="entry.101" />
        </div>
        <div role="listitem">
          <div role="heading">Phone Number</div>
          <input type="tel" name="entry.102" />
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(2);
      expect(fields[0].id).toBe('entry.101');
      expect(fields[0].label).toBe('Email Address');
      expect(fields[0].controlType).toBe('text');
      expect(fields[1].id).toBe('entry.102');
      expect(fields[1].label).toBe('Phone Number');
      expect(fields[1].controlType).toBe('text');
    });

    it('falls back to aria-label when heading title is absent', () => {
      document.body.innerHTML = `
        <div>
          <input type="text" id="orphan-input" aria-label="Company Name" />
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'orphan-input',
        label: 'Company Name',
        ariaLabel: 'Company Name',
        type: 'text',
        controlType: 'text',
      });
    });

    it('correctly handles Phone and Alternate Phone fields with unique IDs', () => {
      document.body.innerHTML = `
        <div role="listitem">
          <div role="heading">Phone Number</div>
          <input type="tel" name="phone_field" aria-label="Phone Number" />
        </div>
        <div role="listitem">
          <div role="heading">Alternate Phone Number</div>
          <input type="tel" name="phone_field" aria-label="Alternate Phone Number" />
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(2);
      expect(fields[0].id).toBe('phone_field');
      expect(fields[0].label).toBe('Phone Number');
      expect(fields[1].id).toBe('phone_field-2');
      expect(fields[1].label).toBe('Alternate Phone Number');
    });
  });

  // ==========================================================================
  // 2. Generic Controls & Multi-Select
  // ==========================================================================
  describe('Generic Select & Dropdown Controls', () => {
    it('extracts native single <select> with options, values, and selectionMode: single', () => {
      document.body.innerHTML = `
        <label for="country">Country</label>
        <select id="country" name="country">
          <option value="" disabled selected>-- Select a country --</option>
          <option value="us">United States</option>
          <option value="ca">Canada</option>
          <option value="uk" disabled>United Kingdom</option>
        </select>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'country',
        name: 'country',
        label: 'Country',
        controlType: 'dropdown',
        selectionMode: 'single',
      });
      // Placeholder option "-- Select a country --" should be excluded
      expect(fields[0].options).toHaveLength(3);
      expect(fields[0].options?.[0]).toEqual({
        label: 'United States',
        value: 'us',
        selected: undefined,
        disabled: undefined,
      });
      expect(fields[0].options?.[1]).toEqual({
        label: 'Canada',
        value: 'ca',
        selected: undefined,
        disabled: undefined,
      });
      expect(fields[0].options?.[2]).toEqual({
        label: 'United Kingdom',
        value: 'uk',
        selected: undefined,
        disabled: true,
      });
    });

    it('extracts native <select multiple> with selectionMode: multiple', () => {
      document.body.innerHTML = `
        <label for="skills">Skills</label>
        <select id="skills" name="skills" multiple>
          <option value="js" selected>JavaScript</option>
          <option value="ts" selected>TypeScript</option>
          <option value="py">Python</option>
        </select>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'skills',
        name: 'skills',
        label: 'Skills',
        controlType: 'dropdown',
        selectionMode: 'multiple',
      });
      expect(fields[0].options).toHaveLength(3);
      expect(fields[0].options?.[0].selected).toBe(true);
      expect(fields[0].options?.[1].selected).toBe(true);
      expect(fields[0].options?.[2].selected).toBeUndefined();
    });

    it('extracts ARIA listbox with aria-multiselectable="true"', () => {
      document.body.innerHTML = `
        <div role="listbox" id="aria-list" aria-label="Languages" aria-multiselectable="true">
          <div role="option" data-value="en" aria-selected="true">English</div>
          <div role="option" data-value="es">Spanish</div>
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'aria-list',
        label: 'Languages',
        controlType: 'dropdown',
        selectionMode: 'multiple',
      });
      expect(fields[0].options).toHaveLength(2);
      expect(fields[0].options?.[0]).toEqual({
        label: 'English',
        value: 'en',
        selected: true,
        disabled: undefined,
      });
    });

    it('extracts ARIA combobox even when no options are currently rendered in DOM', () => {
      document.body.innerHTML = `
        <label for="city-combo">City</label>
        <input role="combobox" id="city-combo" name="city" aria-expanded="false" />
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'city',
        name: 'city',
        label: 'City',
        controlType: 'combobox',
        selectionMode: 'single',
      });
      // Options should be undefined or empty since dropdown is closed
      expect(fields[0].options === undefined || fields[0].options.length === 0).toBe(true);
    });

    it('extracts ARIA combobox with rendered options when present', () => {
      document.body.innerHTML = `
        <div role="combobox" id="framework-combo" aria-label="Framework" aria-controls="framework-list">
          <input type="text" />
        </div>
        <div id="framework-list" role="listbox">
          <div role="option" data-value="react">React</div>
          <div role="option" data-value="vue">Vue</div>
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'framework-combo',
        label: 'Framework',
        controlType: 'combobox',
        selectionMode: 'single',
      });
      expect(fields[0].options).toHaveLength(2);
      expect(fields[0].options?.[0].label).toBe('React');
      expect(fields[0].options?.[1].label).toBe('Vue');
    });

    it('extracts native input[type="date"] with controlType: date', () => {
      document.body.innerHTML = `
        <label for="dob">Date of Birth</label>
        <input type="date" id="dob" name="birthDate" required />
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'birthDate',
        name: 'birthDate',
        label: 'Date of Birth',
        controlType: 'date',
        selectionMode: 'single',
        required: true,
      });
    });
  });

  // ==========================================================================
  // 3. Deduplication & Group Processing
  // ==========================================================================
  describe('Deduplication & Grouping', () => {
    it('deduplicates radio nodes in role="radiogroup" into exactly ONE logical field', () => {
      document.body.innerHTML = `
        <div role="radiogroup" aria-label="Employment Status" id="status-group">
          <label>
            <input type="radio" name="emp_status" value="ft" /> Full-Time
          </label>
          <label>
            <input type="radio" name="emp_status" value="pt" checked /> Part-Time
          </label>
          <label>
            <input type="radio" name="emp_status" value="co" /> Contractor
          </label>
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'emp_status',
        name: 'emp_status',
        label: 'Employment Status',
        controlType: 'radio',
        selectionMode: 'single',
      });
      expect(fields[0].options).toHaveLength(3);
      expect(fields[0].options?.[0].label).toBe('Full-Time');
      expect(fields[0].options?.[0].value).toBe('ft');
      expect(fields[0].options?.[1].selected).toBe(true);
    });

    it('groups radio inputs sharing the same name in a fieldset into ONE logical field', () => {
      document.body.innerHTML = `
        <fieldset>
          <legend>Degree Level</legend>
          <div>
            <input type="radio" id="deg1" name="degree" value="bachelors" />
            <label for="deg1">Bachelor's</label>
          </div>
          <div>
            <input type="radio" id="deg2" name="degree" value="masters" />
            <label for="deg2">Master's</label>
          </div>
        </fieldset>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        name: 'degree',
        label: "Degree Level",
        controlType: 'radio',
        selectionMode: 'single',
      });
      expect(fields[0].options).toHaveLength(2);
      expect(fields[0].options?.[0].label).toBe("Bachelor's");
      expect(fields[0].options?.[0].value).toBe('bachelors');
    });

    it('deduplicates checkbox nodes in role="group" into exactly ONE logical field with selectionMode: multiple', () => {
      document.body.innerHTML = `
        <div role="group" aria-label="Work Preferences" id="work-pref-group">
          <div role="checkbox" aria-checked="true" data-value="remote">Remote Work</div>
          <div role="checkbox" aria-checked="false" data-value="hybrid">Hybrid Work</div>
          <div role="checkbox" aria-checked="false" data-value="onsite">On-Site Work</div>
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        id: 'work-pref-group',
        label: 'Work Preferences',
        controlType: 'checkbox',
        selectionMode: 'multiple',
      });
      expect(fields[0].options).toHaveLength(3);
      expect(fields[0].options?.[0]).toEqual({
        label: 'Remote Work',
        value: 'remote',
        selected: true,
        disabled: undefined,
      });
    });

    it('tightens role="group": does NOT classify role="group" with text inputs as a checkbox group', () => {
      document.body.innerHTML = `
        <div role="group" aria-label="Address Details">
          <div>
            <label for="street">Street</label>
            <input type="text" id="street" name="street" />
          </div>
          <div>
            <label for="city">City</label>
            <input type="text" id="city" name="city" />
          </div>
        </div>
      `;

      const fields = extractFormFields(document);

      // Should discover the two individual text fields, NOT a single checkbox group
      expect(fields).toHaveLength(2);
      expect(fields[0].label).toBe('Street');
      expect(fields[0].controlType).toBe('text');
      expect(fields[1].label).toBe('City');
      expect(fields[1].controlType).toBe('text');
    });
  });

  // ==========================================================================
  // 4. Accessible Name Resolution Precedence
  // ==========================================================================
  describe('Accessible Name Resolution', () => {
    it('resolves accessible label using aria-labelledby with highest precedence', () => {
      document.body.innerHTML = `
        <div id="header-part1">Emergency</div>
        <div id="header-part2">Contact Name</div>
        <input type="text" id="emer-contact" aria-labelledby="header-part1 header-part2" aria-label="Wrong Name" />
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0].label).toBe('Emergency Contact Name');
    });

    it('resolves accessible label using wrapping <label>', () => {
      document.body.innerHTML = `
        <label>
          Preferred Pronouns
          <input type="text" name="pronouns" />
        </label>
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0].label).toBe('Preferred Pronouns');
    });
  });

  // ==========================================================================
  // 5. Option Label vs Value Integrity
  // ==========================================================================
  describe('Option Label and Value Integrity', () => {
    it('preserves distinct label and value without overwriting value with label', () => {
      document.body.innerHTML = `
        <select id="state-sel" name="state">
          <option value="CA">California</option>
          <option value="NY">New York</option>
        </select>
      `;

      const fields = extractFormFields(document);

      expect(fields[0].options?.[0]).toEqual({
        label: 'California',
        value: 'CA',
        selected: true,
        disabled: undefined,
      });
      expect(fields[0].options?.[1]).toEqual({
        label: 'New York',
        value: 'NY',
        selected: undefined,
        disabled: undefined,
      });
    });

    it('omits value for custom ARIA options when no explicit value attribute exists', () => {
      document.body.innerHTML = `
        <div role="radiogroup" aria-label="T-Shirt Size">
          <div role="radio">Small</div>
          <div role="radio">Medium</div>
          <div role="radio">Large</div>
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields[0].options?.[0]).toEqual({
        label: 'Small',
        value: undefined,
        selected: undefined,
        disabled: undefined,
      });
    });
  });

  // ==========================================================================
  // 6. Negative & Edge-Case Tests
  // ==========================================================================
  describe('Negative & Edge Cases', () => {
    it('ignores hidden controls (display:none, hidden attribute, aria-hidden, type=hidden)', () => {
      document.body.innerHTML = `
        <input type="hidden" name="csrf" value="123" />
        <input type="text" name="hidden_attr" hidden />
        <input type="text" name="aria_hidden" aria-hidden="true" />
        <input type="text" name="visible_field" aria-label="Visible Field" />
      `;

      const fields = extractFormFields(document);

      expect(fields).toHaveLength(1);
      expect(fields[0].id).toBe('visible_field');
      expect(fields[0].label).toBe('Visible Field');
    });

    it('handles nested clickable markup inside option labels cleanly', () => {
      document.body.innerHTML = `
        <div role="radiogroup" aria-label="Subscription Plan">
          <div role="radio" data-value="pro">
            <span class="title"><strong>Pro Plan</strong> ($20/mo)</span>
            <span class="badge">Popular</span>
          </div>
        </div>
      `;

      const fields = extractFormFields(document);

      expect(fields[0].options?.[0].label).toBe('Pro Plan ($20/mo) Popular');
      expect(fields[0].options?.[0].value).toBe('pro');
    });
  });
});

// ==========================================================================
// 7. Re-Association with findFieldElement()
// ==========================================================================
describe('findFieldElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('re-associates element via data-autofiller-id when connected', () => {
    document.body.innerHTML = `
      <input type="text" id="user-input" data-autofiller-id="user-input" />
    `;

    const el = findFieldElement({ id: 'user-input', label: 'User' }, document);
    expect(el).not.toBeNull();
    expect(el?.id).toBe('user-input');
  });

  it('re-associates element after DOM node is replaced/re-rendered using native id', () => {
    document.body.innerHTML = `
      <input type="text" id="email-field" name="email" />
    `;

    // Extract field (attaches data-autofiller-id)
    const fields = extractFormFields(document);
    expect(fields[0].id).toBe('email');

    // Simulate React/framework re-render: replace DOM element without data-autofiller-id
    document.body.innerHTML = `
      <input type="text" id="email" name="email" />
    `;

    const reFound = findFieldElement(fields[0], document);
    expect(reFound).not.toBeNull();
    expect(reFound?.id).toBe('email');
  });

  it('re-associates element using name and controlType when data-autofiller-id is missing', () => {
    document.body.innerHTML = `
      <fieldset>
        <legend>Contact Preference</legend>
        <input type="radio" name="contact_pref" value="email" /> Email
        <input type="radio" name="contact_pref" value="phone" /> Phone
      </fieldset>
    `;

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);

    // Wipe data-autofiller-id
    document.querySelectorAll('[data-autofiller-id]').forEach((el) => {
      el.removeAttribute('data-autofiller-id');
    });

    const reFound = findFieldElement(fields[0], document);
    expect(reFound).not.toBeNull();
  });

  it('returns null on ambiguous duplicates rather than guessing', () => {
    document.body.innerHTML = `
      <div>
        <label>Address</label>
        <input type="text" class="first-addr" />
      </div>
      <div>
        <label>Address</label>
        <input type="text" class="second-addr" />
      </div>
    `;

    // When no unique ID or name exists, and two fields have identical accessible labels
    const result = findFieldElement(
      { id: 'field-nonexistent', label: 'Address', controlType: 'text' },
      document,
    );

    expect(result).toBeNull();
  });
});
