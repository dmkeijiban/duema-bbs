# n8n workflows

This folder contains backup and draft-oriented n8n workflows for Duema BBS.

## Current policy

- Cloudflare Worker remains the primary scheduler.
- n8n is a visual backup and draft automation layer.
- Do not use n8n for public posting without human approval.
- Do not commit secrets into workflow JSON files.

## Imported workflows

### Duema BBS - YouTube notification backup

Source file: `youtube-check.workflow.json`

Purpose:

- Calls `https://www.duema-bbs.com/api/youtube/check`
- Runs every 5 minutes if activated
- Uses `Authorization: Bearer {{$env.CRON_SECRET}}`

Use this only after `CRON_SECRET` is configured in n8n.

### Duema BBS - Daily summary generation

Source file: `summary-cron.workflow.json`

Purpose:

- Calls `https://www.duema-bbs.com/api/summary/cron`
- Runs daily at 01:10 if activated
- Uses `Authorization: Bearer {{$env.CRON_SECRET}}`

Use this as a backup or draft generator. Review generated summaries before treating them as public content.

## Activation checklist

1. Confirm Cloudflare Worker is healthy.
2. Confirm Vercel `CRON_SECRET` is set.
3. Set the same `CRON_SECRET` in n8n environment variables.
4. Test each workflow manually once.
5. Check execution logs.
6. Activate only the workflow that is needed as backup.

## Do not automate yet

- Posting to X
- Posting to Discord as a marketing message
- Mass notifications
- Paid or account-level actions

