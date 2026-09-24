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
 * Scans document and any open shadow roots for checkbox groups, multi-select questions, and standalone checkboxes.
 */
export function scanCheckboxGroups(
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

  const checkboxGroupsFound = new Set<Element>();
  questionContainers.forEach((container) => {
    // In Google Forms, internal option wrappers or individual choice listitems inside .QrToBd
    // must never be treated as question containers.
    const parentQuestion = container.closest('.QrToBd, .freebirdFormviewerViewItemsItemItem');
    if (parentQuestion && container !== parentQuestion) {
      const isExplicitGroup = container.getAttribute('role') === 'group';
      const containerRoots = getAllDOMRoots(container);
      const innerCheckboxes = querySelectorAllAcrossRoots(
        containerRoots,
        '[role="checkbox"], input[type="checkbox"], spl-checkbox',
      ).filter((c) => !isElementHidden(c));
      // Only keep an element inside a Google Form question card if it is an explicit multi-checkbox group (e.g. grid row)
      if (!isExplicitGroup || innerCheckboxes.length <= 1) {
        return;
      }
    }

    // Only prune container if it contains child question containers that each have multiple checkboxes
    // (i.e. separate multi-checkbox subquestions inside a broad form wrapper).
    // Never prune for option-level listitems or single-checkbox wrappers!
    const childContainers = container.querySelectorAll(
      '.form-group, .form-row, .field, [role="group"], fieldset, spl-form-field',
    );
    const hasChildCheckboxGroup = Array.from(childContainers).some((child) => {
      if (child === container) return false;
      const childCheckboxes = querySelectorAllAcrossRoots(
        getAllDOMRoots(child),
        '[role="checkbox"], input[type="checkbox"], spl-checkbox',
      ).filter((c) => !isElementHidden(c));
      return childCheckboxes.length > 1;
    });
    if (hasChildCheckboxGroup) return;

    const containerRoots = getAllDOMRoots(container);
    const checkboxes = querySelectorAllAcrossRoots(containerRoots, '[role="checkbox"], input[type="checkbox"], spl-checkbox');
    if (checkboxes.length > 0) {
      checkboxGroupsFound.add(container);
    }
  });

  checkboxGroupsFound.forEach((container) => {
    if (isElementHidden(container)) return;
    const containerRoots = getAllDOMRoots(container);
    const checkboxNodes = querySelectorAllAcrossRoots(
      containerRoots,
      '[role="checkbox"], input[type="checkbox"], spl-checkbox',
    ).filter((c) => !isElementHidden(c));

    if (checkboxNodes.length === 0) return;
    if (checkboxNodes.every((c) => processedElements.has(c))) return;

    checkboxNodes.forEach((c) => processedElements.add(c));
    processedElements.add(container);

    const firstCheckbox = checkboxNodes[0];
    const shadowHost = getShadowHost(firstCheckbox);
    const name =
      firstCheckbox.getAttribute('name') ||
      firstCheckbox.getAttribute('formcontrolname') ||
      container.getAttribute('data-name') ||
      container.getAttribute('formcontrolname') ||
      (shadowHost && shadowHost.getAttribute('name')) ||
      undefined;

    const baseId =
      name ||
      container.id ||
      firstCheckbox.id ||
      `checkbox-group-${fields.length + 1}`;

    const fieldId = generateUniqueFieldId(baseId, usedIds);
    container.setAttribute('data-autofiller-id', fieldId);

    const questionContainer =
      container.matches('.QrToBd, .freebirdFormviewerViewItemsItemItem, fieldset, spl-form-field')
        ? container
        : (container.parentElement &&
            deepClosest(
              container.parentElement,
              '.QrToBd, .freebirdFormviewerViewItemsItemItem, fieldset, [role="listitem"], [role="group"], spl-form-field',
            )) ||
          container;

    // Mark companion "Other" text inputs inside this question as processed
    const otherInputs = querySelectorAllAcrossRoots(
      getAllDOMRoots(questionContainer),
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
  const standaloneCheckboxes = querySelectorAllAcrossRoots<HTMLInputElement>(
    roots,
    'input[type="checkbox"], [role="checkbox"], spl-checkbox',
  ).filter((cb) => !processedElements.has(cb) && !isElementHidden(cb));

  standaloneCheckboxes.forEach((cb) => {
    processedElements.add(cb);
    const shadowHost = getShadowHost(cb);
    const container =
      deepClosest(cb, 'label, .form-group, .field, fieldset, .form-check, spl-form-field, div') ||
      shadowHost ||
      cb.parentElement;
    const name =
      cb.getAttribute('name') ||
      cb.getAttribute('formcontrolname') ||
      (shadowHost && shadowHost.getAttribute('name')) ||
      undefined;
    const baseId = name || cb.id || (shadowHost && shadowHost.id) || `checkbox-${fields.length + 1}`;
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
