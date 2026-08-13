import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { LoggerService } from '../services/loggerService.js';

describe('Logger Service & /logs API', () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = LoggerService.getInstance();
    logger.clearLogs();
  });

  it('adds and retrieves logs correctly', () => {
    logger.addLog({
      level: 'INFO',
      source: 'BACKEND_API',
      tag: 'HEALTH_CHECK',
      message: 'Health checked successfully',
    });

    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Health checked successfully');
    expect(logs[0].level).toBe('INFO');
  });

  it('prunes oldest logs when exceeding 500 entries', () => {
    for (let i = 1; i <= 550; i++) {
      logger.addLog({
        level: 'INFO',
        source: 'BACKEND_API',
        tag: 'TEST_LOG',
        message: `Log #${i}`,
      });
    }

    const logs = logger.getLogs();
    expect(logs.length).toBe(500);
    expect(logs[0].message).toBe('Log #550');
  });

  it('POST /logs creates a log entry', async () => {
    const res = await request(app)
      .post('/logs')
      .send({
        level: 'SUCCESS',
        source: 'EXTENSION_POPUP',
        tag: 'SETTINGS_SAVED',
        message: 'Settings saved successfully',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.log.message).toBe('Settings saved successfully');
  });

  it('GET /logs returns filtered logs', async () => {
    logger.addLog({ level: 'ERROR', source: 'LLM_GATEWAY', tag: 'ERR', message: 'Ollama down' });
    logger.addLog({ level: 'SUCCESS', source: 'BACKEND_API', tag: 'OK', message: 'Profile loaded' });

    const res = await request(app).get('/logs?level=ERROR');
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(1);
    expect(res.body.logs[0].message).toBe('Ollama down');
  });

  it('GET /logs-ui serves HTML dashboard', async () => {
    const res = await request(app).get('/logs-ui');
    expect(res.status).toBe(200);
    expect(res.text).toContain('AutoFiller — Activity & Debug Logs');
  });
});
