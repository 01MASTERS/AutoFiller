---
task: dropdown-options-selection-fix
created: 2026-09-06
status: complete
description: Fix dropdown option genuine selection, hover state simulation, coordinate-based clicks, and eliminate broken forced text insertion
---

# Quick Task: Fix Dropdown Options Selection & Eliminate Forced Fake Insertion

## Objective
Fix dropdown option selection in Google Forms and custom ARIA listboxes so that dropdowns are genuinely opened, hovered, and clicked through natural component event simulation. Eliminate the issue where AutoFiller fails to trigger component selection and instead falls back to forcibly inserting text/hidden values into the DOM without genuine selection.

## Root Causes Identified
1. **Trigger Target Misdirection**: In `fillAriaDropdown`, `listbox.querySelector('[tabindex="0"]')` resolved to the hidden "Choose" option inside the closed popup (`.OA0qNb`) rather than the dropdown trigger button. Clicking a hidden option inside a closed container never opened the dropdown.
2. **Zero-Coordinate Clicks & Closure Outside-Click Dismissal**: `simulateFullClick` dispatched `PointerEvent` and `MouseEvent` with default `clientX: 0, clientY: 0`. Google Forms Closure component uses coordinate collision detection to detect outside clicks; clicks at (0, 0) caused Closure to interpret the click as an outside click, immediately dismissing the menu without selecting the option.
3. **Missing Hover / Highlight State**: Google Forms Closure dropdown items require `mouseover` / `pointerenter` before `mousedown` / `click` to set the active `highlightedItem_`. Without hover events, click commits were ignored.
4. **Blind 40ms Delay**: Fixed 40ms timeout was insufficient for Google Forms animations and DOM transitions; opening and selection must be awaited reactively using `waitForCondition`.
5. **Fake Insertion Fallback**: When the above failures occurred, `fillAriaDropdown` forcibly overwrote `labelEl.textContent` and `hiddenInput.value` without the internal component model updating, leaving the form in an invalid state with visible validation errors.

## Implementation Steps
1. **Accurate Trigger Element Detection**:
   - Create `findDropdownTrigger(listbox)` that targets `.vRMGwf:not([role="option"] *)`, `.quantumWizMenuPaperselectDropDown`, `.ry3kXd`, or `listbox` itself, explicitly excluding any descendant with `role="option"` or inside `.OA0qNb` / `.exportSelectPopup`.
2. **Coordinate & State-Aware Click Simulation**:
   - Enhance `simulateFullClick` to calculate center bounding-box coordinates (`clientX`, `clientY`) via `getBoundingClientRect()`.
   - Include `button: 0, buttons: 1` on down events and `buttons: 0` on up/click events.
   - Dispatch `pointerover`, `mouseover`, and `pointerenter` before clicking options to activate Closure component item highlight.
3. **Reactive State Settlement**:
   - Use `waitForCondition` to await popup expansion (`aria-expanded="true"` or popup style `display !== 'none'`).
   - After clicking the option, use `waitForCondition` to await selection commitment (`aria-selected="true"`, menu closure, or hidden input update).
4. **Clean Fallback & Styling Sync**:
   - Synchronize underlying hidden `entry.XXXX` input and accessibility attributes cleanly without leaving artificial grey text or uncleared validation errors.
5. **Testing**:
   - Add unit tests in `extension/src/__tests__/formFiller.test.ts` replicating Google Forms closed dropdowns, coordinate clicks, and Closure component lifecycle.
   - Verify all tests in extension and backend pass.
