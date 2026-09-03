import { FieldOption } from '@autofiller/shared';
import { cleanText, escapeCss, isElementHidden, isPlaceholderOption } from './utils.js';

/**
 * Extracts options from a native HTML <select> element
 */
export function extractSelectOptions(selectEl: HTMLSelectElement): FieldOption[] {
  const options: FieldOption[] = [];
  Array.from(selectEl.options).forEach((opt) => {
    const label = cleanText(opt.text);
    if (!label) return;

    const hasValueAttr = opt.hasAttribute('value');
    const value = hasValueAttr ? opt.value : undefined;
    const selected = opt.selected;
    const disabled = opt.disabled;

    if (isPlaceholderOption(label, value, disabled, selected)) {
      return;
    }

    options.push({
      label,
      value,
      selected: selected || undefined,
      disabled: disabled || undefined,
    });
  });
  return options;
}

/**
 * Extracts options from ARIA listbox or combobox options
 */
export function extractAriaListboxOptions(container: Element): FieldOption[] {
  const options: FieldOption[] = [];
  const optionEls = container.querySelectorAll(
    '[role="option"], .quantumWizMenuPaperselectOption',
  );

  optionEls.forEach((optEl) => {
    // Note: Do not skip options based on isElementHidden because dropdown option menus
    // are typically hidden (display: none) when the dropdown is collapsed/closed.
    const label = cleanText(optEl.textContent);
    if (!label) return;

    const value =
      optEl.getAttribute('data-value') ||
      optEl.getAttribute('value') ||
      undefined;

    const selected =
      optEl.getAttribute('aria-selected') === 'true' ||
      optEl.classList.contains('isSelected') ||
      optEl.classList.contains('active');

    const disabled =
      optEl.getAttribute('aria-disabled') === 'true' ||
      optEl.hasAttribute('disabled');

    if (isPlaceholderOption(label, value, disabled, selected)) {
      return;
    }

    // Tag option element for execution targeting
    optEl.setAttribute('data-autofiller-option', value || label);

    options.push({
      label,
      value,
      selected: selected || undefined,
      disabled: disabled || undefined,
    });
  });

  return options;
}

/**
 * Resolves the display label for an option element inside a radio or checkbox group
 */
export function resolveOptionLabel(optionEl: Element): string {
  // If the option element itself has direct/nested text content and is not an <input>
  if (optionEl.tagName.toLowerCase() !== 'input') {
    const directText = cleanText(optionEl.textContent);
    if (directText) {
      return directText;
    }
  }

  // Check adjacent label
  if (optionEl.id) {
    const labelFor = optionEl.ownerDocument?.querySelector(`label[for="${escapeCss(optionEl.id)}"]`);
    if (labelFor && cleanText(labelFor.textContent)) {
      return cleanText(labelFor.textContent);
    }
  }

  // Check parent wrapping label
  const parentLabel = optionEl.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input').forEach((i) => i.remove());
    if (cleanText(clone.textContent)) {
      return cleanText(clone.textContent);
    }
  }

  // Check Google Forms / generic text container
  const parentWrapper =
    optionEl.closest('.docssharedWizToggleLabeledLabelWrapper, .freebirdFormviewerViewItemsRadioChoice, .freebirdFormviewerViewItemsCheckboxChoice') ||
    optionEl.parentElement;

  if (parentWrapper) {
    const textNode = parentWrapper.querySelector(
      '.docssharedWizToggleLabeledLabelText, .aDTYNe, .ulDsOb, .M7eMe, label, span',
    );
    if (textNode && textNode !== optionEl && cleanText(textNode.textContent)) {
      return cleanText(textNode.textContent);
    }
  }

  // Check aria-label
  const ariaLabel = optionEl.getAttribute('aria-label');
  if (ariaLabel && cleanText(ariaLabel)) {
    return cleanText(ariaLabel);
  }

  // Check text content of element itself
  return cleanText(optionEl.textContent);
}

/**
 * Extracts options from radio or checkbox elements
 */
export function extractRadioOrCheckboxOptions(elements: Element[]): FieldOption[] {
  const options: FieldOption[] = [];
  const seenLabels = new Set<string>();

  elements.forEach((el) => {
    if (isElementHidden(el)) return;

    const label = resolveOptionLabel(el);
    if (!label) return;

    const value = el.getAttribute('value') || el.getAttribute('data-value') || undefined;
    const selected =
      (el as HTMLInputElement).checked ||
      el.getAttribute('aria-checked') === 'true' ||
      el.getAttribute('aria-selected') === 'true';
    const disabled =
      (el as HTMLInputElement).disabled ||
      el.getAttribute('aria-disabled') === 'true';

    // Tag option element for execution targeting
    el.setAttribute('data-autofiller-option', value || label);

    if (seenLabels.has(label)) return;
    seenLabels.add(label);

    options.push({
      label,
      value,
      selected: selected || undefined,
      disabled: disabled || undefined,
    });
  });

  return options;
}
