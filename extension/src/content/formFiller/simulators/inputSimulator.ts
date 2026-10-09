/**
 * @file inputSimulator.ts
 * Universal native text, textarea, and rich text (contenteditable) simulator.
 */

import { dispatchFullInputSequence, dispatchFormEvents } from '../events.js';
import { applyVisualFeedback } from '../visualFeedback.js';

/**
 * Fills a text input, textarea, or contenteditable editor with complete event dispatch.
 * Bypasses framework setters using prototype property descriptors and triggers full focus/input/change/blur cycle.
 */
export function fillTextInput(target: HTMLElement, value: string, doc: Document): boolean {
  // 1. If target is a wrapper container (e.g. Workday [data-automation-id="textInput"] or custom div), find inner input
  let effectiveTarget = target;
  if (
    target.tagName.toLowerCase() !== 'input' &&
    target.tagName.toLowerCase() !== 'textarea' &&
    target.getAttribute('contenteditable') !== 'true' &&
    !target.isContentEditable
  ) {
    const innerInput = target.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]',
    );
    if (innerInput) {
      effectiveTarget = innerInput;
    }
  }

  // 2. Safeguard against disabled or read-only elements
  const inputEl = effectiveTarget as HTMLInputElement;
  if (inputEl.disabled || inputEl.readOnly || effectiveTarget.getAttribute('aria-disabled') === 'true') {
    return false;
  }

  // 3. Rich text / contenteditable handling
  const isContentEditable =
    effectiveTarget.getAttribute('contenteditable') === 'true' ||
    effectiveTarget.isContentEditable;

  if (isContentEditable) {
    try {
      effectiveTarget.focus();
      if (typeof FocusEvent !== 'undefined') {
        effectiveTarget.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
      }
    } catch {}

    effectiveTarget.innerText = value;

    try {
      if (typeof InputEvent !== 'undefined') {
        effectiveTarget.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: 'insertText',
            data: value,
          }),
        );
      } else {
        effectiveTarget.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }
    } catch {
      effectiveTarget.dispatchEvent(new Event('input', { bubbles: true }));
    }

    effectiveTarget.dispatchEvent(new Event('change', { bubbles: true }));

    try {
      effectiveTarget.blur();
      if (typeof FocusEvent !== 'undefined') {
        effectiveTarget.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
      }
    } catch {}

    applyVisualFeedback(effectiveTarget);
    return true;
  }

  // 4. Standard HTMLInputElement / HTMLTextAreaElement
  if (effectiveTarget.tagName.toLowerCase() === 'input' || effectiveTarget.tagName.toLowerCase() === 'textarea') {
    dispatchFullInputSequence(effectiveTarget, value, doc);
    applyVisualFeedback(effectiveTarget);
    return true;
  }

  // 5. Fallback for custom text element
  effectiveTarget.textContent = value;
  dispatchFormEvents(effectiveTarget, ['input', 'change', 'blur']);
  applyVisualFeedback(effectiveTarget);
  return true;
}
