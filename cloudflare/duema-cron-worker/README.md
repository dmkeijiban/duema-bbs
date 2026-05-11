# Duema Cron Worker

Cloudflare Workers Cron Triggers backup for Duema BBS automation.

This Worker calls existing Vercel API routes with `CRON_SECRET`.

## Jobs

- `*/5 * * * *`: `/api/youtube/check`
- `5 16 * * *`: `/api/summary/cron` at 01:05 JST
- `15 0 * * *`: `/api/youtube/subscribe`

## Setup

Install Wrangler if needed:

```powershell
npm.cmd install -g wrangler
```

Login:

```powershell
wrangler login
```

Set the same secret as Vercel `CRON_SECRET`:

```powershell
Set-Location cloudflare\duema-cron-worker
wrangler secret put CRON_SECRET
```

Deploy:

```powershell
wrangler deploy
```

## Manual Checks

Health check:

```powershell
Invoke-WebRequest https://duema-cron-worker.<your-subdomain>.workers.dev/health -UseBasicParsing
```

Manual YouTube check:

```powershell
Invoke-WebRequest https://duema-cron-worker.<your-subdomain>.workers.dev/run/youtube-check -Headers @{Authorization="Bearer <CRON_SECRET>"} -UseBasicParsing
```

Do not commit real secrets.
