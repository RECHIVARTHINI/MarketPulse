# The Meaningful-Change Engine

## Goal

Turn raw market noise into a small number of *explainable, prioritized*
signals a user should actually look at — never a black box, never a
prediction, never buy/sell advice.

## Inputs per symbol, per evaluation

| Signal | Source | Formula |
|---|---|---|
| Price movement | `MarketSnapshot.price` vs `previousClose` | `(price - previousClose) / previousClose * 100` |
| Relative performance | Stock % change vs `benchmarkChangePercent` | `stockPercent - benchmarkPercent` |
| Volume anomaly | `volume` vs `averageVolume` | `volume / averageVolume` (flagged anomalous at ≥1.8x) |
| Volatility | Intraday range vs previous close | `(dayHigh - dayLow) / previousClose * 100` |
| Corporate event | `MarketEvent` in the recent window | boolean + headline |
| Recency | Age of the observation | decays from full points (≤1h) to zero (>24h) |

## Scoring

Each signal maps to a 0..max point band (see `SCORE_WEIGHTS` in
`backend/src/config/weights.config.ts`) via linear interpolation up to a
saturation point (e.g. price movement saturates at 10%, volume at 4x
average) — moves beyond that don't earn extra points, they're already
"High Attention."

```
rawScore = pricePoints + relativePoints + volumePoints
         + volatilityPoints + eventPoints + recencyPoints   (0-100)

score = round(rawScore × freshnessConfidence)
```//

`freshnessConfidence` is `1.0` for FRESH data, `0.6` for STALE, `0` for
UNAVAILABLE (an unavailable quote never reaches the scorer in practice —
handled upstream in `snapshotService`).

## Tiers

```
0–20   Normal
21–50  Mild
51–75  Important
76–100 High Attention
```

## Cohort-relative ranking (the differentiator)

After every symbol in a watchlist is scored, `detectMeaningfulChanges()`
additionally computes each symbol's **percentile within that watchlist,
right now** — not against history, against its current peers. A stock
sitting at score 40 might be the single most notable thing in a sleepy
watchlist (100th percentile) or the least notable thing in a volatile one
(0th percentile). Watchlists smaller than
`MIN_COHORT_SIZE_FOR_RELATIVE_RANKING` (4) skip percentile ranking — with
that few data points a percentile would imply false precision, so the UI
falls back to the absolute tier only.

## Worked example

RELIANCE moves from ₹1400 to ₹1470 (+5.0%) on 2.7x average volume, 15
minutes after an earnings release, while the NIFTY was flat (+0.1%), and
the data is FRESH:

```
Price movement:     +30  (5.0% ≥ saturation, full points)
Relative perf:       +12  (outperformed benchmark by 4.9%)
Volume anomaly:      +11  (2.7x → (2.7-1)/3 × 20 ≈ 11)
Volatility:            +6  (intraday range ~4.8% of prev close)
Corporate event:     +15  (earnings release detected)
Recency:              +10  (< 1 hour old)
──────────────────────────
Raw score:            84
× confidence (FRESH = 1.0)
──────────────────────────
Attention Score:       84  →  "High Attention"
```

If the same numbers arrived on data that's 12 minutes old (STALE):
`score = round(84 × 0.6) = 50` → "Mild", with an explicit note that it was
discounted from a raw 84 because the data is stale. Same signals, honestly
different confidence.

## What this engine deliberately does NOT do

- Predict future price direction.
- Issue buy/sell/hold recommendations.
- Use an opaque ML model where a linear, auditable formula suffices.
- Treat "no signal" as an error state — it is reported as "Normal / nothing
  meaningful changed," which is itself useful information.
