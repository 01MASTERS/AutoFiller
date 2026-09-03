import { FieldMetadata, FieldControlType, FieldOption, SelectionMode } from '@autofiller/shared';

/**
 * Checks if an element is hidden or non-interactive
 */
function isElementHidden(el: Element): boolean {
  if ((el as HTMLElement).hidden) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  if ((el as HTMLInputElement).type === 'hidden') return true;

  if (typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true;
      }
    } catch {
      // In non-browser/mock environments where getComputedStyle may fail on detached elements
    }
  }

  // Check inline style fallbacks
  const htmlEl = el as HTMLElement;
  if (htmlEl.style) {
    if (htmlEl.style.display === 'none' || htmlEl.style.visibility === 'hidden') {
      return true;
    }
  }

  return false;
}

/**
 * Safe CSS escaping for environments where global CSS.escape may be unavailable (e.g. Node/jsdom)
 */
function escapeCss(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/["\\]/g, '\\$&');
}

/**
 * Normalizes visible whitespace from text strings
 */
function cleanText(text?: string | null): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Strips required asterisks and trailing marker symbols
 */
function cleanLabelText(rawLabel: string): string {
  return cleanText(rawLabel.replace(/[\s*]+$/, '').replace(/^\s*\*+\s*/, ''));
}

/**
 * Conservative placeholder heuristic detection
 */
function isPlaceholderOption(
  text: string,
  value?: string,
  disabled?: boolean,
  selected?: boolean,
): boolean {
  const normalized = text.toLowerCase().trim();
  const isGenericPrompt =
    /^(select|choose|pick|none|\s*|please select|select one|choose one|--.*--)$/i.test(normalized);

  // If value is explicitly empty and text is a generic prompt
  if ((value === '' || value === undefined) && isGenericPrompt) {
    return true;
  }

  // If disabled and matches generic prompt
  if (disabled && isGenericPrompt) {
    return true;
  }

  // If selected by default, has no value or empty value, and looks like a prompt
  if (selected && (value === '' || value === undefined) && isGenericPrompt) {
    return true;
  }

  return false;
}

/**
 * Resolves accessible name for a control using standard precedence
 */
function resolveAccessibleLabel(
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
 * Extracts options from a native HTML <select> element
 */
function extractSelectOptions(selectEl: HTMLSelectElement): FieldOption[] {
  const options: FieldOption[] = [];
  Array.from(selectEl.options).forEach((opt) => {
    const label = cleanText(opt.text);
    if (!label) return;

    const hasValueAttr = opt.hasAttribute('value');
    const value = hasValueAttr ? opt.value : undefined;
    const selected = opt.selected;
    const disabled = opt.disabled;

    if (isPlaceholderOption(label, value, disabled, selected)) {
      return;
    }

    options.push({
      label,
      value,
      selected: selected || undefined,
      disabled: disabled || undefined,
    });
  });
  return options;
}

/**
 * Extracts options from ARIA listbox or combobox options
 */
function extractAriaListboxOptions(container: Element): FieldOption[] {
  const options: FieldOption[] = [];
  const optionEls = container.querySelectorAll(
    '[role="option"], .quantumWizMenuPaperselectOption',
  );

  optionEls.forEach((optEl) => {
    // Note: Do not skip options based on isElementHidden because dropdown option menus
    // are typically hidden (display: none) when the dropdown is collapsed/closed.
    const label = cleanText(optEl.textContent);
    if (!label) return;

    const value =
      optEl.getAttribute('data-value') ||
      optEl.getAttribute('value') ||
      undefined;

    const selected =
      optEl.getAttribute('aria-selected') === 'true' ||
      optEl.classList.contains('isSelected') ||
      optEl.classList.contains('active');

    const disabled =
      optEl.getAttribute('aria-disabled') === 'true' ||
      optEl.hasAttribute('disabled');

    if (isPlaceholderOption(label, value, disabled, selected)) {
      return;
    }

    // Tag option element for execution targeting
    optEl.setAttribute('data-autofiller-option', value || label);

    options.push({
      label,
      value,
      selected: selected || undefined,
      disabled: disabled || undefined,
    });
  });

  return options;
}

/**
 * Resolves the display label for an option element inside a radio or checkbox group
 */
function resolveOptionLabel(optionEl: Element): string {
  // If the option element itself has direct/nested text content and is not an <input>
  if (optionEl.tagName.toLowerCase() !== 'input') {
    const directText = cleanText(optionEl.textContent);
    if (directText) {
      return directText;
    }
  }

  // Check adjacent label
  if (optionEl.id) {
    const labelFor = optionEl.ownerDocument?.querySelector(`label[for="${escapeCss(optionEl.id)}"]`);
    if (labelFor && cleanText(labelFor.textContent)) {
      return cleanText(labelFor.textContent);
    }
  }

  // Check parent wrapping label
  const parentLabel = optionEl.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input').forEach((i) => i.remove());
    if (cleanText(clone.textContent)) {
      return cleanText(clone.textContent);
    }
  }

  // Check Google Forms / generic text container
  const parentWrapper =
    optionEl.closest('.docssharedWizToggleLabeledLabelWrapper, .freebirdFormviewerViewItemsRadioChoice, .freebirdFormviewerViewItemsCheckboxChoice') ||
    optionEl.parentElement;

  if (parentWrapper) {
    const textNode = parentWrapper.querySelector(
      '.docssharedWizToggleLabeledLabelText, .aDTYNe, .ulDsOb, .M7eMe, label, span',
    );
    if (textNode && textNode !== optionEl && cleanText(textNode.textContent)) {
      return cleanText(textNode.textContent);
    }
  }

  // Check aria-label
  const ariaLabel = optionEl.getAttribute('aria-label');
  if (ariaLabel && cleanText(ariaLabel)) {
    return cleanText(ariaLabel);
  }

  // Check text content of element itself
  return cleanText(optionEl.textContent);
}

/**
 * Extracts options from radio or checkbox elements
 */
function extractRadioOrCheckboxOptions(elements: Element[]): FieldOption[] {
  const options: FieldOption[] = [];
  const seenLabels = new Set<string>();

  elements.forEach((el) => {
    if (isElementHidden(el)) return;

    const label = resolveOptionLabel(el);
    if (!label) return;

    const value = el.getAttribute('value') || el.getAttribute('data-value') || undefined;
    const selected =
      (el as HTMLInputElement).checked ||
      el.getAttribute('aria-checked') === 'true' ||
      el.getAttribute('aria-selected') === 'true';
    const disabled =
      (el as HTMLInputElement).disabled ||
      el.getAttribute('aria-disabled') === 'true';

    // Tag option element for execution targeting
    el.setAttribute('data-autofiller-option', value || label);

    if (seenLabels.has(label)) return;
    seenLabels.add(label);

    options.push({
      label,
      value,
      selected: selected || undefined,
      disabled: disabled || undefined,
    });
  });

  return options;
}

/**
 * Checks if a question container or control is marked required
 */
function isRequiredField(controlEl: Element, container?: Element | null): boolean {
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
function generateUniqueFieldId(baseId: string, usedIds: Set<string>): string {
  let fieldId = baseId;
  let suffix = 1;
  while (usedIds.has(fieldId)) {
    suffix++;
    fieldId = `${baseId}-${suffix}`;
  }
  usedIds.add(fieldId);
  return fieldId;
}

/**
 * Main DOM extraction pipeline
 */
export function extractFormFields(doc: Document = document): FieldMetadata[] {
  const fields: FieldMetadata[] = [];
  const processedElements = new Set<Element>();
  const usedIds = new Set<string>();

  // Question container discovery (HTML fieldsets, Google Forms items, ARIA groups)
  const questionContainers = Array.from(
    doc.querySelectorAll(
      '[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, [role="radiogroup"], [role="group"]',
    ),
  );

  // --------------------------------------------------------------------------
  // STAGE 1 & 2: Radio Groups & Checkbox Groups
  // --------------------------------------------------------------------------

  // 1A. Radio groups discovery
  const radioGroupsFound = new Set<Element>();
  const explicitRadiogroups = doc.querySelectorAll('[role="radiogroup"]');
  explicitRadiogroups.forEach((rg) => radioGroupsFound.add(rg));

  // Also discover question containers or fieldsets containing radio buttons
  questionContainers.forEach((container) => {
    if (container.getAttribute('role') === 'radiogroup') return;
    const radios = container.querySelectorAll('[role="radio"], input[type="radio"]');
    if (radios.length > 0) {
      radioGroupsFound.add(container);
    }
  });

  // Group radio inputs by name attribute if not in a container
  const allRadioInputs = Array.from(doc.querySelectorAll('input[type="radio"]'));
  const radiosByName = new Map<string, HTMLInputElement[]>();
  allRadioInputs.forEach((r) => {
    const name = r.getAttribute('name');
    if (name) {
      const list = radiosByName.get(name) || [];
      list.push(r);
      radiosByName.set(name, list);
    }
  });

  // Process all discovered radio groups
  radioGroupsFound.forEach((container) => {
    if (isElementHidden(container)) return;
    const radioNodes = Array.from(
      container.querySelectorAll('[role="radio"], input[type="radio"]'),
    ).filter((r) => !isElementHidden(r));

    if (radioNodes.length === 0) return;
    // Skip if all constituent radio nodes were already grouped and processed
    if (radioNodes.every((r) => processedElements.has(r))) return;

    // Mark constituent nodes as processed
    radioNodes.forEach((r) => processedElements.add(r));
    processedElements.add(container);

    const firstRadio = radioNodes[0];
    const name =
      firstRadio.getAttribute('name') ||
      container.getAttribute('data-name') ||
      undefined;

    const baseId =
      name ||
      container.id ||
      firstRadio.id ||
      `radio-group-${fields.length + 1}`;

    const fieldId = generateUniqueFieldId(baseId, usedIds);
    container.setAttribute('data-autofiller-id', fieldId);

    const questionContainer =
      container.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset') ||
      container;

    // Mark companion "Other" text inputs inside this question as processed
    const otherInputs = questionContainer.querySelectorAll(
      'input[aria-label*="Other" i], input.Hvn9fb, input[name*="other_option_response"]',
    );
    otherInputs.forEach((inp) => processedElements.add(inp));

    const { label, ariaLabel } = resolveAccessibleLabel(container, questionContainer, doc);
    const required = isRequiredField(container, questionContainer) || radioNodes.some((r) => isRequiredField(r));
    const options = extractRadioOrCheckboxOptions(radioNodes);

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      ariaLabel,
      type: 'radio',
      controlType: 'radio',
      selectionMode: 'single',
      options,
      required: required || undefined,
    });
  });

  // Process any un-grouped radio inputs sharing a name
  radiosByName.forEach((radios, name) => {
    const unprocessed = radios.filter((r) => !processedElements.has(r) && !isElementHidden(r));
    if (unprocessed.length === 0) return;

    unprocessed.forEach((r) => processedElements.add(r));
    const firstRadio = unprocessed[0];
    const parentContainer = firstRadio.closest('fieldset, form') || firstRadio.parentElement;

    const fieldId = generateUniqueFieldId(name, usedIds);
    if (parentContainer) {
      parentContainer.setAttribute('data-autofiller-id', fieldId);
    }

    const { label, ariaLabel } = resolveAccessibleLabel(firstRadio, parentContainer, doc);
    const required = unprocessed.some((r) => isRequiredField(r, parentContainer));
    const options = extractRadioOrCheckboxOptions(unprocessed);

    fields.push({
      id: fieldId,
      name,
      label: label || name,
      ariaLabel,
      type: 'radio',
      controlType: 'radio',
      selectionMode: 'single',
      options,
      required: required || undefined,
    });
  });

  // 1B. Checkbox groups discovery
  const checkboxGroupsFound = new Set<Element>();
  questionContainers.forEach((container) => {
    // Tightened role="group": Only consider as checkbox group if it contains checkbox semantics
    const checkboxes = container.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
    if (checkboxes.length > 0) {
      checkboxGroupsFound.add(container);
    }
  });

  checkboxGroupsFound.forEach((container) => {
    if (isElementHidden(container)) return;
    const checkboxNodes = Array.from(
      container.querySelectorAll('[role="checkbox"], input[type="checkbox"]'),
    ).filter((c) => !isElementHidden(c));

    if (checkboxNodes.length === 0) return;
    // Skip if all constituent checkbox nodes were already grouped and processed
    if (checkboxNodes.every((c) => processedElements.has(c))) return;

    checkboxNodes.forEach((c) => processedElements.add(c));
    processedElements.add(container);

    const firstCheckbox = checkboxNodes[0];
    const name =
      firstCheckbox.getAttribute('name') ||
      container.getAttribute('data-name') ||
      undefined;

    const baseId =
      name ||
      container.id ||
      firstCheckbox.id ||
      `checkbox-group-${fields.length + 1}`;

    const fieldId = generateUniqueFieldId(baseId, usedIds);
    container.setAttribute('data-autofiller-id', fieldId);

    const questionContainer =
      container.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset') ||
      container;

    // Mark companion "Other" text inputs inside this question as processed
    const otherInputs = questionContainer.querySelectorAll(
      'input[aria-label*="Other" i], input.Hvn9fb, input[name*="other_option_response"]',
    );
    otherInputs.forEach((inp) => processedElements.add(inp));

    const { label, ariaLabel } = resolveAccessibleLabel(container, questionContainer, doc);
    const required = isRequiredField(container, questionContainer) || checkboxNodes.some((c) => isRequiredField(c));
    const options = extractRadioOrCheckboxOptions(checkboxNodes);

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      ariaLabel,
      type: 'checkbox',
      controlType: 'checkbox',
      selectionMode: 'multiple',
      options,
      required: required || undefined,
    });
  });

  // --------------------------------------------------------------------------
  // STAGE 3: Native <select>, role="listbox", role="combobox"
  // --------------------------------------------------------------------------
  const dropdownAndComboboxEls = Array.from(
    doc.querySelectorAll('select, [role="listbox"], [role="combobox"]'),
  );

  dropdownAndComboboxEls.forEach((el) => {
    if (processedElements.has(el) || isElementHidden(el)) return;
    processedElements.add(el);

    const container =
      el.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset') ||
      el.parentElement;

    const isCombobox = el.getAttribute('role') === 'combobox';
    const isNativeSelect = el.tagName.toLowerCase() === 'select';
    const isMultiSelectable =
      (isNativeSelect && (el as HTMLSelectElement).multiple) ||
      el.getAttribute('aria-multiselectable') === 'true';

    const selectionMode: SelectionMode = isMultiSelectable ? 'multiple' : 'single';
    const controlType: FieldControlType = isCombobox ? 'combobox' : 'dropdown';

    const name = el.getAttribute('name') || undefined;
    const baseId = name || el.id || `${controlType}-${fields.length + 1}`;
    const fieldId = generateUniqueFieldId(baseId, usedIds);
    el.setAttribute('data-autofiller-id', fieldId);

    const { label, ariaLabel, placeholder } = resolveAccessibleLabel(el, container, doc);
    const required = isRequiredField(el, container);

    // Extract options if present
    let options: FieldOption[] | undefined;
    if (isNativeSelect) {
      options = extractSelectOptions(el as HTMLSelectElement);
    } else {
      // Check options inside listbox/combobox or via aria-controls / aria-owns
      const ownsId = el.getAttribute('aria-owns') || el.getAttribute('aria-controls');
      let optionContainer: Element = el;
      if (ownsId) {
        const ownedEl = doc.getElementById(ownsId);
        if (ownedEl) {
          optionContainer = ownedEl;
          processedElements.add(ownedEl);
        }
      }
      if (isCombobox) {
        el.querySelectorAll('input, select, textarea').forEach((child) => processedElements.add(child));
      }
      let extracted = extractAriaListboxOptions(optionContainer);
      // Fallback: in Google Forms, the option popup menu is often a sibling inside the question container
      if (extracted.length === 0 && container) {
        extracted = extractAriaListboxOptions(container);
      }
      if (extracted.length > 0) {
        options = extracted;
      } else if (!isCombobox) {
        options = [];
      }
      // For combobox without options currently in DOM, options remains undefined or []
    }

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      placeholder,
      ariaLabel,
      type: controlType,
      controlType,
      selectionMode,
      options,
      required: required || undefined,
    });
  });

  // --------------------------------------------------------------------------
  // STAGE 4: Date Inputs
  // --------------------------------------------------------------------------
  const dateCandidateEls = Array.from(
    doc.querySelectorAll(
      'input[type="date"], input[data-type="date"], .exportDate input, .v3p8nd input',
    ),
  );

  dateCandidateEls.forEach((el) => {
    if (processedElements.has(el) || isElementHidden(el)) return;

    const inputEl = el as HTMLInputElement;
    const isDate =
      inputEl.type === 'date' ||
      inputEl.getAttribute('data-type') === 'date' ||
      inputEl.closest('.exportDate') !== null;

    if (!isDate) return;

    processedElements.add(el);
    const container =
      el.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd') ||
      el.parentElement;

    const name = inputEl.name || undefined;
    const baseId = name || inputEl.id || `date-${fields.length + 1}`;
    const fieldId = generateUniqueFieldId(baseId, usedIds);
    el.setAttribute('data-autofiller-id', fieldId);

    const { label, ariaLabel, placeholder } = resolveAccessibleLabel(inputEl, container, doc);
    const required = isRequiredField(inputEl, container);

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      placeholder,
      ariaLabel,
      type: 'date',
      controlType: 'date',
      selectionMode: 'single',
      required: required || undefined,
    });
  });

  // --------------------------------------------------------------------------
  // STAGE 5: Text, Textarea, Email, Tel & Other Inputs
  // --------------------------------------------------------------------------
  const textInputEls = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="password"], input[type="url"], input:not([type]), textarea',
    ),
  );

  textInputEls.forEach((inputEl) => {
    if (processedElements.has(inputEl) || isElementHidden(inputEl)) return;

    // Skip companion text inputs for radio/checkbox "Other" options (e.g. Google Forms aria-label="Other response")
    const isOtherCompanion =
      Boolean(inputEl.getAttribute('aria-label')?.toLowerCase().includes('other response')) ||
      inputEl.classList.contains('Hvn9fb') ||
      Boolean(inputEl.name?.includes('other_option_response')) ||
      inputEl.closest('[role="radio"], [role="checkbox"], .docssharedWizToggleLabeledContainer') !== null ||
      Boolean(inputEl.closest('[role="listitem"], .QrToBd')?.querySelector('[role="radio"], [role="checkbox"]'));
    if (isOtherCompanion) {
      processedElements.add(inputEl);
      return;
    }

    processedElements.add(inputEl);

    const container =
      inputEl.closest('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd') ||
      inputEl.parentElement;

    const isTextarea = inputEl.tagName.toLowerCase() === 'textarea';
    const controlType: FieldControlType = isTextarea ? 'textarea' : 'text';

    const name = inputEl.name || undefined;
    const baseId = name || inputEl.id || `field-${fields.length + 1}`;
    const fieldId = generateUniqueFieldId(baseId, usedIds);
    inputEl.setAttribute('data-autofiller-id', fieldId);

    const { label, ariaLabel, placeholder } = resolveAccessibleLabel(inputEl, container, doc);
    const required = isRequiredField(inputEl, container);
    const inputType = isTextarea ? 'textarea' : inputEl.type || 'text';

    fields.push({
      id: fieldId,
      name,
      label: label || fieldId,
      placeholder,
      ariaLabel,
      type: inputType,
      controlType,
      selectionMode: 'single',
      required: required || undefined,
    });
  });

  return fields;
}

