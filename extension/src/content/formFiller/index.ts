/**
 * @file index.ts
 * Main entry point for universal form filling engine.
 */

import { FillResult, FieldMappingValue, FieldMetadata } from '@autofiller/shared';
import {
  findFieldElement,
  deepQuerySelector,
  deepGetElementById,
  waitForFieldEnabled,
  waitForDynamicOptions,
} from '../domReader.js';
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
 * Orders field IDs topologically according to parent-child dependency relationships.
 * Fields acting as parents (e.g. Country) will precede dependent children (e.g. State).
 * Unconstrained fields preserve their original relative order.
 */
export function sortFieldsByDependency(
  fields: FieldMetadata[],
  mappingsOrKeys: Record<string, FieldMappingValue> | string[],
): string[] {
  const keys = Array.isArray(mappingsOrKeys) ? [...mappingsOrKeys] : Object.keys(mappingsOrKeys);
  if (keys.length <= 1) return keys;

  const keySet = new Set(keys);
  const fieldById = new Map<string, FieldMetadata>();
  for (const f of fields) {
    fieldById.set(f.id, f);
  }

  // Build dependency graph: parentFieldId -> childFieldId[]
  // inDegree tracks how many active parents a child must wait for
  const childrenOf = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const key of keys) {
    inDegree.set(key, 0);
  }

  for (const key of keys) {
    const meta = fieldById.get(key);
    const parentId = meta?.parentFieldId;
    if (parentId && keySet.has(parentId) && parentId !== key) {
      const existingChildren = childrenOf.get(parentId) || [];
      existingChildren.push(key);
      childrenOf.set(parentId, existingChildren);
      inDegree.set(key, (inDegree.get(key) || 0) + 1);
    }
  }

  // Kahn's algorithm: start with keys having inDegree === 0, preserving initial order
  const queue: string[] = keys.filter((k) => (inDegree.get(k) || 0) === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const children = childrenOf.get(current) || [];
    for (const child of children) {
      const deg = (inDegree.get(child) || 1) - 1;
      inDegree.set(child, deg);
      if (deg === 0) {
        queue.push(child);
      }
    }
  }

  // If there are any unvisited nodes (e.g., circular dependencies), append them in original order
  if (sorted.length < keys.length) {
    for (const key of keys) {
      if (!sorted.includes(key)) {
        sorted.push(key);
      }
    }
  }

  return sorted;
}

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

  // Topologically sort keys so parent fields precede dependent children
  const orderedKeys = sortFieldsByDependency(fields, mappings);

  for (const fieldId of orderedKeys) {
    const value = mappings[fieldId];
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

    // Fallback: ad-hoc CSS search for fields without metadata (pierces shadow roots)
    if (!target) {
      try {
        target = deepQuerySelector(
          doc,
          `[data-autofiller-id="${escapeCss(fieldId)}"], input[name="${escapeCss(fieldId)}"], textarea[name="${escapeCss(fieldId)}"], #${escapeCss(fieldId)}`,
        );
      } catch {
        target = deepGetElementById(fieldId, doc);
      }
      if (!target) {
        try {
          target = deepQuerySelector(doc, `[name="${escapeCss(fieldId)}"]`);
        } catch {
          target = deepGetElementById(fieldId, doc);
        }
      }
    }

    if (!target) {
      failedFields.push(fieldId);
      failureReasons[fieldId] = 'No matching element found in the form DOM';
      continue;
    }

    // If target is currently disabled (e.g. cascading child awaiting parent selection), wait for enablement
    if (
      target instanceof HTMLElement &&
      (target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true')
    ) {
      await waitForFieldEnabled(target);
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
            success = await fillNativeDropdown(target as HTMLSelectElement, value as string | string[], doc);
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
            success = await fillNativeDropdown(target as HTMLSelectElement, value as string | string[], doc);
          } else {
            const isAriaCombobox =
              target.getAttribute('role') === 'combobox' ||
              target.getAttribute('role') === 'listbox' ||
              target.getAttribute('aria-haspopup') === 'listbox' ||
              target.getAttribute('aria-haspopup') === 'true' ||
              target.hasAttribute('aria-haspopup') ||
              target.matches('input[role="combobox"], [data-automation-id*="prompt"], [data-automation-id*="select"]') ||
              Boolean(target.querySelector('[aria-haspopup], [role="listbox"], [role="combobox"], button')) ||
              meta?.controlType === 'combobox';

            if (isAriaCombobox) {
              success = await fillAriaDropdown(target, value as string, doc);
              if (!success) {
                const input = target.querySelector('input, textarea') || target;
                if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
                  success = fillTextInput(input, value as string, doc);
                }
              }
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
          }
          if (!success && !failedFields.includes(fieldId)) {
            failedFields.push(fieldId);
            failureReasons[fieldId] = `No dropdown option matched value "${value}"`;
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
          let strValue =
            typeof value === 'string'
              ? value
              : Array.isArray(value)
                ? value.join(', ')
                : String(value);

          // If this is a subscriber phone number field and the form has a separate country phone code field,
          // strip any leading country dialing code (e.g. "+91 9135517396" -> "9135517396")
          const isPhoneField =
            (meta?.label && /phone|mobile/i.test(meta.label) && !/country/i.test(meta.label)) ||
            /phone.*number/i.test(fieldId);
          const hasCountryCodeField = fields.some(
            (f) => f.label && /country.*phone|phone.*country|country.*code/i.test(f.label),
          );
          if (isPhoneField && hasCountryCodeField && /^\+\d{1,4}/.test(strValue.trim())) {
            strValue = strValue.trim().replace(/^\+\d{1,4}\s*[-.]?\s*/, '');
          }

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

        // Proactively notify/wait on downstream cascading child fields if any
        const dependentChildren = fields.filter((f) => f.parentFieldId === fieldId);
        for (const childMeta of dependentChildren) {
          const childEl = findFieldElement(childMeta, doc);
          if (childEl instanceof HTMLElement) {
            await waitForFieldEnabled(childEl);
            if (childMeta.controlType === 'dropdown' || childMeta.controlType === 'combobox') {
              await waitForDynamicOptions(childEl);
            }
          }
        }
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
