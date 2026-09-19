import { FieldMetadata } from '@autofiller/shared';
import { isElementHidden } from '../utils.js';
import { resolveAccessibleLabel, isRequiredField, generateUniqueFieldId } from '../accessibility.js';
import { extractRadioOrCheckboxOptions } from '../optionParser.js';

/**
 * Scans document for checkbox groups, multi-select questions, and standalone checkboxes.
 */
export function scanCheckboxGroups(
  doc: Document,
  questionContainers: Element[],
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const checkboxGroupsFound = new Set<Element>();
  questionContainers.forEach((container) => {
    // If container contains nested child question containers, let the leaf containers be the unit
    if (container.querySelector('.form-group, .form-row, .field, [role="group"], [role="listitem"]')) return;
    // Tightened role="group": Only consider as checkbox group if it contains checkbox semantics
    const checkboxes = container.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
    if (checkboxes.length > 0) {
      checkboxGroupsFound.add(container);
    }
  });

  checkboxGroupsFound.forEach((container) => {
    if (isElementHidden(container)) return;
    const checkboxNodes = Array.from(
      container.querySelectorAll('[role="checkbox"], input[type="checkbox"]'),
    ).filter((c) => !isElementHidden(c));

    if (checkboxNodes.length === 0) return;
    if (checkboxNodes.every((c) => processedElements.has(c))) return;

    checkboxNodes.forEach((c) => processedElements.add(c));
    processedElements.add(container);

    const firstCheckbox = checkboxNodes[0];
    const name =
      firstCheckbox.getAttribute('name') ||
      container.getAttribute('data-name') ||
      undefined;

    const baseId =
      name ||
      container.id ||
      firstCheckbox.id ||
      `checkbox-group-${fields.length + 1}`;

    const fieldId = generateUniqueFieldId(baseId, usedIds);
    container.setAttribute('data-autofiller-id', fieldId);

    const questionContainer =
      container.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset') ||
      container;

    // Mark companion "Other" text inputs inside this question as processed
    const otherInputs = questionContainer.querySelectorAll(
      'input[aria-label*="Other" i], input.Hvn9fb, input[name*="other_option_response"]',
    );
    otherInputs.forEach((inp) => processedElements.add(inp));

    const { label, ariaLabel } = resolveAccessibleLabel(container, questionContainer, doc);
    const required = isRequiredField(container, questionContainer) || checkboxNodes.some((c) => isRequiredField(c));
    const options = extractRadioOrCheckboxOptions(checkboxNodes);

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      ariaLabel,
      type: 'checkbox',
      controlType: 'checkbox',
      selectionMode: checkboxNodes.length > 1 ? 'multiple' : 'single',
      options,
      required: required || undefined,
    });
  });

  // Standalone checkboxes (e.g. single consent, authorization, terms)
  const standaloneCheckboxes = Array.from(
    doc.querySelectorAll<HTMLInputElement>('input[type="checkbox"], [role="checkbox"]'),
  ).filter((cb) => !processedElements.has(cb) && !isElementHidden(cb));

  standaloneCheckboxes.forEach((cb) => {
    processedElements.add(cb);
    const container =
      cb.closest('label, .form-group, .field, fieldset, .form-check, div') || cb.parentElement;
    const name = cb.getAttribute('name') || undefined;
    const baseId = name || cb.id || `checkbox-${fields.length + 1}`;
    const fieldId = generateUniqueFieldId(baseId, usedIds);
    cb.setAttribute('data-autofiller-id', fieldId);

    const { label, ariaLabel } = resolveAccessibleLabel(cb, container, doc);
    const required = isRequiredField(cb, container);

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      ariaLabel,
      type: 'checkbox',
      controlType: 'checkbox',
      selectionMode: 'single',
      required: required || undefined,
    });
  });
}
