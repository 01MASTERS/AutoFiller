import { FieldMetadata } from '@autofiller/shared';
import { escapeCss, cleanLabelText, isElementHidden } from './utils.js';
import { resolveAccessibleLabel } from './accessibility.js';
import { detectPlatform } from './heuristics/platformDetector.js';
import { scanRadioGroups } from './controls/radio.js';
import { scanCheckboxGroups } from './controls/checkbox.js';
import { scanDropdowns } from './controls/dropdown.js';
import { scanDateInputs } from './controls/date.js';
import { scanFileInputs } from './controls/file.js';
import { scanTextInputs } from './controls/text.js';
import { applyPlatformAdapters } from './adapters/index.js';

export interface ExtractFormFieldsOptions {
  /**
   * Whether to include file upload inputs (<input type="file">).
   * By default false because browser security sandboxes disallow programmatic file setting.
   */
  includeFileInputs?: boolean;
}

/**
 * Main DOM extraction pipeline: orchestrates scanning across all control types and platforms.
 */
export function extractFormFields(
  doc: Document = document,
  options: ExtractFormFieldsOptions = {},
): FieldMetadata[] {
  const fields: FieldMetadata[] = [];
  const processedElements = new Set<Element>();
  const usedIds = new Set<string>();

  const platform = detectPlatform(doc);

  // Question container discovery (HTML fieldsets, Google Forms items, ARIA groups, ATS question wrappers)
  const questionContainers = Array.from(
    doc.querySelectorAll(
      '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, [role="radiogroup"], [role="group"], .form-group, .form-row, .field, [data-automation-id*="formField"], [data-automation-id*="formItem"], .application-question, .section-candidate-wrapper, .postings-group',
    ),
  );

  // STAGE 1: Radio Groups & Linear Scales
  scanRadioGroups(doc, questionContainers, fields, processedElements, usedIds);

  // STAGE 2: Checkbox Groups (Multi-select) & Standalone Checkboxes
  scanCheckboxGroups(doc, questionContainers, fields, processedElements, usedIds);

  // STAGE 3: Native <select>, role="listbox", role="combobox", and ATS select triggers
  scanDropdowns(doc, fields, processedElements, usedIds);

  // STAGE 4: Date Inputs (Multi-part and standalone)
  scanDateInputs(doc, fields, processedElements, usedIds);

  // STAGE 5: File Upload Inputs & Resume Dropzones (by default skipped due to browser security sandbox)
  if (options.includeFileInputs) {
    scanFileInputs(doc, fields, processedElements, usedIds);
  }

  // STAGE 6: Text, Textarea, Email, Tel & Other Inputs
  scanTextInputs(doc, fields, processedElements, usedIds);

  // Annotate platform on each extracted field
  fields.forEach((f) => {
    f.platform = platform;
  });

  // Apply platform-specific heuristics and adaptations
  applyPlatformAdapters(fields, doc, platform);

  // Sort extracted fields according to their live DOM document position
  const elementMap = new Map<string, Element>();
  doc.querySelectorAll('[data-autofiller-id]').forEach((el) => {
    const id = el.getAttribute('data-autofiller-id');
    if (id && !elementMap.has(id)) {
      elementMap.set(id, el);
    }
  });

  fields.sort((a, b) => {
    const elA = elementMap.get(a.id);
    const elB = elementMap.get(b.id);
    if (!elA || !elB) return 0;
    const pos = elA.compareDocumentPosition(elB);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

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

  // Tier 3: data-automation-id (Workday, ATS portals)
  if (field.id) {
    try {
      const autoEl = doc.querySelector(`[data-automation-id="${escapeCss(field.id)}"]`);
      if (autoEl && doc.contains(autoEl)) return autoEl;
    } catch {
      // Ignore selector errors
    }
  }

  // Tier 4: Match by name + controlType
  if (field.name) {
    const matches = Array.from(doc.querySelectorAll(`[name="${escapeCss(field.name)}"]`));
    const typeMatches = matches.filter((el) => {
      if (field.controlType === 'radio' && (el.getAttribute('role') === 'radio' || (el as HTMLInputElement).type === 'radio')) return true;
      if (field.controlType === 'checkbox' && (el.getAttribute('role') === 'checkbox' || (el as HTMLInputElement).type === 'checkbox')) return true;
      if (field.controlType === 'dropdown' && (el.tagName.toLowerCase() === 'select' || el.getAttribute('role') === 'listbox')) return true;
      if (field.controlType === 'combobox' && (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox')) return true;
      if (field.controlType === 'file' && (el as HTMLInputElement).type === 'file') return true;
      if (field.controlType === 'textarea' && el.tagName.toLowerCase() === 'textarea') return true;
      if (field.controlType === 'text' && el.tagName.toLowerCase() === 'input') return true;
      return false;
    });

    if (typeMatches.length === 1) {
      return typeMatches[0];
    }
    // If multiple radio/checkbox inputs share name, return their common grouping container
    if (typeMatches.length > 1 && (field.controlType === 'radio' || field.controlType === 'checkbox')) {
      const container = typeMatches[0].closest('[role="radiogroup"], [role="group"], fieldset, .form-group') || typeMatches[0].parentElement;
      if (container) return container;
    }
  }

  // Tier 5: Container fingerprint matching controlType and heading/label text
  if (field.label && field.controlType) {
    const containers = Array.from(
      doc.querySelectorAll(
        '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, [role="radiogroup"], [role="group"], .form-group, .field, [data-automation-id*="formField"]',
      ),
    );

    const matchingContainers = containers.filter((c) => {
      const heading = c.querySelector(
        '[role="heading"], h1, h2, h3, h4, h5, h6, .M7eMe, legend, label, .field-label, [data-automation-id*="label"]',
      );
      if (!heading) return false;
      const headingText = cleanLabelText(heading.textContent || '');
      return headingText === field.label;
    });

    if (matchingContainers.length === 1) {
      const c = matchingContainers[0];
      if (field.controlType === 'radio' || field.controlType === 'checkbox') return c;
      const inner = c.querySelector(
        'input, select, textarea, [role="listbox"], [role="combobox"], button[aria-haspopup="listbox"], input[type="file"]',
      );
      if (inner) return inner;
    }
  }

  // Tier 6: Accessible label resolution match
  const allCandidates = Array.from(
    doc.querySelectorAll(
      'input, select, textarea, [role="listbox"], [role="combobox"], [role="radiogroup"], [role="group"], button[aria-haspopup="listbox"], input[type="file"]',
    ),
  );

  const matchedCandidates = allCandidates.filter((el) => {
    if (isElementHidden(el)) return false;
    const resolved = resolveAccessibleLabel(el, el.parentElement, doc);
    return resolved.label === field.label;
  });

  if (matchedCandidates.length === 1) {
    return matchedCandidates[0];
  }

  return null;
}
