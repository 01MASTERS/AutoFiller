import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import { apiRouter } from './routes/api.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();
const PORT = process.env.PORT || 3456;

app.use(corsMiddleware);
app.use(express.json());

app.use('/', apiRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`AutoFiller backend running on port ${PORT}`);
  });
}
