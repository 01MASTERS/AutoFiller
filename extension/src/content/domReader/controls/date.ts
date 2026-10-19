import { FieldMetadata } from '@autofiller/shared';
import { isElementHidden, cleanLabelText } from '../utils.js';
import {
  resolveAccessibleLabel,
  resolveHeadingText,
  isGenericSublabel,
  isRequiredField,
  generateUniqueFieldId,
} from '../accessibility.js';
import {
  getAllDOMRoots,
  querySelectorAllAcrossRoots,
  deepClosest,
  getShadowHost,
} from '../shadowDom.js';

/**
 * Scans document and any open shadow roots for multi-part (.exportDate) and standard single date inputs.
 */
export function scanDateInputs(
  docOrRoots: Document | (Document | ShadowRoot)[],
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const roots = Array.isArray(docOrRoots) ? docOrRoots : getAllDOMRoots(docOrRoots);
  const doc = Array.isArray(docOrRoots)
    ? ((roots.find((r) => r.nodeType === Node.DOCUMENT_NODE) as Document) || document)
    : docOrRoots;

  // 4a. Multi-part date groups (Google Forms .exportDate or container with Month/Day/Year inputs)
  const multiPartDateContainers = querySelectorAllAcrossRoots(
    roots,
    '.exportDate, .v3p8nd, [role="listitem"], spl-form-field',
  ).filter((container) => {
    const containerRoots = getAllDOMRoots(container);
    const inputs = querySelectorAllAcrossRoots<HTMLInputElement>(
      containerRoots,
      'input[type="text"], input:not([type])',
    );
    if (inputs.length < 2) return false;
    const labels = inputs.map((i) => (i.getAttribute('aria-label') || '').toLowerCase());
    const names = inputs.map((i) => (i.name || '').toLowerCase());
    const isGoogleDate = container.classList.contains('exportDate');
    const hasMonthDay =
      (labels.some((l) => l.includes('month')) && labels.some((l) => l.includes('day'))) ||
      (names.some((n) => n.includes('month')) && names.some((n) => n.includes('day')));
    return isGoogleDate || hasMonthDay;
  });

  multiPartDateContainers.forEach((container) => {
    const containerRoots = getAllDOMRoots(container);
    const inputs = querySelectorAllAcrossRoots<HTMLInputElement>(
      containerRoots,
      'input[type="text"], input:not([type])',
    );
    if (inputs.some((i) => processedElements.has(i))) return;

    inputs.forEach((i) => processedElements.add(i));

    const outerContainer =
      deepClosest(container, '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, spl-form-field') ||
      container;

    const firstName = inputs[0]?.name || '';
    const basePrefix = firstName.replace(/_(?:month|day|year)$/i, '');
    const baseId = basePrefix || container.id || `date-group-${fields.length + 1}`;
    const fieldId = generateUniqueFieldId(baseId, usedIds);

    container.setAttribute('data-autofiller-id', fieldId);
    inputs.forEach((input) => input.setAttribute('data-autofiller-id', fieldId));
    if (outerContainer !== container) {
      outerContainer.setAttribute('data-autofiller-id', fieldId);
    }

    // Resolve accessible label from question container heading
    const headingEl = outerContainer.querySelector(
      '[role="heading"], h1, h2, h3, h4, h5, h6, .freebirdFormviewerViewItemsItemItemTitle, .M7eMe, .exportLabel',
    );
    let label = '';
    if (headingEl) {
      const clone = headingEl.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"], .v3p8nd')
        .forEach((a) => a.remove());
      label = cleanLabelText(clone.textContent || '');
    }
    if (!label) {
      const resolved = resolveAccessibleLabel(outerContainer, outerContainer, doc);
      label = resolved.label;
    }
    const ariaLabel = outerContainer.getAttribute('aria-label') || undefined;
    const required = inputs.some((i) => isRequiredField(i, outerContainer));

    fields.push({
      id: fieldId,
      name: basePrefix || undefined,
      label: label || fieldId,
      ariaLabel,
      type: 'date',
      controlType: 'date',
      selectionMode: 'single',
      required: required || undefined,
    });
  });

  // 4b. Single/Standalone date inputs
  const dateCandidateEls = querySelectorAllAcrossRoots(
    roots,
    'input[type="date"], input[data-type="date"], .exportDate input, .v3p8nd input, spl-date-picker input',
  );

  dateCandidateEls.forEach((el) => {
    if (processedElements.has(el) || isElementHidden(el)) return;

    const inputEl = el as HTMLInputElement;
    const isDate =
      inputEl.type === 'date' ||
      inputEl.getAttribute('data-type') === 'date' ||
      deepClosest(inputEl, '.exportDate') !== null;

    if (!isDate) return;

    processedElements.add(el);
    const shadowHost = getShadowHost(el);
    const container =
      deepClosest(el, '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, spl-form-field, fieldset') ||
      shadowHost ||
      el.parentElement;

    const name = inputEl.name || inputEl.getAttribute('formcontrolname') || undefined;
    const baseId = name || inputEl.id || (shadowHost && shadowHost.id) || `date-${fields.length + 1}`;
    const fieldId = generateUniqueFieldId(baseId, usedIds);
    el.setAttribute('data-autofiller-id', fieldId);

    const { label: accessibleLabel, ariaLabel, placeholder } = resolveAccessibleLabel(
      inputEl,
      container,
      doc,
    );

    let label = container ? resolveHeadingText(container) : '';
    if (!label || isGenericSublabel(label)) {
      label = accessibleLabel;
    }
    if (!label) {
      label = fieldId;
    }

    const required = isRequiredField(inputEl, container);

    fields.push({
      id: fieldId,
      name,
      label,
      placeholder,
      ariaLabel,
      type: 'date',
      controlType: 'date',
      selectionMode: 'single',
      required: required || undefined,
    });
  });
}
