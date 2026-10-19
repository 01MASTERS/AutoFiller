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
import { waitForDynamicOptions } from '../../domReader/index.js';

/**
 * Fills a native <select> element (single or multiple) with verification and fuzzy fallback.
 */
export async function fillNativeDropdown(
  selectEl: HTMLSelectElement,
  value: string | string[],
  _doc: Document,
): Promise<boolean> {
  // If options are empty or placeholder-only, await dynamic options
  if (selectEl.options.length <= 1) {
    await waitForDynamicOptions(selectEl);
  }

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
    if (desiredSet.size > 0 && matchedCount === 0) {
      // Retry once after dynamic options settlement
      await waitForDynamicOptions(selectEl);
      Array.from(selectEl.options).forEach((opt) => {
        const optVal = normalize(opt.value);
        const optText = normalize(opt.text);
        const shouldSelect = desiredSet.has(optVal) || desiredSet.has(optText);
        opt.selected = shouldSelect;
        if (shouldSelect) matchedCount++;
      });
      if (matchedCount === 0) return false;
    }
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
    // If no match found, await potential dynamic options arrival and retry
    if (!match) {
      await waitForDynamicOptions(selectEl);
      match = Array.from(selectEl.options).find(
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
 * Splits compound preference strings (e.g. "LinkedIn,Indeed,Career page OR anything except referral")
 * into prioritized candidate option values to try sequentially against dropdown options.
 */
export function extractCandidateValues(value: string): string[] {
  if (!value) return [];
  const trimmed = value.trim();

  // If no delimiter like comma, slash, or "or", return as single value
  if (!/[,|/\n]|\s+or\s+/i.test(trimmed)) {
    return [trimmed];
  }

  // Split by comma, pipe, newline, word "or", or forward slash with spaces
  const tokens = trimmed
    .split(/[,|\n]|\s+or\s+|\s*\/\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  // Filter out negative clauses like "anything except referral", "not referral", etc.
  const positiveCandidates = tokens.filter((t) => {
    const lower = t.toLowerCase();
    return (
      !lower.startsWith('anything except') &&
      !lower.startsWith('except') &&
      !lower.startsWith('not ') &&
      !lower.includes('anything other than')
    );
  });

  return positiveCandidates.length > 0 ? positiveCandidates : [trimmed];
}

/**
 * Resolves the trigger element to open a closed dropdown.
 * Crucially avoids selecting options inside the popup menu itself.
 */
export function findDropdownTrigger(listbox: HTMLElement): HTMLElement {
  // If listbox is already a button, return it directly
  if (listbox.tagName.toLowerCase() === 'button') {
    return listbox;
  }

  // If listbox is an input, look in parent container for companion prompt / search / popup button
  if (listbox.tagName.toLowerCase() === 'input') {
    const parent = listbox.parentElement;
    if (parent) {
      const companionButton = parent.querySelector<HTMLElement>(
        'button[data-automation-id*="prompt"], button[data-automation-id*="search"], button[aria-haspopup], button',
      );
      if (
        companionButton &&
        !companionButton.closest(
          '[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id*="popup"], [data-automation-id*="menu"]',
        )
      ) {
        return companionButton;
      }
    }
  }

  // Google Forms trigger
  const vRmgwf = listbox.querySelector<HTMLElement>('.vRMGwf');
  if (vRmgwf && !vRmgwf.closest('[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id*="popup"], [data-automation-id*="menu"]')) {
    return vRmgwf;
  }

  // Workday / Generic candidate buttons
  const candidates = Array.from(
    listbox.querySelectorAll<HTMLElement>(
      'button[aria-haspopup="listbox"], button[aria-haspopup="true"], [data-automation-id*="select"], [data-automation-id*="prompt"], .quantumWizMenuPaperselectDropDown, .ry3kXd, [aria-haspopup="listbox"], [aria-haspopup="true"], button, .MocG8c',
    ),
  );
  for (const el of candidates) {
    if (!el.closest('[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id*="popup"], [data-automation-id*="menu"]')) {
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
      '.vRMGwf, .quantumWizMenuPaperselectContent, [data-automation-id*="promptLabel"], [data-automation-id*="prompt-selected-value"], [data-automation-id*="promptSelectedValue"], [data-automation-id*="selectedItem"], [data-automation-id*="selected-value"], .select-label',
    ),
  );
  for (const el of candidates) {
    if (!el.closest('[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id*="popup"], [data-automation-id*="menu"]')) {
      return el;
    }
  }
  // Fallback to first non-option span inside button trigger
  const childSpan = listbox.querySelector<HTMLElement>('span');
  if (childSpan && !childSpan.closest('[role="option"], .OA0qNb, .exportSelectPopup, [data-automation-id*="popup"], [data-automation-id*="menu"]')) {
    return childSpan;
  }
  return null;
}

/**
 * Mapping of known source categories to child/leaf job boards, social platforms, and sources.
 * Used for hierarchical prompt drill-down in ATS like Workday.
 */
export const SOURCE_CATEGORY_MAP: Record<string, string[]> = {
  'job board': [
    'linkedin',
    'indeed',
    'glassdoor',
    'ziprecruiter',
    'monster',
    'dice',
    'careerbuilder',
    'naukri',
    'wellfound',
    'angelist',
    'simplyhired',
    'handshake',
    'job board',
    'job boards',
    'online job board',
  ],
  'social media': [
    'linkedin',
    'twitter',
    'x',
    'facebook',
    'instagram',
    'youtube',
    'reddit',
    'tiktok',
    'social media',
  ],
  'campus campaign': [
    'campus',
    'university',
    'college',
    'career fair',
    'campus event',
    'campus campaign',
    'university recruiting',
    'school',
    'student association',
  ],
  'company website': [
    'career site',
    'company website',
    'careers website',
    'careers page',
    'corporate site',
    'company careers',
    'direct',
    'employer website',
  ],
  'employee referral': [
    'referral',
    'employee referral',
    'friend',
    'colleague',
    'internal referral',
    'word of mouth',
  ],
  'agency': [
    'agency',
    'staffing agency',
    'recruiter',
    'headhunter',
    'third party recruiter',
    'external recruiter',
  ],
  'event': [
    'event',
    'conference',
    'hackathon',
    'meetup',
    'seminar',
    'webinar',
    'job fair',
  ],
  'advertisement': [
    'advertisement',
    'ad',
    'banner ad',
    'billboard',
    'print',
    'newspaper',
  ],
};

/**
 * Resolves a parent category option element within a hierarchical dropdown (e.g. Workday Job Source)
 * when the desired leaf option (e.g. "LinkedIn") is nested inside a category (e.g. "Job Board").
 */
export function findMatchingCategoryOption(
  container: Element,
  targetValue: string,
): Element | null {
  const norm = normalize(targetValue);
  const candidateCategories: string[] = [];

  for (const [category, leaves] of Object.entries(SOURCE_CATEGORY_MAP)) {
    if (leaves.some((leaf) => norm.includes(leaf) || leaf.includes(norm))) {
      candidateCategories.push(category);
    }
  }

  if (candidateCategories.length === 0) {
    return null;
  }

  const options = Array.from(
    container.querySelectorAll<HTMLElement>(
      '[role="option"], [data-automation-id*="promptOption"], li[role="option"], [role="treeitem"], button[data-automation-id*="promptOption"]',
    ),
  );

  for (const opt of options) {
    const optText = normalize(opt.textContent || '');
    const autoId = normalize(opt.getAttribute('data-automation-id') || '');
    for (const cat of candidateCategories) {
      if (optText.includes(cat) || autoId.includes(cat) || cat.includes(optText)) {
        return opt;
      }
    }
  }

  return null;
}

export const DIALING_CODE_TO_COUNTRY: Record<string, string> = {
  '1': 'United States',
  '91': 'India',
  '44': 'United Kingdom',
  '61': 'Australia',
  '49': 'Germany',
  '33': 'France',
  '81': 'Japan',
  '86': 'China',
  '65': 'Singapore',
  '971': 'United Arab Emirates',
  '41': 'Switzerland',
  '31': 'Netherlands',
  '46': 'Sweden',
  '34': 'Spain',
  '39': 'Italy',
  '55': 'Brazil',
  '52': 'Mexico',
  '62': 'Indonesia',
  '27': 'South Africa',
  '82': 'South Korea',
  '353': 'Ireland',
  '64': 'New Zealand',
  '48': 'Poland',
  '47': 'Norway',
  '45': 'Denmark',
  '358': 'Finland',
};

export const COUNTRY_TO_DIALING_CODE: Record<string, string> = {
  india: '91',
  'united states': '1',
  'united states of america': '1',
  usa: '1',
  us: '1',
  canada: '1',
  'united kingdom': '44',
  uk: '44',
  australia: '61',
  germany: '49',
  france: '33',
  japan: '81',
  china: '86',
  singapore: '65',
  uae: '971',
  'united arab emirates': '971',
};

/**
 * Checks whether a container/listbox represents a country phone code selector.
 */
export function isCountryCodeSelector(
  container: Element,
  listbox: HTMLElement,
  targetValue: string,
): boolean {
  const normVal = normalize(targetValue);
  if (/^\+?\d{1,4}(\s|$)/.test(normVal.trim())) return true;
  if (COUNTRY_TO_DIALING_CODE[normVal]) return true;

  const desc = [
    container.getAttribute('id') || '',
    container.getAttribute('name') || '',
    container.getAttribute('data-automation-id') || '',
    container.getAttribute('aria-label') || '',
    listbox.getAttribute('id') || '',
    listbox.getAttribute('name') || '',
    listbox.getAttribute('data-automation-id') || '',
    listbox.getAttribute('aria-label') || '',
    container.closest('[data-automation-id*="formField"], .form-group, .field')?.textContent || '',
  ].join(' ').toLowerCase();

  return (
    desc.includes('countryphonecode') ||
    desc.includes('country-phone-code') ||
    (desc.includes('country') && (desc.includes('phone') || desc.includes('dialing') || desc.includes('code')))
  );
}

/**
 * Extracts a concise search query (country name or dialing code like "+91" or "India")
 * from a potential phone or country string, avoiding searching 10-digit subscriber numbers.
 */
export function extractCountrySearchQuery(targetValue: string): string {
  const norm = normalize(targetValue);
  // If targetValue is already a country name
  if (COUNTRY_TO_DIALING_CODE[norm]) {
    return targetValue.trim();
  }

  // If starts with + or contains dialing code like +91 9876543210
  const match = norm.match(/^\+?(\d{1,4})/);
  if (match) {
    const code = match[1];
    return `+${code}`;
  }

  // Check if any country name is mentioned in targetValue
  for (const country of Object.keys(COUNTRY_TO_DIALING_CODE)) {
    if (norm.includes(country)) {
      return country;
    }
  }

  return targetValue.trim();
}

/**
 * Finds a matching country code option element (e.g. matching "India (+91)" or "United States (+1)")
 * against target values like "+91", "91", "+91 9876543210", or "India".
 */
export function findCountryCodeOption(
  container: Element,
  targetValue: string,
): Element | null {
  const norm = normalize(targetValue);
  let dialingDigits: string | null = null;
  const targetCountries: string[] = [];

  // 1. Try to extract dialing code digits
  const digitMatch = norm.match(/^\+?(\d{1,4})/);
  if (digitMatch) {
    dialingDigits = digitMatch[1];
    const country = DIALING_CODE_TO_COUNTRY[dialingDigits];
    if (country) {
      targetCountries.push(normalize(country));
    }
  }

  // 2. Try to extract country name
  for (const [country, code] of Object.entries(COUNTRY_TO_DIALING_CODE)) {
    if (norm.includes(country)) {
      targetCountries.push(country);
      if (!dialingDigits) dialingDigits = code;
    }
  }

  const options = Array.from(
    container.querySelectorAll<HTMLElement>(
      '[role="option"], [data-automation-id*="promptOption"], li[role="option"], .quantumWizMenuPaperselectOption',
    ),
  );

  let bestOption: Element | null = null;
  let bestScore = 0;

  for (const opt of options) {
    const text = normalize(opt.textContent || '');
    let score = 0;

    // Direct exact text
    if (text === norm) {
      return opt;
    }

    // Dialing code match inside parentheses or with plus: (+91) or +91
    if (dialingDigits) {
      if (text.includes(`(+${dialingDigits})`) || text.includes(`+${dialingDigits}`) || text.includes(`(${dialingDigits})`)) {
        score += 85;
      }
    }

    // Country name match
    if (targetCountries.some((c) => text.includes(c))) {
      score += 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestOption = opt;
    }
  }

  return bestScore >= 70 ? bestOption : null;
}

/**
 * Fills an ARIA listbox, Workday select prompt, or custom combobox dropdown:
 * 1. Opens it via realistic pointer click on the trigger button.
 * 2. If it is a searchable combobox, types query into the search box and submits with Enter.
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
      '.OA0qNb, .exportSelectPopup, [data-automation-id="popupList"], [data-automation-id*="popup"], [data-automation-id*="menu"]',
    ) || (ownsId ? doc.getElementById(ownsId) : null)) as HTMLElement | null;
    if (popupEl && popupEl.style.display !== 'none' && !popupEl.hidden) {
      return true;
    }
    // Check if any popup portal is open in body (separate from the closed listbox trigger)
    const portals = Array.from(
      doc.querySelectorAll<HTMLElement>(
        '[data-automation-id="popupList"], [data-automation-id*="popup"], [data-automation-id*="menu"], [data-automation-id="select-options"], [data-automation-widget="wd-popup"], [data-uxi-element-id*="select"]',
      ),
    );
    for (const p of portals) {
      if (p !== listbox && !listbox.contains(p) && p.style.display !== 'none' && !p.hidden) {
        return true;
      }
    }
    return false;
  };

  // 2. Open listbox if closed
  if (!isCurrentlyOpen()) {
    listbox.focus();

    // Find the real trigger button
    const triggerEl = findDropdownTrigger(listbox);
    simulateFullClick(triggerEl);

    // Only dispatch Enter keyboard sequence if trigger is an input (NOT when a button was already clicked)
    if (triggerEl.tagName.toLowerCase() === 'input' || listbox.tagName.toLowerCase() === 'input') {
      const keyOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      const inputTarget = triggerEl.tagName.toLowerCase() === 'input' ? triggerEl : listbox;
      inputTarget.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
      inputTarget.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
      inputTarget.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
    }

    // Wait for options popup to open and render
    await waitForCondition(isCurrentlyOpen, isTest ? 20 : 250, 15);

    // If still closed, try clicking listbox element itself
    if (!isCurrentlyOpen()) {
      simulateFullClick(listbox);
      await waitForCondition(isCurrentlyOpen, isTest ? 20 : 150, 15);
    }
  }

  // Helper to locate active floating popup portal across roots and document body
  const getOpenPopup = (): Element => {
    const internalPopup = listbox.querySelector<HTMLElement>(
      '.OA0qNb, .exportSelectPopup, [data-automation-id="popupList"], [data-automation-id*="popup"], [data-automation-id*="menu"]',
    );
    if (internalPopup && internalPopup.style.display !== 'none') return internalPopup;

    if (ownsId) {
      const owned = doc.getElementById(ownsId);
      if (owned) return owned;
    }

    const bodyPortals = Array.from(
      doc.querySelectorAll<HTMLElement>(
        '[data-automation-id="popupList"], [data-automation-id*="popup"], [data-automation-id*="menu"], [data-automation-id="select-options"], [data-automation-widget="wd-popup"], [data-automation-id*="promptList"], [role="listbox"], [role="tree"], .workday-popup-portal, .OA0qNb, .exportSelectPopup',
      ),
    );
    for (const bp of bodyPortals) {
      if (bp !== listbox && bp.style.display !== 'none' && !bp.hidden) {
        return bp;
      }
    }

    return internalPopup || optionContainer;
  };

  const currentPopup = getOpenPopup();
  const isCountryField = isCountryCodeSelector(container, listbox, value);
  const candidates = extractCandidateValues(value);

  // 3. Searchable combobox support: identify active search box
  const searchInput = (
    currentPopup.querySelector<HTMLInputElement>(
      'input[data-automation-id*="search"], input[data-automation-id="searchBox"], input[data-automation-id="searchInput"], input.select2-search__field, input[type="search"], input[type="text"]',
    ) ||
    doc.querySelector<HTMLInputElement>(
      '[data-automation-id*="popup"] input, [data-automation-id*="menu"] input, [data-automation-widget="wd-popup"] input, .select2-search__field',
    ) ||
    (listbox.matches('input') ? (listbox as HTMLInputElement) : listbox.querySelector<HTMLInputElement>('input[role="combobox"], input[data-automation-id*="search"], input[type="text"]'))
  );

  const executeSearch = async (val: string) => {
    if (!searchInput) return;
    const query = isCountryField ? extractCountrySearchQuery(val) : val;
    fillTextInput(searchInput, query, doc);

    // Modern ATS like Workday require Enter keyboard sequence on the search box to query backend
    const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    searchInput.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
    searchInput.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

    const downOpts = { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true };
    searchInput.dispatchEvent(new KeyboardEvent('keydown', downOpts));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', downOpts));

    // Also click companion search button if present (Workday search icon button)
    const searchBtn =
      currentPopup.querySelector<HTMLElement>(
        'button[data-automation-id*="search"], [data-automation-id*="searchButton"], button[aria-label*="Search" i]',
      ) ||
      listbox.parentElement?.querySelector<HTMLElement>(
        'button[data-automation-id*="search"], [data-automation-id*="searchButton"], button[aria-label*="Search" i]',
      );
    if (searchBtn) {
      simulateFullClick(searchBtn);
    }

    // Wait for search query options to populate
    await waitForDynamicOptions(currentPopup, isTest ? 30 : 600);
  };

  const locateOption = (val: string): Element | null => {
    let opt = findOptionElement(currentPopup, val);
    if (!opt && isCountryField) {
      opt = findCountryCodeOption(currentPopup, val);
    }
    if (!opt && questionContainer) {
      opt = findOptionElement(questionContainer, val);
      if (!opt && isCountryField) {
        opt = findCountryCodeOption(questionContainer, val);
      }
    }
    if (!opt) {
      const openPopups = Array.from(
        doc.querySelectorAll<HTMLElement>(
          '[data-automation-id="popupList"], [data-automation-id*="popup"], [data-automation-id*="menu"], [data-automation-id="select-options"], [data-automation-widget="wd-popup"], [data-automation-id*="promptList"], [role="listbox"], [role="tree"], .workday-popup-portal',
        ),
      );
      for (const p of openPopups) {
        if (p.style.display !== 'none' && !p.hidden) {
          opt = findOptionElement(p, val) || (isCountryField ? findCountryCodeOption(p, val) : null);
          if (opt) return opt;
        }
      }
    }
    if (!opt) {
      opt = findOptionElement(doc.body, val);
      if (!opt && isCountryField) {
        opt = findCountryCodeOption(doc.body, val);
      }
    }
    return opt;
  };

  let option: Element | null = null;
  let chosenCandidate = value;

  // If a search input is present, immediately execute search query on primary candidate
  if (searchInput) {
    await executeSearch(candidates[0] || value);
  }

  for (const candidate of candidates) {
    // 1. Check if option already in DOM
    option = locateOption(candidate);

    // 2. Hierarchical category drill-down (e.g. "Job Board" for "LinkedIn")
    if (!option) {
      const categoryOpt = findMatchingCategoryOption(currentPopup, candidate) || findMatchingCategoryOption(doc.body, candidate);
      if (categoryOpt) {
        if (searchInput && searchInput.value) {
          fillTextInput(searchInput, '', doc);
          const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
          searchInput.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
          await waitForDynamicOptions(currentPopup, isTest ? 30 : 300);
        }
        const refreshedCat = findMatchingCategoryOption(currentPopup, candidate) || findMatchingCategoryOption(doc.body, candidate);
        if (refreshedCat) {
          simulateFullClick(refreshedCat as HTMLElement, { simulateHover: true });
          await waitForDynamicOptions(currentPopup, isTest ? 30 : 600);
          option = locateOption(candidate);
        }
      }
    }

    // 3. If not found and searchInput is present, type query and search
    if (!option && searchInput) {
      await executeSearch(candidate);
      option = locateOption(candidate);
      if (!option) {
        await waitForDynamicOptions(currentPopup, isTest ? 30 : 600);
        option = locateOption(candidate);
      }
    }

    if (option) {
      chosenCandidate = candidate;
      break;
    }
  }

  // If still not found, wait once more for dynamic backend options to settle
  if (!option) {
    await waitForDynamicOptions(currentPopup);
    for (const candidate of candidates) {
      option = locateOption(candidate);
      if (option) {
        chosenCandidate = candidate;
        break;
      }
    }
  }

  if (!option) return false;

  const targetVal =
    option.getAttribute('data-value') ||
    option.getAttribute('value') ||
    option.getAttribute('data-autofiller-option') ||
    chosenCandidate;

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
    // If option unmounted from DOM upon selection (standard Workday closing behavior), selection committed
    if (!option.isConnected) return true;
    if (option.getAttribute('aria-selected') === 'true') return true;
    if (hiddenInput && hiddenInput.value === targetVal) return true;
    const curLabel = findDropdownDisplayLabel(listbox);
    if (curLabel && curLabel.textContent?.trim() === (option.textContent?.trim() || targetVal)) return true;
    // If popup was closed after clicking option
    if (!isCurrentlyOpen()) return true;
    return false;
  };

  await waitForCondition(isSelectionCommitted, isTest ? 20 : 300, 15);

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

  // Ensure aria-selected is set on target option and unset on siblings if still connected
  if (option.isConnected) {
    const allSiblingOptions = Array.from(
      (currentPopup || listbox).querySelectorAll('[role="option"], .quantumWizMenuPaperselectOption, [data-automation-id*="promptOption"]'),
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
