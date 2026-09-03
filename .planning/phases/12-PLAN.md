# Phase 12 Implementation Plan: Generic & Google Forms DOM Extraction & Option Parsing

## Phase Objective
Refactor AutoFiller's DOM extraction into a generic discovery and classification pipeline capable of extracting standard web form controls and Google Forms widgets. Support native HTML controls (`select`, `input[type=date]`, radio, checkbox, text, textarea) and ARIA widgets (`listbox`, `combobox`, `radiogroup`, `group`). Extract structured options (`FieldOption[]`), determine `selectionMode` ('single' | 'multiple'), resolve accessible names, deduplicate candidates into singular logical fields, and decouple logical field identity from temporary DOM nodes using a confidence-ordered re-association helper (`findFieldElement`).

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Shared** | [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts) | `FieldMetadata` has `id, label, placeholder, ariaLabel, type, required` | Add `FieldOption`, `FieldControlType`, `selectionMode?: 'single' \| 'multiple'`, `name?: string`, `controlType?: FieldControlType`, `options?: FieldOption[]` |
| **Backend** | [`backend/src/types/profile.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/types/profile.ts) | `fieldMetadataSchema` has strict keys without `.passthrough()` | Add `fieldOptionSchema`, update `fieldMetadataSchema` with new keys & `.passthrough()` |
| **Extension** | [`extension/src/content/domReader.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader.ts) | Scans text/textarea inputs in Google Forms listitems | Refactor into 5-stage pipeline (Discover -> Classify -> Accessible Label -> Options -> Normalize) + `findFieldElement()` |
| **Extension** | [`extension/src/content/contentScript.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/contentScript.ts) | Logs field count and metadata array | Log breakdown by control type and options count |
| **Tests** | [`extension/src/__tests__/domReader.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/domReader.test.ts) | 5 unit tests for Google Forms text/textarea | Retain all 5 existing tests + add comprehensive generic and edge-case suites (15+ new tests) |

---

## Detailed Task Breakdown

### Task 1: Shared Schema & Backend Schema Updates
**Files to Modify**:
- [MODIFY] [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts)
- [MODIFY] [`backend/src/types/profile.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/types/profile.ts)

**Exact Types & Interfaces**:
1. In `shared/src/index.ts`:
   ```typescript
   export type FieldControlType =
     | 'text'
     | 'textarea'
     | 'dropdown'
     | 'combobox'
     | 'radio'
     | 'checkbox'
     | 'date';

   export type SelectionMode = 'single' | 'multiple';

   export interface FieldOption {
     label: string;
     value?: string;
     selected?: boolean;
     disabled?: boolean;
   }

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
   }
   ```
2. In `backend/src/types/profile.ts`:
   ```typescript
   export const fieldOptionSchema = z.object({
     label: z.string(),
     value: z.string().optional(),
     selected: z.boolean().optional(),
     disabled: z.boolean().optional(),
   });

   export const fieldMetadataSchema = z.object({
     id: z.string(),
     label: z.string(),
     name: z.string().optional(),
     placeholder: z.string().optional(),
     ariaLabel: z.string().optional(),
     type: z.string().optional(),
     controlType: z.enum(['text', 'textarea', 'dropdown', 'combobox', 'radio', 'checkbox', 'date']).optional(),
     options: z.array(fieldOptionSchema).optional(),
     selectionMode: z.enum(['single', 'multiple']).optional(),
     required: z.boolean().optional(),
   }).passthrough();
   ```
3. Build shared: `npm run build -w shared`.

---

### Task 2: Refactor `domReader.ts` into a 5-Stage Generic Pipeline
**Files to Modify**:
- [MODIFY] [`extension/src/content/domReader.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader.ts)
- [MODIFY] [`extension/src/content/contentScript.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/contentScript.ts)

**Pipeline Stages in `domReader.ts`**:

1. **Candidate Discovery & Deduplication**:
   - Track `processedElements = new Set<Element>()` to prevent duplicate extraction.
   - Process container groups first:
     - Radiogroups: `[role="radiogroup"]`, or containers containing multiple `[role="radio"]` / `<input type="radio">`.
     - Checkbox groups: Containers containing multiple `[role="checkbox"]` or `<input type="checkbox">` elements.
     - Form `<fieldset>` elements.
     - Inputs sharing the same `name` attribute (grouping radios unconditionally, and checkboxes when sharing a common parent question block).
     - When a group is identified, all constituent option nodes are added to `processedElements` so they are never emitted as separate standalone fields.
   - Process single controls:
     - Native `<select>`, elements with `[role="listbox"]` or `[role="combobox"]`.
     - `<textarea>`.
     - `<input>` elements (text, email, tel, date, number, etc.).
   - Filter out hidden elements (`display: none`, `visibility: hidden`, `hidden`, `aria-hidden="true"`, `type="hidden"`).

2. **Control Classification**:
   - `<select>`, `[role="listbox"]` → `'dropdown'`
   - `[role="combobox"]` → `'combobox'`
   - Group containing radio items → `'radio'`
   - Group containing checkbox items → `'checkbox'`
   - `role="group"` containing NON-checkbox items is treated as a generic container (not a checkbox field) and descends into children.
   - `<input type="date">` or date wrapper → `'date'`
   - `<textarea>` → `'textarea'`
   - Other inputs → `'text'`

3. **Selection Mode Resolution**:
   - Native `<select multiple>` → `'multiple'`
   - `[role="listbox"][aria-multiselectable="true"]` → `'multiple'`
   - Checkbox groups (`controlType === 'checkbox'`) → `'multiple'`
   - Dropdown / listbox / combobox without multi-select semantics → `'single'`
   - Radio groups (`controlType === 'radio'`) → `'single'`
   - Date / text / textarea → `'single'`

4. **Option Availability & Separation**:
   - For `combobox`: Extract options if present in DOM; if closed/virtualized with no `[role="option"]`, set `options: []` or `undefined`. The combobox control is still successfully extracted.
   - For `dropdown` (`<select>`, `[role="listbox"]`):
     - Extract child `<option>` or `[role="option"]`.
     - `label`: Cleaned visible text content.
     - `value`: Preserved if explicit attribute exists (`value` attribute or `data-value`). Do NOT replace value with label.
     - `selected`: `selected`, `checked`, `aria-selected="true"`, or `aria-checked="true"`.
     - `disabled`: `disabled`, `aria-disabled="true"`.
     - Placeholder detection: If value is empty or disabled/hidden AND text matches conservative placeholder patterns (e.g. "Select...", "Choose...", "Pick an option...").
   - For `radio` and `checkbox` groups: Extract each option's label and value, preserving selection and disabled states.

5. **Accessible Label Resolution**:
   - Precedence:
     1. `aria-labelledby` (resolves referenced element texts)
     2. `aria-label`
     3. `<label for="...">`
     4. Wrapping `<label>`
     5. `<fieldset> > <legend>`
     6. Container headings (`[role="heading"]`, `h1`-`h6`, `.M7eMe`, etc., stripping required asterisks)
     7. `placeholder`
     8. `name` or generated ID

6. **Logical Identity & Re-Association Strategy (`findFieldElement`)**:
   - Assign transient `data-autofiller-id="${field.id}"` and `data-autofiller-option="${optionValue || optionLabel}"`.
   - Implement `findFieldElement(field: FieldMetadata, doc: Document = document): Element | null`:
     - Strategy 1: `doc.querySelector(`[data-autofiller-id="${field.id}"]`)` if valid and connected.
     - Strategy 2: `doc.getElementById(field.id)` or `doc.querySelector(`#${CSS.escape(field.id)}`)`.
     - Strategy 3: Match by `[name="${field.name}"]` filtered by matching `controlType`. If exactly 1 match, return it.
     - Strategy 4: Container fingerprint matching `controlType` in parent block.
     - Strategy 5: Match by accessible label + `controlType` + container context. If multiple candidates match equally well, return `null` rather than guessing.

---

### Task 3: Comprehensive Unit Test Suite
**Files to Modify**:
- [MODIFY] [`extension/src/__tests__/domReader.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/domReader.test.ts)

