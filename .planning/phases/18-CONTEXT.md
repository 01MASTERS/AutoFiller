# Phase 18 Context: ATS Platform Heuristics & Adaptations (Greenhouse, Lever, Workday)

## Phase Summary
Phase 18 equips AutoFiller with specialized DOM heuristics and custom adapters for the top three enterprise Applicant Tracking Systems (ATS): **Greenhouse, Lever, and Workday**. While generic HTML5 and ARIA heuristics cover baseline form controls, each of these enterprise portals exhibits distinct architectural conventions (e.g. multi-section card layouts, bracketed input names, Chosen/Select2 widgets, deep Shadow DOM components, and multi-step wizard step navigation). This phase implements dedicated platform adapters to extract clean metadata, classify sections/field types, provide graceful error recovery, and capture telemetry for skipped fields (such as sandboxed resume file drops).

---

## Core Objectives & Architectural Scope

1. **Shared Platform Telemetry & Section Typing**:
   - Introduce `PlatformFieldType` in `@autofiller/shared`:
     `'personal' | 'experience' | 'custom_question' | 'demographic' | 'resume_upload' | 'social_link' | 'other'`.
   - Extend `FieldMetadata` with `platformFieldType?: PlatformFieldType;` and `section?: string;`.
   - Update backend Zod schema in `backend/src/types/profile.ts`.

2. **Greenhouse Platform Adapter (`greenhouseAdapter.ts`)**:
   - Detects Greenhouse host environments (`boards.greenhouse.io`, `#application_form`, `#app_body`, `[data-source="greenhouse"]`).
   - Personal details normalization: extracts clean labels from `job_application[first_name]`, `job_application[last_name]`, `job_application[email]`, `job_application[phone]`, `job_application[location]`.
   - Social / portfolio links: parses `job_application[answers_attributes][...]` to resolve LinkedIn, GitHub, Website/Portfolio links as `platformFieldType: 'social_link'`.
   - Resume / CV dropzone detection: identifies dropzones (`#resume`, `[data-field="resume"]`, `.attach-or-paste`) and annotates `platformFieldType: 'resume_upload'`.
   - Chosen / Select2 widget option resolution: connects the underlying hidden `<select>` options to the custom widget and cleans Greenhouse boilerplate ("Select one...", asterisk markers).
   - Voluntary Self-Identification (EEO / Demographics): tags Race, Gender, Veteran, and Disability fields with `platformFieldType: 'demographic'` and prunes lengthy legal disclaimers.

3. **Lever Platform Adapter (`leverAdapter.ts`)**:
   - Detects Lever host environments (`jobs.lever.co`, `.lever-job-page`, `form#application-form[action*="lever.co"]`).
   - Multi-section awareness: identifies `.section-candidate-wrapper`, `.section-links-wrapper`, `.section-cards-wrapper`, `.section-eeo-wrapper`, and annotates `section` accordingly.
   - Full name single input: maps `input[name="name"]` to "Full Name" with `platformFieldType: 'personal'`.
   - Social link bracket parsing: parses `urls[LinkedIn]`, `urls[Twitter]`, `urls[GitHub]`, `urls[Portfolio]` into clean network labels ("LinkedIn URL", etc.) with `platformFieldType: 'social_link'`.
   - Custom question cards (`.application-question`): pairs styled radio buttons (`.lever-radio-label`) and checkboxes (`.lever-checkbox-label`) with their visible span text.
   - Demographic EEO questions: strips long preambles, tagging Gender, Race, Veteran, and Disability with `platformFieldType: 'demographic'`.

4. **Workday Platform Adapter (`workdayAdapter.ts`)**:
   - Detects Workday host environments (`*.myworkdayjobs.com`, `*.myworkday.com`, `[data-automation-id]`).
   - Deep Shadow DOM Traversal: provides `queryDeepAll(selector, root)` helper to search through `shadowRoot` boundaries for encapsulated web components.
   - Multi-step Wizard Step Extraction: inspects `[data-automation-id="activeStep"]`, `[data-automation-id="wizardStep"]`, or page headings to record active step ("My Information", "My Experience", "Application Questions", "Voluntary Disclosures") in `section`.
   - `data-automation-id` Label Resolution: maps Workday labels from `data-automation-id="formLabel"` or parent `[data-automation-id*="formField"]`, stripping Workday required asterisks (`<abbr title="required">*</abbr>`).
   - Prompt / Select Button Annotation: identifies Workday select buttons (`button[data-automation-id*="prompt"]`, `button[aria-haspopup="listbox"]`), extracting pre-rendered options or designating them as searchable comboboxes.
   - Compound Section Grouping: handles compound sections (e.g. `legalNameSection_firstName`, `phoneSection_phoneNumber`).

5. **Graceful Error Recovery & Telemetry**:
   - Captures rich diagnostics for skipped fields:
     - File uploads: explains browser sandbox restrictions and notes manual action required.
     - Disabled/read-only inputs: logs skipped state and reason.
   - Enriches `FillResult` and `DOM_FILL_DONE` telemetry with platform metadata.

---

## Verification Strategy
- **Baseline Regression**: Ensure all 194 existing unit tests across extension and backend pass.
- **Dedicated Platform Suite**: Add `extension/src/__tests__/platformAdapters.test.ts` testing:
  - Greenhouse adapter personal info, social links, resume dropzone, and Chosen/Select2 widgets.
  - Lever adapter section wrapper parsing, full name input, `urls[...]` network parsing, and demographic survey.
  - Workday adapter deep shadow DOM querying, wizard step detection, `data-automation-id` labels, and select prompt buttons.
  - Telemetry and graceful error recovery behavior.
