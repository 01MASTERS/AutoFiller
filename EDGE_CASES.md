# AutoFiller — Edge Cases, Known Limitations & Debugging Guide

This document serves as the comprehensive engineering reference for edge cases, form quirks, known boundaries, and troubleshooting procedures across the AutoFiller pipeline.

Use this guide when diagnosing why a specific field failed to scan, map, or fill, or when planning future feature enhancements.

Automated boundary and edge case tests are implemented in:
👉 [`extension/src/__tests__/edgeCases.test.ts`](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/AutoFiller/extension/src/__tests__/edgeCases.test.ts)

---

## 1. System Pipeline Overview

Every autofill cycle moves through four distinct stages. Failures or inconsistencies always localize to one of these four:

```
[1. DOM Scan]             [2. AI Prompt & Deduction]        [3. Option Validation]          [4. Synthetic DOM Fill]
(domReader.ts)      -->   (promptBuilder.ts)          -->   (responseParser.ts)      -->    (formFiller.ts)
Scans active page DOM     Sends fields + profile to LLM     Validates returned values       Simulates real user clicks,
and resolves labels.      for semantic matching.            against allowed options list.   keystrokes, & hidden sync.
```

---

## 2. Comprehensive Edge Cases Catalog

### Category A: Form DOM Extraction Quirks

#### 1. "Other:" Radio/Checkbox with Companion Text Input
- **Symptom**: The "Other:" radio option is selected, but the text underline remains blank, causing Google Forms to throw `! This is a required question`.
- **Technical Cause**: Google Forms embeds a companion `<input type="text" class="Hvn9fb" aria-label="Other response">` inside the option row. If `domReader` treats this as a separate question, the LLM receives detached "Other response" fields without context and leaves them blank. If `formFiller` only clicks the radio without typing into the text input, the field fails validation.
- **Implemented Fix**:
  1. `domReader.ts` detects companion inputs inside radio/checkbox containers and marks them as processed so they are not scanned as separate fields.
  2. `responseParser.ts` accepts `"Other: <custom value>"` and preserves it.
  3. `formFiller.ts` detects the companion input and types the custom value using native setters and event dispatching.
- **Test Reference**: `formFiller.test.ts` & `edgeCases.test.ts`.

#### 2. Multi-Part Google Forms Dates (`.exportDate`)
- **Symptom**: Form has a date question, but Google Forms shows three separate text boxes (Month, Day, Year) instead of a native `<input type="date">`.
- **Technical Cause**: Google Forms renders three separate text inputs (`aria-label="Month" maxlength="2"`, `aria-label="Day" maxlength="2"`, `aria-label="Year" maxlength="4"`).
- **Current Behavior**: `domReader.ts` discovers all three inputs individually. The LLM outputs ISO `YYYY-MM-DD` for all three, but typing `1995-08-24` into a 2-character Month box gets truncated.
- **How to Debug**: Look in `/logs-ui` for `DOM_SCAN_SUCCESS` having three fields with `ariaLabel="Month"`, `ariaLabel="Day"`, `ariaLabel="Year"`.
- **Future Enhancement**: Group `.exportDate` children into a single synthetic compound date field, decompose the canonical `YYYY-MM-DD` string, and populate each component respectively.

#### 3. Rich Text / ContentEditable Editors
- **Symptom**: Long-form text areas (e.g. Cover Letter or Summary boxes on Lever, Greenhouse, or Workday) are not scanned or filled.
- **Technical Cause**: Many modern web apps implement text editors using `<div contenteditable="true" role="textbox">` (Quill, TinyMCE, Draft.js) rather than native `<textarea>`.
- **Current Behavior**: `domReader.ts` Stage 5 queries native `<input>` and `<textarea>`. Rich text divs are skipped.
- **Future Enhancement**: Add `[contenteditable="true"]` and `[role="textbox"]:not(input):not(textarea)` to Stage 5 scanning, and inject text using `document.execCommand('insertText')` or `innerHTML`.

#### 4. Closed Dropdowns with Unrendered Options (Radix UI / Headless UI / MUI)
- **Symptom**: A dropdown field is scanned, but `optionsCount: 0` is sent to the LLM.
- **Technical Cause**: In virtualized or React-portal component libraries, the options `<div role="listbox">` do not exist in the DOM until the user clicks the trigger.
- **Current Behavior**: The LLM receives the field with no options list and must deduce the answer from text alone.
- **Future Enhancement**: For custom comboboxes with 0 options, optionally trigger a synthetic focus/click to hydrate the option list in the DOM before scanning.

#### 5. Shadow DOM & Web Components
- **Symptom**: Form fields styled with web components (e.g. Material Web `<md-outlined-text-field>` or Salesforce Lightning components) are invisible.
- **Technical Cause**: Standard `document.querySelectorAll()` does not pierce `element.shadowRoot`.
- **Future Enhancement**: Implement a recursive deep DOM walker that checks `el.shadowRoot` for encapsulated input controls.

---

### Category B: AI Matching & Semantic Reasoning

#### 6. Negative Default Screening Questions (Backlogs, Criminal History, Non-Compete)
- **Symptom**: Questions like "Do you have any backlogs?" or "Have you been convicted of a felony?" are left blank.
- **Technical Cause**: The user's `profile.json` does not explicitly list negative statements. Under the strict "Do not guess" rule, the LLM omits the field.
- **Implemented Fix**: Rule 14 in `promptBuilder.ts` explicitly instructs the model to map standard screening questions with negative defaults to `"No"` unless the profile states otherwise.
- **Debugging**: Check `unmappedFields` in the `BACKEND_API: LLM_RESPONSE` log. If a screening question appears there, add the explicit key (e.g. `"Backlogs": "No"`) to `profile.json` under `custom`.

