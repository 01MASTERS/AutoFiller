/**
 * @file dateSimulator.ts
 * Flexible date parser and simulator for multi-part (.exportDate) and standard HTML5 date inputs.
 */

import { fillTextInput } from './inputSimulator.js';
import { applyVisualFeedback } from '../visualFeedback.js';

export interface DateComponents {
  year: string;
  month: string;
  day: string;
}

/**
 * Robust date component parser supporting:
 * - ISO formats: "YYYY-MM-DD", "YYYY/MM/DD"
 * - Natural language dates: "5th Jan 2026", "5 January 2026", "Jan 5, 2026", "5 Jan 2026"
 * - International/Indian numeric formats: "DD-MM-YYYY", "DD/MM/YYYY"
 * - US numeric formats: "MM/DD/YYYY"
 */
export function parseDateComponents(value: string): DateComponents | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return {
      year: isoMatch[1],
      month: isoMatch[2].padStart(2, '0'),
      day: isoMatch[3].padStart(2, '0'),
    };
  }

  // 2. Natural language dates: e.g. "5th Jan 2026", "5 January 2026", "5th January, 2026"
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };

  const natMatch1 = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\s*,?\s*(\d{4})$/i);
  if (natMatch1) {
    const m = months[natMatch1[2].toLowerCase()];
    if (m) {
      return { year: natMatch1[3], month: m, day: natMatch1[1].padStart(2, '0') };
    }
  }

  // e.g. "Jan 5th, 2026" or "January 5, 2026"
  const natMatch2 = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})$/i);
  if (natMatch2) {
    const m = months[natMatch2[1].toLowerCase()];
    if (m) {
      return { year: natMatch2[3], month: m, day: natMatch2[2].padStart(2, '0') };
    }
  }

  // 3. Day-first or Month-first numeric format: DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY
  const numMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (numMatch) {
    const first = parseInt(numMatch[1], 10);
    const second = parseInt(numMatch[2], 10);
    if (first > 12) {
      // First must be day (e.g. 24-08-1995)
      return { year: numMatch[3], month: String(second).padStart(2, '0'), day: String(first).padStart(2, '0') };
    }
    // Default to Indian/International standard DD-MM-YYYY
    return { year: numMatch[3], month: String(second).padStart(2, '0'), day: String(first).padStart(2, '0') };
  }

  return null;
}

/**
 * Fills a date input with flexible parsing supporting ISO, natural language, and regional formats.
 * Supports Google Forms multi-part dates (.exportDate with Month/Day/Year inputs)
 * as well as standard HTML5/generic single date inputs.
 */
export function fillDateInput(target: HTMLElement, value: string, doc: Document): boolean {
  const parsed = parseDateComponents(value);

  // 1. Multi-part date inputs (Google Forms .exportDate with Month/Day/Year inputs)
  const container = target.classList?.contains('exportDate') ? target : target.querySelector('.exportDate') || target;
  const monthInput = container.querySelector<HTMLInputElement>('input[aria-label*="Month" i], input[name*="_month" i]');
  const dayInput = container.querySelector<HTMLInputElement>('input[aria-label*="Day" i], input[name*="_day" i]');
  const yearInput = container.querySelector<HTMLInputElement>('input[aria-label*="Year" i], input[name*="_year" i]');

  if (monthInput && dayInput && yearInput && parsed) {
    fillTextInput(monthInput, parsed.month, doc);
    fillTextInput(dayInput, parsed.day, doc);
    fillTextInput(yearInput, parsed.year, doc);
    applyVisualFeedback(container as HTMLElement);
    return true;
  }

  // Fallback for multi-part without explicit month/day labels (e.g. 3 consecutive inputs in .exportDate)
  const dateInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'));
  if (dateInputs.length === 3 && parsed) {
    const firstLabel = (dateInputs[0].getAttribute('aria-label') || dateInputs[0].name || '').toLowerCase();
    if (firstLabel.includes('day')) {
      fillTextInput(dateInputs[0], parsed.day, doc);
      fillTextInput(dateInputs[1], parsed.month, doc);
      fillTextInput(dateInputs[2], parsed.year, doc);
    } else {
      fillTextInput(dateInputs[0], parsed.month, doc);
      fillTextInput(dateInputs[1], parsed.day, doc);
      fillTextInput(dateInputs[2], parsed.year, doc);
    }
    applyVisualFeedback(container as HTMLElement);
    return true;
  }

  // 2. Standard single date input (native <input type="date"> or text input)
  const input =
    target.tagName.toLowerCase() === 'input'
      ? (target as HTMLInputElement)
      : target.querySelector<HTMLInputElement>('input[type="date"], input, textarea');

  if (input) {
    if (input.type === 'date' && parsed) {
      fillTextInput(input, `${parsed.year}-${parsed.month}-${parsed.day}`, doc);
    } else if (parsed) {
      const ph = (input.getAttribute('placeholder') || '').toLowerCase();
      if (ph.includes('dd/mm') || ph.includes('dd-mm') || ph.includes('d/m')) {
        fillTextInput(input, `${parsed.day}/${parsed.month}/${parsed.year}`, doc);
      } else if (ph.includes('mm/dd') || ph.includes('mm-dd')) {
        fillTextInput(input, `${parsed.month}/${parsed.day}/${parsed.year}`, doc);
      } else {
        fillTextInput(input, `${parsed.year}-${parsed.month}-${parsed.day}`, doc);
      }
    } else {
      fillTextInput(input, value, doc);
    }
    applyVisualFeedback(input);
    return true;
  }

  fillTextInput(target, value, doc);
  applyVisualFeedback(target);
  return true;
}
