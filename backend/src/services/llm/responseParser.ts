import { FieldMetadata, FieldOption, FieldMappingValue } from '@autofiller/shared';
import { LLMParseError } from './types.js';

export interface ParseDiagnostics {
  rejectedOptions: Record<string, string[]>;
  unknownFields?: string[];
}

export interface ParseResult {
  mappings: Record<string, FieldMappingValue>;
  diagnostics: ParseDiagnostics;
}

let lastDiagnostics: ParseDiagnostics = { rejectedOptions: {} };

/**
 * Returns diagnostic information from the most recent parse execution.
 * @deprecated Prefer receiving diagnostics directly from parseLLMResponseWithDiagnostics.
 */
export function getLastParseDiagnostics(): ParseDiagnostics {
  return lastDiagnostics;
}

/**
 * Deterministically matches an input string against allowed options for a form field.
 *
 * Matching precedence:
 * 1. Exact option.value match
 * 2. Exact option.label match
 * 3. Case/whitespace normalized option.value match
 * 4. Case/whitespace normalized option.label match
 *
 * Returns matching FieldOption or null if no match found.
 */
export function matchFieldOption(
  input: string,
  options: FieldOption[],
): FieldOption | null {
  if (!input || typeof input !== 'string' || !options || options.length === 0) {
    return null;
  }

  // 1. Exact option.value match
  for (const opt of options) {
    if (opt.value !== undefined && opt.value === input) {
      return opt;
    }
  }

  // 2. Exact option.label match
  for (const opt of options) {
    if (opt.label === input) {
      return opt;
    }
  }

  // 3. Case/whitespace normalized option.value match
  const normalizedInput = input.trim().toLowerCase();
  for (const opt of options) {
    if (opt.value !== undefined && opt.value.trim().toLowerCase() === normalizedInput) {
      return opt;
    }
  }

  // 4. Case/whitespace normalized option.label match
  for (const opt of options) {
    if (opt.label.trim().toLowerCase() === normalizedInput) {
      return opt;
    }
  }

  return null;
}

/**
 * Helper to identify an "Other" option in field options
 */
function findOtherFieldOption(options: FieldOption[]): FieldOption | null {
  for (const opt of options) {
    if (opt.isOther) return opt;
    const val = (opt.value || '').toLowerCase();
    const lbl = (opt.label || '').toLowerCase();
    if (val === '__other_option__' || lbl.startsWith('other') || val.startsWith('other')) {
      return opt;
    }
  }
  return null;
}

/**
 * Parses raw JSON string returned by LLM and returns both validated mappings and request-scoped diagnostics.
 */
