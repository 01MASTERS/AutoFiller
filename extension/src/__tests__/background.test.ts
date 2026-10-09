import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleTriggerAutofill,
  updateStatusState,
  getTabFrameIds,
  clearBackgroundStatusResetTimer,
} from '../background/background.js';

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
    clearBackgroundStatusResetTimer();
    vi.useRealTimers();
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

  it('resets background status to idle in storage after 5s timeout on terminal state', async () => {
    vi.useFakeTimers();
    await updateStatusState('done', { filledCount: 5 });

    expect(setStorageMock).toHaveBeenCalledWith({
      autofillStatus: expect.objectContaining({ currentState: 'done', filledCount: 5 }),
    });

    vi.advanceTimersByTime(5000);

    expect(setStorageMock).toHaveBeenCalledWith({
      autofillStatus: expect.objectContaining({ currentState: 'idle' }),
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
    expect(sendMessageTabMock).toHaveBeenCalledWith(101, { action: 'SCAN_FIELDS' }, { frameId: 0 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3456/autofill',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"provider":"ollama"'),
      }),
    );
    expect(sendMessageTabMock).toHaveBeenCalledWith(
      101,
      {
        action: 'FILL_FIELDS',
        mappings: { 'entry.1': 'Jane' },
        fields: [{ id: 'entry.1', label: 'Name', frameId: 0 }],
      },
      { frameId: 0 },
    );
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

  it('forwards explicit profileId in POST /autofill payload', async () => {
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
        mappings: { 'entry.1': 'Dr. Elena Rostova' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleTriggerAutofill({
      provider: 'ollama',
      profileId: 'data-scientist',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3456/autofill',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"profileId":"data-scientist"'),
      }),
    );
    expect(result).toEqual({ status: 'success', filledCount: 1, failedCount: 0, skippedCount: 0 });
  });

  it('reads activeProfileId from chrome.storage.local when profileId is omitted from options', async () => {
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

    getStorageMock.mockResolvedValue({
      activeProfileId: 'product-manager',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        mappings: { 'entry.1': 'Alex Rivera' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleTriggerAutofill({
      provider: 'ollama',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3456/autofill',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"profileId":"product-manager"'),
      }),
    );
    expect(result).toEqual({ status: 'success', filledCount: 1, failedCount: 0, skippedCount: 0 });
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

  describe('multi-frame scan aggregation & frame routing', () => {
    it('getTabFrameIds discovers frames via webNavigation, scripting, or defaults to [0]', async () => {
      // 1. webNavigation available
      const getAllFramesMock = vi.fn().mockResolvedValue([
        { frameId: 0 },
        { frameId: 10 },
        { frameId: 20 },
      ]);
      vi.stubGlobal('chrome', {
        webNavigation: { getAllFrames: getAllFramesMock },
      });
      const idsFromNav = await getTabFrameIds(99);
      expect(idsFromNav).toEqual([0, 10, 20]);

      // 2. scripting fallback
      const executeScriptMock = vi.fn().mockResolvedValue([
        { frameId: 0 },
        { frameId: 42 },
      ]);
      vi.stubGlobal('chrome', {
        scripting: { executeScript: executeScriptMock },
      });
      const idsFromScript = await getTabFrameIds(99);
      expect(idsFromScript).toEqual([0, 42]);

      // 3. Fallback when neither available
      vi.stubGlobal('chrome', {});
      const idsFallback = await getTabFrameIds(99);
      expect(idsFallback).toEqual([0]);
    });

    it('aggregates fields across frames, ignores empty widget frames, and routes fills to proper frameIds', async () => {
      queryTabsMock.mockResolvedValue([{ id: 101 }]);

      // Mock 3 frames: top frame (0), child iframe (10), recaptcha iframe (20)
      const getAllFramesMock = vi.fn().mockResolvedValue([
        { frameId: 0 },
        { frameId: 10 },
        { frameId: 20 },
      ]);

      sendMessageTabMock.mockImplementation((tabId, message, options) => {
        const frameId = options?.frameId ?? 0;
        if (message.action === 'SCAN_FIELDS') {
          if (frameId === 0) {
            return Promise.resolve({
              status: 'success',
              fields: [
                { id: 'top_first_name', label: 'First Name' },
                { id: 'top_last_name', label: 'Last Name' },
              ],
            });
          }
          if (frameId === 10) {
            return Promise.resolve({
              status: 'success',
              fields: [{ id: 'child_experience', label: 'Years Experience' }],
            });
          }
          if (frameId === 20) {
            // reCAPTCHA widget / empty child frame
            return Promise.resolve({
              status: 'success',
              fields: [],
            });
          }
        }

        if (message.action === 'FILL_FIELDS') {
          if (frameId === 0) {
            return Promise.resolve({
              status: 'success',
              result: {
                status: 'success',
                filledCount: 2,
                failedCount: 0,
                skippedCount: 0,
                filledFields: ['top_first_name', 'top_last_name'],
                failedFields: [],
                skippedFields: [],
              },
            });
          }
          if (frameId === 10) {
            return Promise.resolve({
              status: 'success',
              result: {
                status: 'success',
                filledCount: 1,
                failedCount: 0,
                skippedCount: 0,
                filledFields: ['child_experience'],
                failedFields: [],
                skippedFields: [],
              },
            });
          }
        }
        return Promise.reject(new Error('Unknown message/frame'));
      });

      vi.stubGlobal('chrome', {
        storage: {
          local: { set: setStorageMock, get: getStorageMock },
        },
        runtime: { sendMessage: sendMessageRuntimeMock },
        tabs: { query: queryTabsMock, sendMessage: sendMessageTabMock },
        webNavigation: { getAllFrames: getAllFramesMock },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          mappings: {
            top_first_name: 'John',
            top_last_name: 'Doe',
            child_experience: '5',
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await handleTriggerAutofill({ provider: 'ollama' });

      // Verify all 3 fields were sent to backend
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3456/autofill',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"fields":[{"id":"top_first_name"'),
        }),
      );

      // Verify FILL_FIELDS was routed to frame 0 with frame 0 fields
      expect(sendMessageTabMock).toHaveBeenCalledWith(
        101,
        {
          action: 'FILL_FIELDS',
          mappings: { top_first_name: 'John', top_last_name: 'Doe' },
          fields: expect.arrayContaining([
            expect.objectContaining({ id: 'top_first_name', frameId: 0 }),
            expect.objectContaining({ id: 'top_last_name', frameId: 0 }),
          ]),
        },
        { frameId: 0 },
      );

      // Verify FILL_FIELDS was routed to frame 10 with frame 10 fields
      expect(sendMessageTabMock).toHaveBeenCalledWith(
        101,
        {
          action: 'FILL_FIELDS',
          mappings: { child_experience: '5' },
          fields: expect.arrayContaining([
            expect.objectContaining({ id: 'child_experience', frameId: 10 }),
          ]),
        },
        { frameId: 10 },
      );

      // Combined fill result
      expect(result).toEqual({
        status: 'success',
        filledCount: 3,
        failedCount: 0,
        skippedCount: 0,
      });
    });

    it('handles embedded cross-origin iframe where top frame has 0 fields and iframe has form fields', async () => {
      queryTabsMock.mockResolvedValue([{ id: 101 }]);

      const getAllFramesMock = vi.fn().mockResolvedValue([
        { frameId: 0 },
        { frameId: 42 },
      ]);

      sendMessageTabMock.mockImplementation((tabId, message, options) => {
        const frameId = options?.frameId ?? 0;
        if (message.action === 'SCAN_FIELDS') {
          if (frameId === 0) {
            return Promise.resolve({ status: 'success', fields: [] });
          }
          if (frameId === 42) {
            return Promise.resolve({
              status: 'success',
              fields: [{ id: 'embedded_email', label: 'Email' }],
            });
          }
        }
        if (message.action === 'FILL_FIELDS') {
          if (frameId === 42) {
            return Promise.resolve({
              status: 'success',
              result: {
                status: 'success',
                filledCount: 1,
                failedCount: 0,
                skippedCount: 0,
                filledFields: ['embedded_email'],
                failedFields: [],
                skippedFields: [],
              },
            });
          }
        }
        return Promise.reject(new Error('Unknown message/frame'));
      });

      vi.stubGlobal('chrome', {
        storage: {
          local: { set: setStorageMock, get: getStorageMock },
        },
        runtime: { sendMessage: sendMessageRuntimeMock },
        tabs: { query: queryTabsMock, sendMessage: sendMessageTabMock },
        webNavigation: { getAllFrames: getAllFramesMock },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          mappings: { embedded_email: 'test@example.com' },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await handleTriggerAutofill();

      expect(sendMessageTabMock).toHaveBeenCalledWith(
        101,
        {
          action: 'FILL_FIELDS',
          mappings: { embedded_email: 'test@example.com' },
          fields: [expect.objectContaining({ id: 'embedded_email', frameId: 42 })],
        },
        { frameId: 42 },
      );

      expect(result).toEqual({
        status: 'success',
        filledCount: 1,
        failedCount: 0,
        skippedCount: 0,
      });
    });

    it('resiliently ignores errors in child frames and proceeds with valid frames', async () => {
      queryTabsMock.mockResolvedValue([{ id: 101 }]);

      const getAllFramesMock = vi.fn().mockResolvedValue([
        { frameId: 0 },
        { frameId: 99 }, // frame that throws
      ]);

      sendMessageTabMock.mockImplementation((tabId, message, options) => {
        const frameId = options?.frameId ?? 0;
        if (message.action === 'SCAN_FIELDS') {
          if (frameId === 0) {
            return Promise.resolve({
              status: 'success',
              fields: [{ id: 'main_field', label: 'Name' }],
            });
          }
          if (frameId === 99) {
            return Promise.reject(new Error('Cross-origin frame inaccessible'));
          }
        }
        if (message.action === 'FILL_FIELDS' && frameId === 0) {
          return Promise.resolve({
            status: 'success',
            result: {
              status: 'success',
              filledCount: 1,
              failedCount: 0,
              skippedCount: 0,
              filledFields: ['main_field'],
              failedFields: [],
              skippedFields: [],
            },
          });
        }
        return Promise.reject(new Error('Unknown'));
      });

      vi.stubGlobal('chrome', {
        storage: {
          local: { set: setStorageMock, get: getStorageMock },
        },
        runtime: { sendMessage: sendMessageRuntimeMock },
        tabs: { query: queryTabsMock, sendMessage: sendMessageTabMock },
        webNavigation: { getAllFrames: getAllFramesMock },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          mappings: { main_field: 'Alice' },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await handleTriggerAutofill();
      expect(result).toEqual({
        status: 'success',
        filledCount: 1,
        failedCount: 0,
        skippedCount: 0,
      });
    });
  });
});
