# Phase 17 Context: Universal Form Filler & Multi-Platform Control Simulators

## Phase Summary
Phase 17 transforms AutoFiller's synthetic interaction layer from a Google Forms-focused script into a **modular, universal form-filling engine**. It enables reliable simulation and value injection across standard HTML5 forms, rich text/contenteditable editors, custom UI component libraries (React-Select, Radix UI, Headless UI), and premier ATS portals (**Greenhouse, Lever, Workday, and generic company career sites**), while ensuring 100% backward compatibility with all existing Google Forms workflows and tests.

---

## Core Objectives & Architectural Scope

1. **Universal Native Element Injector & Full Event Sequence (`inputSimulator.ts`)**:
   - Standard HTML5 inputs (`text`, `email`, `tel`, `number`, `url`, `password`, `search`, `textarea`).
   - Prototype property setter injection (`HTMLInputElement.prototype`, `HTMLTextAreaElement.prototype`) to bypass React 16+ controlled component overrides.
   - Full synthetic event sequence:
     `focus` -> `focusin` (bubbles) -> value injection -> `input` (`InputEvent` / `Event` with bubbles: true) -> `change` (bubbles) -> `blur` -> `focusout` (bubbles).
   - Rich text / `contenteditable` element handling (`innerText` / `textContent` population with synthetic `input` and `change` events).
   - Automatic child input discovery when targets are custom wrapper elements (e.g. Workday `[data-automation-id="textInput"]`).
   - Readonly / disabled safeguards.

2. **Custom UI Select & Combobox Simulator (`selectSimulator.ts`)**:
   - **Native `<select>`**: Supports single and multi-select with fuzzy matching (exact value, exact text, trimmed lowercase, substring contains); updates custom wrappers (Chosen / Select2) if present.
   - **Workday Select Buttons & Comboboxes**:
     - Recognizes triggers: `button[aria-haspopup="listbox"]`, `div[data-automation-id*="select"]`, `div[data-automation-id*="prompt"]`, `div[data-automation-id*="dropdown"]`.
     - Opens dropdown popup and locates option elements inside body portals or popup lists (`[data-automation-id="popupList"]`, `ul[role="listbox"]`, `[role="listbox"]`).
     - Supports searchable comboboxes: types query into filter input (`input[data-automation-id="searchBox"]`, `input[role="combobox"]`) before option selection.
   - **Generic ARIA Listbox & Google Forms Popovers**:
     - Coordinates-aware pointer clicks, option hovering to satisfy Closure Menu / framework active states, hidden input synchronization, dynamic error banner dismissal, and clean popover closing.

3. **Universal Radio & Checkbox State Reconcilers (`selectionReconciler.ts`)**:
   - **Click Target Resolver**: In modern portals (Lever, Workday, Greenhouse), native inputs are often visually hidden (`opacity: 0`, `sr-only`). The reconciler identifies the associated `<label>`, parent `<label>`, or custom styled span to receive genuine pointer events.
   - **Universal Radio Reconciler**: Selects target radio, verifies active selection (`checked`, `aria-checked="true"`), and populates companion "Other" inputs across platforms (`.Hvn9fb`, `input[name*="other" i]`, `input[placeholder*="other" i]`).
   - **Universal Checkbox Reconciler**:
     - Standalone boolean checkboxes: checks if already in target state, toggles only if necessary.
     - Multi-select checkbox groups: idempotent reconciliation ensuring only target checkboxes remain selected, supporting companion "Other" text inputs.

4. **Non-Intrusive Green Glow Visual Confirmation (`visualFeedback.ts`)**:
   - Replaces basic outline with a multi-layered, non-intrusive green glow:
     - `outline: 2px solid #22c55e`
     - `box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.6), 0 0 8px rgba(34, 197, 94, 0.35)`
   - Visible element detection: If target input is zero-sized or visually hidden (`display: none`, `opacity: 0`), walks up to the visible parent `<label>` or container.
   - Preserves existing inline styles via data attributes and restores them cleanly after 2000ms.

5. **Modular Architecture**:
   - Follows the modular pattern established in Phase 15 (`domReader/`):
     - `extension/src/content/formFiller/index.ts`
     - `extension/src/content/formFiller/events.ts`
     - `extension/src/content/formFiller/visualFeedback.ts`
     - `extension/src/content/formFiller/simulators/inputSimulator.ts`
     - `extension/src/content/formFiller/simulators/selectSimulator.ts`
     - `extension/src/content/formFiller/simulators/selectionReconciler.ts`
     - `extension/src/content/formFiller/simulators/dateSimulator.ts`
   - `extension/src/content/formFiller.ts` acts as a re-export layer ensuring 100% backward compatibility for imports.

---

## Verification Strategy

- **Baseline Regression**: Verify all 30 existing Google Forms tests in `formFiller.test.ts` pass without modification.
- **Universal Test Suite**: Add `extension/src/__tests__/universalFormFiller.test.ts` covering:
  - Full input event sequence (`focus`, `focusin`, prototype setter, `input`, `change`, `blur`, `focusout`).
  - `contenteditable` container filling and event dispatch.
  - Greenhouse mock form filling (native `<select>` with Chosen/Select2 wrappers, text inputs).
  - Lever mock form filling (custom styled radio buttons, textareas, checkboxes).
  - Workday mock form filling (`button[aria-haspopup="listbox"]` select button with portal dropdown in body, `[data-automation-id="textInput"]` input wrapper, custom radio/checkbox).
  - Combobox with search input inside popup (type to filter, then click option).
  - Non-intrusive green glow on hidden inputs (highlights visible label/wrapper).
  - Idempotent multi-select checkbox reconciliation (checking desired, unchecking undesired).
