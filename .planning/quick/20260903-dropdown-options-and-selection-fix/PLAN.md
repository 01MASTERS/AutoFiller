---
status: complete
date: 2026-09-03
slug: dropdown-options-and-selection-fix
---

# Fix Dropdown Option Extraction, Logging, and Synthetic Selection

## Problem
1. Dropdown options were failing to extract on Google Forms.
2. Extracted options for dropdowns and single choice (radios) were not visible in the Debug Dashboard or backend logs.
3. Dropdown selection failed on the live page even when the LLM returned a valid mapping.
4. Nested radio containers caused duplicate field entries (e.g. `i27` and `i27-2`).

## Root Cause
1. `extractAriaListboxOptions` was discarding options using `isElementHidden(optEl)`. Because closed Google Forms dropdown menus have `display: none` on their popup container, all options were skipped as "hidden".
2. Google Forms option menus are often siblings of the `role="listbox"` button inside the question container rather than direct children.
3. `background.ts` and `api.ts` stripped `options` and `optionsCount` when formatting fields for logs, so users could not verify what was extracted.
4. Calling `(option as HTMLElement).click()` alone was insufficient for Google Forms Closure components, which listen to `mousedown` and `pointerdown` to register the active item before the click event.
5. Content script logs failed to reach the backend due to Mixed Content security (HTTPS Google Forms to HTTP backend localhost).

## Solution
1. In `domReader.ts`:
   - Removed `isElementHidden` check from `extractAriaListboxOptions` so closed dropdown options are preserved.
   - Tagged each extracted option with `data-autofiller-option`.
   - Added question-container fallback so sibling option popups are found.
   - Deduplicated radio and checkbox group discovery to eliminate duplicate fields.
   - Resolved accessible labels against the question container.
2. In `formFiller.ts`:
   - Implemented `simulateFullClick(el)` to dispatch `pointerdown` -> `mousedown` -> `pointerup` -> `mouseup` -> `click`.
   - In `fillAriaDropdown`: searched both option container and question container, updated underlying Google Forms hidden entry inputs (`input[name*="entry."]`), updated visible button text, and set `aria-selected="true"`.
   - Updated `fillRadioGroup` and `fillCheckboxGroup` to use `simulateFullClick` and synchronize hidden inputs.
3. In `background.ts` and `api.ts`:
   - Logged `controlType`, `selectionMode`, `optionsCount`, and `options` in `SCAN_FIELDS_SUCCESS` and `LLM_RESPONSE` / `LLM_ZERO_MAPPINGS`.
   - Added `RELAY_LOG` message handler to relay content script logs through the background service worker.
