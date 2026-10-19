/**
 * @file leverAdapter.ts
 * Specialized DOM adapter and heuristics for Lever job application pages (jobs.lever.co and embeds).
 */

import { FieldMetadata } from '@autofiller/shared';
import { cleanLabelText, escapeCss } from '../utils.js';

/**
 * Normalizes and enriches form fields discovered on Lever application pages.
 */
export function adaptLeverFields(fields: FieldMetadata[], doc: Document): void {
  for (const field of fields) {
    const rawName = (field.name || '').toLowerCase();
    const rawLabel = (field.label || '').toLowerCase();
    const rawId = (field.id || '').toLowerCase();

    // 1. Section Container Detection via DOM lookup
    try {
      const el = doc.querySelector(`[data-autofiller-id="${escapeCss(field.id)}"]`);
      if (el) {
        if (el.closest('.section-candidate-wrapper, .section-candidate')) {
          field.section = 'candidate';
        } else if (el.closest('.section-links-wrapper, .section-links')) {
          field.section = 'links';
        } else if (el.closest('.section-cards-wrapper, .section-custom-questions, .custom-questions')) {
          field.section = 'custom_questions';
        } else if (el.closest('.section-eeo-wrapper, #demographic-survey, .demographic-survey')) {
          field.section = 'demographics';
        }
      }
    } catch {}

    // 2. Full Name Input (Lever single name input)
    if (rawName === 'name' || rawId === 'name' || (rawLabel === 'name' && !field.section)) {
      field.label = 'Full Name';
      field.platformFieldType = 'personal';
      field.section = 'candidate';
    }

    // 3. Candidate Personal Details
    else if (rawName === 'email' || rawId === 'email') {
      field.label = 'Email';
      field.platformFieldType = 'personal';
      field.section = 'candidate';
    } else if (rawName === 'phone' || rawId === 'phone') {
      field.label = 'Phone';
      field.platformFieldType = 'personal';
      field.section = 'candidate';
    } else if (rawName === 'org' || rawName.includes('company')) {
      field.label = 'Current Company';
      field.platformFieldType = 'experience';
      field.section = 'candidate';
    }

    // 4. Social Links Bracket Parsing: urls[LinkedIn], urls[GitHub], urls[Portfolio], etc.
    else if (field.name && field.name.startsWith('urls[')) {
      const match = field.name.match(/^urls\[(.*?)\]$/i);
      const network = match ? match[1] : 'Website';
      field.label = `${network} URL`;
      field.platformFieldType = 'social_link';
      field.section = 'links';
    } else if (
      rawLabel.includes('linkedin') ||
      rawLabel.includes('github') ||
      rawLabel.includes('portfolio') ||
      rawLabel.includes('twitter')
    ) {
      field.platformFieldType = 'social_link';
      field.section = 'links';
      if (rawLabel.includes('linkedin')) field.label = 'LinkedIn URL';
      else if (rawLabel.includes('github')) field.label = 'GitHub URL';
      else if (rawLabel.includes('portfolio')) field.label = 'Portfolio URL';
      else if (rawLabel.includes('twitter')) field.label = 'Twitter URL';
    }

    // 5. Resume Dropzone
    else if (
      field.controlType === 'file' ||
      rawId.includes('resume') ||
      rawName.includes('resume') ||
      rawLabel.includes('resume')
    ) {
      field.platformFieldType = 'resume_upload';
      field.section = 'candidate';
      field.label = 'Resume / CV (File Upload)';
    }

    // 6. Demographic Survey (EEO) Questions
    else if (
      field.section === 'demographics' ||
      rawLabel.includes('race') ||
      rawLabel.includes('ethnicity') ||
      rawLabel.includes('gender') ||
      rawLabel.includes('veteran') ||
      rawLabel.includes('disability') ||
      rawName.includes('eeo')
    ) {
      field.platformFieldType = 'demographic';
      field.section = 'demographics';
      if (rawLabel.includes('gender')) field.label = 'Gender';
      else if (rawLabel.includes('race') || rawLabel.includes('ethnicity')) field.label = 'Race / Ethnicity';
      else if (rawLabel.includes('veteran')) field.label = 'Veteran Status';
      else if (rawLabel.includes('disability')) field.label = 'Disability Status';
    }

    // 7. Custom Questions
    else {
      if (!field.section) field.section = 'custom_questions';
      if (!field.platformFieldType) field.platformFieldType = 'custom_question';
    }

    // Clean Lever boilerplate
    field.label = cleanLabelText(field.label)
      .replace(/optional/i, '')
      .replace(/\(optional\)/i, '')
      .trim();
  }
}
