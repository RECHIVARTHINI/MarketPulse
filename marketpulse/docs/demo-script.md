# Demo Script (≈4 minutes)

Prerequisite: `docker compose up --build` from `docker/`, or backend +
frontend running locally per the README. `DEMO_MODE=true` (default).

## 1. First-time user (30s)
- Log in with a fresh email.
- Create a watchlist "Core Holdings" with `RELIANCE, TCS, INFY, HDFCBANK, ITC, TATAMOTORS`.
- Dashboard shows all six as "first time you're seeing this stock" — no
  errors, no last-seen data, because there genuinely isn't any yet.

## 2. Nothing meaningful changed (20s)
- Refresh the dashboard a second time without touching demo controls.
- All six symbols show Normal-tier, low scores. The dashboard explicitly
  states "Nothing meaningful changed" instead of showing a wall of flat
  numbers.

## 3. A large price move (45s)
- Open "⚙ Demo controls" → symbol `RELIANCE` → scenario `big_move` → Apply.
- Refresh. RELIANCE jumps to High/Important tier with a full explainable
  breakdown ("+X Price moved Y%. +Z Corporate event detected...").
- Point out: it's also flagged "Top of your watchlist today" — the
  cohort-relative ranking in action.

## 4. Large move + abnormal volume (30s)
- Demo controls → `TCS` → `big_move_high_volume` → Apply → refresh.
- TCS shows a large negative move with a 2.5–3.5x volume anomaly called out
  explicitly in the breakdown.

## 5. Provider failure & fallback to cache (45s)
- Demo controls → `INFY` → `api_failure` → Apply → refresh.
- INFY still renders (no broken card) using the last cached/persisted
  snapshot, tagged "Delayed" with the exact cached timestamp shown.
- This is the moment to say out loud: *"the app never fabricates live data
  — it tells you exactly how old what you're looking at is."*

## 6. Stale data discounting the score (30s)
- Demo controls → `ITC` → `stale` → Apply → refresh.
- Open ITC's detail view: note the explanation text — *"Discounted from a
  raw score of N because the underlying data is stale."* This is the
  confidence-adjusted scoring differentiator, visible live.

## 7. Since your last visit, again (30s)
- Refresh the dashboard once more without changing anything.
- Every symbol's "since your last visit" delta is now measured from the
  *previous* refresh, not from the original baseline — proving the
  last-seen pointer genuinely advances on every view.

## 8. Wrap-up talking points (30s)
- Every score is explainable — no black box.
- Every data-quality problem in the brief (stale, delayed, conflicting,
  provider-down, missing symbol) has a visible, demoable path.
- The whole scenario engine is deterministic (seeded, not random) — this
  demo will look identical every time you run it.
