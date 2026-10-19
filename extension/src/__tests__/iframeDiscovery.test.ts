/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFrameMetadata,
  scanAccessibleChildIframes,
} from '../content/iframeDiscovery.js';

describe('Iframe Discovery & Multi-Frame Navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects top-frame context and collects URL metadata', () => {
    const meta = getFrameMetadata();
    expect(meta).toMatchObject({
      isIframe: false,
      frameUrl: expect.any(String),
    });
  });

  it('scans accessible child iframes and extracts embedded form fields', () => {
    const iframe = document.createElement('iframe');
    iframe.id = 'embedded-greenhouse-frame';
    iframe.setAttribute('src', 'https://boards.greenhouse.io/embed/job_app');
    document.body.appendChild(iframe);

    // In jsdom, contentDocument is available for dynamically created iframes
    const iframeDoc = iframe.contentDocument;
    if (iframeDoc && iframeDoc.body) {
      iframeDoc.body.innerHTML = `
        <form id="job-form">
          <label for="first_name">First Name</label>
          <input type="text" id="first_name" name="first_name" required />
        </form>
      `;

      const fields = scanAccessibleChildIframes(document);
      expect(fields.length).toBeGreaterThanOrEqual(1);
      expect(fields[0].label).toBe('First Name');
      expect(fields[0].id).toContain('embedded');
    }
  });

  it('handles empty or inaccessible iframes without throwing errors', () => {
    const iframe = document.createElement('iframe');
    iframe.id = 'blank-frame';
    document.body.appendChild(iframe);

    // Mock inaccessible contentDocument property
    Object.defineProperty(iframe, 'contentDocument', {
      get: () => {
        throw new Error('SecurityError: Blocked a frame with origin from accessing a cross-origin frame.');
      },
      configurable: true,
    });

    expect(() => {
      const fields = scanAccessibleChildIframes(document);
      expect(fields).toEqual([]);
    }).not.toThrow();
  });
});
