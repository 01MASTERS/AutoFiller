import { extractFormFields } from './domReader.js';
import { fillFormFields } from './formFiller.js';
import { ExtensionLogger } from '../utils/logger.js';

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'SCAN_FIELDS') {
      try {
        const fields = extractFormFields(document);
        if (fields.length === 0) {
          ExtensionLogger.log(
            'WARN',
            'CONTENT_SCRIPT',
            'DOM_SCAN_EMPTY',
            'Scanned page but found 0 supported input or textarea form fields',
            { url: window.location.href, title: document.title },
          );
        } else {
          const typeCounts = fields.reduce<Record<string, number>>((acc, f) => {
            const ct = f.controlType || f.type || 'text';
            acc[ct] = (acc[ct] || 0) + 1;
            return acc;
          }, {});
          const summary = Object.entries(typeCounts)
            .map(([t, count]) => `${count} ${t}`)
            .join(', ');

          ExtensionLogger.log(
            'INFO',
            'CONTENT_SCRIPT',
            'DOM_SCAN_SUCCESS',
            `Scanned ${fields.length} form field(s) on page (${summary})`,
            {
              count: fields.length,
              typeCounts,
              fields: fields.map((f) => ({
                id: f.id,
                label: f.label,
                type: f.type,
                controlType: f.controlType,
                selectionMode: f.selectionMode,
                optionsCount: f.options?.length,
                required: f.required,
              })),
            },
          );
        }
        sendResponse({ status: 'success', fields });
      } catch (error) {
        ExtensionLogger.log(
          'ERROR',
          'CONTENT_SCRIPT',
          'DOM_SCAN_ERROR',
          `Error scanning form fields: ${error instanceof Error ? error.message : String(error)}`,
          { error: error instanceof Error ? error.stack : String(error) },
        );
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
        const level = result.status === 'success' ? 'SUCCESS' : result.status === 'partial' ? 'WARN' : 'ERROR';
        const tag = result.status === 'success' ? 'DOM_FILL_DONE' : result.status === 'partial' ? 'DOM_FILL_PARTIAL' : 'DOM_FILL_FAILED';
        ExtensionLogger.log(
          level,
          'CONTENT_SCRIPT',
          tag,
          `Content script filled ${result.filledCount} field(s)${result.failedCount > 0 ? `, ${result.failedCount} failed to fill` : ''}`,
          {
            filledCount: result.filledCount,
            failedCount: result.failedCount,
            filledFields: filledMap,
            failedFields: result.failedFields,
            failureReasons: result.failureReasons,
          },
        );
        sendResponse({ status: 'success', result });
      } catch (error) {
        ExtensionLogger.log(
          'ERROR',
          'CONTENT_SCRIPT',
          'DOM_FILL_EXCEPTION',
          `Content script encountered exception during form filling: ${error instanceof Error ? error.message : String(error)}`,
          { error: error instanceof Error ? error.stack : String(error) },
        );
        sendResponse({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return true;
  });
}
