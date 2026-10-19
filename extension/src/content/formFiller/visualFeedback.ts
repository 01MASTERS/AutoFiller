/**
 * @file visualFeedback.ts
 * Non-intrusive green glow visual confirmation overlay across varied CSS frameworks.
 */

import { escapeCss } from './events.js';

/**
 * Resolves the best visible element to receive visual feedback.
 * If the target element is hidden (e.g. opacity: 0, display: none, type="hidden"), resolves its associated
 * label or parent container.
 */
export function resolveVisibleTarget(el: HTMLElement): HTMLElement {
  const style = el.style;
  const isExplicitlyHidden =
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    el.hasAttribute('hidden') ||
    el.classList.contains('sr-only') ||
    el.classList.contains('visually-hidden') ||
    (el.tagName.toLowerCase() === 'input' && (el as HTMLInputElement).type === 'hidden');

  if (!isExplicitlyHidden) return el;

  // 1. Associated <label for="...">
  const id = el.id;
  if (id && el.ownerDocument) {
    try {
      const label = el.ownerDocument.querySelector<HTMLElement>(`label[for="${escapeCss(id)}"]`);
      if (label && label.style.display !== 'none') return label;
    } catch {}
  }

  // 2. Parent <label>
  const parentLabel = el.closest('label');
  if (parentLabel && parentLabel.style.display !== 'none') return parentLabel;

  // 3. Closest visible form group or container
  const container = el.closest<HTMLElement>(
    '.form-group, .field, [data-automation-id*="formField"], [data-automation-id*="formItem"], [role="radiogroup"], [role="group"], .lever-field, .application-question, fieldset, .freebirdFormviewerViewItemsItemItem, .QrToBd',
  );
  if (container && container.style.display !== 'none') return container;

  return el;
}

/**
 * Applies a temporary non-intrusive green-outline & glow visual feedback to a filled element.
 * Restores original styles after 2000ms.
 */
export function applyVisualFeedback(el: HTMLElement): void {
  const target = resolveVisibleTarget(el);

  const originalOutline = target.style.outline;
  const originalTransition = target.style.transition;
  const originalBoxShadow = target.style.boxShadow;

  target.style.outline = '2px solid #22c55e';
  target.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.6), 0 0 8px rgba(34, 197, 94, 0.35)';
  target.style.transition = 'outline 0.3s ease, box-shadow 0.3s ease';

  setTimeout(() => {
    target.style.outline = originalOutline;
    target.style.boxShadow = originalBoxShadow;
    target.style.transition = originalTransition;
  }, 2000);
}
