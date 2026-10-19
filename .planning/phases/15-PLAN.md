# Phase 15 Implementation Plan: Universal DOM Reader & Smart Field Extraction Engine

## Phase Objective
Refactor and expand AutoFiller's DOM reader into a universal, platform-agnostic extraction engine capable of accurately identifying, classifying, and extracting fields and options from standard HTML5 forms, modern single-page applications, and premier ATS platforms (**Greenhouse, Lever, Workday, and generic company career sites**), while preserving full backward compatibility with Google Forms.

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Shared** | [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts) | `FieldControlType` has `text, textarea, dropdown, combobox, radio, checkbox, date` | Add `'file'` to `FieldControlType`; add optional `platform` to `FieldMetadata`. |
| **Backend** | [`backend/src/types/profile.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/types/profile.ts) | `fieldMetadataSchema` allows specific control types | Update enum and schema to include `'file'` and `platform`. |
| **Extension** | [`extension/src/content/domReader/accessibility.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/accessibility.ts) | Tailored heavily to Google Forms class names (`.freebirdFormviewerViewItemsItem...`) | Generalize into heuristic label resolver supporting standard `<label for>`, wrapping `<label>`, `<legend>`, headings, and boilerplate cleaner. |
| **Extension** | [`extension/src/content/domReader/heuristics/`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/) | No dedicated heuristics directory | Add `labelResolver.ts` and `platformDetector.ts` (detects Greenhouse, Lever, Workday, Google Forms, Generic). |
| **Extension** | [`extension/src/content/domReader/controls/`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/controls/) | Specialized control scanners for Google Forms | Generalize control scanners (`text`, `dropdown`, `radio`, `checkbox`, `date`) and add `file.ts`. |
| **Extension** | [`extension/src/content/domReader/fieldDiscovery.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/fieldDiscovery.ts) | Scans Google Forms listitems and hardcoded classes | Scan universal form containers (`<form>`, `role="form"`, `.application-form`, `[data-automation-id]`, `main`), filter non-form noise, and enhance `findFieldElement`. |
| **Tests** | [`extension/src/__tests__/domReader.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/domReader.test.ts) | 30 unit tests for Google Forms | Retain all 30 existing tests; add `universalDomReader.test.ts` with 20+ tests for HTML5, Greenhouse, Lever, Workday, and edge cases. |

---

## Detailed Task Breakdown

