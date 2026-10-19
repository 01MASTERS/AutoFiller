# Phase 17 Implementation Plan: Universal Form Filler & Multi-Platform Control Simulators

## Phase Objective
Refactor and expand AutoFiller's synthetic interaction layer into a modular, multi-platform form filling engine. Implement universal native element injection with full event lifecycles, advanced custom combobox/dropdown simulators supporting portals and search inputs (Workday, React-Select, Radix), universal radio & checkbox state reconcilers supporting hidden inputs and custom styling (Greenhouse, Lever, Workday), and an adaptive non-intrusive green glow visual feedback system. Ensure 100% backward compatibility with all 30 existing Google Forms tests.

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Extension** | [`extension/src/content/formFiller.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/formFiller.ts) | Monolithic 1062-line file tightly coupling Google Forms heuristics with basic native controls | Modularize into `extension/src/content/formFiller/` submodules; re-export `fillFormFields` from `formFiller.ts` |
| **Extension** | `extension/src/content/formFiller/events.ts` (NEW) | Logic embedded in `formFiller.ts` | Extract coordinate-aware pointer simulation (`simulateFullClick`), full event sequence dispatcher, and async polling helpers |
| **Extension** | `extension/src/content/formFiller/visualFeedback.ts` (NEW) | Basic `outline: 2px solid #22c55e` applied directly to element | Adaptive green glow (`box-shadow` + `outline`), visible element resolver (walks up to label/container if element is hidden), and clean state restoration |
| **Extension** | `extension/src/content/formFiller/simulators/inputSimulator.ts` (NEW) | Basic prototype setter in `formFiller.ts` | Full lifecycle (`focus` -> `focusin` -> setter -> `input` -> `change` -> `blur` -> `focusout`), `contenteditable` support, and custom wrapper resolution |
| **Extension** | `extension/src/content/formFiller/simulators/selectSimulator.ts` (NEW) | Specialized Google Forms closure menu and native select | Generalize native `<select>`, ARIA listboxes, Workday select buttons (`button[aria-haspopup="listbox"]`), body portal popups (`[data-automation-id="popupList"]`), and searchable comboboxes |
| **Extension** | `extension/src/content/formFiller/simulators/selectionReconciler.ts` (NEW) | Coupled with Google Forms DOM structures | Universal radio and checkbox reconciler with clickable target resolution (for hidden native inputs), state verification, and multi-platform "Other" companion text inputs |
| **Extension** | `extension/src/content/formFiller/simulators/dateSimulator.ts` (NEW) | Embedded in `formFiller.ts` | Modularize date parser (ISO, natural language, DD/MM/YYYY, MM/DD/YYYY) and multi-part date fillers |
| **Tests** | `extension/src/__tests__/formFiller.test.ts` | 30 existing Google Forms unit tests | Preserve 100% pass rate without modification |
| **Tests** | `extension/src/__tests__/universalFormFiller.test.ts` (NEW) | Does not exist | Add 15+ comprehensive unit tests covering HTML5, Greenhouse, Lever, Workday, combobox search, and visual glow |

---

## Detailed Task Breakdown

### Task 1: Event Dispatchers, Helpers & Visual Feedback Engine
**Files to Create**:
- [NEW] `extension/src/content/formFiller/events.ts`
- [NEW] `extension/src/content/formFiller/visualFeedback.ts`

**Action**:
1. In `events.ts`:
   - `simulateFullClick(el: HTMLElement, opts?: { simulateHover?: boolean })`:
     - Dispatches `scrollIntoView` if available.
     - Calculates bounding coordinates and dispatches `pointerover`, `pointerenter`, `pointerdown` (button 0, buttons 1), `mousedown`, `pointerup` (button 0, buttons 0), `mouseup`, and `click`.
   - `dispatchFullInputSequence(el: HTMLElement, value: string, doc: Document)`:
     - Dispatches `focus`, `focusin` (bubbles: true).
     - Invokes native prototype setter for `HTMLInputElement` or `HTMLTextAreaElement` (or sets `.value` directly).
     - Dispatches `input` (`InputEvent` with `bubbles: true, composed: true` or fallback `Event('input', { bubbles: true })`).
     - Dispatches `change` (`Event('change', { bubbles: true })`).
     - Dispatches `blur`, `focusout` (bubbles: true).
   - `waitForCondition(predicate: () => boolean, timeoutMs?: number, intervalMs?: number): Promise<boolean>`:
     - Async polling helper with immediate resolution for fast test runners (jsdom).
   - `normalize(s: string): string`:
     - Whitespace collapse and lowercase helper for fuzzy option comparisons.
2. In `visualFeedback.ts`:
   - `applyVisualFeedback(el: HTMLElement)`:
     - Resolves the *visible* element: if target element is hidden (`display: none`, `opacity: 0`, `visibility: hidden`, or `width === 0 && height === 0`), checks for associated `<label for="...">`, parent `<label>`, or closest container (`.form-group`, `[data-automation-id*="formField"]`, `[role="radiogroup"]`, `[role="group"]`).
     - Preserves previous styles (`boxShadow`, `outline`, `transition`) in element `dataset` or symbol.
     - Applies non-intrusive green glow:
       ```css
       outline: 2px solid #22c55e;
       box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.6), 0 0 8px rgba(34, 197, 94, 0.35);
       transition: outline 0.3s ease, box-shadow 0.3s ease;
       ```
     - Sets a 2000ms timer to cleanly restore original styles without memory leaks.

---

### Task 2: Universal Native Input & Rich Text Simulator
**Files to Create**:
- [NEW] `extension/src/content/formFiller/simulators/inputSimulator.ts`

**Action**:
1. Implement `fillTextInput(target: HTMLElement, value: string, doc: Document): boolean`:
   - Checks if `target` is a wrapper container (e.g. Workday `[data-automation-id="textInput"]` or div containing an input); if so, resolves the inner `input` or `textarea`.
   - **HTML5 Input & Textarea**:
     - Executes `dispatchFullInputSequence` using window prototype descriptors to bypass React/Vue/Angular synthetic setter tracking.
     - Handles numeric, telephone, email, password, and URL inputs cleanly.
   - **Rich Text / `contenteditable`**:
     - If `target.getAttribute('contenteditable') === 'true'` or `target.isContentEditable`:
       - Dispatches `focus` and `focusin`.
       - Sets `target.innerText = value` or `target.textContent = value`.
       - Dispatches `input` and `change`.
       - Dispatches `blur` and `focusout`.
   - Guards against disabled or readonly inputs (`disabled`, `aria-disabled="true"`, `readOnly`).
   - Invokes `applyVisualFeedback` on the filled element.

---

### Task 3: Universal Select & Combobox Simulator
**Files to Create**:
- [NEW] `extension/src/content/formFiller/simulators/selectSimulator.ts`

**Action**:
1. Implement `fillNativeDropdown(selectEl: HTMLSelectElement, value: string | string[], doc: Document): boolean`:
   - Supports both single and multi-select modes.
   - Multi-tier fuzzy matching: exact option value, exact option label, case-insensitive trimmed, substring match.
   - Updates `.selected` or `.value`.
   - Dispatches `input` and `change`.
   - Triggers updates on wrapped custom UI widgets if present (e.g. Greenhouse Chosen/Select2 containers, updating any visible display span).
2. Implement `fillAriaDropdown(container: Element, value: string, doc: Document): Promise<boolean>`:
   - Identifies the trigger button:
     - Standard Google Forms `.quantumWizMenuPaperselectDropDown`, `.vRMGwf`.
     - Workday `button[aria-haspopup="listbox"]`, `div[data-automation-id*="select"]`, `div[data-automation-id*="prompt"]`.
     - Generic `[role="combobox"]`, `[aria-haspopup="listbox"]`.
   - Opens the popup if closed (`simulateFullClick(trigger)`).
   - Locates option elements:
     - Inside listbox container.
     - Referenced by `aria-owns` or `aria-controls`.
     - Attached to `doc.body` in floating portals / dialogs (`[data-automation-id="popupList"]`, `ul[role="listbox"]`, `.OA0qNb`, `.exportSelectPopup`, `[role="menu"]`).
     - Inside closest question container.
   - **Searchable Combobox Support**:
     - If the popup or combobox contains an active search box (`input[data-automation-id="searchBox"]`, `input[role="combobox"]`, `input.select2-search__field`), types `value` into the input to trigger client-side filtering.
   - Locates matching option via `data-autofiller-option`, `data-value`, `value`, `aria-label`, or text content.
   - Simulates full click sequence with hover (`simulateHover: true`).
   - Synchronizes framework states:
     - Hidden form inputs (Google Forms `entry.*`, generic hidden inputs).
     - Trigger button display text label.
     - Sets `aria-selected="true"`.
     - Clears error banners (`[role="alert"]`, `.RDeBda`, `.hasError`).
   - Closes popup if still open.

---

### Task 4: Universal Selection Reconcilers & Date Simulator
**Files to Create**:
- [NEW] `extension/src/content/formFiller/simulators/selectionReconciler.ts`
- [NEW] `extension/src/content/formFiller/simulators/dateSimulator.ts`

**Action**:
1. In `selectionReconciler.ts`:
   - Click Target Resolver:
     - If the target input is visually hidden (`opacity: 0`, `position: absolute`), finds associated `<label for="...">`, parent `<label>`, or sibling styled indicator (`span.lever-checkbox`, `.checkbox-custom`, `span[role="checkbox"]`).
   - `fillRadioGroup(container: Element, value: string, doc: Document): Promise<boolean>`:
     - Matches radio option by `data-autofiller-option`, `value`, or text content.
     - Simulates click on the resolved clickable element.
     - Supports universal "Other" companion input:
       - Google Forms `.Hvn9fb`
       - Lever / Workday / Generic `input[name*="other" i]`, `input[placeholder*="other" i]`, or sibling text input in the same question container.
     - Verifies selection and applies visual feedback.
   - `fillCheckboxGroup(container: Element, values: string[] | boolean, doc: Document): Promise<boolean>`:
     - Standalone boolean checkboxes: compares current state with requested boolean; clicks only if state must toggle.
     - Multi-select checkbox groups: iterates over all checkboxes in container, normalizes keys, and toggles only those where current checked state does not match desired state.
     - Handles "Other" checkbox + custom text input.
     - Verifies final state and applies visual feedback.
2. In `dateSimulator.ts`:
   - `parseDateComponents(value: string)`:
     - Parses ISO (`YYYY-MM-DD`, `YYYY/MM/DD`).
     - Parses natural language (`5th Jan 2026`, `5 January 2026`, `Jan 5, 2026`).
     - Parses international / US numeric formats (`DD-MM-YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`).
   - `fillDateInput(target: HTMLElement, value: string, doc: Document): boolean`:
     - Fills multi-part date inputs (Google Forms `.exportDate`, Month/Day/Year triplets).
     - Fills native `<input type="date">`.
     - Fills text inputs adhering to placeholder guidance (`DD/MM/YYYY` vs `MM/DD/YYYY`).

---

### Task 5: Modular Orchestrator, Regression Verification & Universal Tests
**Files to Create/Modify**:
- [NEW] `extension/src/content/formFiller/index.ts`
- [MODIFY] `extension/src/content/formFiller.ts` (re-export `fillFormFields`)
- [NEW] `extension/src/__tests__/universalFormFiller.test.ts`

**Action**:
1. In `extension/src/content/formFiller/index.ts`:
   - Assemble `fillFormFields(mappings, fields, doc)`.
   - Route fields to appropriate simulators based on `controlType`.
   - Maintain O(1) field lookup, type-safety guards, and detailed failure/skipped reasons.
2. In `extension/src/content/formFiller.ts`:
   - Export all public APIs from `./formFiller/index.js`.
3. In `extension/src/__tests__/universalFormFiller.test.ts`:
   - Add 15+ comprehensive unit tests:
     - Full event dispatch on inputs (`focus`, `focusin`, `input`, `change`, `blur`, `focusout`).
     - `contenteditable` filling and event dispatch.
     - Greenhouse mock form filling (native `<select>` with Chosen/Select2 wrappers, text inputs).
     - Lever mock form filling (custom styled radio buttons, textareas, checkboxes).
     - Workday mock form filling (`button[aria-haspopup="listbox"]` select button with portal dropdown in body, `[data-automation-id="textInput"]` input wrapper, custom radio/checkbox).
     - Combobox with search input inside popup (type to filter, then click option).
     - Non-intrusive green glow on hidden inputs (highlights visible label/wrapper).
     - Idempotent multi-select checkbox reconciliation (checking desired, unchecking undesired).
     - Disabled/read-only input graceful handling.

---

## Verification Commands
```bash
# Run extension unit tests (existing 111 tests + 15+ new universal form filler tests)
npm run test -w extension

# Full project test suite (183+ total tests)
npm test

# Production bundle build (verify extension standalone IIFE build)
npm run build
```
