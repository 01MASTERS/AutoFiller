import { FillResult } from '@autofiller/shared';

export function fillFormFields(
  mappings: Record<string, string>,
  doc: Document = document
): FillResult {
  const filledFields: string[] = [];
  const failedFields: string[] = [];

  const keys = Object.keys(mappings);
  if (keys.length === 0) {
    return {
      status: 'error',
      filledCount: 0,
      failedCount: 0,
      filledFields: [],
      failedFields: [],
      error: 'No mappings provided',
    };
  }

  for (const [fieldId, value] of Object.entries(mappings)) {
    if (!value) {
      failedFields.push(fieldId);
      continue;
    }

    let target: HTMLInputElement | HTMLTextAreaElement | null = null;

    try {
      target = doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `input[name="${fieldId}"], textarea[name="${fieldId}"], #${CSS.escape(fieldId)}`
      );
    } catch {
      // Fallback if querySelector fails on unexpected selector characters
      target = null;
    }

    if (!target) {
      target =
        Array.from(
          doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
            'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea'
          )
        ).find(
          (el) =>
            el.id === fieldId ||
            el.getAttribute('name') === fieldId ||
            el.getAttribute('aria-describedby')?.includes(fieldId)
        ) || null;
    }

    if (!target) {
      failedFields.push(fieldId);
      continue;
    }

    try {
      const win = doc.defaultView || window;
      const prototype =
        target.tagName.toLowerCase() === 'textarea'
          ? win.HTMLTextAreaElement.prototype
          : win.HTMLInputElement.prototype;

      const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (valueSetter) {
        valueSetter.call(target, value);
      } else {
        target.value = value;
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
    } catch {
      failedFields.push(fieldId);
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
  };
}
