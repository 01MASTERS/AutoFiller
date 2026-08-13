/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { extractFormFields } from '../content/domReader.js';

describe('extractFormFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts field metadata from standard Google Forms text input container', () => {
    document.body.innerHTML = `
      <div role="listitem">
        <div role="heading">Full Name <span class="freebirdFormviewerViewItemsItemRequiredAsterisk">*</span></div>
        <input type="text" name="entry.123456" aria-label="Full Name" required />
      </div>
    `;

    const fields = extractFormFields(document);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual({
      id: 'entry.123456',
      label: 'Full Name',
      placeholder: undefined,
      ariaLabel: 'Full Name',
      type: 'text',
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
    expect(fields[0]).toEqual({
      id: 'entry.987654',
      label: 'Tell us about yourself',
      placeholder: 'Type response here',
      ariaLabel: undefined,
      type: 'textarea',
      required: undefined,
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
    expect(fields[1].id).toBe('entry.102');
    expect(fields[1].label).toBe('Phone Number');
  });

  it('falls back to aria-label when heading title is absent', () => {
    document.body.innerHTML = `
      <div>
        <input type="text" id="orphan-input" aria-label="Company Name" />
      </div>
    `;

    const fields = extractFormFields(document);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual({
      id: 'orphan-input',
      label: 'Company Name',
      placeholder: undefined,
      ariaLabel: 'Company Name',
      type: 'text',
      required: undefined,
    });
  });
});
