/**
 * @file universalFormFiller.test.ts
 * @vitest-environment jsdom
 * Comprehensive tests for universal multi-platform control simulators:
 * HTML5, rich text/contenteditable, Greenhouse, Lever, Workday, combobox search, and visual glow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fillFormFields, applyVisualFeedback, resolveVisibleTarget } from '../content/formFiller/index.js';
import type { FieldMetadata, FieldMappingValue } from '@autofiller/shared';

function makeField(overrides: Partial<FieldMetadata> & { id: string }): FieldMetadata {
  return {
    label: overrides.id,
    type: overrides.controlType || 'text',
    ...overrides,
  };
}

describe('Universal Form Filler', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Full Event Sequence & Lifecycle
  // =========================================================================

  it('dispatches full synthetic event lifecycle (focus, focusin, input, change, blur, focusout)', async () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="user-email" name="email" data-autofiller-id="email" />
      </form>
    `;

    const input = document.getElementById('user-email') as HTMLInputElement;
    const eventsFired: string[] = [];

    ['focus', 'focusin', 'input', 'change', 'blur', 'focusout'].forEach((evt) => {
      input.addEventListener(evt, () => eventsFired.push(evt));
    });

    const fields: FieldMetadata[] = [makeField({ id: 'email', controlType: 'text' })];
    const result = await fillFormFields({ email: 'alex@example.com' }, fields, document);

    expect(result.status).toBe('success');
    expect(input.value).toBe('alex@example.com');
    expect(eventsFired).toContain('focusin');
    expect(eventsFired).toContain('input');
    expect(eventsFired).toContain('change');
    expect(eventsFired).toContain('blur');
    expect(eventsFired).toContain('focusout');
  });

  // =========================================================================
  // 2. Rich Text / ContentEditable Editors
  // =========================================================================

  it('fills rich text contenteditable element and dispatches input and change events', async () => {
    document.body.innerHTML = `
      <div class="editor-wrapper">
        <label for="cover-letter">Cover Letter</label>
        <div
          id="cover-letter"
          contenteditable="true"
          role="textbox"
          data-autofiller-id="coverLetter"
          style="min-height: 100px;"
        ></div>
      </div>
    `;

    const editor = document.getElementById('cover-letter') as HTMLElement;
    const inputHandler = vi.fn();
    const changeHandler = vi.fn();

    editor.addEventListener('input', inputHandler);
    editor.addEventListener('change', changeHandler);

    const fields: FieldMetadata[] = [makeField({ id: 'coverLetter', controlType: 'textarea' })];
    const letterText = 'Dear Hiring Team, I am thrilled to apply for the Senior Engineer role.';

    const result = await fillFormFields({ coverLetter: letterText }, fields, document);

    expect(result.status).toBe('success');
    expect(editor.innerText).toBe(letterText);
    expect(inputHandler).toHaveBeenCalled();
    expect(changeHandler).toHaveBeenCalled();
    expect(result.filledFields).toEqual(['coverLetter']);
  });

  // =========================================================================
  // 3. Custom Wrapper Input Resolution (Workday [data-automation-id="textInput"])
  // =========================================================================

  it('resolves inner input when target is a Workday wrapper element', async () => {
    document.body.innerHTML = `
      <div data-automation-id="formField-legalNameSection_firstName">
        <label>First Name</label>
        <div data-automation-id="textInput" id="workday-first-name-wrapper" data-autofiller-id="first_name">
          <input type="text" class="css-12345" value="" />
        </div>
      </div>
    `;

    const wrapper = document.getElementById('workday-first-name-wrapper') as HTMLElement;
    const innerInput = wrapper.querySelector('input') as HTMLInputElement;

    const fields: FieldMetadata[] = [makeField({ id: 'first_name', controlType: 'text' })];
    const result = await fillFormFields({ first_name: 'Jordan' }, fields, document);

    expect(result.status).toBe('success');
    expect(innerInput.value).toBe('Jordan');
  });

  // =========================================================================
  // 4. Disabled & Readonly Safeguards
  // =========================================================================

  it('gracefully handles disabled or readonly inputs', async () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="disabled-input" data-autofiller-id="frozen" disabled />
      </form>
    `;

    const fields: FieldMetadata[] = [makeField({ id: 'frozen', controlType: 'text' })];
    const result = await fillFormFields({ frozen: 'New Value' }, fields, document);

    expect(result.status).toBe('error');
    expect(result.failedFields).toEqual(['frozen']);
  });

  // =========================================================================
  // 5. Greenhouse Form Simulation (Chosen/Select2 & File input skip)
  // =========================================================================

  it('fills Greenhouse application form and synchronizes custom select display', async () => {
    document.body.innerHTML = `
      <form id="application_form">
        <div class="field">
          <label for="first_name">First Name</label>
          <input type="text" id="first_name" name="first_name" data-autofiller-id="first_name" />
        </div>
        <div class="field">
          <label for="gender">Gender</label>
          <div class="select2-container">
            <select id="gender" name="gender" data-autofiller-id="gender">
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Non-Binary</option>
            </select>
            <span class="select2-selection__rendered">Select...</span>
          </div>
        </div>
        <div class="field">
          <label for="resume">Resume / CV</label>
          <input type="file" id="resume" name="resume" data-autofiller-id="resume_file" />
        </div>
      </form>
    `;

    const fields: FieldMetadata[] = [
      makeField({ id: 'first_name', controlType: 'text' }),
      makeField({ id: 'gender', controlType: 'dropdown', selectionMode: 'single' }),
      makeField({ id: 'resume_file', controlType: 'file' }),
    ];

    const result = await fillFormFields(
      {
        first_name: 'Morgan',
        gender: 'Female',
        resume_file: '/path/to/resume.pdf',
      },
      fields,
      document,
    );

    // First name filled
    expect((document.getElementById('first_name') as HTMLInputElement).value).toBe('Morgan');

    // Select filled & custom display updated
    const select = document.getElementById('gender') as HTMLSelectElement;
    expect(select.value).toBe('female');
    const rendered = document.querySelector('.select2-selection__rendered');
    expect(rendered?.textContent).toBe('Female');

    // File input safely skipped with clear explanation
    expect(result.skippedFields).toEqual(['resume_file']);
    expect(result.skippedReasons?.['resume_file']).toContain('browser security sandbox');
    expect(result.status).toBe('partial');
    expect(result.filledCount).toBe(2);
  });

  // =========================================================================
  // 6. Lever Form Simulation (Hidden inputs inside styled labels)
  // =========================================================================

  it('clicks styled label when Lever radio input is visually hidden with opacity: 0', async () => {
    document.body.innerHTML = `
      <div class="lever-field" data-autofiller-id="work_auth">
        <div class="label">Are you authorized to work in the US?</div>
        <div class="options">
          <label class="lever-radio-label" id="label-yes">
            <input type="radio" name="auth" value="yes" style="opacity: 0; position: absolute;" />
            <span class="lever-custom-radio"></span>
            <span>Yes</span>
          </label>
          <label class="lever-radio-label" id="label-no">
            <input type="radio" name="auth" value="no" style="opacity: 0; position: absolute;" />
            <span class="lever-custom-radio"></span>
            <span>No</span>
          </label>
        </div>
      </div>
    `;

    const labelYes = document.getElementById('label-yes') as HTMLElement;
    const radioYes = labelYes.querySelector('input') as HTMLInputElement;
    const labelClickSpy = vi.fn();

    labelYes.addEventListener('click', () => {
      labelClickSpy();
      radioYes.checked = true;
    });

    const fields: FieldMetadata[] = [
      makeField({ id: 'work_auth', controlType: 'radio', selectionMode: 'single' }),
    ];

    const result = await fillFormFields({ work_auth: 'Yes' }, fields, document);

    expect(result.status).toBe('success');
    expect(labelClickSpy).toHaveBeenCalled();
    expect(radioYes.checked).toBe(true);
  });

  // =========================================================================
  // 7. Workday Select Button with Document Body Portal Dropdown
  // =========================================================================

  it('opens Workday select button and clicks matching option rendered in document.body portal', async () => {
    document.body.innerHTML = `
      <div data-automation-id="formField-country">
        <label>Country</label>
        <div data-automation-id="select-country" data-autofiller-id="workday_country">
          <button type="button" aria-haspopup="listbox" aria-expanded="false" data-automation-id="promptButton">
            <span data-automation-id="promptLabel">Select a Country</span>
          </button>
        </div>
      </div>
      <!-- Portal attached to body (initially hidden) -->
      <div data-automation-id="popupList" role="listbox" style="display: none;">
        <div role="option" data-automation-id="promptOption-CA">Canada</div>
        <div role="option" data-automation-id="promptOption-US">United States</div>
        <div role="option" data-automation-id="promptOption-DE">Germany</div>
      </div>
    `;

    const button = document.querySelector('button[data-automation-id="promptButton"]') as HTMLButtonElement;
    const popup = document.querySelector('[data-automation-id="popupList"]') as HTMLElement;
    const usOption = document.querySelector('[data-automation-id="promptOption-US"]') as HTMLElement;
    const labelSpan = document.querySelector('[data-automation-id="promptLabel"]') as HTMLElement;

    button.addEventListener('click', () => {
      button.setAttribute('aria-expanded', 'true');
      popup.style.display = 'block';
    });

    usOption.addEventListener('click', () => {
      usOption.setAttribute('aria-selected', 'true');
      labelSpan.textContent = 'United States';
      button.setAttribute('aria-expanded', 'false');
      popup.style.display = 'none';
    });

    const fields: FieldMetadata[] = [
      makeField({ id: 'workday_country', controlType: 'dropdown', selectionMode: 'single' }),
    ];

    const result = await fillFormFields({ workday_country: 'United States' }, fields, document);

    expect(result.status).toBe('success');
    expect(labelSpan.textContent).toBe('United States');
    expect(usOption.getAttribute('aria-selected')).toBe('true');
  });

  // =========================================================================
  // 8. Searchable Combobox with Popup Filter Input
  // =========================================================================

  it('types query into search input inside combobox popup to filter options', async () => {
    document.body.innerHTML = `
      <div class="combobox-wrapper" data-autofiller-id="skill-search">
        <button type="button" aria-haspopup="listbox" id="combo-trigger">
          <span class="select-label">Choose Skill</span>
        </button>
        <div data-automation-id="popupList" style="display: none;">
          <input type="text" data-automation-id="searchBox" placeholder="Search..." />
          <ul role="listbox">
            <li role="option" data-value="typescript">TypeScript</li>
            <li role="option" data-value="python">Python</li>
          </ul>
        </div>
      </div>
    `;

    const trigger = document.getElementById('combo-trigger') as HTMLElement;
    const popup = document.querySelector('[data-automation-id="popupList"]') as HTMLElement;
    const searchInput = document.querySelector('[data-automation-id="searchBox"]') as HTMLInputElement;
    const tsOption = document.querySelector('[data-value="typescript"]') as HTMLElement;

    trigger.addEventListener('click', () => {
      popup.style.display = 'block';
    });

    tsOption.addEventListener('click', () => {
      tsOption.setAttribute('aria-selected', 'true');
    });

    const fields: FieldMetadata[] = [
      makeField({ id: 'skill-search', controlType: 'combobox', selectionMode: 'single' }),
    ];

    const result = await fillFormFields({ 'skill-search': 'TypeScript' }, fields, document);

    expect(result.status).toBe('success');
    expect(searchInput.value).toBe('TypeScript');
    expect(tsOption.getAttribute('aria-selected')).toBe('true');
  });

  // =========================================================================
  // 9. Visual Confirmation Glow on Visually Hidden Element
  // =========================================================================

  it('resolves visible parent label and applies green glow when native input is opacity: 0', () => {
    document.body.innerHTML = `
      <label id="visible-label" class="form-checkbox">
        <input type="checkbox" id="hidden-cb" style="opacity: 0;" />
        <span>Subscribe to newsletter</span>
      </label>
    `;

    const cb = document.getElementById('hidden-cb') as HTMLElement;
    const label = document.getElementById('visible-label') as HTMLElement;

    applyVisualFeedback(cb);

    expect(label.style.outline).toContain('2px solid');
    expect(label.style.boxShadow).toContain('rgba(34, 197, 94');
  });

  // =========================================================================
  // 10. Multi-select Checkbox Reconciliation (Unchecking unrequested items)
  // =========================================================================

  it('reconciles multi-select checkboxes by checking desired and unchecking undesired options', async () => {
    document.body.innerHTML = `
      <div role="group" data-autofiller-id="roles">
        <label><input type="checkbox" value="frontend" checked /> Frontend</label>
        <label><input type="checkbox" value="backend" /> Backend</label>
        <label><input type="checkbox" value="devops" checked /> DevOps</label>
      </div>
    `;

    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    // frontend is checked, backend is unchecked, devops is checked
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
    expect(checkboxes[2].checked).toBe(true);

    const fields: FieldMetadata[] = [
      makeField({ id: 'roles', controlType: 'checkbox', selectionMode: 'multiple' }),
    ];

    // Desired: Backend only (frontend and devops should be unchecked, backend checked)
    const result = await fillFormFields({ roles: ['Backend'] }, fields, document);

    expect(result.status).toBe('success');
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(false);
  });

  // =========================================================================
  // 11. Standalone Boolean Checkbox Reconciliation
  // =========================================================================

  it('toggles boolean checkbox off when false is passed', async () => {
    document.body.innerHTML = `
      <div data-autofiller-id="subscribe">
        <input type="checkbox" id="sub-input" checked />
      </div>
    `;

    const cb = document.getElementById('sub-input') as HTMLInputElement;
    expect(cb.checked).toBe(true);

    const fields: FieldMetadata[] = [
      makeField({ id: 'subscribe', controlType: 'checkbox', selectionMode: 'single' }),
    ];

    const result = await fillFormFields({ subscribe: false }, fields, document);

    expect(result.status).toBe('success');
    expect(cb.checked).toBe(false);
  });
});
