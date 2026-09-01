import { LogEntry, LogLevel, LogSource } from '@autofiller/shared';

export class ExtensionLogger {
  private static readonly MAX_LOGS = 500;
  private static readonly STORAGE_KEY = 'activityLogs';

  public static async log(
    level: LogLevel,
    source: LogSource,
    tag: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<LogEntry> {
    const entry: LogEntry = {
      id: `ext-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      tag,
      message,
      details,
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get([this.STORAGE_KEY]);
        const existing: LogEntry[] = Array.isArray(stored[this.STORAGE_KEY])
          ? stored[this.STORAGE_KEY]
          : [];

        const updated = [entry, ...existing].slice(0, this.MAX_LOGS);
        await chrome.storage.local.set({ [this.STORAGE_KEY]: updated });
      } catch {
        // Storage fallback ignore
      }
    }

    // Asynchronously push to backend logs endpoint
    fetch('http://localhost:3456/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Offline fallback
    });

    return entry;
  }

  public static async getLogs(): Promise<LogEntry[]> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get([this.STORAGE_KEY]);
        return Array.isArray(stored[this.STORAGE_KEY]) ? stored[this.STORAGE_KEY] : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  public static async clearLogs(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove([this.STORAGE_KEY]);
    }
  }
}
