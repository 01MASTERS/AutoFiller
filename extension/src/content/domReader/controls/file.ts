import { FieldMetadata } from '@autofiller/shared';
import { resolveAccessibleLabel, generateUniqueFieldId, isRequiredField } from '../accessibility.js';
import {
  getAllDOMRoots,
  querySelectorAllAcrossRoots,
  deepClosest,
  getShadowHost,
} from '../shadowDom.js';

/**
 * Scans file upload controls (e.g. resume / CV upload inputs, SmartRecruiters uploads, and dropzones).
 */
export function scanFileInputs(
  docOrRoots: Document | (Document | ShadowRoot)[],
  fields: FieldMetadata[],
  processedElements: Set<Element>,
  usedIds: Set<string>,
): void {
  const roots = Array.isArray(docOrRoots) ? docOrRoots : getAllDOMRoots(docOrRoots);
  const doc = Array.isArray(docOrRoots)
    ? ((roots.find((r) => r.nodeType === Node.DOCUMENT_NODE) as Document) || document)
    : docOrRoots;

  const fileInputs = querySelectorAllAcrossRoots<HTMLInputElement>(
    roots,
    'input[type="file"], spl-file-upload input, [data-automation-id*="file"] input',
  );

  for (const input of fileInputs) {
    if (processedElements.has(input)) continue;

    const shadowHost = getShadowHost(input);
    const container =
      deepClosest(
        input,
        '[data-automation-id*="file"], [data-automation-id*="resume"], [data-automation-id*="upload"], .dropzone, .upload-container, .attach-button, [class*="upload"], [class*="resume"], spl-form-field, fieldset, .form-group, div',
      ) || shadowHost || input.parentElement;

    const { label, ariaLabel, placeholder } = resolveAccessibleLabel(input, container, doc);
    const required = isRequiredField(input, container);

    const baseId =
      input.id ||
      input.getAttribute('name') ||
      (shadowHost && shadowHost.id) ||
      input.getAttribute('data-automation-id') ||
      (shadowHost && shadowHost.getAttribute('data-automation-id')) ||
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
