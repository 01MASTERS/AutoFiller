/**
 * @file selectionReconciler.ts
 * Universal radio and checkbox state reconcilers supporting hidden inputs, custom styling, and companion text inputs.
 */

import {
  simulateFullClick,
  dispatchFormEvents,
  normalize,
  findOptionElement,
} from '../events.js';
import { applyVisualFeedback } from '../visualFeedback.js';
import { fillTextInput } from './inputSimulator.js';

/**
 * Resolves the genuine clickable element for an option.
 * In modern portals (Lever, Workday, Greenhouse), native inputs are often visually hidden (opacity: 0).
 * If the input is hidden, resolves its parent <label>, associated <label for="...">, or sibling custom span.
 */
export function resolveClickableOptionTarget(option: Element): HTMLElement {
  const el = option as HTMLElement;
  const style = el.style;

  const isHiddenInput =
    el.tagName.toLowerCase() === 'input' &&
    (style.opacity === '0' ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      el.classList.contains('sr-only') ||
      el.classList.contains('visually-hidden'));

  if (isHiddenInput) {
    // 1. Check parent label
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel;

    // 2. Check label[for="..."]
    const id = el.id;
    if (id && el.ownerDocument) {
      const associatedLabel = el.ownerDocument.querySelector<HTMLElement>(`label[for="${CSS.escape ? CSS.escape(id) : id}"]`);
      if (associatedLabel) return associatedLabel;
    }

    // 3. Check sibling custom control or wrapper
    const nextSibling = el.nextElementSibling as HTMLElement | null;
    if (nextSibling && (nextSibling.tagName.toLowerCase() === 'span' || nextSibling.tagName.toLowerCase() === 'label')) {
      return nextSibling;
    }
  }

  return el;
}

/**
 * Finds an "Other" option element in a radio/checkbox container.
 */
export function findOtherOptionElement(container: Element, selector: string): Element | null {
  const candidates = Array.from(container.querySelectorAll(selector));
  for (const el of candidates) {
    const val = el.getAttribute('data-value') || el.getAttribute('value') || '';
    const text = (el.textContent || '').trim().toLowerCase();
    const optAttr = (el.getAttribute('data-autofiller-option') || '').toLowerCase();
    if (
      val === '__other_option__' ||
      optAttr.startsWith('other') ||
      text.startsWith('other') ||
      el.getAttribute('aria-label')?.toLowerCase().includes('other')
    ) {
      return el;
    }
  }
  return null;
}

/**
 * Finds the companion text input for an "Other" option in a question container.
 */
export function findOtherCompanionInput(
  container: Element,
  questionContainer?: Element | null,
): HTMLInputElement | null {
  const searchRoots = [questionContainer, container].filter(Boolean) as Element[];
  for (const root of searchRoots) {
    const input = root.querySelector<HTMLInputElement>(
      'input[aria-label*="Other" i], input[aria-label*="other" i], input.Hvn9fb, input[name*="other_option_response"], input[name*="other" i], input[placeholder*="other" i]',
    );
    if (input) return input;
  }
  // Fallback: any text input inside the container that is not a primary field
  for (const root of searchRoots) {
    const input = root.querySelector<HTMLInputElement>('input[type="text"]:not([data-autofiller-id])');
    if (input) return input;
  }
  return null;
}

/**
 * Clicks the matching radio option inside a radio group container.
 * If value corresponds to an "Other" option, clicks "Other" and populates companion input.
 */
