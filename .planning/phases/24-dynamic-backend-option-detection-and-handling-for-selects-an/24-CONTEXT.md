# Phase 24 Context: Dynamic Backend Option Detection & Handling for Selects and MCQs

## Phase Summary

Phase 24 equips AutoFiller with advanced intelligence for detecting and handling dynamic, backend-fetched selection choices across diverse web forms and modern ATS platforms. In many enterprise job boards and modern web apps (Workday, Greenhouse, Lever, SmartRecruiters, React/Angular single-page apps), dropdowns, comboboxes, and MCQ options (such as country calling codes, state/province lists, and job categories) are fetched asynchronously via REST/GraphQL APIs or rendered lazily upon user interaction, rather than statically pre-rendered in HTML `<option>` tags.

This phase provides:
1. Heuristics to reliably classify form controls as having hardcoded static options vs. dynamic backend-fetched options vs. cascading dependencies.
2. An asynchronous probing and mutation settlement engine to wait for remote options to render before or during fill operations.
3. Topological dependency ordering to guarantee upstream fields (e.g. Country) are filled and settled first, allowing downstream dependent fields (e.g. State/Province) to be populated by backend APIs before attempting selection.
4. Just-in-Time (JIT) option extraction and resilient matching for typeaheads, searchable comboboxes, and dynamic selects.

---

## Core Objectives & Architectural Scope

1. **Shared Metadata Contracts (`@autofiller/shared`)**:
   - Extend `FieldMetadata` with:
     - `optionSource?: 'static' | 'dynamic' | 'cascading'`
     - `parentFieldId?: string` (references upstream trigger field)
     - `optionsLoaded?: boolean`
     - `dynamicState?: { isAsync?: boolean; requiresInputToSearch?: boolean }`
   - Maintain full backward compatibility for standard text and static fields.

2. **Static vs. Dynamic Heuristic Classifier (`domReader/`)**:
   - `optionParser.ts` and `controls/dropdown.ts`:
     - Classify as `static`: $> 1$ valid non-placeholder options exist in DOM.
     - Classify as `dynamic`: $0$ options or only $1$ placeholder option, `aria-busy="true"`, empty `role="combobox"` with `aria-autocomplete`, or remote attributes (`data-url`, `data-source`, `data-remote`, `data-endpoint`, `select2-ajax`, `[data-automation-id*="prompt"]`).
     - Classify as `cascading`: paired semantic names (Country $\to$ State/Province, Region $\to$ City) where child field is disabled or empty while parent is unselected.

3. **Dynamic Option Settlement Engine (`domReader/dynamicOptionSettler.ts`)**:
   - `waitForDynamicOptions(container, timeoutMs)`: Uses `MutationObserver` on candidate option containers and body popovers to resolve when child option nodes are appended and loading state resolves.
   - `waitForFieldEnabled(element, timeoutMs)`: Observes reactive removal of `disabled` or `aria-disabled` attributes on cascading child elements.
   - `extractLiveOptions(field, element, doc)`: Re-extracts options dynamically from the DOM at fill-time.

4. **Dependency-Aware Topological Form Filling (`formFiller/index.ts` & `selectSimulator.ts`)**:
   - Sort mapped fields into topological execution order based on `parentFieldId`.
   - Execute upstream parent fields first, trigger synthetic event cycle (`focus` $\to$ `input` $\to$ `change` $\to$ `blur`), and wait for dependent child fields to enable and load options.
   - In `fillAriaDropdown` and `fillNativeDropdown`: if options are not yet loaded, wait for settlement or simulate search input on typeahead comboboxes, dynamically match against candidate values, and click the matching choice.

5. **Test Fixtures & E2E Validation**:
   - Add a `/test-forms/dynamic-options` interactive fixture with delayed mock API responses simulating country/state cascading dropdowns and async comboboxes.
   - Add comprehensive unit and integration tests across `@autofiller/shared`, `extension`, and `backend`.

---

## Verification Strategy
- **Unit Tests**:
  - `extension/src/__tests__/dynamicOptionDetection.test.ts`: Validates classification of static, dynamic, and cascading fields.
  - `extension/src/__tests__/dynamicOptionSettler.test.ts`: Validates `MutationObserver` settlement and timeout guarantees.
  - `extension/src/__tests__/dynamicFormsFiller.test.ts`: Validates topological fill order, cascading waits, and JIT matching.
- **Monorepo Test Suite**: 261+ existing tests pass with 0 regressions.
- **Clean Build**: `npm run build` succeeds without TypeScript or bundling errors.