**Test Coverage Requirements**:
1. **Generic Controls & Multi-Select**:
   - Native `<select multiple>` sets `selectionMode: 'multiple'`.
   - ARIA `[role="listbox"][aria-multiselectable="true"]` sets `selectionMode: 'multiple'`.
   - Native `<select>` (single) sets `selectionMode: 'single'`.
   - ARIA `role="combobox"` without options extracts successfully with empty/undefined options.
   - ARIA `role="combobox"` with rendered options extracts all options.
   - Native `<input type="date">` sets `controlType: 'date'`, `selectionMode: 'single'`.
2. **Deduplication & Grouping**:
   - Radio group (3 radios) produces exactly 1 `FieldMetadata` with `controlType: 'radio'`, 3 options.
   - Checkbox group (3 checkboxes) produces exactly 1 `FieldMetadata` with `controlType: 'checkbox'`, 3 options, `selectionMode: 'multiple'`.
   - `role="group"` containing non-checkbox content (e.g. 2 text fields) does NOT produce a checkbox group; extracts the 2 text fields independently.
   - Multiple radios sharing `name` attribute grouped into 1 field.
3. **Accessible Name Resolution**:
   - Via `aria-labelledby` referencing external elements.
   - Via `<label for="...">`.
   - Via wrapping `<label>`.
   - Via `<fieldset><legend>`.
   - Via container heading.
4. **Option Semantics**:
   - Option label and value separation (value preserved, not overwritten by label).
   - Custom ARIA option without value attribute omits `value`.
   - Selected and disabled option states captured.
   - Placeholder option detection (empty value with prompt text).
5. **Re-Association (`findFieldElement`)**:
   - Re-associates successfully after original DOM element is replaced.
   - Returns `null` when duplicate/ambiguous labels exist without stable identifiers.
6. **Edge Cases**:
   - Hidden controls (`display: none`, `hidden`, `aria-hidden="true"`, `type="hidden"`) excluded.
   - Duplicate labels handled with unique generated field IDs.
   - Existing Google Forms text input tests pass unmodified.

---

## Verification Plan
1. Rebuild shared package: `npm run build -w shared`
2. Run extension tests: `npm test -w extension`
3. Run backend tests: `npm test -w backend`
4. Run full build: `npm run build`