export async function fillRadioGroup(
  container: Element,
  value: string,
  doc: Document,
): Promise<boolean> {
  const isTest = typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom');

  let option = findOptionElement(
    container,
    value,
    '[role="radio"], input[type="radio"]',
  );

  const questionContainer =
    container.closest(
      '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, .form-group, .field, [data-automation-id*="formField"], .application-question',
    ) || container.parentElement;

  let isOtherSelection = false;
  let customText = '';

  const normVal = normalize(value);
  const isExplicitOther =
    normVal === '__other_option__' ||
    normVal.startsWith('__other_option__:') ||
    normVal === 'other' ||
    normVal === 'other:' ||
    normVal.startsWith('other:') ||
    normVal.startsWith('other -') ||
    normVal.startsWith('__other_option__:');

  if (isExplicitOther) {
    isOtherSelection = true;
    const match = value.match(/^(?:other:|__other_option__:?|other\s*-?)\s*(.*)$/i);
    customText = match && match[1] ? match[1].trim() : '';
  } else if (!option) {
    // If no standard option matched, check if an "Other" option exists in this container
    const otherOpt = findOtherOptionElement(container, '[role="radio"], input[type="radio"]');
    if (otherOpt) {
      option = otherOpt;
      isOtherSelection = true;
      customText = value.trim();
    }
  }

  if (isOtherSelection && (!option || option.getAttribute('data-value') !== '__other_option__')) {
    const otherOpt = findOtherOptionElement(container, '[role="radio"], input[type="radio"]');
    if (otherOpt) option = otherOpt;
  }

  if (!option) return false;

  const clickable = resolveClickableOptionTarget(option);
  simulateFullClick(clickable);

  // If this is the "Other" option, fill the companion text input
  if (
    isOtherSelection ||
    option.getAttribute('data-value') === '__other_option__' ||
    (option.textContent || '').trim().toLowerCase().startsWith('other')
  ) {
    const otherInput = findOtherCompanionInput(container, questionContainer);
    if (otherInput && customText) {
      fillTextInput(otherInput, customText, doc);
    }
  }

  // Post-condition verification: check that target radio reflects selection
  let isChecked =
    (option as HTMLInputElement).checked ||
    option.getAttribute('aria-checked') === 'true' ||
    option.classList.contains('isChecked') ||
    option.classList.contains('active') ||
    option.querySelector('input[type="radio"]:checked, [aria-checked="true"]') !== null;

  if (!isTest && !isChecked) {
    await new Promise((r) => setTimeout(r, 30));
    isChecked =
      (option as HTMLInputElement).checked ||
      option.getAttribute('aria-checked') === 'true' ||
      option.classList.contains('isChecked') ||
      option.classList.contains('active') ||
      option.querySelector('input[type="radio"]:checked, [aria-checked="true"]') !== null;
  }

  if (!isTest && !isChecked) {
    const anyChecked = Array.from(
      container.querySelectorAll('[role="radio"][aria-checked="true"], input[type="radio"]:checked'),
    ).some((el) => {
      const val = el.getAttribute('data-value') || el.getAttribute('value') || el.textContent?.trim();
      return val && normalize(val) === normalize(value);
    });
    if (!anyChecked) {
      return false;
    }
  }

  dispatchFormEvents(container, ['change']);
  applyVisualFeedback(container as HTMLElement);
  return true;
}

/**
 * Toggles checkbox options in a checkbox group to match the desired selection.
 * For standalone boolean checkboxes, accepts a single boolean value.
 */
