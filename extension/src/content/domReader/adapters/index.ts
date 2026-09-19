/**
 * @file index.ts
 * Platform adapters entry point for Greenhouse, Lever, and Workday.
 */

import { FieldMetadata, FormPlatform } from '@autofiller/shared';
import { adaptGreenhouseFields } from './greenhouseAdapter.js';
import { adaptLeverFields } from './leverAdapter.js';
import { adaptWorkdayFields } from './workdayAdapter.js';

export * from './greenhouseAdapter.js';
export * from './leverAdapter.js';
export * from './workdayAdapter.js';

/**
 * Applies platform-specific heuristics and adaptations to discovered form fields.
 */
export function applyPlatformAdapters(
  fields: FieldMetadata[],
  doc: Document = document,
  platform: FormPlatform = 'generic',
): void {
  switch (platform) {
    case 'greenhouse':
      adaptGreenhouseFields(fields, doc);
      break;
    case 'lever':
      adaptLeverFields(fields, doc);
      break;
    case 'workday':
      adaptWorkdayFields(fields, doc);
      break;
    case 'google-forms':
    case 'generic':
    default:
      break;
  }
}
