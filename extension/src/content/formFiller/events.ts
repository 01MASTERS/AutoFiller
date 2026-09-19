/**
 * @file events.ts
 * Synthetic interaction, string normalization, and event dispatch utilities for universal form filling.
 */

/**
 * Safe CSS escaping for environments where global CSS.escape may be unavailable (e.g. Node/jsdom).
 */
export function escapeCss(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Dispatches standard synthetic events on a form element.
 */
export function dispatchFormEvents(el: Element, events: string[] = ['input', 'change', 'blur']): void {
  for (const name of events) {
    el.dispatchEvent(new Event(name, { bubbles: true }));
  }
}

/**
 * Normalizes a string for fuzzy matching (lowercase, trimmed, collapsed whitespace).
 */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Finds an option element inside a container that matches the target value.
 * Search order: data-autofiller-option -> value/data-value -> data-automation-id -> text content -> aria-label -> substring.
 */
export function findOptionElement(
  container: Element,
  targetValue: string,
  selector: string = '[role="option"], [role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"], .quantumWizMenuPaperselectOption, [data-automation-id*="promptOption"], li[role="option"]',
): Element | null {
  const candidates = Array.from(container.querySelectorAll(selector));
  const norm = normalize(targetValue);

  // 1. Exact match on data-autofiller-option
  for (const el of candidates) {
    const optAttr = el.getAttribute('data-autofiller-option');
    if (optAttr && normalize(optAttr) === norm) return el;
  }

  // 2. Exact match on value or data-value attribute
  for (const el of candidates) {
    const val = el.getAttribute('value') || el.getAttribute('data-value');
    if (val && normalize(val) === norm) return el;
  }

  // 3. Exact match on data-automation-id containing value
  for (const el of candidates) {
    const autoId = el.getAttribute('data-automation-id');
    if (autoId && normalize(autoId) === norm) return el;
  }

  // 4. Exact match on text content
  for (const el of candidates) {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (normalize(text) === norm) return el;
  }

  // 5. Fallback: aria-label match
  for (const el of candidates) {
    const aria = el.getAttribute('aria-label');
    if (aria && normalize(aria) === norm) return el;
  }

  // 6. Substring / partial match on text content or value
  for (const el of candidates) {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const val = el.getAttribute('value') || el.getAttribute('data-value') || '';
    if (normalize(text).includes(norm) || (val && normalize(val).includes(norm))) {
      return el;
    }
  }

  return null;
}

/**
 * Simulates a full realistic pointer and mouse click sequence with accurate coordinates.
 * Modern UI frameworks (such as Google Closure in Google Forms, React-Select, and Workday)
 * rely on pointerdown/mousedown with valid coordinates and button flags to register active
 * items and distinguish inside vs outside clicks.
 */
export function simulateFullClick(el: HTMLElement, opts?: { simulateHover?: boolean }): void {
  try {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  } catch {}

  const rect =
    typeof el.getBoundingClientRect === 'function'
      ? el.getBoundingClientRect()
      : { left: 0, top: 0, width: 0, height: 0 };

  const clientX = Math.round(rect.left + (rect.width ? rect.width / 2 : 10));
  const clientY = Math.round(rect.top + (rect.height ? rect.height / 2 : 10));

  const baseInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
  };

  // Dispatch hover / over sequence if requested (required by Closure MenuItem to activate highlightedItem_)
  if (opts?.simulateHover) {
    try {
      if (typeof PointerEvent !== 'undefined') {
        el.dispatchEvent(new PointerEvent('pointerover', { ...baseInit, button: 0, buttons: 0 }));
        el.dispatchEvent(new PointerEvent('pointerenter', { ...baseInit, button: 0, buttons: 0 }));
      }
    } catch {}
    try {
      el.dispatchEvent(new MouseEvent('mouseover', { ...baseInit, button: 0, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseenter', { ...baseInit, button: 0, buttons: 0 }));
    } catch {}
  }

  try {
    if (typeof PointerEvent !== 'undefined') {
      el.dispatchEvent(new PointerEvent('pointerdown', { ...baseInit, button: 0, buttons: 1 }));
    }
  } catch {}

  try {
    el.dispatchEvent(new MouseEvent('mousedown', { ...baseInit, button: 0, buttons: 1 }));
  } catch {}

  try {
    if (typeof PointerEvent !== 'undefined') {
      el.dispatchEvent(new PointerEvent('pointerup', { ...baseInit, button: 0, buttons: 0 }));
    }
  } catch {}

  try {
    el.dispatchEvent(new MouseEvent('mouseup', { ...baseInit, button: 0, buttons: 0 }));
  } catch {}

  el.click();
}

/**
 * Dispatches a complete synthetic input lifecycle sequence:
 * focus -> focusin -> value injection -> input (InputEvent/Event) -> change -> blur -> focusout.
 * Uses prototype property setters to bypass React 16+ controlled component overrides.
 */
export function dispatchFullInputSequence(
  el: HTMLElement,
  value: string,
  doc: Document,
): void {
  const win = doc.defaultView || window;

  // 1. Focus lifecycle
  try {
    el.dispatchEvent(new Event('focus', { bubbles: false }));
    el.dispatchEvent(new Event('focusin', { bubbles: true }));
  } catch {}

  // 2. Set value via prototype setter (bypassing React 16+ setter wrap)
  const isTextArea = el.tagName.toLowerCase() === 'textarea';
  const prototype = isTextArea
    ? win.HTMLTextAreaElement?.prototype || HTMLTextAreaElement.prototype
    : win.HTMLInputElement?.prototype || HTMLInputElement.prototype;

  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (valueSetter) {
    valueSetter.call(el, value);
  } else {
    (el as HTMLInputElement | HTMLTextAreaElement).value = value;
  }

  // 3. Dispatch input event (bubbles: true)
  try {
    if (typeof InputEvent !== 'undefined') {
      try {
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: 'insertText',
            data: value,
          }),
        );
      } catch {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 4. Dispatch change event
  el.dispatchEvent(new Event('change', { bubbles: true }));

  // 5. Blur lifecycle
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  try {
    el.dispatchEvent(new Event('focusout', { bubbles: true }));
  } catch {}
}

/**
 * Async polling helper that waits for a condition to be met within a timeout.
 */
export async function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number = 200,
  intervalMs: number = 10,
): Promise<boolean> {
  const isTest = typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom');
  if (isTest && predicate()) return true;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return predicate();
}
