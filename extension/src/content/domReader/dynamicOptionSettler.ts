/**
 * @file dynamicOptionSettler.ts
 * Asynchronous settlement and mutation observer engine for dynamically loaded options
 * and reactive cascading form fields.
 */

import { FieldMetadata, FieldOption } from '@autofiller/shared';
import { extractOptionsFromAny, extractSelectOptions, extractAriaListboxOptions } from './optionParser.js';
import { deepGetElementById } from './shadowDom.js';
import { isPendingOption } from './utils.js';

const isTest = typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom');

/**
 * Resolves the option container or popup element associated with a dropdown/combobox
 */
function resolveOptionContainer(container: Element): Element {
  const doc = container.ownerDocument || document;
  const ownsId =
    container.getAttribute('aria-owns') ||
    container.getAttribute('aria-controls') ||
    container.getAttribute('data-popup-id');

  if (ownsId) {
    const owned = deepGetElementById(ownsId, doc);
    if (owned) return owned;
  }

  // Look for child listbox or portal
  const childListbox = container.querySelector(
    '[role="listbox"], .OA0qNb, .exportSelectPopup, [data-automation-id="popupList"]',
  );
  if (childListbox) return childListbox;

  return container;
}

/**
 * Checks whether valid, non-pending options exist within the container
 */
function hasValidOptions(container: Element): boolean {
  const isBusy = container.getAttribute('aria-busy') === 'true';
  if (isBusy) return false;

  const target = resolveOptionContainer(container);
  const options = extractOptionsFromAny(target);

  if (options.length === 0) return false;
  return !options.every((o) => isPendingOption(o.label, o.value));
}

/**
 * Waits for dynamic options to be fetched from the backend and rendered into the DOM.
 * Observes child mutations and aria-busy attribute state on both the container and document body.
 */
export async function waitForDynamicOptions(
  container: Element,
  timeoutMs: number = isTest ? 100 : 1500,
): Promise<FieldOption[]> {
  // If options are already loaded and not pending, resolve immediately
  if (hasValidOptions(container)) {
    const target = resolveOptionContainer(container);
    return extractOptionsFromAny(target);
  }

  const doc = container.ownerDocument || document;
  const target = resolveOptionContainer(container);

  return new Promise<FieldOption[]>((resolve) => {
    let resolved = false;
    let observer: MutationObserver | null = null;
    let bodyObserver: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      resolved = true;
      if (timer) clearTimeout(timer);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
      }
    };

    const checkAndResolve = () => {
      if (resolved) return;
      if (hasValidOptions(container) || hasValidOptions(target)) {
        cleanup();
        const currentTarget = resolveOptionContainer(container);
        resolve(extractOptionsFromAny(currentTarget));
      }
    };

    timer = setTimeout(() => {
      cleanup();
      const currentTarget = resolveOptionContainer(container);
      resolve(extractOptionsFromAny(currentTarget));
    }, timeoutMs);

    // Observe target container for childList or aria-busy mutations
    try {
      observer = new MutationObserver(() => {
        checkAndResolve();
      });

      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-busy', 'style', 'class'],
      });

      if (target !== container) {
        observer.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-busy', 'style', 'class'],
        });
      }

      // Also observe document.body for portaled popovers (e.g. React-Select, Workday, Floating-UI)
      if (doc.body && doc.body !== target) {
        bodyObserver = new MutationObserver(() => {
          checkAndResolve();
        });
        bodyObserver.observe(doc.body, {
          childList: true,
          subtree: true,
        });
      }
    } catch {
      // In constrained mock environments where MutationObserver might be unavailable
      checkAndResolve();
    }
  });
}

/**
 * Waits for a cascading field to become enabled (e.g. after its upstream parent country is selected).
 */
export async function waitForFieldEnabled(
  element: Element,
  timeoutMs: number = isTest ? 100 : 1500,
): Promise<boolean> {
  const isEnabled = () => {
    const hasDisabledAttr = (element as HTMLSelectElement | HTMLInputElement).disabled;
    const hasAriaDisabled = element.getAttribute('aria-disabled') === 'true';
    return !hasDisabledAttr && !hasAriaDisabled;
  };

  if (isEnabled()) return true;

  return new Promise<boolean>((resolve) => {
    let resolved = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      resolved = true;
      if (timer) clearTimeout(timer);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(isEnabled());
    }, timeoutMs);

    try {
      observer = new MutationObserver(() => {
        if (isEnabled() && !resolved) {
          cleanup();
          resolve(true);
        }
      });

      observer.observe(element, {
        attributes: true,
        attributeFilter: ['disabled', 'aria-disabled', 'class'],
      });
    } catch {
      resolve(isEnabled());
    }
  });
}

/**
 * Re-extracts live options from the element or associated popup, updating field metadata
 */
export function extractLiveOptions(
  field: FieldMetadata,
  element: Element,
  _doc: Document = element.ownerDocument || document,
): FieldOption[] {
  const target = resolveOptionContainer(element);
  let liveOptions: FieldOption[] = [];

  if (element.tagName.toLowerCase() === 'select') {
    liveOptions = extractSelectOptions(element as HTMLSelectElement);
  } else {
    liveOptions = extractAriaListboxOptions(target);
    if (liveOptions.length === 0 && target !== element) {
      liveOptions = extractAriaListboxOptions(element);
    }
  }

  if (liveOptions.length > 0) {
    field.options = liveOptions;
    field.optionsLoaded = !liveOptions.every((o) => isPendingOption(o.label, o.value));
  }

  return liveOptions;
}
