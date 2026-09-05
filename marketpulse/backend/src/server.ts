import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';

async function main() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('mongo.connected', { uri: config.mongoUri.replace(/\/\/.*@/, '//***@') });
  } catch (err) {
    logger.error('mongo.connection_failed', { error: (err as Error).message });
    logger.error('mongo.startup_aborted', {
      hint: 'MarketPulse requires MongoDB for watchlists/snapshots. Start it locally or via docker/docker-compose.yml.',
    });
    process.exit(1);
  }

  const app = createApp();
  app.listen(config.port, () => {
    logger.info('server.started', { port: config.port, provider: config.marketProvider, demoMode: config.demoMode });
  });
}

main();
