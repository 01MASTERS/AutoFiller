# Quick Task Summary: Fix Google Forms Checkbox Grouping and Label Extraction

**Slug**: `gforms-checkbox-grouping-fix`  
**Date**: 2026-09-24  
**Status**: Complete ✓  

---

## 1. Overview of the Problem
The user observed in backend logs on a live Google Form (`Flam - AI Data Engineer || Job Opportunity`):
> `"check logs scanned more fields but didnt filled em all"`

Detailed log inspection revealed:
- The content script scanned **35 fields** (28 checkboxes, 2 textareas, 5 text inputs).
- All 28 checkboxes were reported as independent single-choice fields:
  ```json
  { "id": "i7", "label": "Unlabeled Field", "type": "checkbox", "controlType": "checkbox", "selectionMode": "single", "options": ["Linkedin"] }
  { "id": "i34", "label": "Unlabeled Field", "type": "checkbox", "controlType": "checkbox", "selectionMode": "single", "options": ["HTML, CSS"] }
  ```
- Because every checkbox choice became its own field labeled `"Unlabeled Field"` with no question title context, the LLM could not associate them with profile skills or referral sources.
- The LLM only mapped the 5 text inputs with explicit question titles (`field-29` to `field-35`: GitHub, LeetCode, CodeChef, LinkedIn, Portfolio), leaving all 28 checkboxes unmapped and unfilled.

---

## 2. Root Cause Analysis
1. **Container Pruning Bug in `scanCheckboxGroups` (`extension/src/content/domReader/controls/checkbox.ts`)**:
   - The query: `if (container.querySelector('.form-group, .form-row, .field, [role="group"], [role="listitem"]')) return;`
   - In Google Forms, the question card has `role="listitem"` and class `.QrToBd`. Underneath it, choices are rendered inside `<div role="list">` where each option row also has `role="listitem"`.
   - The check matched the child option listitems, causing the true question card container to be discarded.
   - Then, each individual child option row was visited; since it lacked nested listitems, it was accepted as a 1-checkbox container, shattering 2 multi-select questions into 28 independent fields.
2. **Container Heading Exclusion in `resolveUniversalLabel` (`extension/src/content/domReader/heuristics/labelResolver.ts`)**:
   - Step 6 checked: `if (headingEl && headingEl !== controlEl && !controlEl.contains(headingEl))`.
   - When resolving labels for a container (like `container` or `questionContainer`), `controlEl.contains(headingEl)` evaluated to `true`, causing `!controlEl.contains(headingEl)` to discard the heading (`.M7eMe` or `[role="heading"]`), falling through to `"Unlabeled Field"`.
3. **Candidate Selector Precedence in `labelResolver.ts`**:
   - Candidate selectors evaluated `'label'` before question heading classes (`.M7eMe`, `.freebirdFormviewerViewItemsItemItemTitle`), which could match internal choice labels over question titles.
4. **Companion Symmetrical Pruning in `scanRadioGroups` (`extension/src/content/domReader/controls/radio.ts`)**:
   - Similar pruning logic risk was present in `scanRadioGroups`.

---

## 3. Changes Made

### A. Checkbox Group Container Filtering (`extension/src/content/domReader/controls/checkbox.ts`)
- Filter out internal option wrappers inside Google Forms questions: any element within `.QrToBd` or `.freebirdFormviewerViewItemsItemItem` is skipped unless it is an explicit multi-checkbox group (e.g. matrix/grid rows with `role="group"` and multiple checkboxes).
- Container pruning now checks `childCheckboxes.length > 1`: a parent container is only pruned if it contains child containers that are themselves multi-checkbox groups (such as rows in a Tick Box Grid). It is never pruned for single-checkbox option rows.
- Symmetrically updated `questionContainer` discovery to resolve the parent `.QrToBd` question card.

### B. Radio Group Container Filtering (`extension/src/content/domReader/controls/radio.ts`)
- Added identical option-wrapper guards and `childRadios.length > 1` pruning to `scanRadioGroups`.

### C. Universal Label Resolution (`extension/src/content/domReader/heuristics/labelResolver.ts`)
- Step 6 updated: only leaf interactive inputs (`input`, `textarea`, `select`) reject child headings. Container elements (groups, cards, fieldsets) are permitted to contain their heading.
- Prioritized `.M7eMe`, `.freebirdFormviewerViewItemsItemItemTitle`, `[role="heading"]`, `h1..h6`, and `.exportLabel` before `'label'`.
- Added Step 7 container-level `aria-labelledby` resolution.

### D. Comprehensive Unit Tests (`extension/src/__tests__/gformsTickOptions.test.ts`)
- Added unit test mirroring live Google Forms DOM structure with nested `role="listitem"` choices under `<div role="list">` inside `<div role="listitem" class="QrToBd">`.
- Verified that 2 distinct questions are extracted with `selectionMode: 'multiple'`, correct question titles, and all option choices grouped together.
- Verified that `fillFormFields` clicks the desired multi-select checkboxes.

---

## 4. Verification & Results
- **Unit & Integration Tests**:
  - Full monorepo test suite: **261 / 261 passing** (165 extension tests, 96 backend tests).
- **Production Build**:
  - `npm run build`: Clean builds across `shared`, `extension`, and `backend`.
