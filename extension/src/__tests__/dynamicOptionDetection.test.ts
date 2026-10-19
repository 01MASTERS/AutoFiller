import { describe, it, expect, beforeEach } from 'vitest';
import { extractFormFields } from '../content/domReader/fieldDiscovery.js';
import { detectOptionSource } from '../content/domReader/optionParser.js';

describe('Dynamic Option Detection & Classification (Plan 24-01)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('classifies a native <select> with multiple options as static and loaded', () => {
    container.innerHTML = `
      <label for="color-select">Favorite Color</label>
      <select id="color-select" name="color">
        <option value="">-- Select a color --</option>
        <option value="red">Red</option>
        <option value="blue">Blue</option>
        <option value="green">Green</option>
      </select>
    `;

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);
    const field = fields[0];
    expect(field.id).toBe('color');
    expect(field.controlType).toBe('dropdown');
    expect(field.optionSource).toBe('static');
    expect(field.optionsLoaded).toBe(true);
    expect(field.options).toHaveLength(3); // placeholder pruned
  });

  it('classifies an empty or placeholder-only <select> as dynamic and pending', () => {
    container.innerHTML = `
      <label for="country-code">Phone Country Code</label>
      <select id="country-code" name="countryCode">
        <option value="" disabled selected>Loading country codes...</option>
      </select>
    `;

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);
    const field = fields[0];
    expect(field.optionSource).toBe('dynamic');
    expect(field.optionsLoaded).toBe(false);
    expect(field.dynamicState?.isAsync).toBe(true);
  });

  it('detects remote data attributes on comboboxes', () => {
    container.innerHTML = `
      <div class="form-group">
        <label id="lbl-job">Job Function</label>
        <div role="combobox"
             aria-labelledby="lbl-job"
             data-url="/api/v1/job-categories"
             data-automation-id="search-job-prompt"
             aria-expanded="false"
             tabindex="0">
          <span>Search categories...</span>
        </div>
      </div>
    `;

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);
    const field = fields[0];
    expect(field.controlType).toBe('combobox');
    expect(field.optionSource).toBe('dynamic');
    expect(field.dynamicState?.isAsync).toBe(true);
    expect(field.dynamicState?.endpointUrl).toBe('/api/v1/job-categories');
  });

  it('classifies aria-busy elements as dynamic', () => {
    container.innerHTML = `
      <label for="city-select">City</label>
      <select id="city-select" aria-busy="true">
        <option value="1">Pending City</option>
      </select>
    `;

    const selectEl = container.querySelector('select')!;
    const classification = detectOptionSource(selectEl, [{ label: 'Pending City', value: '1' }]);
    expect(classification.optionSource).toBe('dynamic');
  });

  it('links cascading dependencies between Country and State fields', () => {
    container.innerHTML = `
      <form>
        <div class="field">
          <label for="country">Country</label>
          <select id="country" name="country">
            <option value="">Select country...</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
        </div>
        <div class="field">
          <label for="state">State / Province</label>
          <select id="state" name="state" disabled>
            <option value="">Select state...</option>
          </select>
        </div>
      </form>
    `;

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(2);

    const countryField = fields.find((f) => f.id === 'country');
    const stateField = fields.find((f) => f.id === 'state');

    expect(countryField).toBeDefined();
    expect(countryField?.optionSource).toBe('static');

    expect(stateField).toBeDefined();
    expect(stateField?.optionSource).toBe('cascading');
    expect(stateField?.parentFieldId).toBe(countryField?.id);
  });
});
