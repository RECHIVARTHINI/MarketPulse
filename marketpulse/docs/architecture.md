# Architecture

## Layering

```
routes/        → thin, declare paths + middleware only
controllers/    → orchestrate one request: parse input, call services, shape response
services/       → domain logic (changeEngine is pure; snapshotService/freshnessService/cacheService have I/O)
providers/      → market data abstraction (Mock / Real), swappable via config
models/         → Mongoose schemas + indexes
config/         → env + tunable weights/thresholds, single source of truth
```

Controllers never talk to Mongoose models for market data directly — they
go through `snapshotService`, which is the only place that knows about
providers, caching, and freshness. This is what let us write 33 unit tests
against `changeEngine.ts` with zero database or network mocking: the
scoring math has no I/O to fake.

## Request flow: GET /api/watchlists/:id/changes

1. Authorize: confirm the watchlist belongs to `req.userId`.
2. For each symbol: `resolveQuote()` (provider → cache → DB → explicit
   unavailable, in that fallback order), fetch its `LastSeenSnapshot`,
   fetch any `MarketEvent`s.
3. Compute `priceChange`, `volumeAnomaly`, `volatility`,
   `calculateAttentionScore()` (freshness-discounted), and
   `compareWithLastSeenSnapshot()`.
4. Once every symbol in the watchlist is scored, run
   `detectMeaningfulChanges()` across the whole cohort to attach a
   percentile rank.
5. Sort by score, tag the top `DEFAULT_ATTENTION_BUDGET` as
   `withinAttentionBudget`.
6. Unless `?commit=false`, upsert each symbol's `LastSeenSnapshot` to *now*
   so the next visit's diff starts from this moment.

## Scalability

**100K users:** the expensive part of this system is provider calls, not
database reads. Because quotes are cached **per-symbol** (`quote:<provider>:<symbol>`,
30s TTL) rather than per-user, 100K users all watching the NIFTY 50 costs
the same number of upstream calls as one user watching it — cache hit rate
scales with symbol overlap, which in practice is high (most retail
watchlists cluster around the same large-caps).

**1M users / larger watchlists:** the two hot query patterns —
`(userId, watchlistId, symbol)` for last-seen lookups and `(symbol,
observedAt)` for latest-snapshot lookups — are both covered by compound
indexes today. The next lever, not yet needed at this scale, is a
scheduled background job that refreshes popular symbols on a fixed
cadence (rather than on-demand per request) and pure cache reads serve the
dashboard — turning the read path from "N provider calls" into "1 cache
read," independent of user count.

**High market-data traffic:** `MAX_SYMBOLS_PER_WATCHLIST = 50` bounds
worst-case fan-out per request; the provider abstraction means a future
real integration can batch `getQuote` calls for multiple symbols without
any controller/service code changing.

**What we deliberately did NOT build:** a message queue, a
microservice split, or Kubernetes manifests. At this scale and for this
brief, they would add operational surface area without solving a real
bottleneck — the brief explicitly warns against this, and every one of the
scaling levers above is a config/index/caching change, not an
architecture rewrite.

## Concurrency & idempotency

- `LastSeenSnapshot` is unique-indexed on `(userId, watchlistId, symbol)`
  and written via `findOneAndUpdate(..., { upsert: true })` — two devices
  viewing the same watchlist seconds apart simply overwrite the same row;
  there is no duplicate-row race to reason about.
- `Watchlist` names are unique-indexed per user; a duplicate-name create
  returns a clean `409 DUPLICATE_WATCHLIST_NAME` instead of a raw Mongo
  error leaking through.
- `MarketSnapshot` writes are append-only inserts — concurrent quote
  fetches for the same symbol simply produce two valid historical rows;
  reads always take the most recent by `observedAt`.