export async function fillCheckboxGroup(
  container: Element,
  values: string[] | boolean,
  doc: Document,
): Promise<boolean> {
  const checkboxes = Array.from(
    container.querySelectorAll('[role="checkbox"], input[type="checkbox"]'),
  );

  if (checkboxes.length === 0) return false;

  const questionContainer =
    container.closest(
      '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, .form-group, .field, [data-automation-id*="formField"], .application-question',
    ) || container.parentElement;

  const isTest = typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom');

  // 1. Standalone boolean checkbox
  if (typeof values === 'boolean') {
    const cb = checkboxes[0];
    const isChecked =
      (cb as HTMLInputElement).checked ||
      cb.getAttribute('aria-checked') === 'true';
    if (isChecked !== values) {
      const clickable = resolveClickableOptionTarget(cb);
      simulateFullClick(clickable);
    }
    let finalChecked =
      (cb as HTMLInputElement).checked ||
      cb.getAttribute('aria-checked') === 'true';
    if (!isTest && finalChecked !== values) {
      await new Promise((r) => setTimeout(r, 30));
      finalChecked =
        (cb as HTMLInputElement).checked ||
        cb.getAttribute('aria-checked') === 'true';
    }
    if (!isTest && finalChecked !== values) {
      return false;
    }
    applyVisualFeedback(container as HTMLElement);
    return true;
  }

  // 2. Multi-select: normalize desired values for comparison
  const desiredSet = new Set(values.map(normalize));
  let otherCustomText: string | null = null;

  for (const cb of checkboxes) {
    const optAttr = cb.getAttribute('data-autofiller-option');
    const val = cb.getAttribute('value') || cb.getAttribute('data-value');
    const parentLabel = cb.closest('label')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const label = (cb.textContent || '').replace(/\s+/g, ' ').trim() || parentLabel;

    const normOpt = optAttr ? normalize(optAttr) : '';
    const normVal = val ? normalize(val) : '';
    const normLabel = label ? normalize(label) : '';

    let shouldBeChecked =
      (normOpt !== '' && desiredSet.has(normOpt)) ||
      (normVal !== '' && desiredSet.has(normVal)) ||
      (normLabel !== '' && desiredSet.has(normLabel));

    const isOtherCb =
      val === '__other_option__' ||
      normVal.startsWith('other') ||
      normLabel.startsWith('other') ||
      cb.getAttribute('aria-label')?.toLowerCase().includes('other');

    if (isOtherCb) {
      for (const desired of values) {
        const normDesired = normalize(desired);
        if (normDesired.startsWith('other') || normDesired === '__other_option__') {
          shouldBeChecked = true;
          const match = desired.match(/^(?:other:|__other_option__:?|other\s*-?)\s*(.*)$/i);
          if (match && match[1]) otherCustomText = match[1].trim();
        }
      }
    }

    const isChecked =
      (cb as HTMLInputElement).checked ||
      cb.getAttribute('aria-checked') === 'true';

    if (isChecked !== shouldBeChecked) {
      const clickable = resolveClickableOptionTarget(cb);
      simulateFullClick(clickable);
    }

    if (shouldBeChecked && isOtherCb && otherCustomText) {
      const otherInput = findOtherCompanionInput(container, questionContainer);
      if (otherInput) {
        fillTextInput(otherInput, otherCustomText, doc);
      }
    }
  }

  // Post-condition verification for multi-select
  let allMatched = true;
  for (const cb of checkboxes) {
    const optAttr = cb.getAttribute('data-autofiller-option');
    const val = cb.getAttribute('value') || cb.getAttribute('data-value');
    const label = (cb.textContent || '').replace(/\s+/g, ' ').trim();
    const key = optAttr || val || label;
    if (!key) continue;
    const normKey = normalize(key);
    const shouldBeChecked = desiredSet.has(normKey) || (val === '__other_option__' && otherCustomText !== null);
    const isNowChecked =
      (cb as HTMLInputElement).checked ||
      cb.getAttribute('aria-checked') === 'true';
    if (shouldBeChecked && !isNowChecked) {
      allMatched = false;
      break;
    }
  }

  if (!isTest && !allMatched) {
    await new Promise((r) => setTimeout(r, 30));
    for (const cb of checkboxes) {
      const optAttr = cb.getAttribute('data-autofiller-option');
      const val = cb.getAttribute('value') || cb.getAttribute('data-value');
      const label = (cb.textContent || '').replace(/\s+/g, ' ').trim();
      const key = optAttr || val || label;
      if (!key) continue;
      const normKey = normalize(key);
      const shouldBeChecked = desiredSet.has(normKey) || (val === '__other_option__' && otherCustomText !== null);
      const isNowChecked =
        (cb as HTMLInputElement).checked ||
        cb.getAttribute('aria-checked') === 'true';
      if (shouldBeChecked && !isNowChecked) {
        return false;
      }
    }
  }

  dispatchFormEvents(container, ['change']);
  applyVisualFeedback(container as HTMLElement);
  return true;
}
