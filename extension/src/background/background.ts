import { AutofillResponse, FieldMetadata, FillResult } from '@autofiller/shared';

export type AutofillState = 'idle' | 'analyzing' | 'filling' | 'done' | 'partial' | 'error';

export interface StatusDetails {
  currentState: AutofillState;
  filledCount?: number;
  failedCount?: number;
  skippedCount?: number;
  error?: string;
  timestamp?: string;
  durationMs?: number;
  llmDurationMs?: number;
  scanDurationMs?: number;
  fillDurationMs?: number;
}

let backgroundStatusResetTimer: ReturnType<typeof setTimeout> | null = null;

export function clearBackgroundStatusResetTimer() {
  if (backgroundStatusResetTimer) {
    clearTimeout(backgroundStatusResetTimer);
    backgroundStatusResetTimer = null;
  }
}

export async function updateStatusState(
  state: AutofillState,
  details?: {
    filledCount?: number;
    failedCount?: number;
    skippedCount?: number;
    error?: string;
    durationMs?: number;
    llmDurationMs?: number;
    scanDurationMs?: number;
    fillDurationMs?: number;
  },
): Promise<StatusDetails> {
  clearBackgroundStatusResetTimer();

  const statusData: StatusDetails = {
    currentState: state,
    filledCount: details?.filledCount,
    failedCount: details?.failedCount,
    skippedCount: details?.skippedCount,
    error: details?.error,
    timestamp: new Date().toISOString(),
    durationMs: details?.durationMs,
    llmDurationMs: details?.llmDurationMs,
    scanDurationMs: details?.scanDurationMs,
    fillDurationMs: details?.fillDurationMs,
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

  if (state === 'done' || state === 'partial' || state === 'error') {
    backgroundStatusResetTimer = setTimeout(async () => {
      const idleStatus: StatusDetails = {
        currentState: 'idle',
        timestamp: new Date().toISOString(),
      };
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try {
          await chrome.storage.local.set({ autofillStatus: idleStatus });
        } catch {}
      }
    }, 5000);
  }

  return statusData;
}

import { ExtensionLogger } from '../utils/logger.js';

/**
 * Discovers all active frame IDs for a given tab.
 * Prefers chrome.webNavigation.getAllFrames, falls back to
 * chrome.scripting.executeScript, and defaults to [0] (top frame).
 */
export async function getTabFrameIds(tabId: number): Promise<number[]> {
  if (typeof chrome !== 'undefined' && chrome.webNavigation?.getAllFrames) {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      if (Array.isArray(frames) && frames.length > 0) {
        const ids = frames.map((f) => f.frameId);
        return Array.from(new Set([0, ...ids]));
      }
    } catch {
      // Fallback
    }
  }

  if (typeof chrome !== 'undefined' && chrome.scripting?.executeScript) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => true,
      });
      if (Array.isArray(results) && results.length > 0) {
        const ids = results
          .map((r) => r.frameId)
          .filter((id): id is number => typeof id === 'number');
        return Array.from(new Set([0, ...ids]));
      }
    } catch {
      // Fallback
    }
  }

  return [0];
}

