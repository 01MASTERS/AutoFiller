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
import {
  getAllDOMRoots,
  querySelectorAllAcrossRoots,
  deepClosest,
  deepGetElementById,
  isElementConnected,
} from './shadowDom.js';

export interface ExtractFormFieldsOptions {
  /**
   * Whether to include file upload inputs (<input type="file">).
   * By default false because browser security sandboxes disallow programmatic file setting.
   */
  includeFileInputs?: boolean;
}

/**
 * Main DOM extraction pipeline: orchestrates scanning across all control types,
 * open Shadow DOM roots, and ATS platforms (including Angular 20 and SmartRecruiters).
 */
export function extractFormFields(
  doc: Document = document,
  options: ExtractFormFieldsOptions = {},
): FieldMetadata[] {
  const fields: FieldMetadata[] = [];
  const processedElements = new Set<Element>();
  const usedIds = new Set<string>();

  // Discover all DOM roots (Document and all open ShadowRoot trees in visual flow order)
  const roots = getAllDOMRoots(doc);

  const platform = detectPlatform(doc);

  // Question container discovery (HTML fieldsets, Google Forms, ATS question wrappers, Web Components)
  const questionContainers = querySelectorAllAcrossRoots(
    roots,
    '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, [role="radiogroup"], [role="group"], .form-group, .form-row, .field, [data-automation-id*="formField"], [data-automation-id*="formItem"], .application-question, .section-candidate-wrapper, .postings-group, spl-form-field, [class*="spl-form-field"], .c-form-field, .form-field',
  );

  // STAGE 1: Radio Groups & Linear Scales
  scanRadioGroups(roots, questionContainers, fields, processedElements, usedIds);

  // STAGE 2: Checkbox Groups (Multi-select) & Standalone Checkboxes
  scanCheckboxGroups(roots, questionContainers, fields, processedElements, usedIds);

  // STAGE 3: Native <select>, role="listbox", role="combobox", and ATS select triggers
  scanDropdowns(roots, fields, processedElements, usedIds);

  // STAGE 4: Date Inputs (Multi-part and standalone)
  scanDateInputs(roots, fields, processedElements, usedIds);

  // STAGE 5: File Upload Inputs & Resume Dropzones (by default skipped due to browser security sandbox)
  if (options.includeFileInputs) {
    scanFileInputs(roots, fields, processedElements, usedIds);
  }

  // STAGE 6: Text, Textarea, Email, Tel & Other Inputs
  scanTextInputs(roots, fields, processedElements, usedIds);

  // Annotate platform on each extracted field
  fields.forEach((f) => {
    f.platform = platform;
  });

  // Apply platform-specific heuristics and adaptations
  applyPlatformAdapters(fields, doc, platform);

  // Sort extracted fields according to their live DOM document position across roots
  const allMarked = querySelectorAllAcrossRoots(roots, '[data-autofiller-id]');
  const orderMap = new Map<string, number>();
  let orderIndex = 0;
  for (const el of allMarked) {
    const id = el.getAttribute('data-autofiller-id');
    if (id && !orderMap.has(id)) {
      orderMap.set(id, orderIndex++);
    }
  }

  fields.sort((a, b) => {
    const idxA = orderMap.get(a.id) ?? 0;
    const idxB = orderMap.get(b.id) ?? 0;
    return idxA - idxB;
  });

  // STAGE 8: Link Cascading Field Dependencies (e.g. Country -> State)
  linkCascadingFields(fields);

  return fields;
}

/**
 * Post-scan pass to detect and establish cascading parent-child dependencies
 * between fields (e.g. Country -> State/Province, Region -> City).
 */
export function linkCascadingFields(fields: FieldMetadata[]): void {
  const PAIRINGS: Array<{
    parentRegex: RegExp;
    parentExcludeRegex?: RegExp;
    childRegex: RegExp;
    childExcludeRegex?: RegExp;
  }> = [
    {
      parentRegex: /\b(country|nation)\b/i,
      parentExcludeRegex: /\b(phone|mobile|dial|code|calling|tel)\b/i,
      childRegex: /\b(state|province|region|territory)\b/i,
    },
    {
      parentRegex: /\b(state|province|region)\b/i,
      childRegex: /\b(city|town|municipality|county)\b/i,
    },
    {
      parentRegex: /\b(department|division)\b/i,
      childRegex: /\b(sub-department|team|role|function)\b/i,
    },
    {
      parentRegex: /\b(category|industry)\b/i,
      childRegex: /\b(sub-category|specialization)\b/i,
    },
  ];

  for (const pair of PAIRINGS) {
    const parentField = fields.find((f) => {
      const text = `${f.label} ${f.name || ''} ${f.id}`;
      if (pair.parentExcludeRegex && pair.parentExcludeRegex.test(text)) return false;
      return pair.parentRegex.test(text);
    });

    if (!parentField) continue;

    const childField = fields.find((f) => {
      if (f.id === parentField.id) return false;
      const text = `${f.label} ${f.name || ''} ${f.id}`;
      if (pair.childExcludeRegex && pair.childExcludeRegex.test(text)) return false;
      return pair.childRegex.test(text);
    });

    if (!childField) continue;

    if (
      childField.controlType === 'dropdown' ||
      childField.controlType === 'combobox' ||
      childField.controlType === 'radio'
    ) {
      childField.optionSource = 'cascading';
      childField.parentFieldId = parentField.id;
    }
  }
}

