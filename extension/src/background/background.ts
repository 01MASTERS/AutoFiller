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
  details?: { filledCount?: number; failedCount?: number; error?: string }
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

export async function handleTriggerAutofill(options?: {
  provider?: 'ollama' | 'gemini';
  model?: string;
  apiKey?: string;
}) {
  try {
    await updateStatusState('analyzing');

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      throw new Error('Chrome tabs API not available');
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      throw new Error('No active tab found');
    }

    const scanResponse = (await chrome.tabs.sendMessage(activeTab.id, {
      action: 'SCAN_FIELDS',
    })) as { status: string; fields?: FieldMetadata[]; error?: string };

    if (
      !scanResponse ||
      scanResponse.status !== 'success' ||
      !scanResponse.fields ||
      scanResponse.fields.length === 0
    ) {
      const errorMsg =
        scanResponse?.error || 'No fillable text fields found on this form';
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
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    await updateStatusState('filling');

    const fillResponse = (await chrome.tabs.sendMessage(activeTab.id, {
      action: 'FILL_FIELDS',
      mappings: autofillData.mappings,
    })) as { status: string; result?: FillResult; error?: string };

    if (!fillResponse || fillResponse.status !== 'success' || !fillResponse.result) {
      const errorMsg = fillResponse?.error || 'Form filling failed in content script';
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    const { filledCount, failedCount } = fillResponse.result;
    await updateStatusState('done', { filledCount, failedCount });

    return {
      status: 'success',
      filledCount,
      failedCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
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
