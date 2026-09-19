/**
 * @file selectSimulator.ts
 * Universal select, ARIA listbox, Workday select button, and searchable combobox simulator.
 */

import {
  simulateFullClick,
  dispatchFormEvents,
  waitForCondition,
  normalize,
  findOptionElement,
} from '../events.js';
import { applyVisualFeedback } from '../visualFeedback.js';
import { fillTextInput } from './inputSimulator.js';

/**
 * Fills a native <select> element (single or multiple) with verification and fuzzy fallback.
 */
export function fillNativeDropdown(
  selectEl: HTMLSelectElement,
  value: string | string[],
  doc: Document,
): boolean {
  if (Array.isArray(value)) {
    // Multi-select: set selected on matching options
    const desiredSet = new Set(value.map(normalize));
    let matchedCount = 0;
    Array.from(selectEl.options).forEach((opt) => {
      const optVal = normalize(opt.value);
      const optText = normalize(opt.text);
      const shouldSelect = desiredSet.has(optVal) || desiredSet.has(optText);
      opt.selected = shouldSelect;
      if (shouldSelect) matchedCount++;
    });
    if (desiredSet.size > 0 && matchedCount === 0) return false;
  } else {
    // Single-select: try exact value/text first, then partial contains match
    const norm = normalize(value);
    let match = Array.from(selectEl.options).find(
      (opt) => normalize(opt.value) === norm || normalize(opt.text) === norm,
    );
    if (!match) {
      match = Array.from(selectEl.options).find(
        (opt) =>
          (opt.value && normalize(opt.value).includes(norm)) ||
          (opt.text && normalize(opt.text).includes(norm)) ||
          (opt.text && norm.includes(normalize(opt.text))),
      );
    }
    if (match) {
      selectEl.value = match.value;
    } else {
      selectEl.value = value;
    }
    if (!selectEl.value && match) {
      selectEl.value = match.value;
    }
    if (!selectEl.value) return false;
  }

  // Sync custom select wrapper widgets (Greenhouse Chosen / Select2) if present
  const parent = selectEl.parentElement;
  if (parent) {
    const customDisplay = parent.querySelector<HTMLElement>(
      '.chosen-single span, .select2-selection__rendered, .custom-select-label',
    );
    if (customDisplay && selectEl.selectedOptions[0]) {
      customDisplay.textContent = selectEl.selectedOptions[0].text;
    }
  }

  dispatchFormEvents(selectEl, ['input', 'change']);
  applyVisualFeedback(selectEl);
  return true;
}

/**
 * Resolves the trigger element to open a closed dropdown.
 * Crucially avoids selecting options inside the popup menu itself.
 */
export function findDropdownTrigger(listbox: HTMLElement): HTMLElement {
  // Google Forms trigger
  const vRmgwf = listbox.querySelector<HTMLElement>('.vRMGwf');
  if (vRmgwf && !vRmgwf.closest('[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id="popupList"]')) {
    return vRmgwf;
  }

  // Workday / Generic candidate buttons
  const candidates = Array.from(
    listbox.querySelectorAll<HTMLElement>(
      'button[aria-haspopup="listbox"], [data-automation-id*="select"], [data-automation-id*="prompt"], .quantumWizMenuPaperselectDropDown, .ry3kXd, [aria-haspopup="listbox"], [aria-haspopup="true"], button, .MocG8c',
    ),
  );
  for (const el of candidates) {
    if (!el.closest('[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id="popupList"]')) {
      return el;
    }
  }

  return listbox;
}

/**
 * Resolves the display label element on the dropdown trigger button (not inside an option).
 */
export function findDropdownDisplayLabel(listbox: HTMLElement): HTMLElement | null {
  const candidates = Array.from(
    listbox.querySelectorAll<HTMLElement>(
      '.vRMGwf, .quantumWizMenuPaperselectContent, [data-automation-id*="promptLabel"], [data-automation-id*="prompt-selected-value"], [data-automation-id*="promptSelectedValue"], .select-label',
    ),
  );
  for (const el of candidates) {
    if (!el.closest('[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id="popupList"]')) {
      return el;
    }
  }
  // Fallback to first non-option span inside button trigger
  const childSpan = listbox.querySelector<HTMLElement>('span');
  if (childSpan && !childSpan.closest('[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id="popupList"]')) {
    return childSpan;
  }
  return null;
}