/**
 * Re-associates a logical FieldMetadata with a live DOM element using a 6-tier confidence strategy,
 * with complete support for piercing Shadow DOM boundaries.
 */
export function findFieldElement(
  field: FieldMetadata,
  doc: Document = document,
): Element | null {
  const roots = getAllDOMRoots(doc);

  // Tier 1: data-autofiller-id if element is still connected to the DOM
  try {
    const escapedId = escapeCss(field.id);
    for (const r of roots) {
      const el = r.querySelector(`[data-autofiller-id="${escapedId}"]`);
      if (el && isElementConnected(el)) {
        return el;
      }
    }
  } catch {
    // Ignore CSS selector escape issues
  }

  // Tier 2: Stable native ID
  if (field.id) {
    const el = deepGetElementById(field.id, doc);
    if (el && isElementConnected(el)) return el;
  }

  // Tier 3: data-automation-id (Workday, SmartRecruiters, ATS portals)
  if (field.id) {
    try {
      const autoMatches = querySelectorAllAcrossRoots(roots, `[data-automation-id="${escapeCss(field.id)}"]`);
      for (const autoEl of autoMatches) {
        if (autoEl && isElementConnected(autoEl)) return autoEl;
      }
    } catch {
      // Ignore selector errors
    }
  }

  // Tier 4: Match by name / formControlName + controlType
  if (field.name) {
    const escapedName = escapeCss(field.name);
    const matches = querySelectorAllAcrossRoots(
      roots,
      `[name="${escapedName}"], [formcontrolname="${escapedName}"], [ng-reflect-name="${escapedName}"]`,
    );
    const typeMatches = matches.filter((el) => {
      if (field.controlType === 'radio' && (el.getAttribute('role') === 'radio' || (el as HTMLInputElement).type === 'radio' || el.tagName.toLowerCase() === 'spl-radio')) return true;
      if (field.controlType === 'checkbox' && (el.getAttribute('role') === 'checkbox' || (el as HTMLInputElement).type === 'checkbox' || el.tagName.toLowerCase() === 'spl-checkbox')) return true;
      if (field.controlType === 'dropdown' && (el.tagName.toLowerCase() === 'select' || el.getAttribute('role') === 'listbox' || el.tagName.toLowerCase() === 'spl-select')) return true;
      if (field.controlType === 'combobox' && (el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'listbox' || el.getAttribute('aria-haspopup') === 'listbox' || el.getAttribute('aria-haspopup') === 'true' || el.hasAttribute('aria-haspopup') || el.matches('[data-automation-id*="prompt"], [data-automation-id*="select"]'))) return true;
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
      const container =
        deepClosest(typeMatches[0], '[role="radiogroup"], [role="group"], fieldset, .form-group, spl-form-field') ||
        typeMatches[0].parentElement;
      if (container) return container;
    }
  }

  // Tier 5: Container fingerprint matching controlType and heading/label text
  if (field.label && field.controlType) {
    const containers = querySelectorAllAcrossRoots(
      roots,
      '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, [role="radiogroup"], [role="group"], .form-group, .field, [data-automation-id*="formField"], spl-form-field',
    );

    const matchingContainers = containers.filter((c) => {
      const heading = c.querySelector(
        '[role="heading"], h1, h2, h3, h4, h5, h6, .M7eMe, legend, label, .field-label, [data-automation-id*="label"], .spl-form-field__label',
      );
      if (!heading) return false;
      const headingText = cleanLabelText(heading.textContent || '');
      return headingText === field.label;
    });

    if (matchingContainers.length === 1) {
      const c = matchingContainers[0];
      if (field.controlType === 'radio' || field.controlType === 'checkbox') return c;
      const inner = c.querySelector(
        'input, select, textarea, [role="listbox"], [role="combobox"], button[aria-haspopup="listbox"], input[type="file"], spl-select, spl-input',
      );
      if (inner) return inner;
    }
  }

  // Tier 6: Accessible label resolution match
  const allCandidates = querySelectorAllAcrossRoots(
    roots,
    'input, select, textarea, [role="listbox"], [role="combobox"], [role="radiogroup"], [role="group"], button[aria-haspopup="listbox"], input[type="file"], spl-select, spl-input',
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
