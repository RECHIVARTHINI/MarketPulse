import { config } from '../config';
import { MarketDataProvider } from './MarketDataProvider';
import { mockMarketDataProvider } from './MockMarketDataProvider';
import { realMarketDataProvider } from './RealMarketDataProvider';

// Single switch point for the whole application. Everything else imports
// getMarketDataProvider() and never touches Mock/Real classes directly.
export function getMarketDataProvider(): MarketDataProvider {
  return config.marketProvider === 'real' ? realMarketDataProvider : mockMarketDataProvider;
}
