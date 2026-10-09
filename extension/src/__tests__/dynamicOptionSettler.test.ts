import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  waitForDynamicOptions,
  waitForFieldEnabled,
  extractLiveOptions,
} from '../content/domReader/dynamicOptionSettler.js';
import { FieldMetadata } from '@autofiller/shared';

describe('Dynamic Option Settler & Mutation Observer Engine (Plan 24-02)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves immediately if valid options already exist in the container', async () => {
    container.innerHTML = `
      <select id="country-select">
        <option value="us">United States</option>
        <option value="ca">Canada</option>
      </select>
    `;
    const selectEl = container.querySelector('select')!;
    const options = await waitForDynamicOptions(selectEl, 100);

    expect(options).toHaveLength(2);
    expect(options[0].label).toBe('United States');
  });

  it('waits and resolves when <option> elements are appended asynchronously via MutationObserver', async () => {
    container.innerHTML = `
      <select id="async-country">
        <option value="" disabled selected>Loading countries...</option>
      </select>
    `;
    const selectEl = container.querySelector('select')!;

    // Simulate backend response arriving after 25ms
    setTimeout(() => {
      const opt1 = document.createElement('option');
      opt1.value = 'in';
      opt1.textContent = 'India';

      const opt2 = document.createElement('option');
      opt2.value = 'uk';
      opt2.textContent = 'United Kingdom';

      selectEl.appendChild(opt1);
      selectEl.appendChild(opt2);
    }, 25);

    const options = await waitForDynamicOptions(selectEl, 200);
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.some((o) => o.label === 'India')).toBe(true);
    expect(options.some((o) => o.label === 'United Kingdom')).toBe(true);
  });

  it('waits for aria-busy to flip to false before resolving', async () => {
    container.innerHTML = `
      <div role="combobox" aria-busy="true" id="combo-box">
        <div role="listbox" id="combo-list">
          <div role="option">Option A</div>
        </div>
      </div>
    `;
    const comboEl = container.querySelector('#combo-box')!;

    setTimeout(() => {
      comboEl.setAttribute('aria-busy', 'false');
    }, 25);

    const options = await waitForDynamicOptions(comboEl, 200);
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe('Option A');
  });

  it('safely handles timeout when backend options never arrive', async () => {
    container.innerHTML = `
      <select id="stuck-select">
        <option value="" disabled selected>Loading forever...</option>
      </select>
    `;
    const selectEl = container.querySelector('select')!;
    const startTime = Date.now();
    const options = await waitForDynamicOptions(selectEl, 40);

    expect(options).toHaveLength(1);
    expect(options[0].label).toBe('Loading forever...');
    expect(Date.now() - startTime).toBeGreaterThanOrEqual(30);
  });

  it('waitForFieldEnabled resolves when disabled attribute is removed', async () => {
    container.innerHTML = `
      <select id="state-select" disabled>
        <option value="ca">California</option>
      </select>
    `;
    const selectEl = container.querySelector('select')!;
    expect(selectEl.disabled).toBe(true);

    setTimeout(() => {
      selectEl.disabled = false;
      selectEl.removeAttribute('disabled');
    }, 25);

    const enabled = await waitForFieldEnabled(selectEl, 200);
    expect(enabled).toBe(true);
    expect(selectEl.disabled).toBe(false);
  });

  it('extractLiveOptions re-evaluates live DOM options and updates metadata', () => {
    container.innerHTML = `
      <select id="city-select">
        <option value="sf">San Francisco</option>
        <option value="nyc">New York City</option>
      </select>
    `;
    const selectEl = container.querySelector('select')!;
    const field: FieldMetadata = {
      id: 'city-select',
      label: 'City',
      controlType: 'dropdown',
      options: [],
      optionsLoaded: false,
    };

    const live = extractLiveOptions(field, selectEl, document);
    expect(live).toHaveLength(2);
    expect(field.options).toHaveLength(2);
    expect(field.optionsLoaded).toBe(true);
  });
});
