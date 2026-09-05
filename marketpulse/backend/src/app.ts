import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '256kb' }));
  app.use(morgan(process.env.NODE_ENV === 'test' ? 'silent' : 'tiny'));
  app.use(generalLimiter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'MarketPulse API',
      status: 'online',
      version: '1.0.0',
      description: 'Cognitive Attention Engine API for Smart Market Watchlists (Code by Groww 2026)',
      endpoints: {
        health: '/api/health',
        watchlists: '/api/watchlists',
        demoScenarios: '/api/market/demo/scenarios',
      },
    });
  });

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