### Task 1: Update Shared Contracts & Backend Validation
**Files to Modify**:
- [MODIFY] [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts)
- [MODIFY] [`backend/src/types/profile.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/types/profile.ts)

**Action**:
1. Add `'file'` to `FieldControlType` in `shared/src/index.ts`:
   ```typescript
   export type FieldControlType =
     | 'text'
     | 'textarea'
     | 'dropdown'
     | 'combobox'
     | 'radio'
     | 'checkbox'
     | 'date'
     | 'file';

   export type FormPlatform = 'google-forms' | 'greenhouse' | 'lever' | 'workday' | 'generic';
   ```
2. Update `FieldMetadata` interface in `shared/src/index.ts`:
   ```typescript
   export interface FieldMetadata {
     id: string;
     label: string;
     name?: string;
     placeholder?: string;
     ariaLabel?: string;
     type?: string;
     controlType?: FieldControlType;
     options?: FieldOption[];
     selectionMode?: SelectionMode;
     required?: boolean;
     platform?: FormPlatform;
   }
   ```
3. Update `backend/src/types/profile.ts` with corresponding zod schemas.

---

### Task 2: Heuristic Label Resolver & Platform Detector
**Files to Create/Modify**:
- [NEW] `extension/src/content/domReader/heuristics/platformDetector.ts`
- [NEW] `extension/src/content/domReader/heuristics/labelResolver.ts`
- [MODIFY] `extension/src/content/domReader/accessibility.ts`

**Action**:
1. Implement `platformDetector.ts`:
   - Inspect hostname and DOM signatures:
     - Google Forms: `docs.google.com/forms/*` or presence of `.freebirdFormviewerViewItemsItemItem`
     - Greenhouse: `boards.greenhouse.io` or presence of `#app_body`, `.greenhouse-`, `[data-source="greenhouse"]`
     - Lever: `jobs.lever.co` or presence of `.lever-`, `.application-form` with lever signatures
     - Workday: `*.myworkdayjobs.com` or presence of `[data-automation-id]`
     - Generic: fallback
2. Implement `labelResolver.ts`:
   - Priority cascade:
     1. `<label for="id">`
     2. Parent `<label>`
     3. Preceding fieldset `<legend>`, heading elements (`h1-h6`, `role="heading"`), or label spans (`.field-label`, `[data-automation-id*="label"]`, `.label`)
     4. `aria-labelledby` referenced text
     5. `aria-label` attribute
     6. Fallback: input `placeholder`, `title`, or sanitized `name`
   - Boilerplate cleaner: strip "Required", "*", "(optional)", error messages, and helper tips.

---

### Task 3: Universal Control Scanners & File Upload Detection
**Files to Create/Modify**:
- [MODIFY] `extension/src/content/domReader/controls/text.ts`
- [MODIFY] `extension/src/content/domReader/controls/dropdown.ts`
- [MODIFY] `extension/src/content/domReader/controls/radio.ts`
- [MODIFY] `extension/src/content/domReader/controls/checkbox.ts`
- [MODIFY] `extension/src/content/domReader/controls/date.ts`
- [NEW] `extension/src/content/domReader/controls/file.ts`

**Action**:
1. `controls/text.ts`:
   - Detect standard inputs (`text`, `email`, `tel`, `url`, `number`), `textarea`, and `contenteditable` wrappers.
   - Support Workday text inputs (`[data-automation-id="textInput"]`, `[data-automation-id*="input"]`).
2. `controls/dropdown.ts`:
   - Detect native `<select>` and parse `<option>` child elements.
   - Detect ARIA `role="combobox"` / `role="listbox"`.
   - Support Workday search/select buttons (`[data-automation-id*="select"]`, `[data-automation-id*="prompt"]`).
   - Extract choices from visible option nodes or data attributes.
3. `controls/radio.ts`:
   - Group native `<input type="radio">` by `name` or wrapping fieldset.
   - Support ARIA `role="radiogroup"` / `role="radio"`.
   - Extract option label per choice.
4. `controls/checkbox.ts`:
   - Detect individual checkboxes and checkbox groups.
   - Support multi-select choice tags.
5. `controls/file.ts`:
   - Detect `<input type="file">`, resume dropzones, and upload triggers.
   - Tag with `controlType: 'file'` so the system knows an attachment field is present.

---

### Task 4: Universal Container Discovery & Field Re-Association Engine
**Files to Modify**:
- [MODIFY] `extension/src/content/domReader/fieldDiscovery.ts`
- [MODIFY] `extension/src/content/domReader/index.ts`

**Action**:
1. Refactor `extractFormFields`:
   - Scan container candidates: `<form>`, `[role="form"]`, `.application-form`, `[data-automation-id*="application"]`, `#application`, `#apply`, or fallback to `doc.body`.
   - Filter out noise: search inputs (`type="search"` or search bar wrappers), navigation bars, authentication/login modals, hidden inputs (`type="hidden"`), and elements styled `display: none` / `visibility: hidden` (unless backing a styled custom control).
   - Execute scanning stages in order: Radio → Checkbox → Dropdowns → Dates → Files → Text/Textarea.
   - Assign unique, stable `data-autofiller-id` attributes to all discovered controls.
2. Enhance `findFieldElement`:
   - Tier 1: `data-autofiller-id`
   - Tier 2: Native `id`
   - Tier 3: `data-automation-id` / unique attributes
   - Tier 4: `name` + `controlType`
   - Tier 5: Label heuristic matching within closest container

---

### Task 5: Comprehensive Unit Tests & Fixtures
**Files to Create/Modify**:
- [RETAIN] [`extension/src/__tests__/domReader.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/domReader.test.ts) (ensure all 30 tests pass)
- [NEW] `extension/src/__tests__/universalDomReader.test.ts`

**Test Cases**:
1. Standard HTML5 form: `<label for="email">Email</label><input id="email" type="email">`
2. Wrapping `<label>` form: `<label>Full Name <input type="text"></label>`
3. Fieldset with `<legend>` for radio group: `<fieldset><legend>Gender</legend>...`
4. Greenhouse form mock fixture: candidate personal info + custom dropdowns + resume upload
5. Lever form mock fixture: cards, custom questions, demographic radio groups
6. Workday form mock fixture: `data-automation-id="textInput"`, custom select button, search combobox
7. Noise exclusion: ensure search bar (`<input type="search">`) and hidden CSRF tokens (`<input type="hidden">`) are excluded
8. Re-association verification: verify `findFieldElement` correctly retrieves live elements across all platform fixtures.

---

## Verification Commands
```bash
# Workspace builds
npm run build

# Unit tests
npm run test -w extension
npm run test -w backend
npm test
```
