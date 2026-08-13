import { Router, Request, Response, NextFunction } from 'express';
import { HealthResponse, AutofillResponse } from '@autofiller/shared';
import { ProfileStore } from '../services/profileStore.js';
import { autofillRequestSchema } from '../types/profile.js';

export const apiRouter = Router();

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

apiRouter.post('/autofill', (req: Request, res: Response, next: NextFunction) => {
  try {
    autofillRequestSchema.parse(req.body);

    // Stub response for Phase 2 (LLM field mapping logic will be wired in Phase 4)
    const response: AutofillResponse = {
      status: 'success',
      mappings: {},
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});
