import { cleanText } from './utils.js';
import {
  resolveUniversalLabel,
  sanitizeLabelText,
  isGenericSublabel,
} from './heuristics/labelResolver.js';

export { isGenericSublabel };

/**
 * Resolves accessible name for a control using the universal precedence cascade.
 */
export function resolveAccessibleLabel(
  controlEl: Element,
  container?: Element | null,
  doc: Document = document,
): { label: string; ariaLabel?: string; placeholder?: string } {
  const result = resolveUniversalLabel(controlEl, container, doc);
  return {
    label: result.label,
    ariaLabel: result.ariaLabel,
    placeholder: result.placeholder,
  };
}

/**
 * Resolves heading text directly from a container
 */
export function resolveHeadingText(container: Element): string {
  const heading = container.querySelector(
    '[role="heading"], h1, h2, h3, h4, h5, h6, .freebirdFormviewerViewItemsItemItemTitle, .M7eMe, .exportLabel, label, [data-automation-id*="label"], [data-automation-id*="Label"]',
  );
  if (!heading) return '';
  const clone = heading.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      '.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"], .v3p8nd, input, select, textarea, button',
    )
    .forEach((a) => a.remove());
  return sanitizeLabelText(clone.textContent || '');
}

/**
 * Checks if a question container or control is marked required
 */
export function isRequiredField(controlEl: Element, container?: Element | null): boolean {
  if (controlEl.hasAttribute('required')) return true;
  if ((controlEl as HTMLInputElement).required === true) return true;
  if (controlEl.getAttribute('aria-required') === 'true') return true;
  if (container) {
    if (container.getAttribute('aria-required') === 'true') return true;
    const asterisk = container.querySelector(
      '.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"], .v3p8nd, .required, [data-automation-id*="required"], [class*="required"]',
    );
    if (asterisk && cleanText(asterisk.textContent) !== '') return true;
  }
  return false;
}

/**
 * Generates a unique logical field ID and registers it
 */
export function generateUniqueFieldId(baseId: string, usedIds: Set<string>): string {
  let fieldId = baseId;
  let suffix = 1;
  while (usedIds.has(fieldId)) {
    suffix++;
    fieldId = `${baseId}-${suffix}`;
  }
  usedIds.add(fieldId);
  return fieldId;
}
