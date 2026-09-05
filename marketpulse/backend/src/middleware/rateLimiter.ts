import rateLimit from 'express-rate-limit';

// Coarse, sensible-default limiter. The brief calls for "rate limiting
// where appropriate" - this protects the mock/real market-data endpoints
// from being hammered by an accidental polling loop on the frontend.
export const marketDataLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests - slow down.' } },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
