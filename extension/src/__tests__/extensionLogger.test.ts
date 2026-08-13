import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionLogger } from '../utils/logger.js';

describe('ExtensionLogger Utility', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('logs entry and returns structured LogEntry', async () => {
    const entry = await ExtensionLogger.log(
      'INFO',
      'EXTENSION_POPUP',
      'TEST_TAG',
      'Test log message',
      { key: 'val' }
    );

    expect(entry.id).toContain('ext-');
    expect(entry.level).toBe('INFO');
    expect(entry.source).toBe('EXTENSION_POPUP');
    expect(entry.tag).toBe('TEST_TAG');
    expect(entry.message).toBe('Test log message');
    expect(entry.details).toEqual({ key: 'val' });
  });

  it('sends POST request to backend logs endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await ExtensionLogger.log('SUCCESS', 'BACKGROUND', 'SYNC_TEST', 'Sync message');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3456/logs',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
