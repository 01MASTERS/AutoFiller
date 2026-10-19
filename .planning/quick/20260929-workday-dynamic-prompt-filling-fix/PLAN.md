# Quick Plan: 20260929-workday-dynamic-prompt-filling-fix

## Problem
When testing AutoFiller on live Workday job applications (`*.myworkdayjobs.com`), dropdown and prompt fields (such as Country, State/Province, and other single-choice select buttons) were either not mapped by the LLM or failed to fill during the simulation step.

## Root Cause Analysis
1. **LLM Prompt Omission for Dynamic/Empty-Option Fields (`backend/src/services/llm/promptBuilder.ts`)**:
   - Workday prompt buttons start in the DOM with 0 options (`options: []`, `optionSource: 'dynamic'`).
   - Rule 3 in `promptBuilder.ts` strictly commanded: *"NEVER invent an option that does not exist in the field's 'options' list"*, and Rule 10 stated: *"If it is an option field: select the closest estimated corrected option from the provided options list"*.
   - When `options` is empty, the LLM obeyed these rules and omitted the field (or returned empty), preventing any value from being mapped.
2. **Double-Toggle / Accidental Close in `selectSimulator.ts` (`fillAriaDropdown`)**:
   - After calling `simulateFullClick(triggerEl)` on a Workday `<button>`, `fillAriaDropdown` immediately dispatched synthetic `Enter` keyboard events (`keydown`/`keypress`/`keyup`).
   - On button elements, this triggered a second activation that immediately closed the popup that Workday had just opened.
3. **Rigid Body Portal Detection (`isCurrentlyOpen` and `popup` selector)**:
   - `isCurrentlyOpen()` only checked for `[data-automation-id="popupList"], .OA0qNb, .exportSelectPopup`.
   - Real Workday applications use a variety of floating portal selectors:
     `[data-automation-id*="popup"]`, `[data-automation-id*="menu"]`, `[data-automation-id*="select"]`, `[data-automation-widget="wd-popup"]`, `[role="listbox"]`, `[role="dialog"] [role="listbox"]`.
   - Because `isCurrentlyOpen()` returned `false`, it clicked the button a second time, closing the prompt. Furthermore, `popup` fell back to `optionContainer` (the `<button>`), which has no child options.
4. **Missing `Enter` Keypress in Workday Search Boxes**:
   - In Workday's prompt search popup, typing text into the search box (`[data-automation-id*="search"]`) does NOT trigger remote searching.
   - Workday requires the user to press `Enter` (or click the search button) to execute the query against the backend.
   - `fillTextInput` only dispatched `input/change/blur`, so Workday never loaded or rendered the search results.
5. **Selection Commitment Timeout on Popup Unmount**:
   - When an option is clicked in Workday, Workday often removes the floating popup from the DOM immediately.
   - `isSelectionCommitted` waited for `option.getAttribute('aria-selected') === 'true'` on the now-unmounted node, delaying completion.

## Proposed Solution
1. **Update `backend/src/services/llm/promptBuilder.ts`**:
   - Add explicit guidance for fields with empty options or `optionSource: 'dynamic'`: The LLM MUST deduce the best canonical profile value (e.g. Country -> "United States" or "India", State -> "California", Phone Code -> "+1") so the frontend simulator has a query target for search and selection.
2. **Refactor `selectSimulator.ts` (`fillAriaDropdown` & `findDropdownTrigger`)**:
   - Only dispatch `Enter` keyboard events when the element is an `<input>`, NOT when a `<button>` trigger was already clicked.
   - Broaden popup detection across `isCurrentlyOpen()` and `popup` resolution to support all modern Workday portal selectors (`[data-automation-id*="popup"]`, `[data-automation-id*="menu"]`, `[data-automation-widget="wd-popup"]`, `[role="listbox"]`, `div[role="dialog"]`).
   - Broaden search box detection in Workday popups (`input[data-automation-id*="search"]`, `input[data-automation-id="searchBox"]`, `input[type="search"]`).
   - After typing the value into the search box, dispatch `Enter` (`keydown`/`keypress`/`keyup` with `key: 'Enter'`, `keyCode: 13`) and await dynamic option arrival via `waitForDynamicOptions(popup)`.
   - Support Workday option text elements (`[data-automation-id*="promptOption"]`, `[data-automation-id*="menuItem"]`, `[data-automation-id*="promptOptionText"]`).
   - Check if the popup closed or the trigger label updated as positive confirmation of selection commitment.
3. **Refactor `workdayAdapter.ts`**:
   - Ensure all Workday prompt buttons and select controls are recognized, set to `optionSource: 'dynamic'` and `optionsLoaded: false` if options are empty.
4. **Comprehensive Automated Testing**:
   - Add unit tests in `extension/src/__tests__/dynamicFormsFiller.test.ts` or a new test suite simulating realistic Workday prompt interactions (portal attached to `document.body`, search input requiring `Enter`, delayed option arrival, and popup unmount upon click).
   - Add backend prompt builder test verifying that fields with `options: []` and `optionSource: 'dynamic'` produce valid mapped values from profile data.
5. **Verification**:
   - Run all backend and extension tests (`npm test`).
   - Run production builds (`npm run build`).
