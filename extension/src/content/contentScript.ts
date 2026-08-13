import { extractFormFields } from './domReader.js';
import { fillFormFields } from './formFiller.js';

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'SCAN_FIELDS') {
      try {
        const fields = extractFormFields(document);
        sendResponse({ status: 'success', fields });
      } catch (error) {
        sendResponse({
          status: 'error',
          fields: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (message?.action === 'FILL_FIELDS') {
      try {
        const result = fillFormFields(message.mappings || {}, document);
        sendResponse({ status: 'success', result });
      } catch (error) {
        sendResponse({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return true;
  });
}
