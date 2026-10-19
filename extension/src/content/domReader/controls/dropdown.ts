import { FieldMetadata, FieldControlType, FieldOption, SelectionMode } from '@autofiller/shared';
import { isElementHidden } from '../utils.js';
import { resolveAccessibleLabel, isRequiredField, generateUniqueFieldId } from '../accessibility.js';
import { extractSelectOptions, extractAriaListboxOptions, detectOptionSource } from '../optionParser.js';
import {
  getAllDOMRoots,
  querySelectorAllAcrossRoots,
  deepClosest,
  deepGetElementById,
  getShadowHost,
} from '../shadowDom.js';

/**
 * Scans document and any open shadow roots for native <select>, ARIA listbox, combobox dropdowns, and custom ATS select triggers.
 */
export function scanDropdowns(
  docOrRoots: Document | (Document | ShadowRoot)[],
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const roots = Array.isArray(docOrRoots) ? docOrRoots : getAllDOMRoots(docOrRoots);
  const doc = Array.isArray(docOrRoots)
    ? ((roots.find((r) => r.nodeType === Node.DOCUMENT_NODE) as Document) || document)
    : docOrRoots;

  const dropdownAndComboboxEls = querySelectorAllAcrossRoots(
    roots,
    'select, [role="listbox"], [role="combobox"], button[aria-haspopup], button[data-automation-id*="prompt"], button[data-automation-id*="select"], button[data-automation-id*="dropdown"], input[role="combobox"], input[data-automation-id*="prompt"], spl-select, [class*="spl-select"]',
  );

  dropdownAndComboboxEls.forEach((el) => {
    if (processedElements.has(el) || isElementHidden(el)) return;

    // Reject non-interactive internal elements of prompt / select widgets:
    // options, option text, pills, clear buttons, selection labels, selected item lists
    if (
      el.matches(
        '[role="option"], [data-automation-id*="promptOption"], [data-automation-id*="pill"], [data-automation-id*="selectedItem"], [data-automation-id*="SelectionLabel"], [data-automation-id*="promptLabel"], [data-automation-id*="selected-value"], [data-automation-id*="selectedValue"], li, span, ul',
      ) ||
      el.closest(
        '[role="option"], [data-automation-id*="promptOption"], [data-automation-id*="pill"], [data-automation-id*="selectedItemList"]',
      )
    ) {
      return;
    }

    // Reject outer wrapper containers if an inner interactive control exists
    const tagName = el.tagName.toLowerCase();
    if (tagName !== 'select' && tagName !== 'button' && tagName !== 'input') {
      const innerInteractive = el.querySelector(
        'select, input[role="combobox"], input[data-automation-id*="prompt"], button[aria-haspopup], button[data-automation-id*="prompt"], button[data-automation-id*="select"], button[data-automation-id*="dropdown"]',
      );
      if (innerInteractive) {
        return;
      }
    }

    processedElements.add(el);

    const shadowHost = getShadowHost(el);
    const container =
      deepClosest(
        el,
        '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, .form-group, .field, [data-automation-id*="formField"], [data-automation-id*="formItem"], .application-question, spl-form-field, [class*="spl-form-field"], .c-form-field, .form-field',
      ) || shadowHost || el.parentElement;

    if (container) {
      container
        .querySelectorAll(
          '[data-automation-id*="prompt"], [data-automation-id*="select"], [data-automation-id*="pill"], [data-automation-id*="selectedItem"]',
        )
        .forEach((companion) => {
          if (companion !== el) {
            processedElements.add(companion);
          }
        });
    }

    const role = el.getAttribute('role');
    const isCombobox = role === 'combobox';
    const isNativeSelect = el.tagName.toLowerCase() === 'select';
    const isMultiSelectable =
      (isNativeSelect && (el as HTMLSelectElement).multiple) ||
      el.getAttribute('aria-multiselectable') === 'true';

    const selectionMode: SelectionMode = isMultiSelectable ? 'multiple' : 'single';
    const controlType: FieldControlType = isCombobox ? 'combobox' : 'dropdown';

    const name =
      el.getAttribute('name') ||
      el.getAttribute('formcontrolname') ||
      el.getAttribute('ng-reflect-name') ||
      (shadowHost && (shadowHost.getAttribute('name') || shadowHost.getAttribute('formcontrolname'))) ||
      undefined;

    const baseId =
      name ||
      el.id ||
      (shadowHost && shadowHost.id) ||
      el.getAttribute('data-automation-id') ||
      (shadowHost && shadowHost.getAttribute('data-automation-id')) ||
      `${controlType}-${fields.length + 1}`;

    const fieldId = generateUniqueFieldId(baseId, usedIds);
    el.setAttribute('data-autofiller-id', fieldId);

    const { label, ariaLabel, placeholder } = resolveAccessibleLabel(el, container, doc);
    const required = isRequiredField(el, container);

    // Extract options if present
    let options: FieldOption[] | undefined;
    if (isNativeSelect) {
      options = extractSelectOptions(el as HTMLSelectElement);
    } else {
      const ownsId = el.getAttribute('aria-owns') || el.getAttribute('aria-controls');
      let optionContainer: Element = el;
      if (ownsId) {
        const ownedEl = deepGetElementById(ownsId, doc);
        if (ownedEl) {
          optionContainer = ownedEl;
          processedElements.add(ownedEl);
        }
      }
      if (isCombobox) {
        el.querySelectorAll('input, select, textarea').forEach((child) => processedElements.add(child));
      }
      let extracted = extractAriaListboxOptions(optionContainer);
      // Fallback: in Google Forms, SmartRecruiters, or complex ATS, the option popup menu is often a sibling inside the question container
      if (extracted.length === 0 && container) {
        extracted = extractAriaListboxOptions(container);
      }
      if (extracted.length > 0) {
        options = extracted;
      } else if (!isCombobox) {
        options = [];
      }
    }

    const { optionSource, optionsLoaded, dynamicState } = detectOptionSource(el, options, container);

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      placeholder,
      ariaLabel,
      type: controlType,
      controlType,
      selectionMode,
      options,
      optionSource,
      optionsLoaded,
      dynamicState,
      required: required || undefined,
    });
  });
}
