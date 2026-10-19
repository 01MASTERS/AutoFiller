/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fillFormFields, sortFieldsByDependency } from '../content/formFiller/index.js';
import { fillNativeDropdown, fillAriaDropdown } from '../content/formFiller/simulators/selectSimulator.js';
import { FieldMetadata } from '@autofiller/shared';

function makeField(overrides: Partial<FieldMetadata> & { id: string }): FieldMetadata {
  return {
    label: overrides.id,
    type: overrides.controlType || 'text',
    ...overrides,
  };
}

describe('Topological Dependency Sorting & Dynamic Form Filling (Plan 24-03)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('sortFieldsByDependency', () => {
    it('sorts upstream parent fields before dependent children when given in reverse order', () => {
      const fields: FieldMetadata[] = [
        makeField({ id: 'country', controlType: 'dropdown', optionSource: 'static' }),
        makeField({ id: 'state', controlType: 'dropdown', parentFieldId: 'country', optionSource: 'cascading' }),
      ];

      // state passed before country in mappings
      const ordered = sortFieldsByDependency(fields, ['state', 'country']);
      expect(ordered).toEqual(['country', 'state']);
    });

    it('resolves multi-level cascading dependencies (Country -> State -> City)', () => {
      const fields: FieldMetadata[] = [
        makeField({ id: 'country', controlType: 'dropdown' }),
        makeField({ id: 'state', controlType: 'dropdown', parentFieldId: 'country' }),
        makeField({ id: 'city', controlType: 'dropdown', parentFieldId: 'state' }),
      ];

      const ordered = sortFieldsByDependency(fields, ['city', 'country', 'state']);
      expect(ordered).toEqual(['country', 'state', 'city']);
    });

    it('preserves initial order for independent unconstrained fields', () => {
      const fields: FieldMetadata[] = [
        makeField({ id: 'name', controlType: 'text' }),
        makeField({ id: 'email', controlType: 'text' }),
        makeField({ id: 'country', controlType: 'dropdown' }),
        makeField({ id: 'state', controlType: 'dropdown', parentFieldId: 'country' }),
      ];

      const ordered = sortFieldsByDependency(fields, ['name', 'state', 'email', 'country']);
      expect(ordered.indexOf('country')).toBeLessThan(ordered.indexOf('state'));
      expect(ordered.indexOf('name')).toBeLessThan(ordered.indexOf('email'));
    });

    it('handles circular dependencies gracefully without dropping fields', () => {
      const fields: FieldMetadata[] = [
        makeField({ id: 'fieldA', controlType: 'dropdown', parentFieldId: 'fieldB' }),
        makeField({ id: 'fieldB', controlType: 'dropdown', parentFieldId: 'fieldA' }),
        makeField({ id: 'fieldC', controlType: 'text' }),
      ];

      const ordered = sortFieldsByDependency(fields, ['fieldA', 'fieldB', 'fieldC']);
      expect(ordered).toHaveLength(3);
      expect(ordered).toContain('fieldA');
      expect(ordered).toContain('fieldB');
      expect(ordered).toContain('fieldC');
    });
  });

  describe('Reactive Cascading Dropdown Form Filling', () => {
    it('fills parent country first, triggering child state enablement and option settlement', async () => {
      document.body.innerHTML = `
        <form id="cascading-form">
          <div>
            <label for="country">Country</label>
            <select id="country" name="country" data-autofiller-id="country">
              <option value="">-- Select Country --</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
            </select>
          </div>
          <div>
            <label for="state">State</label>
            <select id="state" name="state" data-autofiller-id="state" disabled aria-disabled="true">
              <option value="" disabled selected>Select country first...</option>
            </select>
          </div>
        </form>
      `;

      const countryEl = document.getElementById('country') as HTMLSelectElement;
      const stateEl = document.getElementById('state') as HTMLSelectElement;

      // Simulate reactive frontend framework logic upon country change
      countryEl.addEventListener('change', () => {
        if (countryEl.value === 'US') {
          setTimeout(() => {
            stateEl.disabled = false;
            stateEl.removeAttribute('disabled');
            stateEl.setAttribute('aria-disabled', 'false');
            stateEl.innerHTML = `
              <option value="">-- Select State --</option>
              <option value="CA">California</option>
              <option value="NY">New York</option>
              <option value="TX">Texas</option>
            `;
          }, 20);
        }
      });

      const fields: FieldMetadata[] = [
        makeField({ id: 'country', controlType: 'dropdown', optionSource: 'static' }),
        makeField({ id: 'state', controlType: 'dropdown', parentFieldId: 'country', optionSource: 'cascading' }),
      ];

      // Intentionally provide state before country in mappings
      const mappings = {
        state: 'California',
        country: 'United States',
      };

      const result = await fillFormFields(mappings, fields, document);

      expect(result.status).toBe('success');
      expect(result.filledFields).toContain('country');
      expect(result.filledFields).toContain('state');
      expect(countryEl.value).toBe('US');
      expect(stateEl.value).toBe('CA');
    });
  });

  describe('Delayed Async Option Population in selectSimulator', () => {
    it('fillNativeDropdown awaits dynamic options arriving via delayed async response', async () => {
      document.body.innerHTML = `
        <select id="async-select">
          <option value="" disabled selected>Loading options from API...</option>
        </select>
      `;

      const selectEl = document.getElementById('async-select') as HTMLSelectElement;

      // Simulate async API response populating options after 25ms
      setTimeout(() => {
        const opt1 = document.createElement('option');
        opt1.value = '+1';
        opt1.textContent = '+1 (United States)';

        const opt2 = document.createElement('option');
        opt2.value = '+44';
        opt2.textContent = '+44 (United Kingdom)';

        selectEl.appendChild(opt1);
        selectEl.appendChild(opt2);
      }, 25);

      const success = await fillNativeDropdown(selectEl, '+44 (United Kingdom)', document);

      expect(success).toBe(true);
      expect(selectEl.value).toBe('+44');
    });

    it('fillAriaDropdown finds and clicks option once dynamic listbox options render', async () => {
      document.body.innerHTML = `
        <div id="role-combobox" role="combobox" aria-expanded="true">
          <button type="button" class="select-label">Select Role</button>
          <div role="listbox" id="role-list">
            <!-- options will be injected dynamically -->
          </div>
        </div>
      `;

      const container = document.getElementById('role-combobox')!;
      const listbox = document.getElementById('role-list')!;

      // Simulate async render after 20ms
      setTimeout(() => {
        listbox.innerHTML = `
          <div role="option" data-value="frontend" class="opt">Frontend Engineer</div>
          <div role="option" data-value="backend" class="opt">Backend Engineer</div>
        `;
      }, 20);

      const success = await fillAriaDropdown(container, 'Backend Engineer', document);

      expect(success).toBe(true);
      const clickedOption = listbox.querySelector('[data-value="backend"]');
      expect(clickedOption?.getAttribute('aria-selected')).toBe('true');
    });
  });
});
