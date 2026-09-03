import { FieldMetadata } from '@autofiller/shared';
import { isElementHidden, cleanLabelText } from '../utils.js';
import {
  resolveAccessibleLabel,
  resolveHeadingText,
  isGenericSublabel,
  isRequiredField,
  generateUniqueFieldId,
} from '../accessibility.js';

/**
 * Scans document for multi-part (.exportDate) and standard single date inputs.
 */
export function scanDateInputs(
  doc: Document,
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  // 4a. Multi-part date groups (Google Forms .exportDate or container with Month/Day/Year inputs)
  const multiPartDateContainers = Array.from(
    doc.querySelectorAll('.exportDate, .v3p8nd, [role="listitem"]'),
  ).filter((container) => {
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'));
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
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'));
    if (inputs.some((i) => processedElements.has(i))) return;

    inputs.forEach((i) => processedElements.add(i));

    const outerContainer =
      container.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd') ||
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

  // 4b. Single/Standalone date inputs (including Google Forms date inputs inside .exportDate / .v3p8nd)
  const dateCandidateEls = Array.from(
    doc.querySelectorAll(
      'input[type="date"], input[data-type="date"], .exportDate input, .v3p8nd input',
    ),
  );

  dateCandidateEls.forEach((el) => {
    if (processedElements.has(el) || isElementHidden(el)) return;

    const inputEl = el as HTMLInputElement;
    const isDate =
      inputEl.type === 'date' ||
      inputEl.getAttribute('data-type') === 'date' ||
      inputEl.closest('.exportDate') !== null;

    if (!isDate) return;

    processedElements.add(el);
    const container =
      el.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd') ||
      el.parentElement;

    const name = inputEl.name || undefined;
    const baseId = name || inputEl.id || `date-${fields.length + 1}`;
    const fieldId = generateUniqueFieldId(baseId, usedIds);
    el.setAttribute('data-autofiller-id', fieldId);

    const { label: accessibleLabel, ariaLabel, placeholder } = resolveAccessibleLabel(
      inputEl,
      container,
      doc,
    );

    // In Google Forms, date inputs typically have a sublabel "Date" (e.g. .v3p8nd) or aria-label="Date"
    // while the true question title (e.g. "Joining Date") sits on the container heading.
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
