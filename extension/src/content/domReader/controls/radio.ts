import { FieldMetadata } from '@autofiller/shared';
import { isElementHidden } from '../utils.js';
import { resolveAccessibleLabel, isRequiredField, generateUniqueFieldId } from '../accessibility.js';
import { extractRadioOrCheckboxOptions } from '../optionParser.js';

/**
 * Scans document for radio groups, Google Forms radio questions, and linear scales.
 */
export function scanRadioGroups(
  doc: Document,
  questionContainers: Element[],
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const radioGroupsFound = new Set<Element>();
  const explicitRadiogroups = doc.querySelectorAll('[role="radiogroup"]');
  explicitRadiogroups.forEach((rg) => radioGroupsFound.add(rg));

  // Also discover question containers or fieldsets containing radio buttons
  questionContainers.forEach((container) => {
    if (container.getAttribute('role') === 'radiogroup') return;
    const radios = container.querySelectorAll('[role="radio"], input[type="radio"]');
    if (radios.length > 0) {
      radioGroupsFound.add(container);
    }
  });

  // Group radio inputs by name attribute if not in a container
  const allRadioInputs = Array.from(doc.querySelectorAll('input[type="radio"]'));
  const radiosByName = new Map<string, HTMLInputElement[]>();
  allRadioInputs.forEach((r) => {
    const name = r.getAttribute('name');
    if (name) {
      const list = radiosByName.get(name) || [];
      list.push(r);
      radiosByName.set(name, list);
    }
  });

  // Process all discovered radio groups
  radioGroupsFound.forEach((container) => {
    if (isElementHidden(container)) return;
    const radioNodes = Array.from(
      container.querySelectorAll('[role="radio"], input[type="radio"]'),
    ).filter((r) => !isElementHidden(r));

    if (radioNodes.length === 0) return;
    if (radioNodes.every((r) => processedElements.has(r))) return;

    radioNodes.forEach((r) => processedElements.add(r));
    processedElements.add(container);

    const firstRadio = radioNodes[0];
    const name =
      firstRadio.getAttribute('name') ||
      container.getAttribute('data-name') ||
      undefined;

    const baseId =
      name ||
      container.id ||
      firstRadio.id ||
      `radio-group-${fields.length + 1}`;

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
    const required = isRequiredField(container, questionContainer) || radioNodes.some((r) => isRequiredField(r));
    const options = extractRadioOrCheckboxOptions(radioNodes);

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      ariaLabel,
      type: 'radio',
      controlType: 'radio',
      selectionMode: 'single',
      options,
      required: required || undefined,
    });
  });

  // Process any un-grouped radio inputs sharing a name
  radiosByName.forEach((radios, name) => {
    const unprocessed = radios.filter((r) => !processedElements.has(r) && !isElementHidden(r));
    if (unprocessed.length === 0) return;

    unprocessed.forEach((r) => processedElements.add(r));
    const firstRadio = unprocessed[0];
    const parentContainer = firstRadio.closest('fieldset, form') || firstRadio.parentElement;

    const fieldId = generateUniqueFieldId(name, usedIds);
    if (parentContainer) {
      parentContainer.setAttribute('data-autofiller-id', fieldId);
    }

    const { label, ariaLabel } = resolveAccessibleLabel(firstRadio, parentContainer, doc);
    const required = unprocessed.some((r) => isRequiredField(r, parentContainer));
    const options = extractRadioOrCheckboxOptions(unprocessed);

    fields.push({
      id: fieldId,
      name,
      label: label || name,
      ariaLabel,
      type: 'radio',
      controlType: 'radio',
      selectionMode: 'single',
      options,
      required: required || undefined,
    });
  });
}
