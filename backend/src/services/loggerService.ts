import { LogEntry, LogLevel, LogSource } from '@autofiller/shared';

export class LoggerService {
  private static instance: LoggerService;
  private logs: LogEntry[] = [];
  private readonly maxLogs: number = 500;

  private constructor() {}

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  public addLog(entry: Omit<LogEntry, 'id' | 'timestamp'> & { timestamp?: string }): LogEntry {
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      level: entry.level,
      source: entry.source,
      tag: entry.tag,
      message: entry.message,
      details: entry.details,
    };

    this.logs.unshift(newLog);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return newLog;
  }

  public getLogs(options?: {
    level?: LogLevel;
    source?: LogSource;
    query?: string;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (options?.level) {
      filtered = filtered.filter((l) => l.level === options.level);
    }
    if (options?.source) {
      filtered = filtered.filter((l) => l.source === options.source);
    }
    if (options?.query) {
      const q = options.query.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.tag.toLowerCase().includes(q) ||
          (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
      );
    }

    if (options?.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  public clearLogs(): void {
    this.logs = [];
  }
}
