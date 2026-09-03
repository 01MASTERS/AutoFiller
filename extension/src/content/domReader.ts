/**
 * @file domReader.ts
 * Main entry point for DOM scanning and field discovery.
 * Logic is modularized in `./domReader/`:
 * - accessibility: accessible label and requirement computation
 * - optionParser: option extraction for select, listbox, radio, and checkbox
 * - controls/radio: radio groups and linear scale questions
 * - controls/checkbox: checkbox groups and multi-selection
 * - controls/dropdown: native select, ARIA listbox, and combobox
 * - controls/date: multi-part (.exportDate) and standard single date inputs
 * - controls/text: text, textarea, email, tel, number inputs
 * - fieldDiscovery: main extraction pipeline and findFieldElement locator
 */

export * from './domReader/index.js';
