import { describe, it, expect } from 'vitest';
import { extractFormFields } from '../content/domReader.js';
import { fillFormFields } from '../content/formFiller.js';
import { FieldMetadata } from '@autofiller/shared';

describe('AutoFiller Edge Cases & Boundary Audits', () => {
  // --------------------------------------------------------------------------
  // 1. Google Forms Linear Scale / Rating Questions
  // --------------------------------------------------------------------------
  it('Edge Case 1: Linear scale / rating questions (1-5 radio scale)', () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div role="heading">Rate your familiarity with Docker</div>
        <div role="radiogroup">
          <div role="radio" data-value="1" aria-label="1">1</div>
          <div role="radio" data-value="2" aria-label="2">2</div>
          <div role="radio" data-value="3" aria-label="3">3</div>
          <div role="radio" data-value="4" aria-label="4">4</div>
          <div role="radio" data-value="5" aria-label="5">5</div>
        </div>
      </div>
    `;

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);
    expect(fields[0].controlType).toBe('radio');
    expect(fields[0].label).toBe('Rate your familiarity with Docker');
    expect(fields[0].options?.map((o) => o.label)).toEqual(['1', '2', '3', '4', '5']);
  });

  // --------------------------------------------------------------------------
  // 2. Google Forms Grid / Matrix Questions
  // --------------------------------------------------------------------------
  it('Edge Case 2: Multi-choice grid (matrix of radio rows)', () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div role="heading">Rate your skills across domains</div>
        <div role="radiogroup" aria-label="Frontend Development">
          <div role="radio" data-value="Beginner">Beginner</div>
          <div role="radio" data-value="Intermediate">Intermediate</div>
          <div role="radio" data-value="Advanced">Advanced</div>
        </div>
        <div role="radiogroup" aria-label="Backend Development">
          <div role="radio" data-value="Beginner">Beginner</div>
          <div role="radio" data-value="Intermediate">Intermediate</div>
          <div role="radio" data-value="Advanced">Advanced</div>
        </div>
      </div>
    `;

    const fields = extractFormFields(document);
    // Grid rows are discovered as individual radio groups with their row labels
    expect(fields.length).toBeGreaterThanOrEqual(2);
    const labels = fields.map((f) => f.label);
    expect(labels).toContain('Frontend Development');
    expect(labels).toContain('Backend Development');
  });

  // --------------------------------------------------------------------------
  // 3. Google Forms Multi-part Date (.exportDate with Day, Month, Year inputs)
  // --------------------------------------------------------------------------
  it('Edge Case 3: Google Forms .exportDate multi-part date inputs', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div role="heading">Date of Birth</div>
        <div class="exportDate">
          <input type="text" class="whsOnd" aria-label="Month" maxlength="2" name="entry.100_month" />
          <input type="text" class="whsOnd" aria-label="Day" maxlength="2" name="entry.100_day" />
          <input type="text" class="whsOnd" aria-label="Year" maxlength="4" name="entry.100_year" />
        </div>
      </div>
    `;

    const fields = extractFormFields(document);
    // Multi-part date is now consolidated into exactly 1 logical date field
    expect(fields.length).toBe(1);
    expect(fields[0].controlType).toBe('date');
    expect(fields[0].label).toBe('Date of Birth');

    // Verify filling populates month, day, and year inputs
    const fillResult = await fillFormFields({ [fields[0].id]: '1995-08-24' }, fields, document);
    expect(fillResult.status).toBe('success');
    const monthInput = document.querySelector<HTMLInputElement>('input[aria-label="Month"]');
    const dayInput = document.querySelector<HTMLInputElement>('input[aria-label="Day"]');
    const yearInput = document.querySelector<HTMLInputElement>('input[aria-label="Year"]');
    expect(monthInput?.value).toBe('08');
    expect(dayInput?.value).toBe('24');
    expect(yearInput?.value).toBe('1995');
  });

  // --------------------------------------------------------------------------
  // 4. Rich Text / ContentEditable editors (e.g. Quill, ProseMirror, TinyMCE)
  // --------------------------------------------------------------------------
  it('Edge Case 4: ContentEditable / role="textbox" elements', () => {
    document.body.innerHTML = `
      <div role="listitem">
        <div role="heading">Cover Letter Summary</div>
        <div contenteditable="true" role="textbox" class="ql-editor" aria-label="Cover Letter Summary"></div>
      </div>
    `;

    const fields = extractFormFields(document);
    // Documenting current limitation: contenteditable elements are not standard input/textarea
    // so they are not detected unless standard HTML form controls are used.
    const hasRichText = fields.some((f) => f.label === 'Cover Letter Summary');
    expect(hasRichText).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 5. File Upload Questions (<input type="file">)
  // --------------------------------------------------------------------------
  it('Edge Case 5: File upload inputs (<input type="file">)', () => {
    document.body.innerHTML = `
      <div role="listitem">
        <label for="resume">Attach Resume / CV (PDF)</label>
        <input type="file" id="resume" name="resumeFile" accept=".pdf,.doc,.docx" />
      </div>
    `;

    const fields = extractFormFields(document);
    // File inputs are intentionally excluded because browser security disallows
    // setting file inputs programmatically without real user drag-and-drop.
    expect(fields).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 6. Checkbox Group Deselection (unchecking pre-checked boxes if not desired)
  // --------------------------------------------------------------------------
  it('Edge Case 6: Unchecking pre-checked checkboxes when desired list is empty', async () => {
    document.body.innerHTML = `
      <div role="group" data-autofiller-id="newsletter-group">
        <label><input type="checkbox" value="promo" checked /> Send me promotional offers</label>
        <label><input type="checkbox" value="partner" checked /> Share info with partners</label>
      </div>
    `;

    const fields: FieldMetadata[] = [
      {
        id: 'newsletter-group',
        label: 'Promotions',
        controlType: 'checkbox',
        selectionMode: 'multiple',
      },
    ];

    // Desired list is empty: should uncheck both
    const result = await fillFormFields({ 'newsletter-group': [] }, fields, document);

    expect(result.status).toBe('success');
    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 7. Duplicate labels across different sections (e.g. Current City vs Permanent City)
  // --------------------------------------------------------------------------
  it('Edge Case 7: Disambiguating duplicate field labels across sections', () => {
    document.body.innerHTML = `
      <fieldset>
        <legend>Current Address</legend>
        <div role="listitem">
          <div role="heading">City</div>
          <input type="text" name="current_city" />
        </div>
      </fieldset>
      <fieldset>
        <legend>Permanent Address</legend>
        <div role="listitem">
          <div role="heading">City</div>
          <input type="text" name="perm_city" />
        </div>
      </fieldset>
    `;

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(2);
    // Both fields have unique IDs generated from name/id
    expect(fields[0].id).toBe('current_city');
    expect(fields[1].id).toBe('perm_city');
  });
});
