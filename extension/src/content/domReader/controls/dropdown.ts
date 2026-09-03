import { FieldMetadata, FieldControlType, FieldOption, SelectionMode } from '@autofiller/shared';
import { isElementHidden } from '../utils.js';
import { resolveAccessibleLabel, isRequiredField, generateUniqueFieldId } from '../accessibility.js';
import { extractSelectOptions, extractAriaListboxOptions } from '../optionParser.js';

/**
 * Scans document for native <select>, ARIA listbox, and combobox dropdowns.
 */
export function scanDropdowns(
  doc: Document,
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const dropdownAndComboboxEls = Array.from(
    doc.querySelectorAll('select, [role="listbox"], [role="combobox"]'),
  );

  dropdownAndComboboxEls.forEach((el) => {
    if (processedElements.has(el) || isElementHidden(el)) return;
    processedElements.add(el);

    const container =
      el.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset') ||
      el.parentElement;

    const isCombobox = el.getAttribute('role') === 'combobox';
    const isNativeSelect = el.tagName.toLowerCase() === 'select';
    const isMultiSelectable =
      (isNativeSelect && (el as HTMLSelectElement).multiple) ||
      el.getAttribute('aria-multiselectable') === 'true';

    const selectionMode: SelectionMode = isMultiSelectable ? 'multiple' : 'single';
    const controlType: FieldControlType = isCombobox ? 'combobox' : 'dropdown';

    const name = el.getAttribute('name') || undefined;
    const baseId = name || el.id || `${controlType}-${fields.length + 1}`;
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
        const ownedEl = doc.getElementById(ownsId);
        if (ownedEl) {
          optionContainer = ownedEl;
          processedElements.add(ownedEl);
        }
      }
      if (isCombobox) {
        el.querySelectorAll('input, select, textarea').forEach((child) => processedElements.add(child));
      }
      let extracted = extractAriaListboxOptions(optionContainer);
      // Fallback: in Google Forms, the option popup menu is often a sibling inside the question container
      if (extracted.length === 0 && container) {
        extracted = extractAriaListboxOptions(container);
      }
      if (extracted.length > 0) {
        options = extracted;
      } else if (!isCombobox) {
        options = [];
      }
    }

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
      required: required || undefined,
    });
  });
}
