# Product Decisions

This document exists because the brief explicitly says: *"be ready to
explain why."* Every non-obvious call made while building MarketPulse is
recorded here.

## 1. "Meaningful" is defined per-watchlist, not globally

A fixed "+3% is meaningful" rule is either too sensitive for volatile
small-caps or too blunt for stable blue-chips. We rank each stock's raw
score against the other stocks currently in the *same* watchlist
(percentile-in-cohort), so the bar adapts to what's normal for that user's
own portfolio. See `meaningful-change-engine.md`.

## 2. Freshness is a multiplier on the score, not a separate banner

Treating "is this data trustworthy" and "how important is this change" as
two unrelated UI elements lets a big number look urgent even when it
shouldn't be trusted. We fold freshness into the score itself as a
confidence multiplier, and say so in the explanation text.

## 3. "Since your last visit" means literally that

We track a per-(user, watchlist, symbol) `LastSeenSnapshot`, not "since
yesterday's close." A user who checks the dashboard three times in one
afternoon should see three genuinely different, small diffs — not the same
full-day summary three times. Viewing the dashboard (unless
`?commit=false` is passed) advances the last-seen pointer to "now," which
is what makes repeated visits produce fresh, non-repeating diffs.

## 4. An Attention Budget, not an infinite feed

Surfacing "everything that changed, sorted by score" is not a product
decision — it's the absence of one. MarketPulse caps what's presented as
worth looking at (`DEFAULT_ATTENTION_BUDGET`, default 5) and is explicit
about what was considered and found unremarkable. This is a genuine bet
that reducing what a user must read is more valuable than displaying more
data, and it's why the dashboard headline is a count of "unchanged," not
just a list of everything.

## 5. Minimal, honest auth

The brief lists authentication as "if needed" and explicitly warns against
overbuilding. We implemented a demo auth (find-or-create by email) that
preserves the *shape* of real authorization — every watchlist operation is
scoped to a `userId` and cannot leak across users — while avoiding a
JWT/OAuth stack that would not move the needle on the criteria actually
being judged (engineering depth of the change-detection problem, not of
login).

## 6. Mongo over a relational database

`MarketSnapshot` and `MarketEvent` are naturally append-only, schema-light
time-series documents with no need for cross-collection joins in the hot
path. Mongoose gave us that shape directly; a relational schema would have
added normalization overhead for no query benefit here.

## 7. Redis with an automatic in-memory fallback

Redis is a cache, not a system of record, and a hackathon demo should never
fail because a judge didn't spin up Redis. `cacheService` detects an
unreachable Redis instance and transparently serves the same interface out
of an in-process Map, at the cost of that cache not being shared across
multiple backend instances — an acceptable trade-off for a single-instance
submission, called out explicitly as a scaling consideration.

## 8. Deterministic mock data, not random

The mock provider uses a seeded PRNG keyed by symbol name, not
`Math.random()`, so every demo run (and every test run) produces the same
numbers unless a scenario is explicitly set. Reproducibility mattered more
than "realistic-looking" noise for a system whose entire value proposition
is trustworthy numbers.
