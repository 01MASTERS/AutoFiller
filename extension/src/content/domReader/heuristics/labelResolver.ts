import { cleanText, cleanLabelText, escapeCss } from '../utils.js';

/**
 * Common boilerplate substrings that should be stripped from resolved question labels.
 */
const BOILERPLATE_PATTERNS = [
  /\s*\(required\)\s*/gi,
  /\s*\(optional\)\s*/gi,
  /\s*\[required\]\s*/gi,
  /\s*\[optional\]\s*/gi,
  /\s*\*+\s*$/g,
  /^\s*\*+\s*/g,
  /\s*:\s*$/g,
];

/**
 * Words that represent generic control types or instructions rather than actual question names.
 */
const GENERIC_LABELS = new Set([
  'date',
  'time',
  'your answer',
  'unlabeled-field',
  'option',
  'other',
  'other:',
  'select',
  'choose',
  'please select',
  'input',
  'text',
]);

/**
 * Formats machine names into clean title case (e.g. "first_name" -> "First Name", "linkedinUrl" -> "Linkedin Url")
 */
export function formatMachineName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Strips common form boilerplate iteratively (e.g. "*", "(Required)", "(optional)", trailing colons)
 */
export function sanitizeLabelText(raw: string): string {
  let cleaned = cleanText(raw);
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    for (const pattern of BOILERPLATE_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
    cleaned = cleanText(cleaned);
  }
  return cleaned;
}

/**
 * Checks if a string is a generic placeholder or sublabel
 */
export function isGenericSublabel(text: string): boolean {
  return GENERIC_LABELS.has(text.trim().toLowerCase());
}

/**
 * Extracts visible text from an element, excluding child input/button elements to prevent
 * input values or button text from polluting the label.
 */
export function getElementTextExcludingInputs(el: Element): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('input, select, textarea, button, script, style, noscript, [aria-hidden="true"]').forEach((child) => {
    child.remove();
  });
  return cleanText(clone.textContent);
}

/**
 * Universal heuristic label resolution cascade for any web form control.
 */
