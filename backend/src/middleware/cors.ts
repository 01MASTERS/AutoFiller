import cors, { CorsOptions } from 'cors';

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) {
      return callback(null, true);
    }

    const isChromeExtension = origin.startsWith('chrome-extension://');
    const isLocalhost =
      origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');

    if (isChromeExtension || isLocalhost) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-api-key'],
  credentials: true,
};

export const corsMiddleware = cors(corsOptions);