/**
 * Re-associates a logical FieldMetadata with a live DOM element using a 5-tier confidence strategy.
 * If multiple candidate nodes match equally well (e.g. duplicate labels), returns null.
 */
export function findFieldElement(
  field: FieldMetadata,
  doc: Document = document,
): Element | null {
  // Tier 1: data-autofiller-id if element is still connected to the DOM
  try {
    const el = doc.querySelector(`[data-autofiller-id="${escapeCss(field.id)}"]`);
    if (el && doc.contains(el)) {
      return el;
    }
  } catch {
    // Ignore CSS selector escape issues
  }

  // Tier 2: Stable native ID
  if (field.id) {
    const el = doc.getElementById(field.id);
    if (el) return el;
  }

  // Tier 3: Match by name + controlType
  if (field.name) {
    const matches = Array.from(doc.querySelectorAll(`[name="${escapeCss(field.name)}"]`));
    const typeMatches = matches.filter((el) => {
      if (field.controlType === 'radio' && (el.getAttribute('role') === 'radio' || (el as HTMLInputElement).type === 'radio')) return true;
      if (field.controlType === 'checkbox' && (el.getAttribute('role') === 'checkbox' || (el as HTMLInputElement).type === 'checkbox')) return true;
      if (field.controlType === 'dropdown' && el.tagName.toLowerCase() === 'select') return true;
      if (field.controlType === 'textarea' && el.tagName.toLowerCase() === 'textarea') return true;
      if (field.controlType === 'text' && el.tagName.toLowerCase() === 'input') return true;
      return false;
    });

    if (typeMatches.length === 1) {
      return typeMatches[0];
    }
    // If multiple radio/checkbox inputs share name, return their common grouping container
    if (typeMatches.length > 1 && (field.controlType === 'radio' || field.controlType === 'checkbox')) {
      const container = typeMatches[0].closest('[role="radiogroup"], [role="group"], fieldset') || typeMatches[0].parentElement;
      if (container) return container;
    }
  }

  // Tier 4: Container fingerprint matching controlType and heading text
  if (field.label && field.controlType) {
    const containers = Array.from(
      doc.querySelectorAll('[role="listitem"], .freebirdFormviewerViewItemsItemItem, .QrToBd, fieldset, [role="radiogroup"], [role="group"]'),
    );

    const matchingContainers = containers.filter((c) => {
      const heading = c.querySelector('[role="heading"], h1, h2, h3, h4, h5, h6, .M7eMe, legend, label');
      if (!heading) return false;
      const headingText = cleanLabelText(heading.textContent || '');
      return headingText === field.label;
    });

    if (matchingContainers.length === 1) {
      const c = matchingContainers[0];
      if (field.controlType === 'radio' || field.controlType === 'checkbox') return c;
      const inner = c.querySelector('input, select, textarea, [role="listbox"], [role="combobox"]');
      if (inner) return inner;
    }
  }

  // Tier 5: Accessible label resolution match
  // Crucial Rule: If multiple candidates match equally well, return null rather than guessing!
  const allCandidates = Array.from(
    doc.querySelectorAll('input, select, textarea, [role="listbox"], [role="combobox"], [role="radiogroup"], [role="group"]'),
  );

  const matchedCandidates = allCandidates.filter((el) => {
    if (isElementHidden(el)) return false;
    const resolved = resolveAccessibleLabel(el, el.parentElement, doc);
    return resolved.label === field.label;
  });

  if (matchedCandidates.length === 1) {
    return matchedCandidates[0];
  }

  // Ambiguous duplicates or not found -> return null
  return null;
}
