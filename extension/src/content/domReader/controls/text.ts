import { FieldMetadata, FieldControlType } from '@autofiller/shared';
import { isElementHidden } from '../utils.js';
import { resolveAccessibleLabel, isRequiredField, generateUniqueFieldId } from '../accessibility.js';
import {
  getAllDOMRoots,
  querySelectorAllAcrossRoots,
  deepClosest,
  getShadowHost,
} from '../shadowDom.js';

/**
 * Scans document and any open shadow roots for text inputs, textareas, email, tel, number, and other text-like inputs.
 */
export function scanTextInputs(
  docOrRoots: Document | (Document | ShadowRoot)[],
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const roots = Array.isArray(docOrRoots) ? docOrRoots : getAllDOMRoots(docOrRoots);
  const doc = Array.isArray(docOrRoots)
    ? ((roots.find((r) => r.nodeType === Node.DOCUMENT_NODE) as Document) || document)
    : docOrRoots;

  const textInputEls = querySelectorAllAcrossRoots<HTMLInputElement | HTMLTextAreaElement>(
    roots,
    'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="password"], input[type="url"], input:not([type]), textarea, [data-automation-id="textInput"], [data-automation-id*="input"], spl-input input, spl-textarea textarea',
  );

  textInputEls.forEach((inputEl) => {
    if (processedElements.has(inputEl) || isElementHidden(inputEl)) return;

    // Filter out site search inputs outside forms
    if (
      (inputEl.getAttribute('type') === 'search' || inputEl.getAttribute('role') === 'searchbox') &&
      !deepClosest(inputEl, 'form, [role="form"], [data-automation-id*="application"], spl-job-application, smart-apply-form')
    ) {
      processedElements.add(inputEl);
      return;
    }

    // Skip companion text inputs for radio/checkbox "Other" options (e.g. Google Forms aria-label="Other response")
    const isOtherCompanion =
      Boolean(inputEl.getAttribute('aria-label')?.toLowerCase().includes('other response')) ||
      inputEl.classList.contains('Hvn9fb') ||
      Boolean(inputEl.name?.includes('other_option_response')) ||
      inputEl.closest('[role="radio"], [role="checkbox"], .docssharedWizToggleLabeledContainer') !== null ||
      Boolean(deepClosest(inputEl, '[role="listitem"], .QrToBd')?.querySelector('[role="radio"], [role="checkbox"]'));
    if (isOtherCompanion) {
      processedElements.add(inputEl);
      return;
    }

    processedElements.add(inputEl);

    const shadowHost = getShadowHost(inputEl);
    const container =
      deepClosest(
        inputEl,
        '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, .form-group, .field, [data-automation-id*="formField"], [data-automation-id*="formItem"], .application-question, .form-row, spl-form-field, [class*="spl-form-field"], .c-form-field, .form-field',
      ) || shadowHost || inputEl.parentElement;

    const isTextarea = inputEl.tagName.toLowerCase() === 'textarea';
    const controlType: FieldControlType = isTextarea ? 'textarea' : 'text';

    const name =
      inputEl.name ||
      inputEl.getAttribute('formcontrolname') ||
      inputEl.getAttribute('ng-reflect-name') ||
      (shadowHost && shadowHost.getAttribute('name')) ||
      (shadowHost && shadowHost.getAttribute('formcontrolname')) ||
      (container instanceof Element ? container.getAttribute('name') || container.getAttribute('formcontrolname') : undefined) ||
      undefined;

    const baseId =
      name ||
      inputEl.id ||
      (shadowHost && shadowHost.id) ||
      (container instanceof Element ? container.id : undefined) ||
      inputEl.getAttribute('data-automation-id') ||
      (shadowHost && shadowHost.getAttribute('data-automation-id')) ||
      `field-${fields.length + 1}`;

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
