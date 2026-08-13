import { FieldMetadata } from '@autofiller/shared';

export function extractFormFields(doc: Document = document): FieldMetadata[] {
  const fields: FieldMetadata[] = [];
  const processedInputs = new Set<Element>();

  const itemContainers = doc.querySelectorAll(
    '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .M7eMe, .QrToBd'
  );

  const processInput = (
    inputEl: HTMLInputElement | HTMLTextAreaElement,
    container?: Element,
    fallbackIndex = fields.length + 1
  ) => {
    if (processedInputs.has(inputEl)) return;
    processedInputs.add(inputEl);

    const nameAttr = inputEl.getAttribute('name');
    const idAttr = inputEl.id;
    const fieldId = nameAttr || idAttr || `field-${fallbackIndex}`;
    inputEl.setAttribute('data-autofiller-id', fieldId);

    let labelText = '';
    if (container) {
      const headingEl = container.querySelector(
        '[role="heading"], .freebirdFormviewerViewItemsItemItemTitle, .M7eMe, label, .exportLabel'
      );
      if (headingEl) {
        const clone = headingEl.cloneNode(true) as HTMLElement;
        const asterisk = clone.querySelector(
          '.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"]'
        );
        if (asterisk) {
          asterisk.remove();
        }
        labelText = clone.textContent?.trim() || '';
      }
    }

    if (!labelText) {
      labelText =
        inputEl.getAttribute('aria-label') ||
        inputEl.getAttribute('placeholder') ||
        fieldId;
    }

    labelText = labelText.replace(/\s*\*$/, '').trim();

    const isRequired =
      inputEl.hasAttribute('required') ||
      inputEl.getAttribute('aria-required') === 'true' ||
      (container
        ? !!container.querySelector(
            '.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"], .v3p8nd'
          )
        : false);

    const placeholder = inputEl.getAttribute('placeholder') || undefined;
    const ariaLabel = inputEl.getAttribute('aria-label') || undefined;
    const inputType =
      inputEl.tagName.toLowerCase() === 'textarea'
        ? 'textarea'
        : inputEl.type || 'text';

    fields.push({
      id: fieldId,
      label: labelText || fieldId,
      placeholder,
      ariaLabel,
      type: inputType,
      required: isRequired || undefined,
    });
  };

  if (itemContainers.length > 0) {
    let index = 1;
    itemContainers.forEach((container) => {
      const inputs = container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea'
      );
      inputs.forEach((inputEl) => {
        processInput(inputEl, container, index++);
      });
    });
  }

  const orphanInputs = doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea'
  );
  let orphanIndex = fields.length + 1;
  orphanInputs.forEach((inputEl) => {
    if (!processedInputs.has(inputEl)) {
      const parentContainer =
        inputEl.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem') ||
        undefined;
      processInput(inputEl, parentContainer || undefined, orphanIndex++);
    }
  });

  return fields;
}
