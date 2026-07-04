# Automation Services

This project uses Vercel as the main host. External automation services are optional backups or workflow builders.

## Cloudflare Workers

Use Cloudflare Workers as an external scheduler for important jobs.

Included Worker:

- `cloudflare/duema-cron-worker`

Main purpose:

- Call `/api/youtube/check` every 5 minutes so Discord receives notifications soon after YouTube videos become public.
- Call `/api/summary/cron` daily as a backup for summary generation.
- Renew YouTube PubSub subscription daily through `/api/youtube/subscribe`.

Required secret:

- `CRON_SECRET`: same value as Vercel.

Do not put the secret in GitHub. Use `wrangler secret put CRON_SECRET`.

## Analytics / Performance Monitoring

Current runtime monitoring is centered on:

- Google Analytics 4
- Microsoft Clarity
- PostHog

Vercel Analytics / Speed Insights were previously disabled to reduce runtime events and cost. Do not assume they are active just because package dependencies may still exist.

Current rule:

- `src/app/layout.tsx` should not mount `<Analytics />` or `<SpeedInsights />` unless a separate PR explicitly reintroduces them.
- Do not remove `@vercel/analytics` or `@vercel/speed-insights` from package files in a docs-only or UI-copy PR.
- Reintroducing Vercel Analytics / Speed Insights requires a separate review of runtime cost, observability volume, and overlap with GA4 / Clarity / PostHog.

## n8n

n8n is useful when a workflow becomes too annoying to maintain only in code.

Good first use cases:

- YouTube publish check backup.
- Daily summary generation backup.
- Future flow: video published -> make forum thread draft -> send Discord notice -> prepare X post draft.

Included importable workflow templates:

- `automation/n8n/youtube-check.workflow.json`
- `automation/n8n/summary-cron.workflow.json`

These workflows expect `CRON_SECRET` to be available in n8n as an environment variable. Do not paste secrets into workflow JSON that will be committed to GitHub.
