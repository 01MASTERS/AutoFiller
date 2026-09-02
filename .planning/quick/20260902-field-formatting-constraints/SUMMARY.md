---
task: field-formatting-constraints
created: 2026-09-02
status: complete
description: Add explicit field formatting and constraint handling rules to LLM prompt builder
---

# Quick Task Summary: Handle Explicit Field Formatting Constraints

## What was Changed
1. **Prompt Builder ([`promptBuilder.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/services/llm/promptBuilder.ts))**:
   - Updated Rule 1 so the LLM knows matching field IDs should map to profile values formatted according to any explicit instructions in the field label or placeholder.
   - Added Rule 6 ("Field Formatting & Explicit Constraints"):
     - Phone numbers: When a field specifies "10-digit", "without country code", "without +91", "without 0", etc., strips country code (`+91`), leading zeros, spaces, hyphens, and parentheses so only the requested digits remain (e.g., `"+91 9135517396"` -> `"9135517396"`).
     - Names: When asking for "First Name" or "Last Name" specifically, extracts only that name part.
     - Dates/numbers: Conforms to requested formats (e.g. `YYYY-MM-DD`, numbers only).
     - Default: Preserves profile value as-is if no constraints are specified.
   - Updated `userPrompt` output format instructions to reinforce respecting field constraints.

2. **Unit Tests ([`promptBuilder.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/__tests__/promptBuilder.test.ts))**:
   - Added unit test asserting prompt contains formatting constraint instructions and phone normalization guidance.

## Verification
- Ran full workspace test suite (`npm test`).
- All 67 tests (26 extension + 41 backend) passing.
