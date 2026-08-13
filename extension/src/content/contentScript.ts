import { extractFormFields } from './domReader.js';
import { fillFormFields } from './formFiller.js';
import { ExtensionLogger } from '../utils/logger.js';

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
        const filledMap: Record<string, string> = {};
        if (Array.isArray(result.filledFields)) {
          result.filledFields.forEach((id) => {
            filledMap[id] = (message.mappings || {})[id] || '(filled)';
          });
        }
        ExtensionLogger.log(
          'SUCCESS',
          'CONTENT_SCRIPT',
          'DOM_FILL_DONE',
          `Content script filled ${result.filledCount} field(s): ${JSON.stringify(filledMap)}`,
          {
            filledCount: result.filledCount,
            failedCount: result.failedCount,
            filledFields: filledMap,
            failedFields: result.failedFields,
          }
        );
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
