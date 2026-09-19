/**
 * @file index.ts
 * Main entry point for universal form filling engine.
 */

import { FillResult, FieldMappingValue, FieldMetadata } from '@autofiller/shared';
import { findFieldElement } from '../domReader.js';
import { escapeCss } from './events.js';
import { fillTextInput } from './simulators/inputSimulator.js';
import { fillNativeDropdown, fillAriaDropdown } from './simulators/selectSimulator.js';
import { fillRadioGroup, fillCheckboxGroup } from './simulators/selectionReconciler.js';
import { fillDateInput } from './simulators/dateSimulator.js';

export * from './events.js';
export * from './visualFeedback.js';
export * from './simulators/inputSimulator.js';
export * from './simulators/selectSimulator.js';
export * from './simulators/selectionReconciler.js';
export * from './simulators/dateSimulator.js';

/**
 * Universally fills form fields based on mapped values and field metadata.
 * Coordinates input injection, dropdown simulation, selection reconciliation, and date handling.
 */
export async function fillFormFields(
  mappings: Record<string, FieldMappingValue>,
  fields: FieldMetadata[] = [],
  doc: Document = document,
): Promise<FillResult> {
  const filledFields: string[] = [];
  const failedFields: string[] = [];
  const skippedFields: string[] = [];
  const failureReasons: Record<string, string> = {};
  const skippedReasons: Record<string, string> = {};

  const keys = Object.keys(mappings);
  if (keys.length === 0) {
    return {
      status: 'error',
      filledCount: 0,
      failedCount: 0,
      skippedCount: 0,
      filledFields: [],
      failedFields: [],
      skippedFields: [],
      failureReasons: {},
      skippedReasons: {},
      error: 'No mappings provided',
    };
  }

  // Build O(1) lookup from field ID to metadata
  const fieldMap = new Map<string, FieldMetadata>();
  for (const f of fields) {
    fieldMap.set(f.id, f);
  }

  for (const [fieldId, value] of Object.entries(mappings)) {
    if (value === undefined || value === null || value === '') {
      failedFields.push(fieldId);
      failureReasons[fieldId] = 'Value mapped for this field was empty or null';
      continue;
    }

    const meta = fieldMap.get(fieldId);
    const controlType = meta?.controlType || 'text';
    const selectionMode = meta?.selectionMode;

    // --- File input browser security guard ---
    if (controlType === 'file' || meta?.platformFieldType === 'resume_upload') {
      skippedFields.push(fieldId);
      skippedReasons[fieldId] = 'Resume / file upload inputs cannot be programmatically set due to browser security sandbox (manual attachment required)';
      continue;
    }

    // --- Type-safety guards ---
    if (controlType === 'radio' && typeof value !== 'string') {
      skippedFields.push(fieldId);
      skippedReasons[fieldId] = `Radio expects string, got ${typeof value === 'object' ? 'array' : typeof value}`;
      continue;
    }

    if (controlType === 'checkbox' && selectionMode === 'multiple' && !Array.isArray(value) && typeof value !== 'boolean') {
      skippedFields.push(fieldId);
      skippedReasons[fieldId] = `Multi-select checkbox expects string[] or boolean, got ${typeof value}`;
      continue;
    }

    if ((controlType === 'dropdown' || controlType === 'combobox') && selectionMode !== 'multiple' && typeof value !== 'string') {
      skippedFields.push(fieldId);
      skippedReasons[fieldId] = `Single-select ${controlType} expects string, got ${typeof value === 'object' ? 'array' : typeof value}`;
      continue;
    }

    // --- Find DOM element ---
    let target: Element | null = null;

    if (meta) {
      target = findFieldElement(meta, doc);
    }

    // Fallback: ad-hoc CSS search for fields without metadata
    if (!target) {
      try {
        target = doc.querySelector(
          `[data-autofiller-id="${escapeCss(fieldId)}"], input[name="${escapeCss(fieldId)}"], textarea[name="${escapeCss(fieldId)}"], #${escapeCss(fieldId)}`,
        );
      } catch {
        target = doc.getElementById(fieldId);
      }
      if (!target) {
        try {
          target = doc.querySelector(`[name="${escapeCss(fieldId)}"]`);
        } catch {
          target = doc.getElementById(fieldId);
        }
      }
    }

    if (!target) {
      failedFields.push(fieldId);
      failureReasons[fieldId] = 'No matching element found in the form DOM';
      continue;
    }

    try {
      let success = true;

      switch (controlType) {
        case 'radio':
          success = await fillRadioGroup(target, value as string, doc);
          if (!success) {
            failedFields.push(fieldId);
            failureReasons[fieldId] = `No radio option matched value "${value}"`;
          }
          break;

        case 'checkbox':
          if (typeof value === 'boolean' || Array.isArray(value)) {
            success = await fillCheckboxGroup(target, value, doc);
          } else {
            const boolVal = String(value).toLowerCase() === 'true';
            success = await fillCheckboxGroup(target, boolVal, doc);
          }
          if (!success) {
            failedFields.push(fieldId);
            failureReasons[fieldId] = 'Checkbox toggle failed — no checkbox elements found';
          }
          break;

        case 'dropdown':
          if (target.tagName.toLowerCase() === 'select') {
            success = fillNativeDropdown(target as HTMLSelectElement, value as string | string[], doc);
          } else {
            success = await fillAriaDropdown(target, value as string, doc);
          }
          if (!success) {
            failedFields.push(fieldId);
            failureReasons[fieldId] = `No dropdown option matched value "${value}"`;
          }
          break;

        case 'combobox': {
          if (target.tagName.toLowerCase() === 'select') {
            success = fillNativeDropdown(target as HTMLSelectElement, value as string | string[], doc);
          } else if (
            target.getAttribute('role') === 'listbox' ||
            target.getAttribute('aria-haspopup') === 'listbox' ||
            target.querySelector('[aria-haspopup="listbox"], button')
          ) {
            success = await fillAriaDropdown(target, value as string, doc);
          } else {
            const input = target.querySelector('input, textarea') || target;
            if (input instanceof HTMLElement) {
              success = fillTextInput(input, value as string, doc);
              if (!success) {
                failedFields.push(fieldId);
                failureReasons[fieldId] = 'Combobox input element is disabled or readonly';
              }
            } else {
              success = false;
              failedFields.push(fieldId);
              failureReasons[fieldId] = 'Combobox input element not found';
            }
          }
          break;
        }

        case 'date':
          success = fillDateInput(target as HTMLElement, value as string, doc);
          if (!success) {
            failedFields.push(fieldId);
            failureReasons[fieldId] = `Failed to fill date value "${value}"`;
          }
          break;

        case 'text':
        case 'textarea':
        default: {
          const strValue =
            typeof value === 'string'
              ? value
              : Array.isArray(value)
                ? value.join(', ')
                : String(value);
          success = fillTextInput(target as HTMLElement, strValue, doc);
          if (!success) {
            failedFields.push(fieldId);
            failureReasons[fieldId] = 'Field input element is disabled or readonly';
          }
          break;
        }
      }

      if (success && !failedFields.includes(fieldId)) {
        filledFields.push(fieldId);
      }
    } catch (err) {
      failedFields.push(fieldId);
      failureReasons[fieldId] = `DOM interaction failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const filledCount = filledFields.length;
  const failedCount = failedFields.length;
  const skippedCount = skippedFields.length;

  let status: 'success' | 'partial' | 'error' = 'success';
  if (filledCount === 0) {
    status = 'error';
  } else if (failedCount > 0 || skippedCount > 0) {
    status = 'partial';
  }

  return {
    status,
    filledCount,
    failedCount,
    skippedCount,
    filledFields,
    failedFields,
    skippedFields,
    failureReasons,
    skippedReasons,
  };
}
