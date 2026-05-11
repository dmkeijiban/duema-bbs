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

## Vercel Analytics / Speed Insights

Already installed in this project.

Confirmed files:

- `package.json`
  - `@vercel/analytics`
  - `@vercel/speed-insights`
- `src/app/layout.tsx`
  - `<Analytics />`
  - `<SpeedInsights />`

To see data, open the Vercel project dashboard and check:

- Analytics
- Speed Insights

No UI changes are needed inside the site.

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
