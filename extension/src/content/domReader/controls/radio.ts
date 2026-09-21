import { FieldMetadata } from '@autofiller/shared';
import { isElementHidden } from '../utils.js';
import { resolveAccessibleLabel, isRequiredField, generateUniqueFieldId } from '../accessibility.js';
import { extractRadioOrCheckboxOptions } from '../optionParser.js';
import {
  getAllDOMRoots,
  querySelectorAllAcrossRoots,
  deepClosest,
  getShadowHost,
} from '../shadowDom.js';

/**
 * Scans document and any open shadow roots for radio groups, Google Forms radio questions, and linear scales.
 */
export function scanRadioGroups(
  docOrRoots: Document | (Document | ShadowRoot)[],
  questionContainers: Element[],
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const roots = Array.isArray(docOrRoots) ? docOrRoots : getAllDOMRoots(docOrRoots);
  const doc = Array.isArray(docOrRoots)
    ? ((roots.find((r) => r.nodeType === Node.DOCUMENT_NODE) as Document) || document)
    : docOrRoots;

  const radioGroupsFound = new Set<Element>();
  const explicitRadiogroups = querySelectorAllAcrossRoots(roots, '[role="radiogroup"], spl-radio-group');
  explicitRadiogroups.forEach((rg) => radioGroupsFound.add(rg));

  // Also discover question containers or fieldsets containing radio buttons
  questionContainers.forEach((container) => {
    if (container.getAttribute('role') === 'radiogroup') return;
    if (container.querySelector('.form-group, .form-row, .field, [role="radiogroup"], [role="listitem"]')) return;
    const containerRoots = getAllDOMRoots(container);
    const radios = querySelectorAllAcrossRoots(containerRoots, '[role="radio"], input[type="radio"], spl-radio');
    if (radios.length > 0) {
      radioGroupsFound.add(container);
    }
  });

  // Group radio inputs by name attribute if not in a container
  const allRadioInputs = querySelectorAllAcrossRoots<HTMLInputElement>(roots, 'input[type="radio"]');
  const radiosByName = new Map<string, HTMLInputElement[]>();
  allRadioInputs.forEach((r) => {
    const name = r.getAttribute('name') || r.getAttribute('formcontrolname');
    if (name) {
      const list = radiosByName.get(name) || [];
      list.push(r);
      radiosByName.set(name, list);
    }
  });

  // Process all discovered radio groups
  radioGroupsFound.forEach((container) => {
    if (isElementHidden(container)) return;
    const containerRoots = getAllDOMRoots(container);
    const radioNodes = querySelectorAllAcrossRoots(
      containerRoots,
      '[role="radio"], input[type="radio"], spl-radio',
    ).filter((r) => !isElementHidden(r));

    if (radioNodes.length === 0) return;
    if (radioNodes.every((r) => processedElements.has(r))) return;

    radioNodes.forEach((r) => processedElements.add(r));
    processedElements.add(container);

    const firstRadio = radioNodes[0];
    const shadowHost = getShadowHost(firstRadio);
    const name =
      firstRadio.getAttribute('name') ||
      firstRadio.getAttribute('formcontrolname') ||
      container.getAttribute('data-name') ||
      container.getAttribute('formcontrolname') ||
      (shadowHost && shadowHost.getAttribute('name')) ||
      undefined;

    const baseId =
      name ||
      container.id ||
      firstRadio.id ||
      `radio-group-${fields.length + 1}`;

    const fieldId = generateUniqueFieldId(baseId, usedIds);
    container.setAttribute('data-autofiller-id', fieldId);

    const questionContainer =
      deepClosest(container, '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, spl-form-field') ||
      container;

    // Mark companion "Other" text inputs inside this question as processed
    const otherInputs = querySelectorAllAcrossRoots(
      getAllDOMRoots(questionContainer),
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
    const parentContainer = deepClosest(firstRadio, 'fieldset, form, spl-form-field') || firstRadio.parentElement;

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
