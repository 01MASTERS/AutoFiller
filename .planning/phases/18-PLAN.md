# Phase 18 Implementation Plan: ATS Platform Heuristics & Adaptations (Greenhouse, Lever, Workday)

## Phase Objective
Implement dedicated platform adapters and domain-specific heuristics for the top three enterprise Applicant Tracking Systems (**Greenhouse, Lever, and Workday**). Handle platform-specific DOM conventions, section classifications, bracketed input parsing, Shadow DOM traversal, multi-step wizard step detection, and enhanced skipped/failed field telemetry while preserving 100% backward compatibility with all existing tests.

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Shared** | [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts) | `FieldMetadata` has `platform` but lacks `platformFieldType` and `section` | Add `PlatformFieldType` enum/union; add `platformFieldType` and `section` to `FieldMetadata` |
| **Backend** | [`backend/src/types/profile.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/types/profile.ts) | `fieldMetadataSchema` allows specific fields | Update schema with `platformFieldType` and `section` |
| **Extension** | `extension/src/content/domReader/adapters/greenhouseAdapter.ts` (NEW) | Does not exist | Create Greenhouse adapter for personal info, resume dropzone, social links, Chosen/Select2, and EEO demographics |
| **Extension** | `extension/src/content/domReader/adapters/leverAdapter.ts` (NEW) | Does not exist | Create Lever adapter for multi-section wrappers, full name, `urls[...]` network parsing, and demographic survey |
| **Extension** | `extension/src/content/domReader/adapters/workdayAdapter.ts` (NEW) | Does not exist | Create Workday adapter for deep Shadow DOM traversal, wizard step detection, `data-automation-id` labels, and prompt comboboxes |
| **Extension** | `extension/src/content/domReader/adapters/index.ts` (NEW) | Does not exist | Create platform adapter orchestrator `applyPlatformAdapters(fields, doc, platform)` |
| **Extension** | [`extension/src/content/domReader/fieldDiscovery.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/fieldDiscovery.ts) | Runs generic control scanners without platform post-processing | Integrate `applyPlatformAdapters` to refine discovered fields before returning |
| **Extension** | [`extension/src/content/formFiller/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/formFiller/index.ts) | Basic failure reasons | Enhance skipped field reporting with platform recovery metadata (e.g. sandbox file upload notice) |
| **Tests** | `extension/src/__tests__/platformAdapters.test.ts` (NEW) | Does not exist | Add 15+ comprehensive unit tests covering Greenhouse, Lever, Workday adapters, shadow DOM, and telemetry |

---

## Detailed Task Breakdown

### Task 1: Shared Platform Telemetry & Data Contracts
**Files to Modify**:
- [MODIFY] [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts)
- [MODIFY] [`backend/src/types/profile.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/types/profile.ts)

**Action**:
1. In `shared/src/index.ts`:
   ```typescript
   export type PlatformFieldType =
     | 'personal'
     | 'experience'
     | 'custom_question'
     | 'demographic'
     | 'resume_upload'
     | 'social_link'
     | 'other';

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
     platformFieldType?: PlatformFieldType;
     section?: string;
   }
   ```
2. In `backend/src/types/profile.ts`:
   - Add `platformFieldType` and `section` to `fieldMetadataSchema`.

---

### Task 2: Greenhouse Platform Adapter
**Files to Create**:
- [NEW] `extension/src/content/domReader/adapters/greenhouseAdapter.ts`

**Action**:
1. Implement `adaptGreenhouseFields(fields: FieldMetadata[], doc: Document): void`:
   - **Personal Details**: Detects inputs named `job_application[first_name]`, `job_application[last_name]`, `job_application[email]`, `job_application[phone]`, `job_application[location]`. Sets clean label ("First Name", "Last Name", etc.) and `platformFieldType: 'personal'`.
   - **Social / Portfolio Links**: Identifies `job_application[answers_attributes][...]` with labels like LinkedIn, GitHub, Portfolio/Website. Sets `platformFieldType: 'social_link'`.
   - **Resume Dropzone**: Detects `#resume, [data-field="resume"], .attach-or-paste`. If present in fields, annotates `platformFieldType: 'resume_upload'`.
   - **Chosen & Select2 Widgets**: Links custom dropdown containers (`.chosen-container`, `.select2-container`) to their parent question and underlying `<select>` options.
   - **Boilerplate Cleaning**: Strips Greenhouse helper sub-labels ("Select one...", "Please enter a valid URL", asterisk clutter).
   - **EEO / Demographics**: Detects Voluntary Self-Identification sections, tags fields as `platformFieldType: 'demographic'`, and trims verbose legal disclaimers.

