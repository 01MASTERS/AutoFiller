# Phase 18 Summary: ATS Platform Heuristics & Adaptations (Greenhouse, Lever, Workday)

## Phase Status
- **Status**: Completed (`passed`)
- **Git Commit**: None (kept uncommitted in working tree per user directive)
- **Monorepo Tests**: 199 / 199 passing (127 extension, 72 backend)
- **Build Status**: Production bundle builds cleanly with zero errors or warnings (`55.88 kB` standalone IIFE content script)

---

## Deliverables & Architectural Changes

### 1. Shared Types & Schema Extensions (`shared/src/index.ts`, `backend/src/types/profile.ts`)
- Added `PlatformFieldType` union type: `'personal' | 'experience' | 'custom_question' | 'demographic' | 'resume_upload' | 'social_link' | 'other'`.
- Extended `FieldMetadata` interface in `@autofiller/shared`:
  - `platformFieldType?: PlatformFieldType;`
  - `section?: string;`
- Synchronized Zod validation in `backend/src/types/profile.ts`:
  - Added `platformFieldType: z.enum([...]).optional()` and `section: z.string().optional()` to `fieldMetadataSchema`.

### 2. Greenhouse Adapter (`extension/src/content/domReader/adapters/greenhouseAdapter.ts`)
- **Detection**: Fast-checks `isGreenhousePage()` via hostname (`boards.greenhouse.io`, `job-boards.greenhouse.io`, `gh_src=`), `#application_form`, or `#flash_wrapper`.
- **Field Normalization**:
  - Matches personal fields (`first_name`, `last_name`, `email`, `phone`) and standardizes labels.
  - Matches social profile links (`job_application[answers_attributes][...][text_value]`) to normalize labels (LinkedIn, GitHub, Website, Portfolio).
  - Handles resume/cover letter upload dropzones (`#resume`, `#cover_letter`, `[data-provides="upload"]`), tagging with `platformFieldType: 'resume_upload'` and descriptive label.
  - Synchronizes custom Chosen/Select2 dropdowns (`.select2-container`, `.chosen-container`) with native underlying `<select>` options.
  - Detects EEO demographic surveys (`#eeoc_fields`, `job_application_gender`, `job_application_race`, `veteran_status`, `disability_status`) and assigns `section: 'demographics'` and `platformFieldType: 'demographic'`.

### 3. Lever Adapter (`extension/src/content/domReader/adapters/leverAdapter.ts`)
- **Detection**: `isLeverPage()` checks `jobs.lever.co`, `lever-job-page`, or `form#application-form[action*="lever.co"]`.
- **Field Normalization**:
  - Unpacks single "Full Name" input (`input[name="name"]`) vs compound personal details.
  - Recognizes `urls[LinkedIn]`, `urls[GitHub]`, `urls[Twitter]`, `urls[Portfolio]`, `urls[Other]` bracketed patterns.
  - Section wrapper parsing: maps `.section-candidate-wrapper` to candidate info, `.section-links-wrapper` to links, `.section-custom-questions` to custom questions, and `.section-eeo` to demographics.
  - Custom question cards: associates styled custom radio/checkbox cards (`.application-question`) with parent question prompts.
  - EEO survey parsing: maps veteran, gender, race/ethnicity dropdowns and disclosure checkboxes.

### 4. Workday Adapter (`extension/src/content/domReader/adapters/workdayAdapter.ts`)
- **Detection**: `isWorkdayPage()` checks `myworkdayjobs.com`, `myworkday.com`, `[data-automation-id*="workday"]`, or `[data-automation-id="workdayApplicationRoot"]`.
- **Field Normalization**:
  - Multi-step wizard detector: inspects `[data-automation-id*="wizardStep"]`, `ol[data-automation-id="progressBar"]`, or active tab pills to tag `section` (e.g., `My Information`, `My Experience`, `Application Questions`, `Review`).
  - Compound personal details: extracts standard Workday IDs (`legalNameSection_firstName`, `addressSection_city`, `phone-number`).
  - Prompt comboboxes: detects prompt buttons (`button[data-automation-id*="prompt"]`, `[data-automation-id="multiselect-input"]`, `button[aria-haspopup="listbox"]`), sets `controlType: 'combobox'`, and marks them with interactive metadata.
  - Shadow DOM traversal: provides `queryDeepAll` helper to traverse shadow roots when fields are encapsulated inside Web Components.

### 5. Platform Adapter Integration & Post-Scan Pipeline (`fieldDiscovery.ts`, `adapters/index.ts`)
- Created `extension/src/content/domReader/adapters/index.ts` exporting `applyPlatformAdapters(fields, root)`.
- Integrated as a clean post-processing refinement pass after universal discovery completes in `findFormFields(root)`.
- Generic DOM reader retains 100% generality; platform heuristics run only when target platform is recognized.

### 6. User-Friendly Form Filler Reporting (`extension/src/content/formFiller/index.ts`)
- Augmented file upload skip behavior: fields marked `resume_upload` or `type="file"` now produce friendly informative skip entries:
  `Skipped: Resume/CV file upload requires manual file selection (automated file upload restricted by browser security)`.

### 7. Comprehensive Testing (`platformAdapters.test.ts`)
- Added 5 comprehensive test suites in `extension/src/__tests__/platformAdapters.test.ts`:
  1. Greenhouse Adapter: personal fields, social links, resume upload, Select2 dropdowns, EEO demographics.
  2. Lever Adapter: section wrappers, full name, social link bracketed names, custom question cards, styled options.
  3. Workday Adapter: wizard step detection, compound personal fields, prompt button comboboxes, Shadow DOM piercing.
  4. Integration Pipeline: verify `findFormFields` executes adapters seamlessly without mutating generic fields.
  5. Form Filler Telemetry: verify `fillFormFields` returns detailed skipped report for `resume_upload`.

---

## Key Learnings & Gotchas
- **JSDOM `CSS.escape` Trap**: Node/JSDOM does not provide global `window.CSS.escape`. Calling `CSS.escape` throws `ReferenceError: CSS is not defined`. Always use `escapeCss` with regex fallback `str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1')`.
- **Base ID Priority**: In `controls/text.ts` and `controls/dropdown.ts`, element `name` takes precedence over `id` when assigning `field.id`. For `<select id="job_application_gender" name="job_application[gender]">`, `field.id` becomes `job_application[gender]`. Adapter lookups and test assertions must test both `id` and `name`.
- **Preserving Sub-labels in General Reader**: When adapters normalize labels, they must avoid overwriting descriptive sub-labels (e.g., "Gender Identity" must remain "Gender Identity" rather than collapsing to "Gender", and "Phone Number" must not shorten to "Phone") so that generic DOM reader tests remain 100% stable.
