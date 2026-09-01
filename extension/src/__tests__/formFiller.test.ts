/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fillFormFields } from '../content/formFiller.js';

describe('fillFormFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('fills text input element and dispatches input, change, and blur events', () => {
    document.body.innerHTML = `
      <div>
        <input type="text" name="entry.100" id="name-input" />
      </div>
    `;

    const input = document.getElementById('name-input') as HTMLInputElement;
    const inputHandler = vi.fn();
    const changeHandler = vi.fn();
    const blurHandler = vi.fn();

    input.addEventListener('input', inputHandler);
    input.addEventListener('change', changeHandler);
    input.addEventListener('blur', blurHandler);

    const result = fillFormFields({ 'entry.100': 'Jane Doe' }, document);

    expect(input.value).toBe('Jane Doe');
    expect(inputHandler).toHaveBeenCalledTimes(1);
    expect(changeHandler).toHaveBeenCalledTimes(1);
    expect(blurHandler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'success',
      filledCount: 1,
      failedCount: 0,
      filledFields: ['entry.100'],
      failedFields: [],
    });
  });

  it('fills textarea element correctly', () => {
    document.body.innerHTML = `
      <div>
        <textarea name="entry.200" id="bio-textarea"></textarea>
      </div>
    `;

    const textarea = document.getElementById('bio-textarea') as HTMLTextAreaElement;

    const result = fillFormFields({ 'entry.200': 'Software Engineer' }, document);

    expect(textarea.value).toBe('Software Engineer');
    expect(result.status).toBe('success');
    expect(result.filledFields).toEqual(['entry.200']);
  });

  it('applies green outline highlight style on filled input', () => {
    document.body.innerHTML = `
      <div>
        <input type="text" name="entry.300" id="city-input" />
      </div>
    `;

    const input = document.getElementById('city-input') as HTMLInputElement;

    fillFormFields({ 'entry.300': 'San Francisco' }, document);

    expect(input.style.outline).toContain('2px solid');
  });

  it('returns partial status when some target fields are missing in DOM', () => {
    document.body.innerHTML = `
      <div>
        <input type="text" name="entry.400" id="present-input" />
      </div>
    `;

    const result = fillFormFields(
      { 'entry.400': 'Value 1', 'entry.999': 'Missing Value' },
      document,
    );

    expect(result.status).toBe('partial');
    expect(result.filledCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.filledFields).toEqual(['entry.400']);
    expect(result.failedFields).toEqual(['entry.999']);
  });

  it('returns error status when no fields could be filled', () => {
    document.body.innerHTML = '<div>No inputs here</div>';

    const result = fillFormFields({ 'entry.888': 'Sample' }, document);

    expect(result.status).toBe('error');
    expect(result.filledCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.failedFields).toEqual(['entry.888']);
  });
});
