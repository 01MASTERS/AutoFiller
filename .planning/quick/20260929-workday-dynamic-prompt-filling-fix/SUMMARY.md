# Quick Task Summary: Fix Workday Dynamic Prompt Detection, LLM Mapping & Portal Filling

**Slug**: `workday-dynamic-prompt-filling-fix`  
**Date**: 2026-09-29  
**Status**: Complete ✓  

---

## 1. Overview of the Problem
When attempting to autofill on live Workday job applications (`*.myworkdayjobs.com`), dropdown and prompt fields (e.g., Country, State/Province, and other single-choice select buttons) were either omitted by the LLM or failed to fill during the simulation step:
> *"tried on workday for the same feature i dunno if it mapped the values correctly but atleast it didnt fill em"*

---

## 2. Root Cause Analysis
1. **LLM Prompt Omission for Dynamic/Empty-Option Fields (`backend/src/services/llm/promptBuilder.ts`)**:
   - Workday prompt buttons begin in the DOM with 0 options (`options: []`, `optionSource: 'dynamic'`).
   - Rule 3 in `promptBuilder.ts` commanded: *"NEVER invent an option that does not exist in the field's 'options' list"*, and Rule 10 stated: *"If it is an option field: select the closest estimated corrected option from the provided options list"*.
   - Because `options` was empty, LLMs strictly followed these rules and omitted the field from the mapping output.
2. **Double-Toggle / Accidental Close in `selectSimulator.ts` (`fillAriaDropdown`)**:
   - After calling `simulateFullClick(triggerEl)` on a Workday `<button>`, `fillAriaDropdown` immediately dispatched synthetic `Enter` keyboard events (`keydown`/`keypress`/`keyup`).
   - On button elements, this triggered a second activation that immediately closed the popup that Workday had just opened.
3. **Rigid Body Portal Detection (`isCurrentlyOpen` and `popup` selector)**:
   - `isCurrentlyOpen()` only checked for `[data-automation-id="popupList"], .OA0qNb, .exportSelectPopup`.
   - Real Workday applications use a variety of floating portal selectors:
     `[data-automation-id*="popup"]`, `[data-automation-id*="menu"]`, `[data-automation-id*="select"]`, `[data-automation-widget="wd-popup"]`, `[role="listbox"]`.
   - Because `isCurrentlyOpen()` returned `false`, it clicked the button a second time, closing the prompt.
4. **Missing `Enter` Keypress in Workday Search Boxes**:
   - In Workday's prompt search popup, typing text into the search box (`[data-automation-id*="search"]`) does NOT trigger remote searching.
   - Workday requires the user to press `Enter` (or click the search button) to execute the query against the backend.
   - `fillTextInput` only dispatched `input/change/blur`, so Workday never loaded or rendered the search results.
5. **Selection Commitment Timeout on Popup Unmount**:
   - When an option is clicked in Workday, Workday often removes the floating popup from the DOM immediately.
   - `isSelectionCommitted` waited for `option.getAttribute('aria-selected') === 'true'` on the unmounted node, causing a timeout.
6. **Zod Validation HTTP 400 on `platformFieldType: 'source'`**:
   - `workdayAdapter.ts` tagged the "How did you hear about us?" field as `platformFieldType: 'source'`.
   - In `backend/src/types/profile.ts`, `platformFieldType` was constrained to a strict Zod enum that lacked `'source'`.
   - When the extension sent the 20 scanned fields to `POST /autofill`, Zod rejected the payload with HTTP 400 (`#BACKEND_HTTP_ERROR: Invalid request payload`).

---

## 3. Changes Made

### A. Backend Payload Validation & Type Sync (`shared/src/index.ts`, `backend/src/types/profile.ts`)
- Added `'source'` to `PlatformFieldType` in `shared/src/index.ts` and `fieldMetadataSchema` in `backend/src/types/profile.ts`.
- Added `.passthrough()` to `fieldOptionSchema` to prevent options with extra properties from failing validation.
- Enhanced `extension/src/background/background.ts` to log specific validation issue paths (`errData.details`) on backend HTTP 400 errors.

### B. Backend LLM Mapping Instructions (`backend/src/services/llm/promptBuilder.ts`)
- Added **Rule 16**: Instructs LLM that for fields with empty options (`options: []`) or `optionSource: "dynamic"` / `"cascading"` (such as Workday prompt buttons, async country/state dropdowns, and search comboboxes), the LLM must NOT omit the field, but instead extract or deduce the canonical profile text value (e.g. Country $\to$ `"United States"` or `"India"`, State $\to$ `"California"`, Phone Code $\to$ `"+91"` or `"India"`).
- Added **Rule 6b**: Instructs LLM on Phone Country Code disambiguation. Map country code fields to dialing code (e.g. `"+91"` or `"India"`) and companion phone number fields to subscriber digits only (e.g. `"9135517396"`). NEVER output 10-digit subscriber numbers into country code pickers.
- Updated **Rule 14**: Clarified source/discovery questions (`"How did you hear about us?"`, `"Source"`) to map to preferred sources like `"LinkedIn"`, `"Indeed"`, `"Job Board"`.
- Added explicit cross-reference in Rule 3 redirecting empty-option fields to Rule 16.

