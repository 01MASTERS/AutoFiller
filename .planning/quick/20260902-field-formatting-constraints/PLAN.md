---
task: field-formatting-constraints
created: 2026-09-02
status: in-progress
description: Add explicit field formatting and constraint handling rules to LLM prompt builder
---

# Quick Task: Handle Explicit Field Formatting Constraints

## Objective
Update the system prompt and instructions in `promptBuilder.ts` so the LLM respects field-level formatting constraints and instructions (such as "10-digit mobile number", "without +91 or 0", "First Name only", specific date/numeric formats) instead of blindly echoing raw unformatted profile values.

## Steps
1. Modify `backend/src/services/llm/promptBuilder.ts`:
   - Revise Rule 1 to clarify that matching values should adapt to explicit instructions in field labels/placeholders.
   - Add Rule 6 for "Field Formatting & Explicit Constraints" detailing how to handle phone numbers (stripping country codes like "+91", leading zeros, spaces), names (extracting First Name or Last Name), and other constraints.
   - Update output format instructions in `userPrompt` to reinforce compliance with constraints.
2. Update unit tests in `backend/src/__tests__/promptBuilder.test.ts` to assert that formatting instructions and constraint handling rules are present.
3. Run tests across workspace to ensure no regressions.
4. Update `STATE.md` and generate `SUMMARY.md`.
