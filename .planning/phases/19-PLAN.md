# Phase 19 Implementation Plan: Multi-Platform E2E Testing, Mock Fixtures & Verification

## Phase Objective
Deliver realistic mock form fixtures for all major ATS platforms (Greenhouse, Lever, Workday) and generic HTML5 career forms, expose them through backend test endpoints for live browser verification, implement comprehensive automated end-to-end Vitest test suites executing the full Scan $\to$ Map $\to$ Fill pipeline, and benchmark latency to verify compliance with performance constraints (<10s total fill, <200ms DOM scan).

---

## Codebase Audit & Baseline Inspection

| Layer | File | Current State | Target Change |
|---|---|---|---|
| **Shared** | `shared/src/fixtures/mockForms.ts` (NEW) | Does not exist | Create realistic HTML mock fixtures for Greenhouse, Lever, Workday, Generic Career, and Google Forms |
| **Shared** | [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts) | Exports data types | Re-export mock HTML fixtures for cross-workspace consumption |
| **Backend** | [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts) | Only serves `/test-form` for Google Forms | Add `/test-forms` hub and `/test-forms/:platform` (`greenhouse`, `lever`, `workday`, `career`) endpoints |
| **Backend** | [`backend/src/__tests__/testForm.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/__tests__/testForm.test.ts) | Tests single `/test-form` | Test all `/test-forms/*` routes return 200 OK HTML |
| **Extension** | `extension/src/__tests__/e2eUniversalAutofill.test.ts` (NEW) | Does not exist | Implement comprehensive multi-platform E2E tests: full Scan $\to$ Map $\to$ Fill cycle, edge cases, and latency benchmarks |
| **Planning** | `.planning/phases/19-SUMMARY.md` (NEW) | Does not exist | Document Phase 19 results and Milestone 2 completion |

---

## Detailed Task Breakdown

### Task 1: Shared Realistic Mock Form Fixtures
**Files to Create/Modify**:
- [NEW] `shared/src/fixtures/mockForms.ts`
- [MODIFY] [`shared/src/index.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/shared/src/index.ts)

**Action**:
1. Create `shared/src/fixtures/mockForms.ts` containing realistic HTML strings:
   - `mockGreenhouseFormHtml`:
     - Form container `<form id="application_form" action="/jobs/123/apply">`.
     - Personal info: `job_application[first_name]`, `job_application[last_name]`, `job_application[email]`, `job_application[phone]`.
     - File dropzone: `<div id="resume" class="attach-or-paste"><input type="file" name="job_application[resume]" /></div>`.
     - Bracketed social links: `job_application[answers_attributes][0][text_value]` for LinkedIn, GitHub, Portfolio.
     - Select2 dropdown: `<select id="job_application_gender" name="job_application[gender]">` with wrapper.
     - Custom questions: textarea and radio questions.
     - Demographics / EEO: `#eeoc_fields` with race, veteran, disability selects.
   - `mockLeverFormHtml`:
     - Page wrapper `<div class="lever-job-page"><form id="application-form">`.
     - Section candidate wrapper: `input[name="name"]` (Full Name), `email`, `org` (Current Company).
     - Section links wrapper: `urls[LinkedIn]`, `urls[GitHub]`, `urls[Portfolio]`.
     - Section custom questions: styled radio group and checkbox questions (`.application-question`).
     - Section EEO: demographic survey dropdowns and disclosure checkboxes.
   - `mockWorkdayFormHtml`:
     - Application root `<div data-automation-id="workdayApplicationRoot">`.
     - Wizard progress bar: `<ol data-automation-id="progressBar"><li data-automation-id="wizardStep" class="active">My Information</li></ol>`.
     - Compound inputs: `legalNameSection_firstName`, `legalNameSection_lastName`, `addressSection_city`, `phone-number`.
     - Combobox prompt button: `button[data-automation-id="select-country-prompt"]` with listbox popup in body.
   - `mockCareerFormHtml`:
     - Clean modern standard HTML5 job application form with `<fieldset>`, `<legend>`, text inputs, select dropdowns, radio groups, checkboxes, and textarea.
   - `mockGoogleFormHtml`:
     - Preserves the standard Google Form test fixture.
2. Re-export all fixtures in `shared/src/index.ts`.

---

### Task 2: Backend Mock Form Hub & Platform Endpoints
**Files to Modify**:
- [MODIFY] [`backend/src/routes/api.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/routes/api.ts)
- [MODIFY] [`backend/src/__tests__/testForm.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/backend/src/__tests__/testForm.test.ts)

**Action**:
1. In `backend/src/routes/api.ts`:
   - Add `GET /test-forms`: Visual dashboard page styled with modern CSS linking to all test forms (`/test-forms/greenhouse`, `/test-forms/lever`, `/test-forms/workday`, `/test-forms/career`, `/test-forms/google-forms`).
   - Add `GET /test-forms/greenhouse`: Serves `mockGreenhouseFormHtml`.
   - Add `GET /test-forms/lever`: Serves `mockLeverFormHtml`.
   - Add `GET /test-forms/workday`: Serves `mockWorkdayFormHtml`.
   - Add `GET /test-forms/career`: Serves `mockCareerFormHtml`.
   - Update `GET /test-form`: Serves Google Form (and alias `/test-forms/google-forms`).
2. In `backend/src/__tests__/testForm.test.ts`:
   - Add tests verifying `GET /test-forms`, `GET /test-forms/greenhouse`, `GET /test-forms/lever`, `GET /test-forms/workday`, `GET /test-forms/career` each return `200 OK` HTML with proper platform-specific elements.

---

### Task 3: Multi-Platform Automated E2E Verification Test Suite
**Files to Create**:
- [NEW] `extension/src/__tests__/e2eUniversalAutofill.test.ts`

**Action**:
1. Implement full-cycle integration tests across all mock form platforms:
   - **Greenhouse E2E**:
     - `findFormFields(document)` detects 10+ fields, identifies Greenhouse, maps social links, marks resume upload.
     - Execute `fillFormFields(mappings, document)`.
     - Verify first name, last name, email, phone, LinkedIn, GitHub, gender select are filled.
     - Verify resume upload is recorded in `skippedFields` with informational security message.
   - **Lever E2E**:
     - `findFormFields(document)` detects sections (`candidate`, `links`, `custom_questions`, `demographics`), single Full Name, bracketed social URLs.
     - Execute `fillFormFields(mappings, document)`.
     - Verify Full Name, Email, Current Company, LinkedIn URL, custom questions, and styled radio selection.
   - **Workday E2E**:
     - `findFormFields(document)` detects wizard step `My Information`, compound name/address fields, and prompt combobox button.
     - Execute `fillFormFields(mappings, document)`.
     - Verify input setters, prompt button click, body portal option selection.
   - **Generic HTML5 Career Form E2E**:
     - Tests standard HTML5 form filling: text inputs, select dropdowns, radio groups, multi-select checkboxes, textarea bio.
   - **Error Resilience & Partial Fills**:
     - Tests handling of missing profile fields, disabled elements, and unmapped inputs.
2. **Performance & Latency Benchmarks (FR-16.3, NFR-11)**:
   - Benchmark DOM scanning latency: `performance.now()` across all fixtures must be `< 200ms` (typically < 30ms).
   - Benchmark DOM filling latency: filling 10+ fields must be `< 500ms` total (< 50ms per field).

---

### Task 4: Full Verification & Milestone 2 Audit
**Files to Create/Modify**:
- [NEW] `.planning/phases/19-SUMMARY.md`
- [MODIFY] `.planning/ROADMAP.md` (Mark Phase 19 completed, Milestone 2 complete)
- [MODIFY] `.planning/STATE.md` (Update state to Milestone 2 Complete, Next Phase 20)

**Action**:
1. Run full monorepo test suite: `npm test`.
2. Run full monorepo build: `npm run build`.
3. Generate `19-SUMMARY.md` documenting test coverage and benchmark results.
4. Update `ROADMAP.md` and `STATE.md`.
5. Update `walkthrough.md`.

---

## Verification Criteria
- All 199 existing tests continue to pass.
- All new E2E tests pass (Greenhouse, Lever, Workday, Career, Benchmarks).
- Backend `/test-forms/*` endpoints return 200 OK.
- Production bundle builds with 0 errors and 0 warnings.
- ZERO git commits made.
