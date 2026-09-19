import { FieldMetadata } from '@autofiller/shared';
import { resolveAccessibleLabel, generateUniqueFieldId, isRequiredField } from '../accessibility.js';

/**
 * Scans file upload controls (e.g. resume / CV upload inputs and dropzones).
 */
export function scanFileInputs(
  doc: Document,
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const fileInputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="file"]'));

  for (const input of fileInputs) {
    if (processedElements.has(input)) continue;

    // Styled custom file dropzones often keep the underlying <input type="file"> opacity: 0 or display: none.
    // We look up the closest meaningful upload container.
    const container =
      input.closest(
        '[data-automation-id*="file"], [data-automation-id*="resume"], [data-automation-id*="upload"], .dropzone, .upload-container, .attach-button, [class*="upload"], [class*="resume"], fieldset, .form-group, div',
      ) || input.parentElement;

    const { label, ariaLabel, placeholder } = resolveAccessibleLabel(input, container, doc);
    const required = isRequiredField(input, container);

    const baseId =
      input.id ||
      input.getAttribute('name') ||
      input.getAttribute('data-automation-id') ||
      `file-${fields.length + 1}`;

    const fieldId = generateUniqueFieldId(baseId, usedIds);
    input.setAttribute('data-autofiller-id', fieldId);
    if (container && container !== input) {
      container.setAttribute('data-autofiller-id', fieldId);
    }

    processedElements.add(input);
    if (container) processedElements.add(container);

    fields.push({
      id: fieldId,
      name: input.name || undefined,
      label: label && label !== 'unlabeled-field' && label !== 'Unlabeled Field' ? label : 'Resume / CV File Upload',
      placeholder,
      ariaLabel,
      type: 'file',
      controlType: 'file',
      selectionMode: 'single',
      required,
    });
  }
}