export function resolveUniversalLabel(
  controlEl: Element,
  container?: Element | null,
  doc: Document = document,
): {
  label: string;
  ariaLabel?: string;
  placeholder?: string;
  required?: boolean;
} {
  const rawPlaceholder = controlEl.getAttribute('placeholder');
  const placeholder = rawPlaceholder && cleanText(rawPlaceholder) ? cleanText(rawPlaceholder) : undefined;

  const directAriaLabel = controlEl.getAttribute('aria-label');
  const containerAriaLabel = container?.getAttribute('aria-label');
  const rawAriaLabel = directAriaLabel || containerAriaLabel;
  const ariaLabel = rawAriaLabel && cleanText(rawAriaLabel) ? cleanText(rawAriaLabel) : undefined;

  // Determine required flag
  let isRequired =
    controlEl.hasAttribute('required') ||
    (controlEl as HTMLInputElement).required === true ||
    controlEl.getAttribute('aria-required') === 'true';

  if (!isRequired && container) {
    if (container.getAttribute('aria-required') === 'true') {
      isRequired = true;
    } else {
      const requiredMarker = container.querySelector(
        '.required, [data-automation-id*="required"], [class*="required"], [aria-label*="Required"]',
      );
      if (requiredMarker && cleanText(requiredMarker.textContent) !== '') {
        isRequired = true;
      }
    }
  }

  // 1. Direct aria-labelledby on the control element itself
  const directLabelledBy = controlEl.getAttribute('aria-labelledby');
  if (directLabelledBy) {
    const ids = directLabelledBy.split(/\s+/).filter(Boolean);
    const textParts: string[] = [];
    for (const id of ids) {
      try {
        const refEl = doc.getElementById(id);
        if (refEl) {
          const t = sanitizeLabelText(getElementTextExcludingInputs(refEl));
          if (t) textParts.push(t);
        }
      } catch {
        // Ignore lookup error
      }
    }
    if (textParts.length > 0) {
      const txt = sanitizeLabelText(textParts.join(' '));
      if (txt && !isGenericSublabel(txt)) {
        return { label: txt, ariaLabel, placeholder, required: isRequired };
      }
    }
  }

  // 2. Direct aria-label on the control element itself (e.g. matrix rows with explicit aria-label)
  if (directAriaLabel) {
    const txt = sanitizeLabelText(directAriaLabel);
    if (txt && !isGenericSublabel(txt)) {
      return { label: txt, ariaLabel, placeholder, required: isRequired };
    }
  }

  // 3. Explicit <label for="id">
  if (controlEl.id) {
    try {
      const explicitLabel = doc.querySelector(`label[for="${escapeCss(controlEl.id)}"]`);
      if (explicitLabel) {
        const txt = sanitizeLabelText(getElementTextExcludingInputs(explicitLabel));
        if (txt && !isGenericSublabel(txt)) {
          return { label: txt, ariaLabel, placeholder, required: isRequired };
        }
      }
    } catch {
      // Ignore querySelector escape issues
    }
  }

  // 4. Parent wrapping <label>
  const parentLabel = controlEl.closest('label');
  if (parentLabel) {
    const txt = sanitizeLabelText(getElementTextExcludingInputs(parentLabel));
    if (txt && !isGenericSublabel(txt)) {
      return { label: txt, ariaLabel, placeholder, required: isRequired };
    }
  }

  // 5. Fieldset <legend> (if inside a fieldset)
  const fieldset = controlEl.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const txt = sanitizeLabelText(cleanText(legend.textContent));
      if (txt && !isGenericSublabel(txt)) {
        return { label: txt, ariaLabel, placeholder, required: isRequired };
      }
    }
  }

  // 6. Container heading or label element (Google Forms question title, Workday, Greenhouse, Lever)
  if (container) {
    const candidateSelectors = [
      '[role="heading"]',
      'h1, h2, h3, h4, h5, h6',
      'label',
      '[data-automation-id*="label"]',
      '[data-automation-id*="Label"]',
      '.field-label',
      '.question-label',
      '.label-text',
      '.M7eMe',
      '.freebirdFormviewerViewItemsItemItemTitle',
    ];
    for (const sel of candidateSelectors) {
      const headingEl = container.querySelector(sel);
      if (headingEl && headingEl !== controlEl && !controlEl.contains(headingEl)) {
        const txt = sanitizeLabelText(getElementTextExcludingInputs(headingEl));
        if (txt && !isGenericSublabel(txt)) {
          return { label: txt, ariaLabel, placeholder, required: isRequired };
        }
      }
    }
  }

  // 7. Container aria-labelledby / aria-label
  if (containerAriaLabel) {
    const txt = sanitizeLabelText(containerAriaLabel);
    if (txt && !isGenericSublabel(txt)) {
      return { label: txt, ariaLabel, placeholder, required: isRequired };
    }
  }

  // 8. Preceding sibling label or span text
  let prev = controlEl.previousElementSibling;
  while (prev) {
    if (
      prev.tagName.toLowerCase() === 'label' ||
      prev.classList.contains('label') ||
      prev.getAttribute('data-automation-id')?.includes('label')
    ) {
      const txt = sanitizeLabelText(getElementTextExcludingInputs(prev));
      if (txt && !isGenericSublabel(txt)) {
        return { label: txt, ariaLabel, placeholder, required: isRequired };
      }
    }
    prev = prev.previousElementSibling;
  }

  // 9. Fallback: placeholder
  if (placeholder && !isGenericSublabel(placeholder)) {
    return { label: sanitizeLabelText(placeholder), ariaLabel, placeholder, required: isRequired };
  }

  // 10. Fallback: title attribute
  const title = controlEl.getAttribute('title');
  if (title && cleanText(title) && !isGenericSublabel(cleanText(title))) {
    return { label: sanitizeLabelText(title), ariaLabel, placeholder, required: isRequired };
  }

  // 11. Fallback: formatted name or id
  const rawName = (controlEl as HTMLInputElement).name || controlEl.id;
  if (rawName && cleanText(rawName)) {
    const formatted = formatMachineName(rawName);
    if (formatted && !isGenericSublabel(formatted)) {
      return { label: formatted, ariaLabel, placeholder, required: isRequired };
    }
  }

  return { label: 'Unlabeled Field', ariaLabel, placeholder, required: isRequired };
}
