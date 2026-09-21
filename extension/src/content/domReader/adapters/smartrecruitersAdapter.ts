/**
 * @file smartrecruitersAdapter.ts
 * Specialized DOM adapter and heuristics for SmartRecruiters ATS portals
 * (jobs.smartrecruiters.com, *.smartrecruiters.com, and embedded Angular/Web Component widgets).
 */

import { FieldMetadata } from '@autofiller/shared';
import { cleanLabelText } from '../utils.js';

/**
 * Normalizes and enriches form fields discovered on SmartRecruiters application pages.
 */
export function adaptSmartrecruitersFields(fields: FieldMetadata[], _doc: Document = document): void {
  for (const field of fields) {
    const rawId = (field.id || '').toLowerCase();
    const rawName = (field.name || '').toLowerCase();
    const rawLabel = (field.label || '').toLowerCase();

    // 1. Personal Information Section
    if (
      rawName === 'firstname' ||
      rawName === 'first_name' ||
      rawId.includes('firstname') ||
      rawLabel === 'first name' ||
      rawLabel.includes('first name')
    ) {
      field.label = 'First Name';
      field.platformFieldType = 'personal';
      field.section = field.section || 'Personal Information';
    } else if (
      rawName === 'lastname' ||
      rawName === 'last_name' ||
      rawId.includes('lastname') ||
      rawLabel === 'last name' ||
      rawLabel.includes('last name')
    ) {
      field.label = 'Last Name';
      field.platformFieldType = 'personal';
      field.section = field.section || 'Personal Information';
    } else if (
      rawName === 'email' ||
      rawId.includes('email') ||
      rawLabel === 'email' ||
      rawLabel.includes('email address')
    ) {
      field.label = 'Email Address';
      field.platformFieldType = 'personal';
      field.section = field.section || 'Personal Information';
    } else if (
      rawName === 'phonenumber' ||
      rawName === 'phone' ||
      rawId.includes('phone') ||
      rawLabel.includes('phone')
    ) {
      field.label = 'Phone Number';
      field.platformFieldType = 'personal';
      field.section = field.section || 'Personal Information';
    } else if (rawName.includes('city') || rawId.includes('city') || rawLabel === 'city') {
      field.label = 'City';
      field.platformFieldType = 'personal';
      field.section = field.section || 'Personal Information';
    } else if (
      rawName.includes('postalcode') ||
      rawName.includes('zip') ||
      rawId.includes('postalcode') ||
      rawId.includes('zip') ||
      rawLabel.includes('postal code') ||
      rawLabel.includes('zip code')
    ) {
      field.label = 'Postal Code';
      field.platformFieldType = 'personal';
      field.section = field.section || 'Personal Information';
    }

    // 2. Resume / CV File Upload
    else if (
      field.controlType === 'file' ||
      rawName.includes('resume') ||
      rawId.includes('resume') ||
      rawLabel.includes('resume') ||
      rawLabel.includes('cv')
    ) {
      field.platformFieldType = 'resume_upload';
      field.section = field.section || 'Resume / CV';
      field.label = 'Resume / CV';
    }

    // 3. Social & Web Links
    else if (
      rawName.includes('linkedin') ||
      rawId.includes('linkedin') ||
      rawLabel.includes('linkedin')
    ) {
      field.platformFieldType = 'social_link';
      field.section = field.section || 'Social Links';
      field.label = 'LinkedIn URL';
    } else if (
      rawName.includes('website') ||
      rawName.includes('portfolio') ||
      rawName.includes('github') ||
      rawLabel.includes('website') ||
      rawLabel.includes('portfolio')
    ) {
      field.platformFieldType = 'social_link';
      field.section = field.section || 'Social Links';
    }

    // 4. Screening Questions
    else if (
      rawId.includes('screening') ||
      rawName.includes('screening') ||
      rawId.includes('question') ||
      rawName.includes('question')
    ) {
      field.platformFieldType = 'custom_question';
      field.section = field.section || 'Screening Questions';
    }

    // Clean label text
    field.label = cleanLabelText(field.label).trim();
  }
}
