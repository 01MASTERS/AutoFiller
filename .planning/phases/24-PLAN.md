# Phase 24 Implementation Plan: Dynamic Backend Option Detection & Handling for Selects and MCQs

## Phase Objective
Equip AutoFiller with comprehensive capabilities to detect, classify, probe, and fill form fields (dropdowns, ARIA comboboxes, and MCQ groups) whose options are fetched asynchronously from backend APIs or lazy-loaded on interaction. Resolve cascading parent-child dependencies (e.g. Country $\to$ State/Province), provide mutation-based option settlement, and implement Just-in-Time (JIT) option matching.

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Shared Contracts** | [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts) | `FieldMetadata` only tracks static `options?: FieldOption[]` | Add `optionSource?: 'static' \| 'dynamic' \| 'cascading'`, `parentFieldId?: string`, `optionsLoaded?: boolean`, and `dynamicState` |
| **DOM Option Parser** | [`extension/src/content/domReader/optionParser.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/optionParser.ts) | Parses static `<select>` and ARIA listboxes once | Add `detectOptionSource()`, placeholder filtering, and live option re-extraction |
| **DOM Scanner** | [`extension/src/content/domReader/controls/dropdown.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/controls/dropdown.ts) | Scans dropdowns assuming options are present | Flag dynamic/empty controls, check `aria-busy` and remote attributes |
| **Field Discovery** | [`extension/src/content/domReader/fieldDiscovery.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/fieldDiscovery.ts) | Discovers and sorts fields by DOM position | Add cascading dependency linking pass (`linkCascadingFields`) connecting children to parents |
| **Settlement Engine** | `extension/src/content/domReader/dynamicOptionSettler.ts` (NEW) | Does not exist | Implement `waitForDynamicOptions()`, `waitForFieldEnabled()`, and `extractLiveOptions()` with `MutationObserver` |
| **Form Filler Orchestrator** | [`extension/src/content/formFiller/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/formFiller/index.ts) | Fills fields in raw mapped order | Sort execution topologically by `parentFieldId` and await child option settlement after upstream filling |
| **Control Simulators** | [`extension/src/content/formFiller/simulators/selectSimulator.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/formFiller/simulators/selectSimulator.ts) | Attempts immediate option find; fails if options not yet rendered | Await dynamic settlement, simulate typeahead search input for remote comboboxes |
| **Test Forms Hub** | [`shared/src/fixtures/mockForms.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/fixtures/mockForms.ts) & [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts) | Contains static ATS fixtures (Greenhouse, Lever, Workday) | Add `/test-forms/dynamic-options` with async Country, cascading State, and remote search combobox |

---

## Plan Waves Breakdown

### Plan 24-01: Shared Schema Extensions & Static vs. Dynamic Option Classification
- **Wave**: 1
- **Focus**: Data contract & DOM scanner classification
- **Key Deliverables**:
  - `shared/src/index.ts`: `OptionSource`, `FieldMetadata.optionSource`, `FieldMetadata.parentFieldId`, `FieldMetadata.optionsLoaded`
  - `domReader/optionParser.ts` & `utils.ts`: `detectOptionSource()`, `hasRemoteDataAttributes()`, `isAsyncCombobox()`
  - `domReader/controls/dropdown.ts`: Tag fields with classification
  - `domReader/fieldDiscovery.ts`: `linkCascadingFields(fields)`
  - Unit tests: `extension/src/__tests__/dynamicOptionDetection.test.ts`

### Plan 24-02: Dynamic Option Probing & Mutation Settlement Engine
- **Wave**: 2 (depends on 24-01)
- **Focus**: Runtime settlement and mutation observers
- **Key Deliverables**:
  - `domReader/dynamicOptionSettler.ts`: `waitForDynamicOptions()`, `waitForFieldEnabled()`, `extractLiveOptions()`
  - Unit tests: `extension/src/__tests__/dynamicOptionSettler.test.ts`

### Plan 24-03: Dependency-Aware Topological Form Filling & JIT Resolution
- **Wave**: 3 (depends on 24-01, 24-02)
- **Focus**: Fill execution, cascading resolution, test forms fixture, and E2E verification
- **Key Deliverables**:
  - `formFiller/index.ts`: Topological sort (`sortFieldsByDependency`), post-fill cascading wait
  - `formFiller/simulators/selectSimulator.ts`: Dynamic option settlement in `fillNativeDropdown` and `fillAriaDropdown`, search typeahead simulation
  - `shared/src/fixtures/mockForms.ts` & `backend/src/routes/api.ts`: `/test-forms/dynamic-options` interactive mock endpoint
  - Tests: `extension/src/__tests__/dynamicFormsFiller.test.ts` & `backend/src/__tests__/dynamicFormsE2E.test.ts`

---

## Verification & Quality Gates
- **Unit Testing**:
  - Static vs dynamic detection on native selects, ARIA listboxes, and custom comboboxes.
  - Cascading dependency linking (Country $\to$ State/Province).
  - `MutationObserver` settlement when options are appended with simulated network delay.
  - Safe timeout fallback when remote endpoints fail.
  - Topological fill execution verifying Country is filled before State.
- **Integration & Regression Testing**:
  - Verification on `/test-forms/dynamic-options`.
  - All 261 existing monorepo unit and integration tests passing.
  - Clean TypeScript typecheck and production build (`npm run build`).
