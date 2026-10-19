# Quick Plan: 20260924-gforms-checkbox-grouping-fix

## Problem
In Google Forms (`Flam - AI Data Engineer` and others), questions with multi-select checkboxes (e.g. "How did you hear about this opportunity?" and "Technical Skills") were scanned as 28 separate fields, each labeled `"Unlabeled Field"` with `selectionMode: 'single'` and 1 option.
As a result, the LLM had no question label context and could not map the profile skills or referral source to the checkboxes, filling only 5 link inputs and leaving all 28 checkboxes untouched.

## Root Cause
1. **Container Pruning in `scanCheckboxGroups`**:
   `if (container.querySelector('.form-group, .form-row, .field, [role="group"], [role="listitem"]')) return;`
   In Google Forms, the question card has `role="listitem"` and class `.QrToBd`. The options inside are rendered in a `<div role="list">` where each option row also has `role="listitem"`. The querySelector matched the child option listitems, causing the true question card container to be discarded. The loop then accepted each individual option row as a 1-checkbox container.
2. **Container Heading Exclusion in `resolveUniversalLabel`**:
   `if (headingEl && headingEl !== controlEl && !controlEl.contains(headingEl))`
   When `controlEl` is a group container (like `container` or `questionContainer`), `controlEl.contains(headingEl)` evaluates to `true`, causing `!controlEl.contains(headingEl)` to discard the heading (`.M7eMe` or `[role="heading"]`), falling through to `"Unlabeled Field"`.
3. **Candidate Selector Precedence in `labelResolver.ts`**:
   `'label'` selector appeared before `.M7eMe` and `.freebirdFormviewerViewItemsItemItemTitle`, potentially matching option wrapper labels over the question title.
4. **Self-match in `deepClosest`**:
   If an option container was used, `closest('[role="listitem"]...')` matched the option container itself rather than climbing up to `.QrToBd`.

## Proposed Solution
1. **Fix `scanCheckboxGroups` (`extension/src/content/domReader/controls/checkbox.ts`)**:
   - Guard against option wrapper false positives: any element nested inside `.QrToBd` or `.freebirdFormviewerViewItemsItemItem` that is not the question card itself is excluded from candidate question containers.
   - Refactor container pruning so that a container is only pruned if a child container has multiple checkboxes (`length > 1`) representing an independent sub-group.
   - Update `questionContainer` resolution to climb to the parent question card if `container` is an option item.
2. **Fix `scanRadioGroups` (`extension/src/content/domReader/controls/radio.ts`)**:
   - Apply matching safeguards so Google Forms radio questions never prune question cards due to child `[role="listitem"]`.
3. **Fix `resolveUniversalLabel` (`extension/src/content/domReader/heuristics/labelResolver.ts`)**:
   - Allow container elements to contain their own heading: only reject `controlEl.contains(headingEl)` if `controlEl` is a leaf input element (`input`, `textarea`, `select`).
   - Prioritize `.M7eMe`, `.freebirdFormviewerViewItemsItemItemTitle`, and `[role="heading"]` before `'label'` in candidate selectors.
   - Support container-level `aria-labelledby` resolution.
4. **Comprehensive Unit Tests (`gformsTickOptions.test.ts`)**:
   - Add unit test mirroring the exact Google Forms DOM structure with nested `role="listitem"` inside `<div role="listitem" class="QrToBd">`.
   - Verify that all checkboxes are grouped into 1 field with `selectionMode: 'multiple'`, correct question label, and all option labels extracted.
   - Verify that simulated fill selects the desired options.
5. **Regression Verification**:
   - Run all backend and extension tests (`npm test`).
   - Run production builds (`npm run build`).
