/**
 * @file workdayAdapter.ts
 * Specialized DOM adapter and heuristics for Workday career applications (*.myworkdayjobs.com and embeds).
 */

import { FieldMetadata } from '@autofiller/shared';
import { cleanLabelText, escapeCss } from '../utils.js';

/**
 * Recursively queries DOM elements across standard elements and Shadow DOM roots.
 */
export function queryDeepAll(selector: string, root: Element | Document = document): Element[] {
  const results: Element[] = [];

  try {
    results.push(...Array.from(root.querySelectorAll(selector)));
  } catch {}

  // Walk through child elements to find any shadowRoots
  const allElements = Array.from(root.querySelectorAll('*'));
  for (const el of allElements) {
    if (el.shadowRoot) {
      results.push(...queryDeepAll(selector, el.shadowRoot));
    }
  }

  return results;
}

/**
 * Detects the current active step in a Workday multi-step application wizard.
 */
export function detectWorkdayWizardStep(doc: Document): string | undefined {
  const stepEl = doc.querySelector(
    '[data-automation-id="activeStep"], [data-automation-id="wizardStep"], [data-automation-id="pageHeader"] h1, [data-automation-id="pageHeader"] h2, h2.css-12345',
  );
  if (stepEl && stepEl.textContent) {
    const text = stepEl.textContent.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return undefined;
}

/**
 * Normalizes and enriches form fields discovered on Workday application pages.
 */
export function adaptWorkdayFields(fields: FieldMetadata[], doc: Document): void {
  // Prune internal Workday prompt UI artifacts (multiselect containers, prompt selection labels, selectedItem lists, pills, promptOptions)
  const internalIdPrefixes = [
    'multiselectinputcontainer',
    'promptselectionlabel',
    'selecteditemlist',
    'promptoption',
  ];

  for (let i = fields.length - 1; i >= 0; i--) {
    const f = fields[i];
    const rawId = (f.id || '').toLowerCase();
    const rawLabel = (f.label || '').toLowerCase();

    const isInternalWidget =
      internalIdPrefixes.some((prefix) => rawId.startsWith(prefix)) ||
      rawId.startsWith('pill-') ||
      rawLabel.includes('press delete to clear value') ||
      rawLabel.includes('items selected');

    if (isInternalWidget) {
      fields.splice(i, 1);
    }
  }

  const currentStep = detectWorkdayWizardStep(doc);

  for (const field of fields) {
    const rawId = (field.id || '').toLowerCase();
    const rawName = (field.name || '').toLowerCase();
    const rawLabel = (field.label || '').toLowerCase();

    // Default section from detected wizard step
    if (currentStep && !field.section) {
      field.section = currentStep;
    }

    // 1. Compound Personal Fields (legalNameSection_firstName, phoneSection_phoneNumber, etc.)
    if (rawId.includes('firstname') || rawName.includes('firstname') || rawLabel === 'first name' || rawLabel.includes('first name')) {
      field.label = 'First Name';
      field.platformFieldType = 'personal';
      field.section = field.section || 'My Information';
    } else if (rawId.includes('lastname') || rawName.includes('lastname') || rawLabel === 'last name' || rawLabel.includes('last name')) {
      field.label = 'Last Name';
      field.platformFieldType = 'personal';
      field.section = field.section || 'My Information';
    } else if (rawId.includes('email') || rawName.includes('email') || rawLabel.includes('email')) {
      field.label = 'Email';
      field.platformFieldType = 'personal';
      field.section = field.section || 'My Information';
    } else if (
      rawId.includes('countryphonecode') ||
      rawId.includes('country-phone-code') ||
      rawName.includes('countryphonecode') ||
      (rawLabel.includes('country') && (rawLabel.includes('phone') || rawLabel.includes('code'))) ||
      rawLabel === 'country phone code' ||
      rawLabel === 'phone country code' ||
      rawLabel === 'country code'
    ) {
      field.label = 'Country Phone Code';
      field.platformFieldType = 'personal';
      field.controlType = 'combobox';
      field.optionSource = 'dynamic';
      field.section = field.section || 'My Information';
    } else if (
      rawId.includes('devicetype') ||
      rawId.includes('device-type') ||
      rawName.includes('devicetype') ||
      rawLabel.includes('device type')
    ) {
      field.label = 'Phone Device Type';
      field.platformFieldType = 'personal';
      field.controlType = 'combobox';
      field.section = field.section || 'My Information';
    } else if (rawId.includes('phoneextension') || rawName.includes('extension') || rawLabel.includes('extension')) {
      field.label = 'Phone Extension';
      field.platformFieldType = 'personal';
      field.controlType = 'text';
      field.section = field.section || 'My Information';
    } else if (rawId.includes('phone') || rawName.includes('phone') || rawLabel.includes('phone')) {
      if (!field.label || field.label === field.id || field.label === 'unlabeled-field') {
        field.label = 'Phone Number';
      }
      field.platformFieldType = 'personal';
      field.section = field.section || 'My Information';
    } else if (
      rawId.includes('source') ||
      rawName.includes('source') ||
      rawLabel.includes('hear about') ||
      rawLabel.includes('how did you hear') ||
      rawLabel.includes('how did you find')
    ) {
      field.label = 'How did you hear about us?';
      field.platformFieldType = 'source';
      field.section = field.section || 'Job Application';
      field.controlType = 'combobox';
      field.optionSource = 'dynamic';
    } else if (rawId.includes('addresssection_city') || (rawId.includes('city') && field.section === 'My Information')) {
      field.label = 'City';
      field.platformFieldType = 'personal';
    } else if (rawId.includes('postalcode') || rawId.includes('zip')) {
      field.label = 'Postal Code';
      field.platformFieldType = 'personal';
    }

    // 2. Experience / Education Sections
    else if (rawId.includes('jobhistory') || rawId.includes('workexperience') || (currentStep && currentStep.toLowerCase().includes('experience'))) {
      field.platformFieldType = 'experience';
      field.section = 'My Experience';
    }

    // 3. Resume / CV Dropzones
    else if (
      field.controlType === 'file' ||
      rawId.includes('resume') ||
      rawId.includes('file') ||
      rawLabel.includes('resume')
    ) {
      field.platformFieldType = 'resume_upload';
      field.section = 'My Experience';
      field.label = 'Resume / CV (File Upload)';
    }

    // 4. Demographic / Voluntary Disclosures
    else if (
      rawId.includes('diversity') ||
      rawId.includes('veteran') ||
      rawId.includes('disability') ||
      rawId.includes('gender') ||
      rawLabel.includes('race') ||
      rawLabel.includes('ethnicity') ||
      rawLabel.includes('gender') ||
      rawLabel.includes('veteran') ||
      rawLabel.includes('disability') ||
      (currentStep && currentStep.toLowerCase().includes('disclosures'))
    ) {
      field.platformFieldType = 'demographic';
      field.section = 'Voluntary Disclosures';
      if (rawLabel === 'gender') field.label = 'Gender';
      else if (rawLabel === 'race' || rawLabel === 'ethnicity') field.label = 'Race / Ethnicity';
      else if (rawLabel === 'veteran') field.label = 'Veteran Status';
      else if (rawLabel === 'disability') field.label = 'Disability Status';
    }

    // 5. Workday Prompt Buttons & Select Controls
    try {
      const el = doc.querySelector(`[data-autofiller-id="${escapeCss(field.id)}"]`);
      if (el) {
        const promptBtn =
          el.matches('button[data-automation-id*="prompt"], button[aria-haspopup="listbox"], button[aria-haspopup="true"], [data-automation-id*="select"], [data-automation-id*="dropdown"], [data-automation-id*="prompt"]') ||
          el.querySelector('button[data-automation-id*="prompt"], button[aria-haspopup="listbox"], button[aria-haspopup="true"]');
        if (promptBtn) {
          field.controlType = 'combobox';
          if (!field.options || field.options.length === 0) {
            field.optionSource = field.parentFieldId ? 'cascading' : (field.optionSource || 'dynamic');
            field.optionsLoaded = false;
          }
        }
      }
    } catch {}

    // Strip Workday required markers (<abbr title="required">*</abbr>) and clean label
    field.label = cleanLabelText(field.label).trim();
  }
}
