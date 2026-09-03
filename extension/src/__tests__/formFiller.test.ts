/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fillFormFields } from '../content/formFiller.js';
import type { FieldMetadata, FieldMappingValue } from '@autofiller/shared';

// Helper to build a minimal FieldMetadata
function makeField(overrides: Partial<FieldMetadata> & { id: string }): FieldMetadata {
  return {
    label: overrides.id,
    type: overrides.controlType || 'text',
    ...overrides,
  };
}

describe('fillFormFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Original text-input tests
  // =========================================================================

  it('fills text input element and dispatches input, change, and blur events', async () => {
    document.body.innerHTML = `
      <div>
        <input type="text" name="entry.100" id="name-input" data-autofiller-id="entry.100" />
      </div>
    `;

    const input = document.getElementById('name-input') as HTMLInputElement;
    const inputHandler = vi.fn();
    const changeHandler = vi.fn();
    const blurHandler = vi.fn();

    input.addEventListener('input', inputHandler);
    input.addEventListener('change', changeHandler);
    input.addEventListener('blur', blurHandler);

    const fields: FieldMetadata[] = [makeField({ id: 'entry.100', controlType: 'text' })];
    const result = await fillFormFields({ 'entry.100': 'Jane Doe' }, fields, document);

    expect(input.value).toBe('Jane Doe');
    expect(inputHandler).toHaveBeenCalledTimes(1);
    expect(changeHandler).toHaveBeenCalledTimes(1);
    expect(blurHandler).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['entry.100']);
    expect(result.skippedCount).toBe(0);
  });

  it('fills textarea element correctly', async () => {
    document.body.innerHTML = `
      <div>
        <textarea name="entry.200" id="bio-textarea" data-autofiller-id="entry.200"></textarea>
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({ id: 'entry.200', controlType: 'textarea' })];
    const textarea = document.getElementById('bio-textarea') as HTMLTextAreaElement;

    const result = await fillFormFields({ 'entry.200': 'Software Engineer' }, fields, document);

    expect(textarea.value).toBe('Software Engineer');
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['entry.200']);
  });

  it('applies green outline highlight style on filled input', async () => {
    document.body.innerHTML = `
      <div>
        <input type="text" name="entry.300" id="city-input" data-autofiller-id="entry.300" />
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({ id: 'entry.300', controlType: 'text' })];
    const input = document.getElementById('city-input') as HTMLInputElement;

    await fillFormFields({ 'entry.300': 'San Francisco' }, fields, document);

    expect(input.style.outline).toContain('2px solid');
  });

  it('returns partial status when some target fields are missing in DOM', async () => {
    document.body.innerHTML = `
      <div>
        <input type="text" name="entry.400" id="present-input" data-autofiller-id="entry.400" />
      </div>
    `;

    const fields: FieldMetadata[] = [
      makeField({ id: 'entry.400', controlType: 'text' }),
      makeField({ id: 'entry.999', controlType: 'text' }),
    ];

    const result = await fillFormFields(
      { 'entry.400': 'Value 1', 'entry.999': 'Missing Value' },
      fields,
      document,
    );

    expect(result.status).toBe('partial');
    expect(result.filledCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.filledFields).toEqual(['entry.400']);
    expect(result.failedFields).toEqual(['entry.999']);
    expect(result.failureReasons?.['entry.999']).toContain('No matching element found');
  });

  it('returns error status when no fields could be filled', async () => {
    document.body.innerHTML = '<div>No inputs here</div>';

    const fields: FieldMetadata[] = [makeField({ id: 'entry.888', controlType: 'text' })];
    const result = await fillFormFields({ 'entry.888': 'Sample' }, fields, document);

    expect(result.status).toBe('error');
    expect(result.filledCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.failedFields).toEqual(['entry.888']);
  });

  // =========================================================================
  // Phase 14: Radio group tests
  // =========================================================================

  it('radio group: clicks correct option by data-autofiller-option', async () => {
    document.body.innerHTML = `
      <div role="radiogroup" data-autofiller-id="gender">
        <div role="radio" data-autofiller-option="Male" aria-checked="false">Male</div>
        <div role="radio" data-autofiller-option="Female" aria-checked="false">Female</div>
        <div role="radio" data-autofiller-option="Other" aria-checked="false">Other</div>
      </div>
    `;

    const clickSpy = vi.fn();
    const maleOption = document.querySelector('[data-autofiller-option="Male"]') as HTMLElement;
    maleOption.addEventListener('click', clickSpy);

    const fields: FieldMetadata[] = [makeField({
      id: 'gender',
      controlType: 'radio',
      selectionMode: 'single',
      options: [{ label: 'Male' }, { label: 'Female' }, { label: 'Other' }],
    })];

    const result = await fillFormFields({ gender: 'Male' }, fields, document);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['gender']);
  });

  it('radio group: clicks correct option by text content fallback', async () => {
    document.body.innerHTML = `
      <div role="radiogroup" data-autofiller-id="preference">
        <div role="radio">Option A</div>
        <div role="radio">Option B</div>
      </div>
    `;

    const clickSpy = vi.fn();
    const optionB = document.querySelectorAll('[role="radio"]')[1] as HTMLElement;
    optionB.addEventListener('click', clickSpy);

    const fields: FieldMetadata[] = [makeField({
      id: 'preference',
      controlType: 'radio',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ preference: 'Option B' }, fields, document);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
  });

  // =========================================================================
  // Phase 14: Checkbox group tests
  // =========================================================================

  it('checkbox group: toggles multiple options correctly', async () => {
    document.body.innerHTML = `
      <div role="group" data-autofiller-id="skills">
        <div role="checkbox" data-autofiller-option="JavaScript" aria-checked="false">JavaScript</div>
        <div role="checkbox" data-autofiller-option="Python" aria-checked="false">Python</div>
        <div role="checkbox" data-autofiller-option="Rust" aria-checked="false">Rust</div>
      </div>
    `;

    const jsClick = vi.fn();
    const pyClick = vi.fn();
    const rustClick = vi.fn();

    const checkboxes = document.querySelectorAll('[role="checkbox"]');
    (checkboxes[0] as HTMLElement).addEventListener('click', jsClick);
    (checkboxes[1] as HTMLElement).addEventListener('click', pyClick);
    (checkboxes[2] as HTMLElement).addEventListener('click', rustClick);

    const fields: FieldMetadata[] = [makeField({
      id: 'skills',
      controlType: 'checkbox',
      selectionMode: 'multiple',
      options: [{ label: 'JavaScript' }, { label: 'Python' }, { label: 'Rust' }],
    })];

    const result = await fillFormFields({ skills: ['JavaScript', 'Rust'] }, fields, document);

    expect(jsClick).toHaveBeenCalledTimes(1);
    expect(pyClick).not.toHaveBeenCalled();
    expect(rustClick).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['skills']);
  });

  it('checkbox group: idempotent — does not re-toggle already-checked options', async () => {
    document.body.innerHTML = `
      <div role="group" data-autofiller-id="langs">
        <div role="checkbox" data-autofiller-option="Go" aria-checked="true">Go</div>
        <div role="checkbox" data-autofiller-option="Java" aria-checked="false">Java</div>
      </div>
    `;

    const goClick = vi.fn();
    const javaClick = vi.fn();

    const checkboxes = document.querySelectorAll('[role="checkbox"]');
    (checkboxes[0] as HTMLElement).addEventListener('click', goClick);
    (checkboxes[1] as HTMLElement).addEventListener('click', javaClick);

    const fields: FieldMetadata[] = [makeField({
      id: 'langs',
      controlType: 'checkbox',
      selectionMode: 'multiple',
    })];

    const result = await fillFormFields({ langs: ['Go', 'Java'] }, fields, document);

    expect(goClick).not.toHaveBeenCalled();
    expect(javaClick).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
  });

  it('standalone boolean checkbox: toggles on when unchecked', async () => {
    document.body.innerHTML = `
      <div data-autofiller-id="agree">
        <input type="checkbox" id="agree-cb" />
      </div>
    `;

    const clickSpy = vi.fn();
    const cb = document.getElementById('agree-cb') as HTMLInputElement;
    cb.addEventListener('click', clickSpy);

    const fields: FieldMetadata[] = [makeField({
      id: 'agree',
      controlType: 'checkbox',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ agree: true }, fields, document);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['agree']);
  });

  it('standalone boolean checkbox: no-op when already checked', async () => {
    document.body.innerHTML = `
      <div data-autofiller-id="terms">
        <input type="checkbox" id="terms-cb" checked />
      </div>
    `;

    const clickSpy = vi.fn();
    const cb = document.getElementById('terms-cb') as HTMLInputElement;
    cb.addEventListener('click', clickSpy);

    const fields: FieldMetadata[] = [makeField({
      id: 'terms',
      controlType: 'checkbox',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ terms: true }, fields, document);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(result.status).toBe('success');
  });

  // =========================================================================
  // Phase 14: Native <select> dropdown tests
  // =========================================================================

  it('native select single: sets correct option', async () => {
    document.body.innerHTML = `
      <select name="country" data-autofiller-id="country">
        <option value="">Select</option>
        <option value="US">United States</option>
        <option value="IN">India</option>
        <option value="UK">United Kingdom</option>
      </select>
    `;

    const changeHandler = vi.fn();
    const select = document.querySelector('select') as HTMLSelectElement;
    select.addEventListener('change', changeHandler);

    const fields: FieldMetadata[] = [makeField({
      id: 'country',
      controlType: 'dropdown',
      selectionMode: 'single',
      options: [
        { label: 'United States', value: 'US' },
        { label: 'India', value: 'IN' },
        { label: 'United Kingdom', value: 'UK' },
      ],
    })];

    const result = await fillFormFields({ country: 'IN' }, fields, document);

    expect(select.value).toBe('IN');
    expect(changeHandler).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['country']);
  });

  it('native select multiple: selects multiple options', async () => {
    document.body.innerHTML = `
      <select name="topics" data-autofiller-id="topics" multiple>
        <option value="ai">AI</option>
        <option value="web">Web</option>
        <option value="mobile">Mobile</option>
        <option value="cloud">Cloud</option>
      </select>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'topics',
      controlType: 'dropdown',
      selectionMode: 'multiple',
    })];

    const result = await fillFormFields({ topics: ['ai', 'cloud'] }, fields, document);
    const select = document.querySelector('select') as HTMLSelectElement;

    expect(select.options[0].selected).toBe(true);
    expect(select.options[1].selected).toBe(false);
    expect(select.options[2].selected).toBe(false);
    expect(select.options[3].selected).toBe(true);
    expect(result.status).toBe('success');
  });

  it('native select single: fails and reports failure when option does not exist', async () => {
    document.body.innerHTML = `
      <select name="tier" data-autofiller-id="tier">
        <option value="basic">Basic</option>
        <option value="pro">Pro</option>
      </select>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'tier',
      controlType: 'dropdown',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ tier: 'enterprise' }, fields, document);
    expect(result.status).toBe('error');
    expect(result.failedFields).toEqual(['tier']);
    expect(result.failureReasons['tier']).toContain('No dropdown option matched');
  });

  // =========================================================================
  // Phase 14: ARIA listbox dropdown tests
  // =========================================================================

  it('ARIA listbox: clicks correct option element', async () => {
    document.body.innerHTML = `
      <div role="listbox" data-autofiller-id="dept">
        <div role="option" data-autofiller-option="Engineering">Engineering</div>
        <div role="option" data-autofiller-option="Marketing">Marketing</div>
        <div role="option" data-autofiller-option="Sales">Sales</div>
      </div>
    `;

    const clickSpy = vi.fn();
    const engOpt = document.querySelector('[data-autofiller-option="Engineering"]') as HTMLElement;
    engOpt.addEventListener('click', clickSpy);

    const fields: FieldMetadata[] = [makeField({
      id: 'dept',
      controlType: 'dropdown',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ dept: 'Engineering' }, fields, document);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['dept']);
  });

  // =========================================================================
  // Phase 14: Date input tests
  // =========================================================================

  it('date input: sets ISO value correctly', async () => {
    document.body.innerHTML = `
      <input type="date" data-autofiller-id="dob" id="dob-input" />
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'dob',
      controlType: 'date',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ dob: '1995-06-15' }, fields, document);
    const input = document.getElementById('dob-input') as HTMLInputElement;

    expect(input.value).toBe('1995-06-15');
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['dob']);
  });

  // =========================================================================
  // Phase 14: Type mismatch tests
  // =========================================================================

  it('type mismatch: array to radio → skipped', async () => {
    document.body.innerHTML = `
      <div role="radiogroup" data-autofiller-id="q1">
        <div role="radio" data-autofiller-option="A">A</div>
        <div role="radio" data-autofiller-option="B">B</div>
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'q1',
      controlType: 'radio',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ q1: ['A', 'B'] as unknown as FieldMappingValue }, fields, document);

    expect(result.skippedCount).toBe(1);
    expect(result.skippedFields).toEqual(['q1']);
    expect(result.skippedReasons?.['q1']).toContain('Radio expects string');
  });

  it('type mismatch: string to multi-select checkbox → skipped', async () => {
    document.body.innerHTML = `
      <div role="group" data-autofiller-id="q2">
        <div role="checkbox" data-autofiller-option="X">X</div>
        <div role="checkbox" data-autofiller-option="Y">Y</div>
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'q2',
      controlType: 'checkbox',
      selectionMode: 'multiple',
    })];

    const result = await fillFormFields({ q2: 'X' }, fields, document);

    expect(result.skippedCount).toBe(1);
    expect(result.skippedFields).toEqual(['q2']);
    expect(result.skippedReasons?.['q2']).toContain('Multi-select checkbox');
  });

  // =========================================================================
  // Phase 14: Fallback and edge cases
  // =========================================================================

  it('no metadata fallback: fills as text input', async () => {
    document.body.innerHTML = `
      <input type="text" name="unknown-field" id="unknown-field" />
    `;

    const result = await fillFormFields({ 'unknown-field': 'Fallback Value' }, [], document);
    const input = document.getElementById('unknown-field') as HTMLInputElement;

    expect(input.value).toBe('Fallback Value');
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['unknown-field']);
  });

  it('visual feedback on radio container', async () => {
    document.body.innerHTML = `
      <div role="radiogroup" data-autofiller-id="color" id="color-group">
        <div role="radio" data-autofiller-option="Red">Red</div>
        <div role="radio" data-autofiller-option="Blue">Blue</div>
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'color',
      controlType: 'radio',
      selectionMode: 'single',
    })];

    await fillFormFields({ color: 'Red' }, fields, document);

    const container = document.getElementById('color-group') as HTMLElement;
    expect(container.style.outline).toContain('2px solid');
  });

  it('mixed field form: text + radio + checkbox + dropdown', async () => {
    document.body.innerHTML = `
      <input type="text" data-autofiller-id="name" id="name-input" />
      <div role="radiogroup" data-autofiller-id="gender">
        <div role="radio" data-autofiller-option="Male">Male</div>
        <div role="radio" data-autofiller-option="Female">Female</div>
      </div>
      <div role="group" data-autofiller-id="hobbies">
        <div role="checkbox" data-autofiller-option="Reading" aria-checked="false">Reading</div>
        <div role="checkbox" data-autofiller-option="Gaming" aria-checked="false">Gaming</div>
      </div>
      <select data-autofiller-id="country">
        <option value="US">US</option>
        <option value="IN">IN</option>
      </select>
    `;

    const fields: FieldMetadata[] = [
      makeField({ id: 'name', controlType: 'text' }),
      makeField({ id: 'gender', controlType: 'radio', selectionMode: 'single' }),
      makeField({ id: 'hobbies', controlType: 'checkbox', selectionMode: 'multiple' }),
      makeField({ id: 'country', controlType: 'dropdown', selectionMode: 'single' }),
    ];

    const result = await fillFormFields(
      {
        name: 'Jane Doe',
        gender: 'Female',
        hobbies: ['Reading', 'Gaming'],
        country: 'IN',
      },
      fields,
      document,
    );

    expect(result.status).toBe('success');
    expect(result.filledCount).toBe(4);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(0);

    expect((document.getElementById('name-input') as HTMLInputElement).value).toBe('Jane Doe');
    expect((document.querySelector('select') as HTMLSelectElement).value).toBe('IN');
  });

  it('ARIA listbox: simulates click and marks selected when component handler responds', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div role="listbox" data-autofiller-id="country-dd" aria-expanded="false">
          <span class="vRMGwf">Choose</span>
        </div>
        <div class="exportSelectPopup" style="display: none;">
          <div role="option" data-value="United States">United States</div>
          <div role="option" data-value="India">India</div>
        </div>
      </div>
    `;

    const indiaOption = document.querySelector('[role="option"][data-value="India"]') as HTMLElement;
    const clickSpy = vi.fn();
    indiaOption.addEventListener('click', () => {
      clickSpy();
      indiaOption.setAttribute('aria-selected', 'true');
    });

    const fields: FieldMetadata[] = [makeField({
      id: 'country-dd',
      controlType: 'dropdown',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ 'country-dd': 'India' }, fields, document);

    expect(clickSpy).toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['country-dd']);
    expect(indiaOption.getAttribute('aria-selected')).toBe('true');
  });

  it('Radio group: triggers real click and selects radio option', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div role="radiogroup" data-autofiller-id="gender-rg">
          <div role="radio" data-value="Male">Male</div>
          <div role="radio" data-value="Female">Female</div>
        </div>
      </div>
    `;

    const maleRadio = document.querySelector('[role="radio"][data-value="Male"]') as HTMLElement;
    const clickSpy = vi.fn();
    maleRadio.addEventListener('click', () => {
      clickSpy();
      maleRadio.setAttribute('aria-checked', 'true');
    });

    const fields: FieldMetadata[] = [makeField({
      id: 'gender-rg',
      controlType: 'radio',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ 'gender-rg': 'Male' }, fields, document);

    expect(clickSpy).toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(maleRadio.getAttribute('aria-checked')).toBe('true');
  });

  it('radio group: selects Other option and populates companion text input when custom text is provided', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <input type="hidden" name="entry.11111" value="" />
        <div role="radiogroup" data-autofiller-id="college-loc">
          <div role="radio" data-value="Hyderabad">Hyderabad</div>
          <div role="radio" data-value="Bangalore">Bangalore</div>
          <div role="radio" data-value="__other_option__">Other:</div>
        </div>
        <div class="Xb9hP">
          <input type="text" class="Hvn9fb" aria-label="Other response" />
        </div>
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'college-loc',
      controlType: 'radio',
      selectionMode: 'single',
    })];

    // Value is custom text not in the radio list
    const result = await fillFormFields({ 'college-loc': 'Patna' }, fields, document);

    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['college-loc']);

    // Check companion Other input was filled
    const otherInput = document.querySelector<HTMLInputElement>('.Hvn9fb');
    expect(otherInput?.value).toBe('Patna');
  });

  it('radio group: selects Other option and parses "Other: <text>" prefix correctly', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div role="radiogroup" data-autofiller-id="college-loc-2">
          <div role="radio" data-value="Hyderabad">Hyderabad</div>
          <div role="radio" data-value="__other_option__">Other:</div>
        </div>
        <input type="text" class="Hvn9fb" aria-label="Other response" />
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'college-loc-2',
      controlType: 'radio',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ 'college-loc-2': 'Other: Patna' }, fields, document);

    expect(result.status).toBe('success');
    const otherInput = document.querySelector<HTMLInputElement>('.Hvn9fb');
    expect(otherInput?.value).toBe('Patna');
  });

  it('checkbox group: selects Other checkbox and populates companion text input', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div role="group" data-autofiller-id="skills-group">
          <div role="checkbox" data-value="JavaScript">JavaScript</div>
          <div role="checkbox" data-value="Python">Python</div>
          <div role="checkbox" data-value="__other_option__">Other:</div>
        </div>
        <input type="text" class="Hvn9fb" aria-label="Other response" />
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'skills-group',
      controlType: 'checkbox',
      selectionMode: 'multiple',
    })];

    const result = await fillFormFields(
      { 'skills-group': ['JavaScript', 'Other: Rust'] },
      fields,
      document,
    );

    expect(result.status).toBe('success');
    const otherInput = document.querySelector<HTMLInputElement>('.Hvn9fb');
    expect(otherInput?.value).toBe('Rust');
  });

  it('Date filling: correctly populates multi-part date from natural language string "5th Jan 2026"', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div role="heading">Date of Joining</div>
        <div class="exportDate" data-autofiller-id="joining-date">
          <input type="text" class="whsOnd" aria-label="Month" maxlength="2" name="entry.200_month" />
          <input type="text" class="whsOnd" aria-label="Day" maxlength="2" name="entry.200_day" />
          <input type="text" class="whsOnd" aria-label="Year" maxlength="4" name="entry.200_year" />
        </div>
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'joining-date',
      controlType: 'date',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ 'joining-date': '5th Jan 2026' }, fields, document);

    expect(result.status).toBe('success');
    const monthInput = document.querySelector<HTMLInputElement>('input[name="entry.200_month"]');
    const dayInput = document.querySelector<HTMLInputElement>('input[name="entry.200_day"]');
    const yearInput = document.querySelector<HTMLInputElement>('input[name="entry.200_year"]');

    expect(monthInput?.value).toBe('01');
    expect(dayInput?.value).toBe('05');
    expect(yearInput?.value).toBe('2026');
  });

  it('Date filling: formats DD/MM/YYYY text input when placeholder specifies dd/mm/yyyy', async () => {
    document.body.innerHTML = `
      <div role="listitem">
        <label for="join-text">Joining Date</label>
        <input type="text" id="join-text" placeholder="DD/MM/YYYY" />
      </div>
    `;

    const fields: FieldMetadata[] = [makeField({
      id: 'join-text',
      controlType: 'date',
      selectionMode: 'single',
    })];

    const result = await fillFormFields({ 'join-text': '5th Jan 2026' }, fields, document);

    expect(result.status).toBe('success');
    const input = document.getElementById('join-text') as HTMLInputElement;
    expect(input.value).toBe('05/01/2026');
  });
});