export function parseLLMResponseWithDiagnostics(
  rawResponse: string,
  fields?: FieldMetadata[],
): ParseResult {
  const diagnostics: ParseDiagnostics = { rejectedOptions: {} };
  lastDiagnostics = diagnostics;

  if (!rawResponse || typeof rawResponse !== 'string') {
    throw new LLMParseError('Empty or invalid response from LLM', String(rawResponse));
  }

  let cleaned = rawResponse.trim();

  // Strip code blocks if present
  const codeBlockMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new LLMParseError(
      `Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`,
      rawResponse,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new LLMParseError('Parsed JSON is not a plain object', rawResponse);
  }

  const rawEntries = Object.entries(parsed);
  const result: Record<string, FieldMappingValue> = {};

  for (const [key, rawVal] of rawEntries) {
    // Validate that values are primitives or arrays of primitives
    if (typeof rawVal === 'object' && rawVal !== null && !Array.isArray(rawVal)) {
      throw new LLMParseError(
        `Value for key "${key}" is not a string, boolean, number, or array (got object)`,
        rawResponse,
      );
    }

    if (Array.isArray(rawVal)) {
      if (rawVal.some((item) => typeof item === 'object' && item !== null)) {
        throw new LLMParseError(
          `Array value for key "${key}" contains non-primitive elements`,
          rawResponse,
        );
      }
    }

    // If no field metadata is supplied, preserve backwards-compatible parsing
    if (!fields || fields.length === 0) {
      if (typeof rawVal === 'string') {
        result[key] = rawVal;
      } else if (typeof rawVal === 'number') {
        result[key] = String(rawVal);
      } else if (typeof rawVal === 'boolean') {
        result[key] = rawVal;
      } else if (Array.isArray(rawVal)) {
        result[key] = rawVal.map(String);
      }
      continue;
    }

    const field = fields.find((f) => f.id === key);

    // Reject unknown LLM field IDs that were not present in the scanned form
    if (!field) {
      diagnostics.unknownFields = diagnostics.unknownFields || [];
      diagnostics.unknownFields.push(key);
      continue;
    }

    const isMultiSelect = field.selectionMode === 'multiple';

    const isStandaloneCheckbox =
      field.controlType === 'checkbox' && field.selectionMode !== 'multiple';

    const isSingleChoice =
      field.selectionMode === 'single' ||
      field.controlType === 'radio' ||
      field.controlType === 'dropdown' ||
      field.controlType === 'combobox';

    // 1. Multiple-choice fields
    if (isMultiSelect) {
      // Must be an array or convertible array
      let rawArray: string[];
      if (Array.isArray(rawVal)) {
        rawArray = rawVal.map(String);
      } else if (typeof rawVal === 'string' && field.options && field.options.length > 0) {
        // If LLM returned a single string for a multi-select, check if it's a valid option
        rawArray = [rawVal];
      } else {
        // Non-array and non-convertible -> reject
        continue;
      }

      if (field.options && field.options.length > 0) {
        const validOptions: string[] = [];
        const seen = new Set<string>();

        for (const item of rawArray) {
          const matched = matchFieldOption(item, field.options);
          if (matched) {
            const canonicalValue = matched.value ?? matched.label;
            if (!seen.has(canonicalValue)) {
              seen.add(canonicalValue);
              validOptions.push(canonicalValue);
            }
          } else {
            const otherOpt = findOtherFieldOption(field.options);
            if (otherOpt && item.trim().length > 0) {
              const trimmed = item.trim();
              const norm = trimmed.toLowerCase();
              const formatted =
                norm.startsWith('other:') || norm.startsWith('__other_option__')
                  ? trimmed
                  : `Other: ${trimmed}`;
              if (!seen.has(formatted)) {
                seen.add(formatted);
                validOptions.push(formatted);
              }
            } else {
              if (!diagnostics.rejectedOptions[key]) {
                diagnostics.rejectedOptions[key] = [];
              }
              diagnostics.rejectedOptions[key].push(item);
            }
          }
        }

        if (validOptions.length > 0) {
          result[key] = validOptions;
        }
      } else {
        // No options metadata available (e.g. open multi-select)
        result[key] = Array.from(new Set(rawArray));
      }
      continue;
    }

    // 2. Standalone boolean checkbox
    if (isStandaloneCheckbox) {
      if (typeof rawVal === 'boolean') {
        result[key] = rawVal;
      } else if (rawVal === 'true' || rawVal === '1') {
        result[key] = true;
      } else if (rawVal === 'false' || rawVal === '0') {
        result[key] = false;
      }
      // Arrays or random strings rejected for standalone boolean checkbox
      continue;
    }

    // 3. Single-choice fields
    if (isSingleChoice) {
      // If single-choice received array or boolean, reject as invalid
      if (Array.isArray(rawVal) || typeof rawVal === 'boolean') {
        continue;
      }

      const inputStr = typeof rawVal === 'number' ? String(rawVal) : (rawVal as string);

      if (field.options && field.options.length > 0) {
        const matched = matchFieldOption(inputStr, field.options);
        if (matched) {
          result[key] = matched.value ?? matched.label;
        } else {
          // Check if field has an "Other" option allowing custom text
          const otherOpt = findOtherFieldOption(field.options);
          if (otherOpt && inputStr.trim().length > 0) {
            const trimmed = inputStr.trim();
            const norm = trimmed.toLowerCase();
            if (norm.startsWith('other:') || norm.startsWith('__other_option__')) {
              result[key] = trimmed;
            } else {
              result[key] = `Other: ${trimmed}`;
            }
          } else {
            // Unrecognized constrained option: reject & record
            if (!diagnostics.rejectedOptions[key]) {
              diagnostics.rejectedOptions[key] = [];
            }
            diagnostics.rejectedOptions[key].push(inputStr);
          }
        }
      } else {
        // Missing option metadata (e.g. combobox without rendered options)
        result[key] = inputStr;
      }
      continue;
    }

    // 4. Date fields
    if (field.controlType === 'date') {
      if (typeof rawVal === 'string') {
        result[key] = rawVal.trim();
      }
      // Arrays or booleans rejected for date fields
      continue;
    }

    // 5. Normal text / textarea fields
    if (typeof rawVal === 'string') {
      result[key] = rawVal;
    } else if (typeof rawVal === 'number') {
      result[key] = String(rawVal);
    }
    // Booleans and arrays rejected for text/textarea fields
  }

  return { mappings: result, diagnostics };
}

/**
 * Parses raw JSON string returned by LLM and validates against field metadata.
 * Returns mapped fields with diagnostics attached for backwards compatibility.
 */
export function parseLLMJsonResponse(
  rawResponse: string,
  fields?: FieldMetadata[],
): Record<string, FieldMappingValue> & { diagnostics?: ParseDiagnostics } {
  const { mappings, diagnostics } = parseLLMResponseWithDiagnostics(rawResponse, fields);
  lastDiagnostics = diagnostics;
  Object.defineProperty(mappings, 'diagnostics', {
    value: diagnostics,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return mappings as Record<string, FieldMappingValue> & { diagnostics?: ParseDiagnostics };
}
