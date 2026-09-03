import { FieldMetadata } from '@autofiller/shared';
import { escapeCss, cleanLabelText, isElementHidden } from './utils.js';
import { resolveAccessibleLabel } from './accessibility.js';
import { scanRadioGroups } from './controls/radio.js';
import { scanCheckboxGroups } from './controls/checkbox.js';
import { scanDropdowns } from './controls/dropdown.js';
import { scanDateInputs } from './controls/date.js';
import { scanTextInputs } from './controls/text.js';

/**
 * Main DOM extraction pipeline: orchestrates scanning across all control types.
 */
export function extractFormFields(doc: Document = document): FieldMetadata[] {
  const fields: FieldMetadata[] = [];
  const processedElements = new Set<Element>();
  const usedIds = new Set<string>();

  // Question container discovery (HTML fieldsets, Google Forms items, ARIA groups)
  const questionContainers = Array.from(
    doc.querySelectorAll(
      '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, [role="radiogroup"], [role="group"]',
    ),
  );

  // STAGE 1: Radio Groups & Linear Scales
  scanRadioGroups(doc, questionContainers, fields, processedElements, usedIds);

  // STAGE 2: Checkbox Groups (Multi-select)
  scanCheckboxGroups(doc, questionContainers, fields, processedElements, usedIds);

  // STAGE 3: Native <select>, role="listbox", role="combobox"
  scanDropdowns(doc, fields, processedElements, usedIds);

  // STAGE 4: Date Inputs (Multi-part and standalone)
  scanDateInputs(doc, fields, processedElements, usedIds);

  // STAGE 5: Text, Textarea, Email, Tel & Other Inputs
  scanTextInputs(doc, fields, processedElements, usedIds);

  return fields;
}

/**
 * Re-associates a logical FieldMetadata with a live DOM element using a 5-tier confidence strategy.
 * If multiple candidate nodes match equally well (e.g. duplicate labels), returns null.
 */
export function findFieldElement(
  field: FieldMetadata,
  doc: Document = document,
): Element | null {
  // Tier 1: data-autofiller-id if element is still connected to the DOM
  try {
    const el = doc.querySelector(`[data-autofiller-id="${escapeCss(field.id)}"]`);
    if (el && doc.contains(el)) {
      return el;
    }
  } catch {
    // Ignore CSS selector escape issues
  }

  // Tier 2: Stable native ID
  if (field.id) {
    const el = doc.getElementById(field.id);
    if (el) return el;
  }

  // Tier 3: Match by name + controlType
  if (field.name) {
    const matches = Array.from(doc.querySelectorAll(`[name="${escapeCss(field.name)}"]`));
    const typeMatches = matches.filter((el) => {
      if (field.controlType === 'radio' && (el.getAttribute('role') === 'radio' || (el as HTMLInputElement).type === 'radio')) return true;
      if (field.controlType === 'checkbox' && (el.getAttribute('role') === 'checkbox' || (el as HTMLInputElement).type === 'checkbox')) return true;
      if (field.controlType === 'dropdown' && el.tagName.toLowerCase() === 'select') return true;
      if (field.controlType === 'textarea' && el.tagName.toLowerCase() === 'textarea') return true;
      if (field.controlType === 'text' && el.tagName.toLowerCase() === 'input') return true;
      return false;
    });

    if (typeMatches.length === 1) {
      return typeMatches[0];
    }
    // If multiple radio/checkbox inputs share name, return their common grouping container
    if (typeMatches.length > 1 && (field.controlType === 'radio' || field.controlType === 'checkbox')) {
      const container = typeMatches[0].closest('[role="radiogroup"], [role="group"], fieldset') || typeMatches[0].parentElement;
      if (container) return container;
    }
  }

  // Tier 4: Container fingerprint matching controlType and heading text
  if (field.label && field.controlType) {
    const containers = Array.from(
      doc.querySelectorAll('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, [role="radiogroup"], [role="group"]'),
    );

    const matchingContainers = containers.filter((c) => {
      const heading = c.querySelector('[role="heading"], h1, h2, h3, h4, h5, h6, .M7eMe, legend, label');
      if (!heading) return false;
      const headingText = cleanLabelText(heading.textContent || '');
      return headingText === field.label;
    });

    if (matchingContainers.length === 1) {
      const c = matchingContainers[0];
      if (field.controlType === 'radio' || field.controlType === 'checkbox') return c;
      const inner = c.querySelector('input, select, textarea, [role="listbox"], [role="combobox"]');
      if (inner) return inner;
    }
  }

  // Tier 5: Accessible label resolution match
  // Crucial Rule: If multiple candidates match equally well, return null rather than guessing!
  const allCandidates = Array.from(
    doc.querySelectorAll('input, select, textarea, [role="listbox"], [role="combobox"], [role="radiogroup"], [role="group"]'),
  );

  const matchedCandidates = allCandidates.filter((el) => {
    if (isElementHidden(el)) return false;
    const resolved = resolveAccessibleLabel(el, el.parentElement, doc);
    return resolved.label === field.label;
  });

  if (matchedCandidates.length === 1) {
    return matchedCandidates[0];
  }

  // Ambiguous duplicates or not found -> return null
  return null;
}
