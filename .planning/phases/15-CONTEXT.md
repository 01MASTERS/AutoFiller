# Phase 15 Context: Universal DOM Reader & Smart Field Extraction Engine

## Phase Summary
Phase 15 expands AutoFiller's DOM scanning capabilities beyond Google Forms into a **universal, platform-agnostic form reader**. It enables the extension to detect, classify, and extract form fields across standard HTML5 forms, modern single-page applications, and premier Applicant Tracking Systems (ATS) including **Greenhouse, Lever, Workday, and generic company career portals**.

---

## Core Objectives & Scope

1. **Universal Form & Container Discovery**:
   - Detect forms within standard `<form>`, `role="form"`, section wrappers (`.application-form`, `[data-automation-id*="application"]`, `#apply`), or fallback to root page content.
   - Intelligently filter out non-application inputs (search bars, navigation menus, login forms, hidden honeypots).

2. **Heuristic Label Resolution Engine**:
   - Universal priority cascade to resolve human-readable question text:
     1. Direct `<label for="...">` association.
     2. Parent wrapping `<label>` elements.
     3. Preceding fieldset `<legend>`, heading elements (`h1-h6`, `role="heading"`), or label spans (`.field-label`, `[data-automation-id*="label"]`).
     4. `aria-labelledby` referenced DOM text (with asterisks and helper text pruned).
     5. `aria-label` attribute on the element or parent container.
     6. Fallback to `placeholder` or cleaned `name` attribute.
   - Boilerplate stripping: automatically remove "Required", "*", "(optional)", error messages, and sublabel clutter.

3. **Comprehensive Control-Type Classification**:
   - `text` / `textarea`: Standard text, email, phone, URL, numeric inputs, and `contenteditable` wrappers.
   - `dropdown` / `combobox`: Native `<select>`, ARIA `role="combobox"`, `role="listbox"`, and custom UI dropdown buttons (Workday, React-Select, Radix).
   - `radio`: Native radio inputs grouped by `name`, ARIA `role="radiogroup"` / `role="radio"`, and button-group selectors.
   - `checkbox`: Native checkboxes, multi-select choice tags, and ARIA `role="checkbox"`.
   - `date`: Native `<input type="date">`, date pickers, and compound date inputs.
   - `file`: Resume / CV upload dropzones and file inputs (annotated to prevent misclassification as text fields).

4. **Universal Option Extractor**:
   - Native `<option>` tags (text and value extraction).
   - ARIA `role="option"` elements.
   - Pre-rendered option lists or closed dropdown trigger metadata.
   - Sibling radio / checkbox label text.

5. **ATS Platform Adaptation**:
   - **Greenhouse (`boards.greenhouse.io`)**: Support standard candidate fields, custom questions, and demographic dropdowns.
   - **Lever (`jobs.lever.co`)**: Support multi-section cards, custom dropdowns, and social links.
   - **Workday (`*.myworkdayjobs.com`)**: Support `data-automation-id` conventions, custom comboboxes, and dynamic wizard wrappers.
   - **Generic Career Sites**: Fall back to universal HTML5 and ARIA heuristics.

---

## Shared Data Contracts

### 1. Extended `FieldControlType` (`@autofiller/shared`)
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
```

### 2. Enhanced `FieldMetadata` (`@autofiller/shared`)
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
  platform?: 'google-forms' | 'greenhouse' | 'lever' | 'workday' | 'generic';
}
```

---

## Verification Strategy

- **Unit Tests**: Retain all 30 existing Google Forms tests in `domReader.test.ts`.
- **Universal Fixtures**: Add comprehensive test suites verifying extraction against:
  - Standard HTML5 forms (associated labels, wrapping labels, legends).
  - Greenhouse application form DOM snippets.
  - Lever application form DOM snippets.
  - Workday dynamic component DOM snippets.
  - File upload and honeypot exclusion scenarios.
