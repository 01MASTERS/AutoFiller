# Phase 24 Research: Dynamic Backend Option Detection & Handling

## Domain & Objective

Modern web applications, career portals, and enterprise ATS platforms (Workday, Greenhouse, Lever, SmartRecruiters, Salesforce, dynamic React/Angular/Vue portals) increasingly populate selection options dynamically via asynchronous backend API calls rather than hardcoding static `<option>` elements in the initial HTML document. 

Common real-world examples:
- **Phone Country Codes**: `<select>` or combobox containing hundreds of international calling codes (`+1`, `+44`, `+91`, etc.) fetched from an endpoint on component mount or first interaction.
- **Cascading Location Fields**: "Country" selection triggers an asynchronous request (e.g. `GET /api/states?country=US`) that dynamically populates the "State / Province / Region" dropdown or radio group. The child field is initially empty and disabled until the parent is filled.
- **Searchable Combobox / Typeahead Controls**: Dropdown menus that remain empty until the user clicks into the field or types 1–3 characters, querying a remote search API (e.g., job titles, universities, nationalities).
- **MCQ Radio / Checkbox Groups**: Dynamic question blocks rendered via template engines or client-side fetch after page load.

---

## 1. Static (Hardcoded) vs. Backend-Fetched Options: Detection Heuristics

To reliably distinguish between fields with hardcoded options and fields whose options are fetched from the backend, the DOM reader must evaluate a multi-tier heuristic cascade at scan time:

### Tier 1: Static Option Count & Placeholder Pruning
- **Native `<select>`**:
  - Evaluate `select.options` using `isPlaceholderOption(label, value, disabled, selected)`.
  - **Static**: Number of non-placeholder options $> 1$.
  - **Dynamic (Pending)**: Number of non-placeholder options is $0$, or only $1$ placeholder option exists (e.g., `"Select a country"`, `"Loading..."`, `"Please wait..."`, `value=""`, `disabled`).
- **ARIA Listbox / Combobox**:
  - Query options using `[role="option"]`, `.OA0qNb`, or the element targeted by `aria-owns` / `aria-controls`.
  - **Static**: Multiple option elements exist in the DOM with text/values.
  - **Dynamic (Empty / Collapsed)**: The referenced option container is empty or does not exist in the DOM prior to interaction.

### Tier 2: Accessibility & Remote Framework Attributes
- **Standard ARIA Signals**:
  - `aria-busy="true"`: Indicates the component is actively awaiting an async payload.
  - `role="combobox"` with `aria-autocomplete="list"` or `aria-autocomplete="both"`: Strong indicator of dynamic search/filter listboxes.
  - `aria-expanded="false"` paired with an empty target listbox: Indicates lazy-loaded options.
- **Framework & ATS Remote Attributes**:
  - `data-source`, `data-remote`, `data-url`, `data-endpoint`, `data-ajax`: Remote data source URLs.
  - Select2 / Chosen AJAX markers: `.select2-ajax`, `data-ajax--url`, `.chosen-ajax`.
  - Workday Prompt Buttons: `[data-automation-id*="prompt"]` buttons that open remote dialog searches.
  - Async UI classes: `.is-loading`, `.async-select`, `spl-select`, `.loading-spinner`, `.skeleton`.

### Tier 3: Cascading / Relational Dependency Analysis
- **Semantic Pairing Rules**:
  - `Country` $\to$ `State` / `Province` / `Region`
  - `State` $\to$ `City` / `County`
  - `Department` $\to$ `Sub-team` / `Role`
  - `Category` $\to$ `Sub-category`
- **Disabled State Correlation**:
  - A choice field (e.g. `state`) that is `disabled` or has `aria-disabled="true"` while its preceding paired field (`country`) is empty/unselected is classified as `optionSource: 'cascading'` with `parentFieldId` linked to the upstream field.

---

## 2. Dynamic Option Settlement & Probing Mechanics

When a field is identified as dynamic or cascading, AutoFiller cannot rely on options present in the static DOM. It must coordinate interactive probing and mutation settlement:

### A. Non-Disruptive Interaction Probing
1. **Focus / Trigger Simulation**:
   - For comboboxes and custom dropdowns with 0 options, the filler simulates a pointer click on the trigger button (e.g. chevron or input).
2. **Mutation Observer Loop**:
   - Attach a `MutationObserver` on the target listbox, container, or document body (for portaled popovers like React-Select, Popper.js, or Floating-UI).
   - Listen for `childList` additions matching `[role="option"]` or `<option>` and attribute changes (`aria-busy="false"`).
3. **Debounce & Settle Timeout**:
   - Wait up to a configurable timeout (default 800ms–1500ms; in unit tests 50ms) for DOM mutations to settle.
   - If options appear, parse them immediately using `extractSelectOptions` or `extractAriaListboxOptions`.
   - If the probe was speculative (pre-fill), restore original closed state if needed, or proceed directly to selection if actively filling.

### B. Cascading Topological Execution Order
In standard autofill, fields are processed in document DOM order. However, with cascading fields:
- If `state` appears before or without waiting for `country`, the fill will fail because `state` options have not been retrieved from the backend.
- **Topological Sorting**:
  1. Build a dependency DAG from `parentFieldId` references.
  2. Order fields so upstream parent fields are filled first.
  3. After filling an upstream field, dispatch full event cycle (`focus` $\to$ `input` $\to$ `change` $\to$ `blur`).
  4. Wait for the downstream dependent field to become enabled (`!disabled`) and for its child options to populate (`options.length > 0`).

---

## 3. Just-In-Time (JIT) Option Matching & Selection

When an async field's options are loaded only on demand:
- **LLM Mapping**: The LLM prompt can either receive:
  1. Profile data and field labels without static options, instructed to provide canonical names/codes (e.g., `"United States"`, `"CA"`).
  2. Or, if options are probed at scan time, the full fetched option list.
- **JIT Option Seeker**:
  - When the simulator clicks the trigger and options settle in the DOM, re-scan the live options.
  - Use normalized string comparison (exact value $\to$ exact label $\to$ normalized lowercase $\to$ partial token match) against the desired mapped value.
  - If the control is a searchable combobox requiring user input to filter backend results, simulate typing the candidate text into the search input, wait for filtered search results, and click the matching item.

---

## 4. Architectural Integration Points

1. **`@autofiller/shared`**:
   - Add `OptionSource = 'static' | 'dynamic' | 'cascading'` to `FieldMetadata`.
   - Add `parentFieldId?: string`, `optionsLoaded?: boolean`, and `dynamicOptionsState` to track async readiness.
2. **`extension/src/content/domReader/`**:
   - Add `detectOptionSource()` to `optionParser.ts` and `controls/dropdown.ts`.
   - Add `detectCascadingDependencies(fields)` to link child fields to parent fields.
   - Add `dynamicOptionSettler.ts` providing `waitForDynamicOptions()` and `waitForFieldEnabled()`.
3. **`extension/src/content/formFiller/`**:
   - Update `fillFormFields()` to sort execution topologically and await cascading downstream updates.
   - Update `fillNativeDropdown` and `fillAriaDropdown` to invoke dynamic option settlement when options are pending.
4. **Backend Test Fixtures & E2E**:
   - Provide `/test-forms/dynamic-options` in `shared/src/fixtures/mockForms.ts` and `backend/src/routes/api.ts` with delayed backend responses (`setTimeout`) to test async option loading and cascading dependencies under automated Vitest suites.
