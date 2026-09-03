import { FieldMetadata } from '@autofiller/shared';
import { isElementHidden } from '../utils.js';
import { resolveAccessibleLabel, isRequiredField, generateUniqueFieldId } from '../accessibility.js';
import { extractRadioOrCheckboxOptions } from '../optionParser.js';

/**
 * Scans document for checkbox groups and multi-select options.
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
      selectionMode: 'multiple',
      options,
      required: required || undefined,
    });
  });
}
