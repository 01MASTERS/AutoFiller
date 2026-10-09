/**
 * @file greenhouseAdapter.ts
 * Specialized DOM adapter and heuristics for Greenhouse job boards (boards.greenhouse.io and embeds).
 */

import { FieldMetadata } from '@autofiller/shared';
import { cleanLabelText, escapeCss } from '../utils.js';

/**
 * Normalizes and enriches form fields discovered on Greenhouse application pages.
 */
export function adaptGreenhouseFields(fields: FieldMetadata[], doc: Document): void {
  for (const field of fields) {
    const rawName = (field.name || '').toLowerCase();
    const rawLabel = (field.label || '').toLowerCase();
    const rawId = (field.id || '').toLowerCase();

    // 1. Personal Information Normalization
    if (rawName.includes('first_name') || rawId.includes('first_name') || rawLabel === 'first name') {
      field.label = 'First Name';
      field.platformFieldType = 'personal';
      field.section = 'personal';
    } else if (rawName.includes('last_name') || rawId.includes('last_name') || rawLabel === 'last name') {
      field.label = 'Last Name';
      field.platformFieldType = 'personal';
      field.section = 'personal';
    } else if (rawName === 'job_application[email]' || rawName === 'email' || rawId === 'email' || rawLabel === 'email') {
      field.label = 'Email';
      field.platformFieldType = 'personal';
      field.section = 'personal';
    } else if (rawName.includes('phone') || rawId.includes('phone') || rawLabel.includes('phone')) {
      field.label = 'Phone';
      field.platformFieldType = 'personal';
      field.section = 'personal';
    } else if (rawName.includes('location') || rawId.includes('location') || rawLabel.includes('location')) {
      field.label = 'Location';
      field.platformFieldType = 'personal';
      field.section = 'personal';
    }

    // 2. Social / Portfolio Links
    else if (
      rawLabel.includes('linkedin') ||
      rawName.includes('linkedin') ||
      rawLabel.includes('github') ||
      rawName.includes('github') ||
      rawLabel.includes('website') ||
      rawLabel.includes('portfolio') ||
      rawLabel.includes('twitter')
    ) {
      field.platformFieldType = 'social_link';
      field.section = 'links';
      if (rawLabel.includes('linkedin')) field.label = 'LinkedIn Profile';
      else if (rawLabel.includes('github')) field.label = 'GitHub Profile';
      else if (rawLabel.includes('portfolio') || rawLabel.includes('website')) field.label = 'Website / Portfolio';
      else if (rawLabel.includes('twitter')) field.label = 'Twitter URL';
    }

    // 3. Resume / Cover Letter Dropzones
    else if (
      field.controlType === 'file' ||
      rawId.includes('resume') ||
      rawName.includes('resume') ||
      rawLabel.includes('resume')
    ) {
      field.platformFieldType = 'resume_upload';
      field.section = 'personal';
      field.label = 'Resume / CV (File Upload)';
    }

    // 4. Demographic / EEO Questions
    else if (
      rawLabel.includes('race') ||
      rawLabel.includes('ethnicity') ||
      rawLabel.includes('gender') ||
      rawLabel.includes('veteran') ||
      rawLabel.includes('disability') ||
      rawName.includes('demographic') ||
      rawId.includes('eeo')
    ) {
      field.platformFieldType = 'demographic';
      field.section = 'demographics';
      // Preserve descriptive question labels like "Gender Identity", only normalize if simple/ambiguous
      if (rawLabel === 'gender') field.label = 'Gender';
      else if (rawLabel === 'race' || rawLabel === 'ethnicity') field.label = 'Race / Ethnicity';
      else if (rawLabel === 'veteran') field.label = 'Veteran Status';
      else if (rawLabel === 'disability') field.label = 'Disability Status';
    }

    // 5. Custom Questions
    else {
      if (!field.section) field.section = 'custom_questions';
      if (!field.platformFieldType) field.platformFieldType = 'custom_question';
    }

    // Strip Greenhouse boilerplate helper text & asterisks
    field.label = cleanLabelText(field.label)
      .replace(/select one\.{3}/i, '')
      .replace(/please select/i, '')
      .replace(/please specify/i, '')
      .trim();

    // 6. Chosen / Select2 widget option reconciliation
    if (field.controlType === 'dropdown') {
      try {
        const selectEl = doc.querySelector<HTMLSelectElement>(
          `select#${escapeCss(field.id)}, select[name="${escapeCss(field.name || '')}"]`,
        );
        if (selectEl && (!field.options || field.options.length === 0)) {
          field.options = Array.from(selectEl.options)
            .map((opt) => ({
              label: opt.text.trim(),
              value: opt.value || opt.text.trim(),
              selected: opt.selected,
              disabled: opt.disabled,
            }))
            .filter((opt) => opt.label && opt.label.toLowerCase() !== 'select...' && opt.label.toLowerCase() !== 'select one...');
        }
      } catch {}
    }
  }
}