export async function handleTriggerAutofill(options?: {
  provider?: 'ollama' | 'gemini';
  model?: string;
  apiKey?: string;
  profileId?: string;
}) {
  const overallStart = Date.now();
  try {
    await updateStatusState('analyzing');

    let activeProfileId = options?.profileId;
    if (!activeProfileId && typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(['activeProfileId']);
        if (stored?.activeProfileId && typeof stored.activeProfileId === 'string') {
          activeProfileId = stored.activeProfileId;
        }
      } catch {
        // Fallback to undefined
      }
    }

    await ExtensionLogger.log(
      'INFO',
      'BACKGROUND',
      'AUTOFILL_START',
      `Starting autofill workflow (provider: ${options?.provider || 'ollama'}, model: ${options?.model || 'default'}, profile: ${activeProfileId || 'active'})`,
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

    const scanStart = Date.now();

    // 1. Discover all frames on the tab
    const frameIds = await getTabFrameIds(activeTab.id);

    // 2. Scan top frame (frameId: 0) first with targeted routing
    let topFrameResponse: { status: string; fields?: FieldMetadata[]; error?: string } | null = null;
    try {
      topFrameResponse = (await chrome.tabs.sendMessage(
        activeTab.id,
        { action: 'SCAN_FIELDS' },
        { frameId: 0 },
      )) as { status: string; fields?: FieldMetadata[]; error?: string };
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
          topFrameResponse = (await chrome.tabs.sendMessage(
            activeTab.id,
            { action: 'SCAN_FIELDS' },
            { frameId: 0 },
          )) as { status: string; fields?: FieldMetadata[]; error?: string };
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

    // 3. Scan any child frames (frameId > 0) individually in parallel
    const childFrameIds = frameIds.filter((id) => id !== 0);
    const childScanPromises = childFrameIds.map(async (frameId) => {
      try {
        const res = (await chrome.tabs.sendMessage(
          activeTab.id,
          { action: 'SCAN_FIELDS' },
          { frameId },
        )) as { status: string; fields?: FieldMetadata[]; error?: string };
        if (res && res.status === 'success' && Array.isArray(res.fields) && res.fields.length > 0) {
          return { frameId, fields: res.fields };
        }
      } catch {
        // Child frame may be sandboxed, empty, or un-injected; safe to ignore
      }
      return null;
    });
    const childResults = await Promise.all(childScanPromises);

    // 4. Aggregate all discovered fields across frames, deduplicating by ID
    const aggregatedFields: FieldMetadata[] = [];
    const fieldsByFrame = new Map<number, FieldMetadata[]>();
    const seenFieldIds = new Set<string>();

    if (
      topFrameResponse &&
      topFrameResponse.status === 'success' &&
      Array.isArray(topFrameResponse.fields) &&
      topFrameResponse.fields.length > 0
    ) {
      const topFields: FieldMetadata[] = [];
      for (const f of topFrameResponse.fields) {
        if (!seenFieldIds.has(f.id)) {
          seenFieldIds.add(f.id);
          const tagged = { ...f, frameId: 0 };
          topFields.push(tagged);
          aggregatedFields.push(tagged);
        }
      }
      if (topFields.length > 0) {
        fieldsByFrame.set(0, topFields);
      }
    }

    for (const child of childResults) {
      if (!child || child.fields.length === 0) continue;
      const childFields: FieldMetadata[] = [];
      for (const f of child.fields) {
        if (!seenFieldIds.has(f.id)) {
          seenFieldIds.add(f.id);
          const tagged = { ...f, frameId: child.frameId };
          childFields.push(tagged);
          aggregatedFields.push(tagged);
        }
      }
      if (childFields.length > 0) {
        fieldsByFrame.set(child.frameId, childFields);
      }
    }

    const scanDurationMs = Date.now() - scanStart;

    if (aggregatedFields.length === 0) {
      const errorMsg = topFrameResponse?.error || 'No fillable text fields found on this form';
      await ExtensionLogger.log('WARN', 'BACKGROUND', 'SCAN_NO_FIELDS', errorMsg, {
        tabUrl: activeTab.url,
        tabTitle: activeTab.title,
        fieldsFound: 0,
        framesScanned: frameIds.length,
        hint: 'AutoFiller scans for text, email, tel, textarea, date, radio, checkbox, and dropdown form fields. Ensure the form fields are visible and loaded on the page.',
      });
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    const detectedPlatform = aggregatedFields[0]?.platform || 'generic';
    await ExtensionLogger.log(
      'INFO',
      'BACKGROUND',
      'PLATFORM_DETECTED',
      `Detected form platform: ${detectedPlatform.toUpperCase()} (${aggregatedFields.length} fields found across ${fieldsByFrame.size} frame(s))`,
      {
        platform: detectedPlatform,
        fieldsFound: aggregatedFields.length,
        framesCount: fieldsByFrame.size,
        frameIds: Array.from(fieldsByFrame.keys()),
        tabUrl: activeTab.url,
      },
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

    let backendRes: Response;
    const llmStart = Date.now();
    try {
      backendRes = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: aggregatedFields,
          provider: options?.provider || 'ollama',
          model: options?.model,
          profileId: activeProfileId,
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
    const llmDurationMs = Date.now() - llmStart;

    if (!backendRes.ok) {
      const errData = (await backendRes.json().catch(() => ({}))) as { error?: string; details?: unknown };
      const detailStr = Array.isArray(errData.details)
        ? `: ${errData.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ')}`
        : '';
      const errorMsg =
        (errData.error ? `${errData.error}${detailStr}` : undefined) ||
        `Backend HTTP request failed with status ${backendRes.status}`;
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'BACKEND_HTTP_ERROR', errorMsg, {
        httpStatus: backendRes.status,
        statusText: backendRes.statusText,
        backendUrl,
        provider: options?.provider,
        model: options?.model,
        fieldsSent: aggregatedFields.length,
        details: errData.details,
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
        durationMs: autofillData.durationMs || llmDurationMs,
        scannedFieldsCount: aggregatedFields.length,
        scannedFields: aggregatedFields.map((f) => ({ id: f.id, label: f.label })),
        hint: 'None of the form fields matched your profile in backend/profile.json.',
      });
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    await updateStatusState('filling');

    const fillStart = Date.now();

    // Map each field ID to its origin frameId
    const fieldToFrameMap = new Map<string, number>();
    for (const f of aggregatedFields) {
      fieldToFrameMap.set(f.id, f.frameId ?? 0);
    }

    // Partition mappings by target frameId
    const mappingsByFrame = new Map<number, Record<string, FieldMappingValue>>();
    for (const [fieldId, value] of Object.entries(autofillData.mappings)) {
      const targetFrame = fieldToFrameMap.get(fieldId) ?? 0;
      if (!mappingsByFrame.has(targetFrame)) {
        mappingsByFrame.set(targetFrame, {});
      }
      mappingsByFrame.get(targetFrame)![fieldId] = value;
    }

    // Dispatch FILL_FIELDS to each frame containing mapped elements
    const fillResults: FillResult[] = [];
    for (const [frameId, frameMappings] of mappingsByFrame.entries()) {
      const frameFields =
        fieldsByFrame.get(frameId) ||
        aggregatedFields.filter((f) => (f.frameId ?? 0) === frameId);

      try {
        const fillResponse = (await chrome.tabs.sendMessage(
          activeTab.id,
          {
            action: 'FILL_FIELDS',
            mappings: frameMappings,
            fields: frameFields,
          },
          { frameId },
        )) as { status: string; result?: FillResult; error?: string };

        if (fillResponse?.status === 'success' && fillResponse.result) {
          fillResults.push(fillResponse.result);
        } else {
          fillResults.push({
            status: 'error',
            filledCount: 0,
            failedCount: Object.keys(frameMappings).length,
            skippedCount: 0,
            filledFields: [],
            failedFields: Object.keys(frameMappings),
            skippedFields: [],
            error: fillResponse?.error || `Frame ${frameId} fill failed`,
          });
        }
      } catch (frameErr) {
        fillResults.push({
          status: 'error',
          filledCount: 0,
          failedCount: Object.keys(frameMappings).length,
          skippedCount: 0,
          filledFields: [],
          failedFields: Object.keys(frameMappings),
          skippedFields: [],
          error: frameErr instanceof Error ? frameErr.message : String(frameErr),
        });
      }
    }

    const fillDurationMs = Date.now() - fillStart;

    // Combine fill results across all frames
    const combinedResult: FillResult = {
      status: 'success',
      filledCount: 0,
      failedCount: 0,
      skippedCount: 0,
      filledFields: [],
      failedFields: [],
      skippedFields: [],
      failureReasons: {},
      skippedReasons: {},
    };

    for (const res of fillResults) {
      combinedResult.filledCount += res.filledCount || 0;
      combinedResult.failedCount += res.failedCount || 0;
      combinedResult.skippedCount += res.skippedCount || 0;
      if (Array.isArray(res.filledFields)) combinedResult.filledFields.push(...res.filledFields);
      if (Array.isArray(res.failedFields)) combinedResult.failedFields.push(...res.failedFields);
      if (Array.isArray(res.skippedFields)) combinedResult.skippedFields.push(...res.skippedFields);
      if (res.failureReasons) Object.assign(combinedResult.failureReasons!, res.failureReasons);
      if (res.skippedReasons) Object.assign(combinedResult.skippedReasons!, res.skippedReasons);
    }

    const { filledCount, failedCount, skippedCount } = combinedResult;
    const totalIssues = failedCount + skippedCount;
    const finalState: AutofillState =
      totalIssues === 0 ? 'done' : filledCount > 0 ? 'partial' : 'error';

    if (fillResults.length === 0 || (filledCount === 0 && failedCount > 0)) {
      const errorMsg = fillResults[0]?.error || 'Form filling failed in content script';
      await ExtensionLogger.log('ERROR', 'BACKGROUND', 'DOM_FILL_FAIL', errorMsg, {
        mappings: autofillData.mappings,
        tabId: activeTab.id,
      });
      await updateStatusState('error', { error: errorMsg });
      return { status: 'error', error: errorMsg };
    }

    const totalDurationMs = Date.now() - overallStart;
    const effectiveLlmMs = autofillData.durationMs || llmDurationMs;

    await ExtensionLogger.log(
      'SUCCESS',
      'BACKGROUND',
      'FORM_FILL_TIME',
      `⏱️ Page Filled in ${(totalDurationMs / 1000).toFixed(2)}s (${totalDurationMs}ms) — LLM: ${(effectiveLlmMs / 1000).toFixed(2)}s | DOM Scan: ${scanDurationMs}ms | DOM Fill: ${fillDurationMs}ms (${filledCount} fields filled)`,
      {
        pageUrl: activeTab.url,
        pageTitle: activeTab.title,
        totalDurationSeconds: Number((totalDurationMs / 1000).toFixed(2)),
        totalDurationMs,
        llmDurationMs: effectiveLlmMs,
        scanDurationMs,
        fillDurationMs,
        filledCount,
        failedCount,
        skippedCount,
      },
    );

    await updateStatusState(finalState, {
      filledCount,
      failedCount,
      skippedCount,
      durationMs: totalDurationMs,
      llmDurationMs: effectiveLlmMs,
      scanDurationMs,
      fillDurationMs,
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
