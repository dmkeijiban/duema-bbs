# 2026-05-13 Summary cron secret fix

## Issue

The weekly summary for `2026-05-04` to `2026-05-10` was missing from `/summary`.

## Findings

- `/summary` was healthy and returned 200.
- Cloudflare Worker `/health` returned 200.
- Vercel `/api/summary/cron` worked when called with the production `CRON_SECRET`.
- Cloudflare Worker `/run/summary` returned 401 when called with the Vercel production `CRON_SECRET`.

## Cause

Cloudflare Worker `CRON_SECRET` did not match the Vercel production `CRON_SECRET`, so scheduled summary generation was likely failing authorization before reaching the Vercel cron route.

## Fix

- Manually ran Vercel `/api/summary/cron` with the production `CRON_SECRET`.
- Generated:
  - `weekly-2026-05-04`
  - `monthly-2026-04`
- Updated Cloudflare Worker secret `CRON_SECRET` to match Vercel production.
- Re-tested Cloudflare Worker `/run/summary`.

## Verification

- `/summary` now contains `weekly-2026-05-04`.
- Cloudflare Worker `/run/summary` now returns 200.
- Result after fix:
  - weekly: skipped existing `weekly-2026-05-04`
  - monthly: skipped existing `monthly-2026-04`

## Next

Check after the next scheduled run that `weekly-2026-05-11` appears automatically.

