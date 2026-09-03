import { FieldMetadata, FieldControlType } from '@autofiller/shared';
import { isElementHidden } from '../utils.js';
import { resolveAccessibleLabel, isRequiredField, generateUniqueFieldId } from '../accessibility.js';

/**
 * Scans document for text inputs, textareas, email, tel, number, and other inputs.
 */
export function scanTextInputs(
  doc: Document,
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const textInputEls = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="password"], input[type="url"], input:not([type]), textarea',
    ),
  );

  textInputEls.forEach((inputEl) => {
    if (processedElements.has(inputEl) || isElementHidden(inputEl)) return;

    // Skip companion text inputs for radio/checkbox "Other" options (e.g. Google Forms aria-label="Other response")
    const isOtherCompanion =
      Boolean(inputEl.getAttribute('aria-label')?.toLowerCase().includes('other response')) ||
      inputEl.classList.contains('Hvn9fb') ||
      Boolean(inputEl.name?.includes('other_option_response')) ||
      inputEl.closest('[role="radio"], [role="checkbox"], .docssharedWizToggleLabeledContainer') !== null ||
      Boolean(inputEl.closest('[role="listitem"], .QrToBd')?.querySelector('[role="radio"], [role="checkbox"]'));
    if (isOtherCompanion) {
      processedElements.add(inputEl);
      return;
    }

    processedElements.add(inputEl);

    const container =
      inputEl.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd') ||
      inputEl.parentElement;

    const isTextarea = inputEl.tagName.toLowerCase() === 'textarea';
    const controlType: FieldControlType = isTextarea ? 'textarea' : 'text';

    const name = inputEl.name || undefined;
    const baseId = name || inputEl.id || `field-${fields.length + 1}`;
    const fieldId = generateUniqueFieldId(baseId, usedIds);
    inputEl.setAttribute('data-autofiller-id', fieldId);

    const { label, ariaLabel, placeholder } = resolveAccessibleLabel(inputEl, container, doc);
    const required = isRequiredField(inputEl, container);
    const inputType = isTextarea ? 'textarea' : inputEl.type || 'text';

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      placeholder,
      ariaLabel,
      type: inputType,
      controlType,
      selectionMode: 'single',
      required: required || undefined,
    });
  });
}
