export { extractFormFields, findFieldElement } from './fieldDiscovery.js';
export { resolveAccessibleLabel, resolveHeadingText, isRequiredField, generateUniqueFieldId } from './accessibility.js';
export { extractSelectOptions, extractAriaListboxOptions, resolveOptionLabel, extractRadioOrCheckboxOptions } from './optionParser.js';
export { isElementHidden, escapeCss, cleanText, cleanLabelText, normalize, isPlaceholderOption } from './utils.js';
export { scanRadioGroups } from './controls/radio.js';
export { scanCheckboxGroups } from './controls/checkbox.js';
export { scanDropdowns } from './controls/dropdown.js';
export { scanDateInputs } from './controls/date.js';
export { scanTextInputs } from './controls/text.js';