/**
 * Fills an ARIA listbox, Workday select prompt, or custom combobox dropdown:
 * 1. Opens it via realistic pointer click on the trigger button.
 * 2. If it is a searchable combobox, types query into the search box.
 * 3. Finds option across container, referenced aria-controls, or document body portals.
 * 4. Hovers and clicks option with full event simulation.
 * 5. Synchronizes framework state, labels, and hidden inputs, dismissing validation banners.
 */
export async function fillAriaDropdown(container: Element, value: string, doc: Document): Promise<boolean> {
  const win = doc.defaultView || window;
  const isTest = typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom');

  // 1. Identify listbox / combobox element
  const listbox = (
    container.getAttribute('role') === 'listbox' || container.getAttribute('role') === 'combobox'
      ? container
      : container.querySelector('[role="listbox"], [role="combobox"]')
  ) as HTMLElement || (container as HTMLElement);

  const questionContainer =
    container.closest(
      '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, .form-group, .field, [data-automation-id*="formField"], [data-automation-id*="formItem"], .application-question',
    ) || container.parentElement;

  const ownsId =
    listbox.getAttribute('aria-owns') ||
    listbox.getAttribute('aria-controls') ||
    listbox.getAttribute('data-popup-id');

  let optionContainer: Element = listbox;
  if (ownsId) {
    const ownedEl = doc.getElementById(ownsId);
    if (ownedEl) optionContainer = ownedEl;
  }

  const isCurrentlyOpen = (): boolean => {
    if (listbox.getAttribute('aria-expanded') === 'true') return true;
    const popupEl = (listbox.querySelector<HTMLElement>(
      '.OA0qNb, .exportSelectPopup, [data-automation-id="popupList"], [role="listbox"]',
    ) || (ownsId ? doc.getElementById(ownsId) : null)) as HTMLElement | null;
    if (popupEl && popupEl.style.display !== 'none') {
      return true;
    }
    // Check if any popup portal is open in body
    const bodyPopup = doc.querySelector<HTMLElement>('[data-automation-id="popupList"], .OA0qNb, .exportSelectPopup');
    if (bodyPopup && bodyPopup.style.display !== 'none') {
      return true;
    }
    return false;
  };

  // 2. Open listbox if closed
  if (!isCurrentlyOpen()) {
    listbox.focus();

    // Find the real trigger button
    const triggerEl = findDropdownTrigger(listbox);
    simulateFullClick(triggerEl);

    // Also dispatch Enter keyboard sequence on listbox for standard ARIA support
    const keyOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    listbox.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
    listbox.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
    listbox.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

    // Wait for options popup to open and render
    await waitForCondition(isCurrentlyOpen, isTest ? 20 : 250, 15);

    // If still closed, try clicking listbox element itself
    if (!isCurrentlyOpen()) {
      simulateFullClick(listbox);
      await waitForCondition(isCurrentlyOpen, isTest ? 20 : 150, 15);
    }
  }

  // 3. Searchable combobox support: if popup or listbox contains an active search box, type query
  const searchInput = (
    doc.querySelector<HTMLInputElement>('[data-automation-id="popupList"] input, .select2-search__field') ||
    listbox.querySelector<HTMLInputElement>('input[role="combobox"], input[data-automation-id*="search"], input[type="text"]')
  );
  if (searchInput && searchInput !== listbox) {
    fillTextInput(searchInput, value, doc);
    if (!isTest) {
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  // 4. Find option element across popup, listbox, questionContainer, or doc.body portals
  const popup =
    listbox.querySelector('.OA0qNb, .exportSelectPopup, [data-automation-id="popupList"]') ||
    doc.querySelector('[data-automation-id="popupList"]') ||
    optionContainer;

  let option = findOptionElement(popup, value);

  if (!option && questionContainer) {
    option = findOptionElement(questionContainer, value);
  }

  if (!option) {
    option = findOptionElement(doc.body, value);
  }

  if (!option) return false;

  const targetVal =
    option.getAttribute('data-value') ||
    option.getAttribute('value') ||
    option.getAttribute('data-autofiller-option') ||
    value;

  // Locate hidden form input if present (Google Forms or generic)
  const containerWithParams = listbox.closest('[data-params]');
  const dataParams = containerWithParams?.getAttribute('data-params') || '';
  const match = dataParams.match(/\[\[(\d+),/);
  const entryId = match ? match[1] : null;
  const hiddenInput = entryId
    ? doc.querySelector<HTMLInputElement>(`input[name="entry.${entryId}"]`)
    : (questionContainer?.querySelector<HTMLInputElement>('input[type="hidden"]') || null);

  // 5. Click option using hover state + coordinate pointerdown -> mousedown -> pointerup -> mouseup -> click
  const optionTextChild = option.querySelector<HTMLElement>(
    '.quantumWizMenuPaperselectContent, .vRMGwf, [data-automation-id*="promptOptionText"], span',
  );
  if (optionTextChild) {
    simulateFullClick(optionTextChild, { simulateHover: true });
  }
  simulateFullClick(option as HTMLElement, { simulateHover: true });

  // 6. Wait for framework to process selection & update state
  const isSelectionCommitted = (): boolean => {
    if (option?.getAttribute('aria-selected') === 'true') return true;
    if (hiddenInput && hiddenInput.value === targetVal) return true;
    const curLabel = findDropdownDisplayLabel(listbox);
    if (curLabel && curLabel.textContent?.trim() === (option?.textContent?.trim() || targetVal)) return true;
    return false;
  };

  await waitForCondition(isSelectionCommitted, isTest ? 20 : 300, 20);

  // 7. Synchronization fallback
  if (hiddenInput && hiddenInput.value !== targetVal) {
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement?.prototype || HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(hiddenInput, targetVal);
    } else {
      hiddenInput.value = targetVal;
    }
    dispatchFormEvents(hiddenInput, ['input', 'change']);
  }

  // Ensure aria-selected is set on target option and unset on siblings
  const allSiblingOptions = Array.from(
    (popup || listbox).querySelectorAll('[role="option"], .quantumWizMenuPaperselectOption, [data-automation-id*="promptOption"]'),
  );
  for (const sib of allSiblingOptions) {
    if (sib === option) {
      sib.setAttribute('aria-selected', 'true');
      sib.classList.add('isSelected');
    } else {
      sib.setAttribute('aria-selected', 'false');
      sib.classList.remove('isSelected');
    }
  }

  // Update visible label on dropdown trigger if not already set by component
  const labelEl = findDropdownDisplayLabel(listbox);
  if (labelEl) {
    const chosenText = option.textContent?.trim() || targetVal;
    if (labelEl.textContent?.trim() !== chosenText) {
      labelEl.textContent = chosenText;
    }
    labelEl.classList.remove('oJeWuf');
    labelEl.classList.add('isSelected');
  }

  // Clear validation error banner if present
  if (questionContainer) {
    const errorBanner = questionContainer.querySelector('.RDeBda, [role="alert"]');
    if (errorBanner) {
      errorBanner.remove();
    }
    questionContainer.classList.remove('N2RpBe', 'hasError');
  }

  // Close listbox if still open
  if (listbox.getAttribute('aria-expanded') === 'true') {
    listbox.setAttribute('aria-expanded', 'false');
    const popupEl = listbox.querySelector<HTMLElement>('.OA0qNb, .exportSelectPopup, [data-automation-id="popupList"]');
    if (popupEl) popupEl.style.display = 'none';
  }

  dispatchFormEvents(listbox, ['change', 'blur']);
  applyVisualFeedback(listbox);
  return true;
}
