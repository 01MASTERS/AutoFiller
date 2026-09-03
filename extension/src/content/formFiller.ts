import { FillResult, FieldMappingValue } from '@autofiller/shared';

export function fillFormFields(
  mappings: Record<string, FieldMappingValue>,
  doc: Document = document,
): FillResult {
  const filledFields: string[] = [];
  const failedFields: string[] = [];
  const failureReasons: Record<string, string> = {};

  const keys = Object.keys(mappings);
  if (keys.length === 0) {
    return {
      status: 'error',
      filledCount: 0,
      failedCount: 0,
      filledFields: [],
      failedFields: [],
      failureReasons: {},
      error: 'No mappings provided',
    };
  }

  for (const [fieldId, value] of Object.entries(mappings)) {
    if (value === undefined || value === null || value === '') {
      failedFields.push(fieldId);
      failureReasons[fieldId] = 'Value mapped for this field was empty or null';
      continue;
    }

    // In-browser CSS search order:
    // 1. data-autofiller-id attribute stamped by domReader
    // 2. Exact name attribute
    // 3. Exact id attribute
    let target: HTMLElement | null = null;
    try {
      target = doc.querySelector(
        `[data-autofiller-id="${CSS.escape(fieldId)}"], input[name="${fieldId}"], textarea[name="${fieldId}"], #${CSS.escape(fieldId)}`,
      );
    } catch {
      // Fallback if CSS.escape fails on strange characters
      target = doc.getElementById(fieldId);
    }

    // Fallback: if not found, find by name attribute alone
    if (!target) {
      target = doc.querySelector(`[name="${fieldId}"]`);
    }

    // Google Forms container fallback: check if ID belongs to an entry container
    if (!target) {
      const container = doc.querySelector(`[data-params*="${fieldId}"]`);
      if (container) {
        target = container.querySelector('input, textarea');
      }
    }

    if (!target || !(target instanceof doc.defaultView!.HTMLElement)) {
      failedFields.push(fieldId);
      failureReasons[fieldId] = 'No matching input or textarea element found in the form DOM';
      continue;
    }

    try {
      const win = doc.defaultView || window;
      const prototype =
        target.tagName.toLowerCase() === 'textarea'
          ? win.HTMLTextAreaElement.prototype
          : win.HTMLInputElement.prototype;

      const strValue =
        typeof value === 'string'
          ? value
          : Array.isArray(value)
            ? value.join(', ')
            : String(value);

      const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (valueSetter) {
        valueSetter.call(target, strValue);
      } else {
        (target as HTMLInputElement | HTMLTextAreaElement).value = strValue;
      }

      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new Event('blur', { bubbles: true }));

      const originalOutline = target.style.outline;
      const originalTransition = target.style.transition;

      target.style.outline = '2px solid #22c55e';
      target.style.transition = 'outline 0.3s ease';

      setTimeout(() => {
        target.style.outline = originalOutline;
        target.style.transition = originalTransition;
      }, 2000);

      filledFields.push(fieldId);
    } catch (err) {
      failedFields.push(fieldId);
      failureReasons[fieldId] = `DOM input event or value assignment failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const filledCount = filledFields.length;
  const failedCount = failedFields.length;

  let status: 'success' | 'partial' | 'error' = 'success';
  if (filledCount === 0) {
    status = 'error';
  } else if (failedCount > 0) {
    status = 'partial';
  }

  return {
    status,
    filledCount,
    failedCount,
    filledFields,
    failedFields,
    failureReasons,
  };
}
