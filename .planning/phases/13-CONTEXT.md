# Phase 13 Context: LLM Gateway Enhancement for Constrained & Choice Fields

## Phase Summary
Phase 13 enhances AutoFiller's backend LLM Gateway (`promptBuilder.ts`, `responseParser.ts`, `ollamaProvider.ts`, `geminiProvider.ts`, and `gateway.ts`) to understand and enforce structured option constraints (`FieldOption[]`), multi-select array outputs for checkboxes, and date formatting. It incorporates strict validation in `responseParser` to filter hallucinated options and normalizes selections against allowed choices.

---

## Agreed Architecture & Specifications

### 1. Types & Return Signatures
- **Mapping Values**:
  ```typescript
  export type FieldMappingValue = string | string[];

  export interface AutofillResponse {
    status: 'success' | 'error';
    mappings: Record<string, FieldMappingValue>;
    error?: string;
  }
  ```
- All provider interfaces (`LLMProvider.mapFields`) and `LLMGateway.mapFields` return `Promise<Record<string, FieldMappingValue>>`.

### 2. Prompt Engineering Enhancements (`promptBuilder.ts`)
- **Single-Select Option Constraints (`controlType: 'radio' | 'dropdown' | 'combobox'` or `selectionMode: 'single'`)**:
  - When `options` are present in field metadata, instruct LLM that it must choose strictly ONE matching choice from the provided `options`.
  - Prefer the option's `value` (or `label` if no value exists).
  - Explicit rule: Do not invent any option outside the provided choices.
- **Multi-Select Checkboxes (`controlType: 'checkbox'` or `selectionMode: 'multiple'`)**:
  - Instruct LLM that for multi-select fields, the output MUST be a JSON array of strings containing all matching choices (e.g. `["JavaScript", "TypeScript"]`).
- **Date Inputs (`controlType: 'date'`)**:
  - Extract the date from profile history or custom attributes and format as standard ISO `YYYY-MM-DD` unless the field specifies a different pattern in its label/placeholder (e.g. `DD/MM/YYYY`).
- **Phone & Text Disambiguation**:
  - Retain all existing prompt rules for primary vs. alternate phone disambiguation, 10-digit stripping, and name splitting.

### 3. Response Parsing & Option Validation (`responseParser.ts`)
- **JSON & Array Support**:
  - Support string, number, boolean, and array of strings `string[]`.
- **Option Validation (`parseLLMJsonResponse(rawResponse, fields?)`)**:
  - When `fields` metadata is passed:
    - For each mapped field with defined `options`:
      - Match against `option.value` or `option.label` (case-insensitive fallback).
      - Normalize to `option.value ?? option.label`.
      - For single-select: if no option matches, drop/omit the field (prevents hallucinations).
      - For multi-select: filter array items to only valid options; if empty after filtering, omit the field.

---

## Downstream Guidelines for Phase 14
- Phase 14 (Content Script Form Filler) will receive `Record<string, string | string[]>`:
  - String values $\to$ fill text, set select value, click matching radio button.
  - Array values $\to$ iterate and toggle matching checkboxes.
