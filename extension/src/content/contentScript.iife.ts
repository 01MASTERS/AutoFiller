import { extractFormFields } from './domReader.js';
import { fillFormFields } from './formFiller.js';
import { ExtensionLogger } from '../utils/logger.js';
import { getFrameMetadata, scanAccessibleChildIframes } from './iframeDiscovery.js';
import { initNavigationObserver } from './navigationObserver.js';

// Initialize SPA route and dynamic form step observation
initNavigationObserver({
  onRouteChange: (url, method) => {
    ExtensionLogger.log(
      'INFO',
      'CONTENT_SCRIPT',
      'SPA_ROUTE_CHANGED',
      `SPA navigation detected (${method}): ${url}`,
      { url, method },
    );
  },
  onFormMutated: (mutatedNodes) => {
    ExtensionLogger.log(
      'INFO',
      'CONTENT_SCRIPT',
      'SPA_FORM_MUTATION',
      `Dynamic form DOM mutation detected (${mutatedNodes.length} node(s) added)`,
      { count: mutatedNodes.length },
    );
  },
});

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'SCAN_FIELDS') {
      try {
        const frameMeta = getFrameMetadata();
        let fields = extractFormFields(document);

        // If top-frame, also inspect any accessible same-origin child iframes
        if (!frameMeta.isIframe) {
          const iframeFields = scanAccessibleChildIframes(document);
          if (iframeFields.length > 0) {
            fields = [...fields, ...iframeFields];
          }
        }

        if (fields.length === 0) {
          ExtensionLogger.log(
            'WARN',
            'CONTENT_SCRIPT',
            'DOM_SCAN_EMPTY',
            'Scanned page but found 0 supported form fields',
            { url: window.location.href, title: document.title, ...frameMeta },
          );
        } else {
          const detectedPlatform = fields[0]?.platform || 'generic';
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
            `Scanned ${fields.length} form field(s) on ${detectedPlatform} (${summary})`,
            {
              count: fields.length,
              platform: detectedPlatform,
              ...frameMeta,
              typeCounts,
              fields: fields.map((f) => ({
                id: f.id,
                label: f.label,
                type: f.type,
                controlType: f.controlType,
                selectionMode: f.selectionMode,
                optionsCount: f.options?.length ?? 0,
                options: f.options?.map((o) => o.label),
                required: f.required,
                platform: f.platform,
              })),
            },
          );
        }
        sendResponse({ status: 'success', fields, frameMeta });
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
      (async () => {
        try {
          const result = await fillFormFields(message.mappings || {}, message.fields || [], document);
          const filledMap: Record<string, unknown> = {};
          if (Array.isArray(result.filledFields)) {
            result.filledFields.forEach((id) => {
              const val = (message.mappings || {})[id];
              filledMap[id] = val !== undefined ? val : '(filled)';
            });
          }
          const level = result.status === 'success' ? 'SUCCESS' : result.status === 'partial' ? 'WARN' : 'ERROR';
          const tag = result.status === 'success' ? 'DOM_FILL_DONE' : result.status === 'partial' ? 'DOM_FILL_PARTIAL' : 'DOM_FILL_FAILED';
          ExtensionLogger.log(
            level,
            'CONTENT_SCRIPT',
            tag,
            `Content script filled ${result.filledCount} field(s)${result.failedCount > 0 ? `, ${result.failedCount} failed to fill` : ''}${result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ''}`,
            {
              filledCount: result.filledCount,
              failedCount: result.failedCount,
              skippedCount: result.skippedCount,
              filledFields: filledMap,
              failedFields: result.failedFields,
              skippedFields: result.skippedFields,
              failureReasons: result.failureReasons,
              skippedReasons: result.skippedReasons,
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
      })();
      return true;
    }
  });
}
