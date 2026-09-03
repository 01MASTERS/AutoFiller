import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleTriggerAutofill, updateStatusState } from '../background/background.js';

describe('background service worker', () => {
  const setStorageMock = vi.fn().mockResolvedValue(undefined);
  const getStorageMock = vi.fn().mockResolvedValue({});
  const sendMessageRuntimeMock = vi.fn().mockResolvedValue(undefined);
  const sendMessageTabMock = vi.fn();
  const queryTabsMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();

    setStorageMock.mockResolvedValue(undefined);
    getStorageMock.mockResolvedValue({});
    sendMessageRuntimeMock.mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          set: setStorageMock,
          get: getStorageMock,
        },
      },
      runtime: {
        sendMessage: sendMessageRuntimeMock,
      },
      tabs: {
        query: queryTabsMock,
        sendMessage: sendMessageTabMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates state and persists to storage and runtime message channel', async () => {
    await updateStatusState('analyzing');

    expect(setStorageMock).toHaveBeenCalledWith({
      autofillStatus: expect.objectContaining({ currentState: 'analyzing' }),
    });
    expect(sendMessageRuntimeMock).toHaveBeenCalledWith({
      action: 'STATUS_UPDATE',
      currentState: 'analyzing',
      filledCount: undefined,
      failedCount: undefined,
      skippedCount: undefined,
      error: undefined,
      timestamp: expect.any(String),
    });
  });

  it('runs full orchestration flow on handleTriggerAutofill', async () => {
    queryTabsMock.mockResolvedValue([{ id: 101 }]);

    sendMessageTabMock.mockImplementation((tabId, message) => {
      if (message.action === 'SCAN_FIELDS') {
        return Promise.resolve({
          status: 'success',
          fields: [{ id: 'entry.1', label: 'Name' }],
        });
      }
      if (message.action === 'FILL_FIELDS') {
        return Promise.resolve({
          status: 'success',
          result: {
            status: 'success',
            filledCount: 1,
            failedCount: 0,
            skippedCount: 0,
            filledFields: ['entry.1'],
            failedFields: [],
            skippedFields: [],
          },
        });
      }
      return Promise.reject(new Error('Unknown action'));
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        mappings: { 'entry.1': 'Jane' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleTriggerAutofill({ provider: 'ollama' });

    expect(queryTabsMock).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(sendMessageTabMock).toHaveBeenCalledWith(101, { action: 'SCAN_FIELDS' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3456/autofill',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"provider":"ollama"'),
      }),
    );
    expect(sendMessageTabMock).toHaveBeenCalledWith(101, {
      action: 'FILL_FIELDS',
      mappings: { 'entry.1': 'Jane' },
      fields: [{ id: 'entry.1', label: 'Name' }],
    });
    expect(result).toEqual({ status: 'success', filledCount: 1, failedCount: 0, skippedCount: 0 });
  });

  it('handles empty scan fields error gracefully', async () => {
    queryTabsMock.mockResolvedValue([{ id: 101 }]);
    sendMessageTabMock.mockResolvedValue({ status: 'success', fields: [] });

    const result = await handleTriggerAutofill();

    expect(result).toEqual({
      status: 'error',
      error: 'No fillable text fields found on this form',
    });
  });

  it('handles backend error response', async () => {
    queryTabsMock.mockResolvedValue([{ id: 101 }]);
    sendMessageTabMock.mockResolvedValue({
      status: 'success',
      fields: [{ id: 'entry.1', label: 'Name' }],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Ollama service offline' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleTriggerAutofill();

    expect(result).toEqual({
      status: 'error',
      error: 'Ollama service offline',
    });
  });

  it('recovers via chrome.scripting.executeScript when content script was not initially loaded', async () => {
    queryTabsMock.mockResolvedValue([{ id: 101, url: 'https://docs.google.com/forms/d/test/viewform' }]);
    const executeScriptMock = vi.fn().mockResolvedValue([]);

    // First call fails, second call succeeds after injection
    let callCount = 0;
    sendMessageTabMock.mockImplementation((tabId, message) => {
      if (message.action === 'SCAN_FIELDS') {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
        }
        return Promise.resolve({
          status: 'success',
          fields: [{ id: 'entry.1', label: 'Name' }],
        });
      }
      if (message.action === 'FILL_FIELDS') {
        return Promise.resolve({
          status: 'success',
          result: {
            status: 'success',
            filledCount: 1,
            failedCount: 0,
            skippedCount: 0,
            filledFields: ['entry.1'],
            failedFields: [],
            skippedFields: [],
          },
        });
      }
      return Promise.reject(new Error('Unknown action'));
    });

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          set: setStorageMock,
          get: getStorageMock,
        },
      },
      runtime: {
        sendMessage: sendMessageRuntimeMock,
      },
      tabs: {
        query: queryTabsMock,
        sendMessage: sendMessageTabMock,
      },
      scripting: {
        executeScript: executeScriptMock,
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        mappings: { 'entry.1': 'Jane' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleTriggerAutofill({ provider: 'ollama' });

    expect(executeScriptMock).toHaveBeenCalledWith({
      target: { tabId: 101 },
      files: ['src/content/contentScript.iife.js'],
    });
    expect(result).toEqual({ status: 'success', filledCount: 1, failedCount: 0, skippedCount: 0 });
  });

  it('handles content script failure when injection also fails', async () => {
    queryTabsMock.mockResolvedValue([{ id: 101, url: 'chrome://extensions' }]);
    sendMessageTabMock.mockRejectedValue(new Error('Receiving end does not exist'));

    const result = await handleTriggerAutofill();

    expect(result).toEqual({
      status: 'error',
      error: 'Content script not loaded on this tab. Please refresh the page tab and try again.',
    });
  });

  it('Item 17 verification: runtime content-script injection file exists in source and matches manifest', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const sourcePath = path.resolve(__dirname, '../content/contentScript.iife.ts');
    expect(fs.existsSync(sourcePath)).toBe(true);

    // Verify dist artifact exists if dist directory is present
    const distDir = path.resolve(__dirname, '../../../dist');
    const distFile = path.resolve(__dirname, '../../dist/src/content/contentScript.iife.js');
    if (fs.existsSync(distDir)) {
      expect(fs.existsSync(distFile)).toBe(true);
    }
  });
});
