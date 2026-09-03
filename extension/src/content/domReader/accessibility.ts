import { cleanText, cleanLabelText, escapeCss } from './utils.js';

/**
 * Resolves accessible name for a control using standard precedence
 */
export function resolveAccessibleLabel(
  controlEl: Element,
  container?: Element | null,
  doc: Document = document,
): { label: string; ariaLabel?: string; placeholder?: string } {
  const rawPlaceholder = controlEl.getAttribute('placeholder');
  const placeholder = rawPlaceholder && cleanText(rawPlaceholder) ? cleanText(rawPlaceholder) : undefined;

  const rawAriaLabel =
    controlEl.getAttribute('aria-label') || container?.getAttribute('aria-label');
  const ariaLabel = rawAriaLabel && cleanText(rawAriaLabel) ? cleanText(rawAriaLabel) : undefined;

  // 1. aria-labelledby
  const labelledBy =
    controlEl.getAttribute('aria-labelledby') || container?.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const textParts: string[] = [];
    for (const id of ids) {
      const refEl = doc.getElementById(id);
      if (refEl) {
        const clone = refEl.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll('.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"]')
          .forEach((a) => a.remove());
        const t = cleanText(clone.textContent);
        if (t) textParts.push(t);
      }
    }
    if (textParts.length > 0) {
      const label = cleanLabelText(textParts.join(' '));
      if (label) return { label, ariaLabel, placeholder };
    }
  }

  // 2. aria-label
  if (ariaLabel) {
    return { label: cleanLabelText(ariaLabel), ariaLabel, placeholder };
  }

  // 3. <label for="...">
  if (controlEl.id) {
    const labelFor = doc.querySelector(`label[for="${escapeCss(controlEl.id)}"]`);
    if (labelFor) {
      const clone = labelFor.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"]')
        .forEach((a) => a.remove());
      const text = cleanLabelText(clone.textContent || '');
      if (text) return { label: text, ariaLabel, placeholder };
    }
  }

  // 4. Wrapping <label>
  const wrappingLabel = controlEl.closest('label');
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('input, select, textarea, .freebirdFormviewerViewItemsItemRequiredAsterisk')
      .forEach((el) => el.remove());
    const text = cleanLabelText(clone.textContent || '');
    if (text) return { label: text, ariaLabel, placeholder };
  }

  // 5. fieldset > legend
  const fieldset = container?.closest('fieldset') || controlEl.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const clone = legend.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"]')
        .forEach((a) => a.remove());
      const text = cleanLabelText(clone.textContent || '');
      if (text) return { label: text, ariaLabel, placeholder };
    }
  }

  // 6. Container headings / Google Forms question title
  if (container) {
    const heading = container.querySelector(
      '[role="heading"], h1, h2, h3, h4, h5, h6, .freebirdFormviewerViewItemsItemItemTitle, .M7eMe, .exportLabel',
    );
    if (heading) {
      const clone = heading.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(
          '.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"], .v3p8nd',
        )
        .forEach((a) => a.remove());
      const text = cleanLabelText(clone.textContent || '');
      if (text) return { label: text, ariaLabel, placeholder };
    }
  }

  // 7. Placeholder
  if (placeholder) {
    return { label: cleanLabelText(placeholder), ariaLabel, placeholder };
  }

  // 8. Fallback to name or id
  const name = controlEl.getAttribute('name') || controlEl.id || '';
  return { label: cleanLabelText(name) || 'unlabeled-field', ariaLabel, placeholder };
}

/**
 * Resolves heading text directly from a container
 */
export function resolveHeadingText(container: Element): string {
  const heading = container.querySelector(
    '[role="heading"], h1, h2, h3, h4, h5, h6, .freebirdFormviewerViewItemsItemItemTitle, .M7eMe, .exportLabel',
  );
  if (!heading) return '';
  const clone = heading.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      '.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"], .v3p8nd',
    )
    .forEach((a) => a.remove());
  return cleanLabelText(clone.textContent || '');
}

/**
 * Checks if a question container or control is marked required
 */
export function isRequiredField(controlEl: Element, container?: Element | null): boolean {
  if (controlEl.hasAttribute('required')) return true;
  if (controlEl.getAttribute('aria-required') === 'true') return true;
  if (container) {
    if (container.getAttribute('aria-required') === 'true') return true;
    const asterisk = container.querySelector(
      '.freebirdFormviewerViewItemsItemRequiredAsterisk, [aria-label*="Required"], .v3p8nd',
    );
    if (asterisk) return true;
  }
  return false;
}

/**
 * Generates a unique logical field ID and registers it
 */
export function generateUniqueFieldId(baseId: string, usedIds: Set<string>): string {
  let fieldId = baseId;
  let suffix = 1;
  while (usedIds.has(fieldId)) {
    suffix++;
    fieldId = `${baseId}-${suffix}`;
  }
  usedIds.add(fieldId);
  return fieldId;
}
