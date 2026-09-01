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

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      throw new Error('No active tab found');
    }

    let scanResponse: { status: string; fields?: FieldMetadata[]; error?: string } | null = null;
    try {
      scanResponse = (await chrome.tabs.sendMessage(activeTab.id, {
        action: 'SCAN_FIELDS',
      })) as { status: string; fields?: FieldMetadata[]; error?: string };
    } catch {
      const errorMsg =
        'Content script not loaded on this tab. Please refresh the page tab and try again.';
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'SCAN_FIELDS_FAIL', errorMsg);
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    if (
      !scanResponse ||
      scanResponse.status !== 'success' ||
      !scanResponse.fields ||
      scanResponse.fields.length === 0
    ) {
      const errorMsg = scanResponse?.error || 'No fillable text fields found on this form';
      await ExtensionLogger.log('WARN', 'BACKGROUND', 'SCAN_NO_FIELDS', errorMsg);
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    await ExtensionLogger.log(
      'SUCCESS',
      'BACKGROUND',
      'SCAN_FIELDS_SUCCESS',
      `Extracted ${scanResponse.fields.length} form field(s) from active tab`,
    );

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

    const backendRes = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: scanResponse.fields,
        provider: options?.provider || 'ollama',
        model: options?.model,
        apiKey: options?.apiKey,
      }),
    });

    if (!backendRes.ok) {
      const errData = (await backendRes.json().catch(() => ({}))) as { error?: string };
      const errorMsg =
        errData.error || `Backend HTTP request failed with status ${backendRes.status}`;
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'BACKEND_HTTP_ERROR', errorMsg);
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    const autofillData = (await backendRes.json()) as AutofillResponse;
    if (
      autofillData.status !== 'success' ||
      !autofillData.mappings ||
      Object.keys(autofillData.mappings).length === 0
    ) {
      const errorMsg = autofillData.error || 'LLM returned no field mappings';
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'LLM_MAPPING_EMPTY', errorMsg);
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    const mappedCount = Object.keys(autofillData.mappings).length;
    await ExtensionLogger.log(
      'SUCCESS',
      'BACKGROUND',
      'LLM_MAPPING_SUCCESS',
      `LLM response received (${mappedCount} field mapping(s)): ${JSON.stringify(autofillData.mappings)}`,
      {
        provider: options?.provider,
        model: options?.model,
        mappings: autofillData.mappings,
      },
    );

    await updateStatusState('filling');

    const fillResponse = (await chrome.tabs.sendMessage(activeTab.id, {
      action: 'FILL_FIELDS',
      mappings: autofillData.mappings,
    })) as { status: string; result?: FillResult; error?: string };

    if (!fillResponse || fillResponse.status !== 'success' || !fillResponse.result) {
      const errorMsg = fillResponse?.error || 'Form filling failed in content script';
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'DOM_FILL_FAIL', errorMsg);
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    const { filledCount, failedCount, filledFields, failedFields } = fillResponse.result;

    const filledDetails: Record<string, string> = {};
    if (Array.isArray(filledFields)) {
      filledFields.forEach((fieldId) => {
        filledDetails[fieldId] = autofillData.mappings[fieldId] || '(filled)';
      });
    }

    await ExtensionLogger.log(
      'SUCCESS',
      'BACKGROUND',
      'AUTOFILL_COMPLETE',
      `Form filled successfully: ${filledCount} field(s) populated: ${JSON.stringify(filledDetails)}${failedCount > 0 ? `, ${failedCount} failed: [${failedFields.join(', ')}]` : ''}`,
      {
        filledCount,
        failedCount,
        filledFields: filledDetails,
        failedFields,
        mappings: autofillData.mappings,
      },
    );

    await updateStatusState('done', { filledCount, failedCount });

    return {
      status: 'success',
      filledCount,
      failedCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await ExtensionLogger.log('ERROR', 'BACKGROUND', 'AUTOFILL_EXCEPTION', errorMsg);
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
    }
  });
}
