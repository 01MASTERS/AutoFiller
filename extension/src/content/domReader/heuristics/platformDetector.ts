import { FormPlatform } from '@autofiller/shared';

/**
 * Detects the current webpage's form/ATS platform based on URL patterns and DOM signatures.
 */
export function detectPlatform(doc: Document = document): FormPlatform {
  let hostname = '';
  let pathname = '';

  try {
    if (typeof window !== 'undefined' && window.location) {
      hostname = window.location.hostname.toLowerCase();
      pathname = window.location.pathname.toLowerCase();
    }
  } catch {
    // Ignore environments where location is undefined
  }

  // 1. Google Forms
  if (
    (hostname.includes('docs.google.com') && pathname.includes('/forms/')) ||
    doc.querySelector('.freebirdFormviewerViewItemsItemItem, .QrToBd, form[action*="docs.google.com/forms"]')
  ) {
    return 'google-forms';
  }

  // 2. Greenhouse
  if (
    hostname.includes('greenhouse.io') ||
    doc.querySelector('#app_body, #application_form, [data-source="greenhouse"], .greenhouse-content, #embedded_job_board')
  ) {
    return 'greenhouse';
  }

  // 3. Lever
  if (
    hostname.includes('lever.co') ||
    doc.querySelector('.lever-job-page, form#application-form[action*="lever.co"], .application-form .section-candidate-wrapper, [data-qa="btn-apply"]')
  ) {
    return 'lever';
  }

  // 4. Workday
  if (
    hostname.includes('myworkdayjobs.com') ||
    hostname.includes('myworkday.com') ||
    doc.querySelector('[data-automation-id="jobApplicationWrapper"], [data-automation-id="pageHeader"], [data-automation-id*="workday"]')
  ) {
    return 'workday';
  }

  // 5. SmartRecruiters
  if (
    hostname.includes('smartrecruiters.com') ||
    doc.querySelector(
      'spl-job-application, smart-apply-form, [data-automation-id*="smartrecruiters"], [data-qa*="smartrecruiters"], [class*="smartrecruiters"], spl-form-field, smart-input',
    )
  ) {
    return 'smartrecruiters';
  }

  return 'generic';
}
