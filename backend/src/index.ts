import express from 'express';
import { HealthResponse } from '@autofiller/shared';

export const app = express();
const PORT = process.env.PORT || 3456;

app.get('/health', (req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`AutoFiller backend running on port ${PORT}`);
  });
}