#### 7. Ambiguous Section Disambiguation (e.g. Current City vs Permanent City)
- **Symptom**: Form has two fields labeled "City" or "Passing Year", and both get mapped to the same value.
- **Technical Cause**: Short labels like "City" or "Percentage" lose their hierarchical context if the parent section header (e.g., "Permanent Address" vs "Current Address") is not included in the field label.
- **Implemented Fix**: `domReader.ts` traverses parent `<fieldset>`, `<legend>`, and `role="heading"` elements to construct accessible labels.

#### 8. Linear / Rating Scales (1 to 5, 1 to 10)
- **Symptom**: Google Forms "Linear scale" radio questions (e.g., "Rate your skill in Docker from 1 to 5") might be omitted if the profile has no numeric rating.
- **Technical Cause**: Profiles typically store skills as arrays of strings (`"skills": ["Docker"]`) rather than numeric ratings.
- **Mitigation**: Add self-ratings or years of experience in `profile.json` under `custom` (e.g. `"Docker Skill Rating": "4/5"`).

---

### Category C: DOM Interaction & Browser Security Restrictions

#### 9. File Upload Questions (`<input type="file">`)
- **Symptom**: "Upload Resume / CV" is completely untouched by AutoFiller.
- **Technical Cause**: **Browser Security Sandbox**. The W3C File API strictly forbids JavaScript or extension content scripts from programmatically setting `input.files` with a local file path. File uploads require genuine OS file picker interaction or drag-and-drop.
- **Status**: By design, AutoFiller ignores file inputs. Users must manually attach their resume file.

#### 10. Forms Embedded Inside `<iframe>`s
- **Symptom**: A Google Form embedded on a company career page is not detected or filled.
- **Technical Cause**: If the embedding page is on domain A (`careers.company.com`) and the form is inside an iframe on domain B (`docs.google.com`), cross-origin security prevents top-frame scripts from accessing the iframe DOM.
- **Mitigation**: Add `"all_frames": true` in `manifest.ts` so the content script injects directly inside the iframe context.

#### 11. Multi-Page / Paginated Forms
- **Symptom**: Only the first page is filled; clicking "Next" shows an unfilled second page.
- **Technical Cause**: Single-page form engines dynamically swap the DOM on page navigation without reloading the browser tab.
- **Usage Rule**: Click AutoFiller on Page 1, proceed to Page 2, and trigger AutoFiller again on Page 2.

#### 12. Strict Input Masks (e.g. Cleave.js, Inputmask)
- **Symptom**: Phone numbers or currency fields end up jumbled (e.g. `919-135-5173` instead of `913-551-7396`).
- **Technical Cause**: Some mask plugins listen to `keydown` or `keypress` events and maintain internal cursor position state, rejecting raw programmatic string assignments.
- **Mitigation**: `formFiller.ts` dispatches `keydown`, `keypress`, `input`, `change`, and `blur`.

---

## 3. Step-by-Step Debugging Playbook

When an autofill run does not produce expected results:

### Step 1: Open the Debug Log Dashboard
Open `http://localhost:3456/logs-ui` or click **"Open Debug Logs"** from the extension popup.

### Step 2: Check the 4-Step Timeline

1. **`[BACKGROUND] AUTOFILL_START`**:
   - Verify which provider (`ollama` or `gemini`) and model was invoked.
2. **`[CONTENT_SCRIPT] DOM_SCAN_SUCCESS`**:
   - Inspect `details.count` and `details.fields`.
   - *Was the missing field even detected?* If not, the field is using custom DOM tags (Shadow DOM, rich text, iframe).
3. **`[BACKEND_API] LLM_RESPONSE`**:
   - Inspect `details.unmappedCount` and `details.unmappedFields`.
   - *Did the LLM omit the field?* If so, your `profile.json` lacks data for this question, or the prompt rules instructed omission.
   - Inspect `details.rejectedOptions`.
   - *Did the validator drop the model's output?* Check if the returned string didn't match the form's allowed choices.
4. **`[CONTENT_SCRIPT] DOM_FILL_DONE`**:
   - Inspect `details.failedFields` and `details.failureReasons`.
   - *Did DOM insertion fail?* Indicates an unclickable or masked DOM element.

---

## 4. Summary of Supported Form Controls

| Control Type | Extraction Mechanism | DOM Interaction Mechanism | Supported Form Builders |
|---|---|---|---|
| **Text / Email / Tel / Password** | `input[type="text|email|tel|password|url|number"]` | Prototype value setter + `input`, `change`, `blur` events | Google Forms, Typeform, Native HTML |
| **Textarea** | `<textarea>` | Prototype value setter + `input`, `change`, `blur` events | Google Forms, Typeform, Native HTML |
| **Radio Group** | `[role="radiogroup"]`, `input[type="radio"]` | Full pointer sequence (`pointerdown` $\to$ `mousedown` $\to$ `mouseup` $\to$ `click`) + hidden sync | Google Forms, Native HTML, ARIA radiogroups |
| **Checkbox Group** | `[role="group"]`, `input[type="checkbox"]` | `simulateFullClick` on matching options; unchecks non-matching | Google Forms, Native HTML, ARIA groups |
| **Native `<select>` Dropdown** | `<select>` + `<option>` | Native `.value` assignment + `change` event dispatch | Standard Web Forms |
| **ARIA Listbox Dropdown** | `[role="listbox"]` + `[role="option"]` | Keyboard `Enter` open sequence + 120ms tick wait + pointer click | Google Forms Closure Select, ARIA listboxes |
| **"Other:" Option with Custom Text** | Companion `input[aria-label*="Other"]` | Selects "Other" radio/checkbox + fills companion text box | Google Forms, Native HTML |