---

### Task 3: Lever Platform Adapter
**Files to Create**:
- [NEW] `extension/src/content/domReader/adapters/leverAdapter.ts`

**Action**:
1. Implement `adaptLeverFields(fields: FieldMetadata[], doc: Document): void`:
   - **Section Classification**:
     - `.section-candidate-wrapper` -> `section: 'candidate'`
     - `.section-links-wrapper` -> `section: 'links'`
     - `.section-cards-wrapper` or `.custom-questions` -> `section: 'custom_questions'`
     - `.section-eeo-wrapper` or `#demographic-survey` -> `section: 'demographics'`
   - **Full Name**: Single input `input[name="name"]` mapped to label "Full Name", `platformFieldType: 'personal'`.
   - **Social Links Bracket Parsing**:
     - Parses network name from `name="urls[LinkedIn]"`, `name="urls[Twitter]"`, `name="urls[GitHub]"`, `name="urls[Portfolio]"` into clean network labels ("LinkedIn URL", "GitHub URL", "Portfolio URL"), `platformFieldType: 'social_link'`.
   - **Custom Questions & Styled Radios/Checkboxes**:
     - Resolves `.card-field-title` or `.application-question-text`.
     - Links `.lever-radio-label` and `.lever-checkbox-label` to their visible span texts.
   - **Demographic Survey**:
     - Tags Gender, Race, Veteran, and Disability fields with `platformFieldType: 'demographic'`, stripping long legal preambles.

---

### Task 4: Workday Platform Adapter & Shadow DOM Traversal
**Files to Create**:
- [NEW] `extension/src/content/domReader/adapters/workdayAdapter.ts`

**Action**:
1. Implement `queryDeepAll(selector: string, root: Element | Document): Element[]`:
   - Traverses standard children and recursively pierces `element.shadowRoot` boundaries.
2. Implement `adaptWorkdayFields(fields: FieldMetadata[], doc: Document): void`:
   - **Wizard Step Detection**:
     - Inspects `[data-automation-id="activeStep"]`, `[data-automation-id="wizardStep"]`, or page headings to record active step ("My Information", "My Experience", "Application Questions", "Voluntary Disclosures") in `section`.
   - **`data-automation-id` Label Resolution**:
     - Resolves field labels from `data-automation-id="formLabel"` or parent `[data-automation-id*="formField"]`.
     - Strips Workday required asterisks (`<abbr title="required">*</abbr>`).
   - **Select Prompt Buttons & Comboboxes**:
     - Detects `button[data-automation-id*="prompt"]`, `button[aria-haspopup="listbox"]`.
     - Connects pre-rendered options or marks as searchable comboboxes.
   - **Compound Input Grouping**:
     - Normalizes compound identifiers (`legalNameSection_firstName`, `phoneSection_phoneNumber`).

---

### Task 5: Adapter Pipeline Integration & Comprehensive Test Suite
**Files to Create/Modify**:
- [NEW] `extension/src/content/domReader/adapters/index.ts`
- [MODIFY] [`extension/src/content/domReader/fieldDiscovery.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/domReader/fieldDiscovery.ts)
- [MODIFY] [`extension/src/content/formFiller/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/content/formFiller/index.ts)
- [NEW] `extension/src/__tests__/platformAdapters.test.ts`

**Action**:
1. In `adapters/index.ts`:
   - Implement `applyPlatformAdapters(fields: FieldMetadata[], doc: Document, platform: FormPlatform): void`:
     - Dispatches to `adaptGreenhouseFields`, `adaptLeverFields`, or `adaptWorkdayFields` based on detected platform.
2. In `fieldDiscovery.ts`:
   - Call `applyPlatformAdapters(fields, doc, platform)` after control scans.
3. In `formFiller/index.ts`:
   - Annotate skipped field telemetry with recovery guidance and field classifications.
4. In `extension/src/__tests__/platformAdapters.test.ts`:
   - Unit tests for Greenhouse adapter (personal info, social links, Chosen/Select2, resume annotation).
   - Unit tests for Lever adapter (section wrappers, full name, `urls[...]` parsing, styled radio/checkboxes, demographic survey).
   - Unit tests for Workday adapter (shadow DOM querying, wizard step detection, `data-automation-id` labels, prompt button comboboxes).
   - Telemetry and error recovery behavior.

---

## Verification Commands
```bash
# Run extension unit tests (existing 122 tests + 15+ new adapter tests)
npm run test -w extension

# Full project test suite (194+ total tests)
npm test

# Production bundle build (verify extension standalone IIFE build)
npm run build
```
