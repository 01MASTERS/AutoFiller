# Phase 12 Context: Advanced Google Form DOM Extraction & Option Parsing

## Phase Summary
Phase 12 expands AutoFiller's DOM scanning capabilities beyond simple text inputs to complex Google Forms controls: dropdown menus (`role="listbox"` / `<select>`), single-choice radio groups (`role="radiogroup"` / `role="radio"`), multi-select checkbox groups (`role="group"` / `role="checkbox"`), and date pickers. It extracts the discrete options for choice controls and packages them into `FieldMetadata.options`, providing the downstream LLM gateway (Phase 13) and form filler (Phase 14) with the structural metadata required for accurate matching.

---

## Agreed Architecture & DOM Structure Conventions

### 1. Shared Types Update (`@autofiller/shared`)
```typescript
export type FieldControlType =
  | 'text'
  | 'textarea'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'date';

export interface FieldMetadata {
  id: string;
  label: string;
  placeholder?: string;
  ariaLabel?: string;
  type?: string;
  controlType?: FieldControlType;
  options?: string[]; // Allowed choices for dropdown, radio, and checkbox
  required?: boolean;
}
```

### 2. Google Forms DOM Extraction Rules

#### A. Radio Groups (`controlType: 'radio'`)
- **Containers**: Look for `[role="radiogroup"]`, or item containers (`[role="listitem"]`, `.freebirdFormviewerViewItemsItemItem`) containing elements with `[role="radio"]` or `<input type="radio">`.
- **Label**: Extracted from container heading (`[role="heading"]`, `.M7eMe`, `.freebirdFormviewerViewItemsItemItemTitle`) or `aria-label` on the radiogroup container.
- **Options**: Scanned from each radio item's text container (e.g. `.docssharedWizToggleLabeledLabelText`, `[data-value]`, `.aDTYNe`, `.ulDsOb`, or adjacent `label`/`span`).
- **Tagging**: Assign `data-autofiller-id` to the radiogroup container, and assign `data-autofiller-option` to each option element.

#### B. Checkbox Groups (`controlType: 'checkbox'`)
- **Containers**: Look for `[role="group"]` or item containers containing multiple `[role="checkbox"]` or `<input type="checkbox">` elements.
- **Label**: Extracted from container heading or group `aria-label`.
- **Options**: Scanned from each checkbox item's label or text span.
- **Tagging**: Assign `data-autofiller-id` to the checkbox group container, and assign `data-autofiller-option` to each checkbox option.

#### C. Dropdown Menus (`controlType: 'dropdown'`)
- **Containers**: Look for elements with `[role="listbox"]` (or native `<select>`), commonly found in Google Forms custom selector components (`.quantumWizMenuPaperselectOptionList`, `.jgvuAb`, `.ry3kXd`).
- **Label**: Extracted from parent question heading or `aria-labelledby` / `aria-label`.
- **Options**: Scanned from option child elements (`[role="option"]`, `.quantumWizMenuPaperselectOption`, or `<option>`), filtering out placeholder instructions such as "Choose".
- **Tagging**: Assign `data-autofiller-id` to the listbox container.

#### D. Date Pickers (`controlType: 'date'`)
- **Elements**: HTML5 `<input type="date">` or containers containing date components with `aria-label` containing Month/Day/Year or Google Forms date wrapper `.exportDate`.
- **Label**: Extracted from container heading.
- **Tagging**: Assign `data-autofiller-id` to the date input element.

#### E. Text & Textarea Inputs (`controlType: 'text' | 'textarea'`)
- Backward-compatible with existing extraction logic for standard text, email, tel, and textarea inputs.

---

## Downstream Guidelines for Phase 13 & Phase 14
- **Phase 13 (LLM Gateway)**: Will consume `controlType` and `options` to prompt the LLM to pick strictly valid enum values (1 option for radio/dropdown, array of options for checkbox).
- **Phase 14 (Form Filler)**: Will query `[data-autofiller-id="..."]` and simulate native clicks/events on the matching option element.
