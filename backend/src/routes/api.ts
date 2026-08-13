import { Router, Request, Response, NextFunction } from 'express';
import { HealthResponse, AutofillResponse } from '@autofiller/shared';
import { ProfileStore } from '../services/profileStore.js';
import { autofillRequestSchema } from '../types/profile.js';
import { LLMGateway } from '../services/llm/gateway.js';
import { LLMProviderError, LLMParseError } from '../services/llm/types.js';
import { ZodError } from 'zod';

export const apiRouter = Router();
let llmGatewayInstance = new LLMGateway();

export function setLLMGateway(gateway: LLMGateway): void {
  llmGatewayInstance = gateway;
}

apiRouter.get('/health', (req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

apiRouter.get('/profile', (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = ProfileStore.getProfile();
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/autofill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = autofillRequestSchema.parse(req.body);
    const profile = ProfileStore.getProfile();

    const provider = body.provider || 'ollama';
    const apiKey = (req.headers['x-gemini-api-key'] as string) || body.apiKey;
    const model = body.model;

    const mappings = await llmGatewayInstance.mapFields(
      provider,
      body.fields,
      profile,
      { apiKey, model }
    );

    const response: AutofillResponse = {
      status: 'success',
      mappings,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      next(error);
      return;
    }

    if (error instanceof LLMProviderError || error instanceof LLMParseError) {
      const response: AutofillResponse = {
        status: 'error',
        mappings: {},
        error: error.message,
      };
      res.status(502).json(response);
      return;
    }

    next(error);
  }
});

apiRouter.get('/test-form', (req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Google Form QA Test Fixture — AutoFiller</title>
  <style>
    body { font-family: sans-serif; background: #f1f5f9; padding: 30px; max-width: 600px; margin: auto; }
    .form-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    h1 { color: #1e293b; font-size: 20px; margin-bottom: 20px; }
    .item { margin-bottom: 20px; }
    .heading { font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #334155; }
    input, textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    .required-star { color: #ef4444; }
  </style>
</head>
<body>
  <div class="form-card">
    <h1>AutoFiller Test Form (Google Form Fixture)</h1>
    <form>
      <div role="listitem" class="item">
        <div role="heading" class="heading">Full Name <span class="required-star">*</span></div>
        <input type="text" name="entry.101" aria-label="Full Name" required placeholder="Enter your full name" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Email Address <span class="required-star">*</span></div>
        <input type="email" name="entry.102" aria-label="Email Address" required placeholder="name@example.com" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Phone Number</div>
        <input type="tel" name="entry.103" aria-label="Phone Number" placeholder="(555) 000-0000" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Short Bio</div>
        <textarea name="entry.104" aria-label="Short Bio" placeholder="Tell us about yourself..."></textarea>
      </div>
    </form>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
