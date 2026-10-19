import { FieldMetadata } from '@autofiller/shared';
import { extractFormFields } from './domReader.js';

export interface FrameMetadata {
  isIframe: boolean;
  frameUrl: string;
  frameTitle?: string;
}

/**
 * Returns metadata describing the current execution frame context.
 */
export function getFrameMetadata(): FrameMetadata {
  const isIframe = typeof window !== 'undefined' && window !== window.top;
  let frameUrl = '';
  let frameTitle = '';

  try {
    if (typeof window !== 'undefined' && window.location) {
      frameUrl = window.location.href;
    }
    if (typeof document !== 'undefined') {
      frameTitle = document.title;
    }
  } catch {
    // Ignore cross-origin access blocks
  }

  return { isIframe, frameUrl, frameTitle };
}

/**
 * For top-frame environments, scans all same-origin accessible child <iframe> elements
 * to discover embedded form fields that are part of the application.
 */
export function scanAccessibleChildIframes(doc: Document = document): FieldMetadata[] {
  const isIframe = typeof window !== 'undefined' && window !== window.top;
  // Only the top frame should traverse child frames to avoid duplicate recursive scanning
  if (isIframe) return [];

  const iframeElements = Array.from(doc.querySelectorAll<HTMLIFrameElement>('iframe'));
  const aggregatedFields: FieldMetadata[] = [];

  for (const iframe of iframeElements) {
    try {
      const childDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (childDoc && childDoc.body) {
        const childFields = extractFormFields(childDoc);
        if (childFields.length > 0) {
          childFields.forEach((f) => {
            // Annotate field with iframe source info if available
            const src = iframe.getAttribute('src') || iframe.id || 'embedded-iframe';
            if (!f.id.includes('iframe')) {
              f.id = `${src}::${f.id}`;
            }
          });
          aggregatedFields.push(...childFields);
        }
      }
    } catch {
      // Cross-origin iframe: access is blocked by browser SOP.
      // Handled natively by manifest V3 `all_frames: true` which injects a separate
      // instance of the content script directly into the cross-origin iframe.
    }
  }

  return aggregatedFields;
}
