import { AutofillResponse, FieldMetadata, FillResult } from '@autofiller/shared';

export type AutofillState = 'idle' | 'analyzing' | 'filling' | 'done' | 'error';

export interface StatusDetails {
  currentState: AutofillState;
  filledCount?: number;
  failedCount?: number;
  error?: string;
  timestamp?: string;
}

export async function updateStatusState(
  state: AutofillState,
  details?: { filledCount?: number; failedCount?: number; error?: string },
): Promise<StatusDetails> {
  const statusData: StatusDetails = {
    currentState: state,
    filledCount: details?.filledCount,
    failedCount: details?.failedCount,
    error: details?.error,
    timestamp: new Date().toISOString(),
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ autofillStatus: statusData });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      await chrome.runtime.sendMessage({
        action: 'STATUS_UPDATE',
        ...statusData,
      });
    } catch {
      // Ignore errors when no popup listener is open
    }
  }

  return statusData;
}

import { ExtensionLogger } from '../utils/logger.js';

export async function handleTriggerAutofill(options?: {
  provider?: 'ollama' | 'gemini';
  model?: string;
  apiKey?: string;
}) {
  try {
    await updateStatusState('analyzing');
    await ExtensionLogger.log(
      'INFO',
      'BACKGROUND',
      'AUTOFILL_START',
      `Starting autofill workflow (provider: ${options?.provider || 'ollama'}, model: ${options?.model || 'default'})`,
    );

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      throw new Error('Chrome tabs API not available');
    }

    let [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      const fallbackTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      activeTab = fallbackTabs[0];
    }
    if (!activeTab || !activeTab.id) {
      throw new Error('No active tab found');
    }

    let scanResponse: { status: string; fields?: FieldMetadata[]; error?: string } | null = null;
    try {
      scanResponse = (await chrome.tabs.sendMessage(activeTab.id, {
        action: 'SCAN_FIELDS',
      })) as { status: string; fields?: FieldMetadata[]; error?: string };
    } catch (firstErr) {
      // Content script may not be loaded yet (e.g. tab opened before extension load/reload).
      // Attempt dynamic programmatic injection as automatic recovery.
      try {
        if (typeof chrome !== 'undefined' && chrome.scripting?.executeScript && activeTab.id) {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['src/content/contentScript.iife.js'],
          });
          // Brief yield to allow content script event listeners to register
          await new Promise((resolve) => setTimeout(resolve, 80));
          scanResponse = (await chrome.tabs.sendMessage(activeTab.id, {
            action: 'SCAN_FIELDS',
          })) as { status: string; fields?: FieldMetadata[]; error?: string };
        } else {
          throw firstErr;
        }
      } catch (injectErr) {
        const errorMsg =
          'Content script not loaded on this tab. Please refresh the page tab and try again.';
        await ExtensionLogger.log('ERROR', 'BACKGROUND', 'SCAN_FIELDS_FAIL', errorMsg, {
          tabId: activeTab.id,
          tabUrl: activeTab.url,
          tabTitle: activeTab.title,
          originalError: firstErr instanceof Error ? firstErr.message : String(firstErr),
          injectionError: injectErr instanceof Error ? injectErr.message : String(injectErr),
          hint: 'Content scripts only run on allowed URLs (e.g. Google Forms or regular web pages, not chrome:// internal pages).',
        });
        await updateStatusState('error', { error: errorMsg });
        return { status: 'error', error: errorMsg };
      }
    }

    if (
      !scanResponse ||
      scanResponse.status !== 'success' ||
      !scanResponse.fields ||
      scanResponse.fields.length === 0
    ) {
      const errorMsg = scanResponse?.error || 'No fillable text fields found on this form';
      await ExtensionLogger.log('WARN', 'BACKGROUND', 'SCAN_NO_FIELDS', errorMsg, {
        tabUrl: activeTab.url,
        tabTitle: activeTab.title,
        fieldsFound: 0,
        hint: 'AutoFiller scans for standard text, email, tel, textarea, and Google Form question inputs. Dropdowns and checkboxes are not yet supported.',
      });
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    let backendUrl = 'http://localhost:3456/autofill';
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(['backendUrl']);
        if (stored && typeof stored === 'object' && stored.backendUrl) {
          backendUrl = stored.backendUrl;
        }
      } catch {
        // Fallback to default URL
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options?.apiKey) {
      headers['x-gemini-api-key'] = options.apiKey;
    }

    let backendRes: Response;
    try {
      backendRes = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: scanResponse.fields,
          provider: options?.provider || 'ollama',
          model: options?.model,
          apiKey: options?.apiKey,
        }),
      });
    } catch (networkErr) {
      const errorMsg = `Cannot connect to AutoFiller backend at ${backendUrl}. Ensure the backend server is running (start.bat).`;
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'BACKEND_CONNECTION_FAILED', errorMsg, {
        backendUrl,
        error: networkErr instanceof Error ? networkErr.message : String(networkErr),
      });
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    if (!backendRes.ok) {
      const errData = (await backendRes.json().catch(() => ({}))) as { error?: string };
      const errorMsg =
        errData.error || `Backend HTTP request failed with status ${backendRes.status}`;
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'BACKEND_HTTP_ERROR', errorMsg, {
        httpStatus: backendRes.status,
        statusText: backendRes.statusText,
        backendUrl,
        provider: options?.provider,
        model: options?.model,
        fieldsSent: scanResponse.fields.length,
      });
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    const autofillData = (await backendRes.json()) as AutofillResponse;
    if (
      autofillData.status !== 'success' ||
      !autofillData.mappings ||
      Object.keys(autofillData.mappings).length === 0
    ) {
      const errorMsg = autofillData.error || 'LLM returned no matching field mappings for this form';
      await ExtensionLogger.log('WARN', 'BACKGROUND', 'LLM_MAPPING_EMPTY', errorMsg, {
        provider: options?.provider,
        model: options?.model,
        scannedFieldsCount: scanResponse.fields.length,
        scannedFields: scanResponse.fields.map((f) => ({ id: f.id, label: f.label })),
        hint: 'None of the form fields matched your profile in backend/profile.json.',
      });
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    await updateStatusState('filling');

    const fillResponse = (await chrome.tabs.sendMessage(activeTab.id, {
      action: 'FILL_FIELDS',
      mappings: autofillData.mappings,
      fields: scanResponse.fields,
    })) as { status: string; result?: FillResult; error?: string };

    if (!fillResponse || fillResponse.status !== 'success' || !fillResponse.result) {
      const errorMsg = fillResponse?.error || 'Form filling failed in content script';
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'DOM_FILL_FAIL', errorMsg, {
        mappings: autofillData.mappings,
        tabId: activeTab.id,
      });
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    const { filledCount, failedCount, skippedCount } = fillResponse.result;

    const totalIssues = failedCount + skippedCount;
    await updateStatusState(totalIssues > 0 ? 'error' : 'done', {
      filledCount,
      failedCount,
      skippedCount,
      error: totalIssues > 0 ? `${failedCount} field(s) failed, ${skippedCount} skipped` : undefined,
    });

    return {
      status: totalIssues > 0 ? 'partial' : 'success',
      filledCount,
      failedCount,
      skippedCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await ExtensionLogger.log('ERROR', 'BACKGROUND', 'AUTOFILL_EXCEPTION', errorMsg, {
      errorName: err instanceof Error ? err.name : undefined,
      errorMessage: errorMsg,
      stack: err instanceof Error ? err.stack : undefined,
      options,
    });
    await updateStatusState('error', { error: errorMsg });
    return { status: 'error', error: errorMsg };
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'TRIGGER_AUTOFILL') {
      handleTriggerAutofill(message.options).then(sendResponse);
      return true;
    } else if (message?.action === 'GET_STATUS') {
      if (chrome.storage?.local) {
        chrome.storage.local.get(['autofillStatus']).then((stored) => {
          sendResponse({
            status: 'success',
            autofillStatus: stored.autofillStatus || { currentState: 'idle' },
          });
        });
      } else {
        sendResponse({
          status: 'success',
          autofillStatus: { currentState: 'idle' },
        });
      }
      return true;
    } else if (message?.action === 'RELAY_LOG' && message.entry) {
      chrome.storage?.local?.get(['backendUrl']).then((stored) => {
        const url = stored?.backendUrl || 'http://localhost:3456/logs';
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.entry),
        }).catch(() => {});
      }).catch(() => {
        fetch('http://localhost:3456/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.entry),
        }).catch(() => {});
      });
      return true;
    }
  });
}