### B. Workday Platform Adapter (`extension/src/content/domReader/adapters/workdayAdapter.ts`)
- Broadened prompt button detection to match `button[data-automation-id*="prompt"]`, `button[aria-haspopup="listbox"]`, `button[aria-haspopup="true"]`, and `[data-automation-id*="select"]`.
- When options are empty, sets `optionSource: 'dynamic'` (or `'cascading'` if `parentFieldId` exists) and `optionsLoaded: false`.
- Disambiguated `Country Phone Code`, `Phone Device Type`, `Phone Extension`, and `Phone Number`.
- Disambiguated `How did you hear about us?` (`source`).

### C. Select & Combobox Simulator (`extension/src/content/formFiller/simulators/selectSimulator.ts`)
- **Hierarchical Category Drill-Down**:
  - Defined `SOURCE_CATEGORY_MAP` mapping leaf sources (e.g. `LinkedIn`, `Indeed`, `Glassdoor`) to parent categories (`Job Board`, `Campus Campaign`, `Social Media`, etc.).
  - Added `findMatchingCategoryOption(container, value)`: If the leaf source is not yet in the DOM (because Workday initially only renders top-level categories), detects and clicks the parent category (e.g. `Job Board`).
  - Waits for dynamic sub-options to load, then selects the leaf option (`LinkedIn`).
  - Handles pre-search check to prevent client-side search inputs from filtering out category buttons.
- **Smart Country Phone Code Resolution**:
  - Defined `DIALING_CODE_TO_COUNTRY` and `COUNTRY_TO_DIALING_CODE` tables.
  - Added `isCountryCodeSelector` and `extractCountrySearchQuery`: Only types the dialing code (e.g. `+91`) or country name (`India`) into the search box, never raw 10-digit subscriber numbers.
  - Added `findCountryCodeOption`: Scores candidate options using dialing code regex (`(+91)` or `+91`) and country name matches (`India (+91)`), selecting the best match.
- **Subscriber Phone Number Normalization** (`extension/src/content/formFiller/index.ts`):
  - When filling a subscriber phone number field and a companion Country Phone Code field exists in the form, automatically strips any leading country code prefix (e.g. `"+91 9135517396"` $\to$ `"9135517396"`).
- **Prevent Double-Toggle**: In `fillAriaDropdown`, only dispatch `Enter` keyboard events when the trigger is an `<input>`, avoiding accidental closure of `<button>` dropdowns.
- **Broaden Floating Portal Detection**: Updated `isCurrentlyOpen()` and `getOpenPopup()` to support all modern Workday portal selectors (`[data-automation-id*="popup"]`, `[data-automation-id*="menu"]`, `[data-automation-widget="wd-popup"]`, `[data-automation-id="select-options"]`).
- **Workday Search Execution**: When a search input is present in the popup, types query and dispatches `Enter` (`keydown`/`keypress`/`keyup`), then awaits dynamic option settlement.
- **Portal Unmount Commitment**: In `isSelectionCommitted`, immediately recognizes selection success if the option was unmounted from the DOM (`!option.isConnected`) or the popup closed upon click.

### D. Automated Test Coverage
- `extension/src/__tests__/workdayPromptSimulator.test.ts` (5 tests passing):
  - Simulates Workday prompt button opening a body portal with search box requiring `Enter`.
  - Simulates pre-rendered floating menu options.
  - Full end-to-end `fillFormFields` on Workday text inputs and prompt comboboxes.
  - **Hierarchical Category Drill-Down**: Initial popup displays categories (`Job Board`, `Campus Campaign`, `Social Media`); simulator clicks `Job Board`, sub-options appear (`LinkedIn`, `Indeed`, `Glassdoor`), and simulator selects `LinkedIn`.
  - **Country Phone Code Dynamic Resolution**: Prompt opens with `India (+91)`, `United States of America (+1)`, etc.; simulator resolves and selects `India (+91)`, and phone input receives stripped `9135517396`.
- `backend/src/__tests__/promptBuilder.test.ts` (10 tests passing):
  - Validates that dynamic / empty-option fields generate Rule 16 instructions.
  - Validates Rule 6b Country Phone Code and Rule 14 Job Source instructions.

---

## 4. Verification Results
- **Extension Tests**: 188 / 188 passed across 19 suites.
- **Backend Tests**: 100 / 100 passed across 14 suites.
- **Total**: 288 / 288 passed across monorepo with 0 errors.
- **Production Build**: Clean build across `shared`, `extension`, and `backend`.
