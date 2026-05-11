---
name: duema-bbs-ops
description: Operate, debug, and improve the duema-bbs Next.js/Supabase/Vercel project safely. Use when working on the Duema BBS codebase, admin tools, Discord/YouTube automation, Supabase data flow, Vercel deployment, GitHub commits, Obsidian work logs, or when the user asks to fix site behavior without breaking existing operations.
---

# Duema BBS Ops

Use this skill as the operating manual for the Duema BBS project.

## Core Rules

- Preserve user-facing design unless the user explicitly asks for UI changes.
- Prefer small, reversible changes over broad refactors.
- Never commit secrets, cookies, auth tokens, `.env.local`, or X/Apify/Discord credentials.
- Treat `notes/` as local Codex logs. Do not commit it unless the user explicitly asks.
- Write an Obsidian work log after each completed task:
  `C:\Users\light\Desktop\test\AI-work-log\Codex`
  If the real Japanese Obsidian path exists in the workspace context, use that path instead.
- Work with existing user, Claude Code, or other agent changes. Do not revert unrelated changes.
- Use Japanese in user-facing explanations unless the user asks otherwise.

## Project Shape

- App: Next.js App Router.
- Database/storage: Supabase.
- Hosting: Vercel.
- Main repo: `dmkeijiban/duema-bbs`.
- Production URL: `https://www.duema-bbs.com`.
- Important environment variables include:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_PASSWORD`
  - `CRON_SECRET`
  - `DISCORD_WEBHOOK_URL`
  - `YOUTUBE_WEBHOOK_URL`
  - `NEXT_PUBLIC_SITE_URL=https://www.duema-bbs.com`

## Safe Workflow

1. Inspect the relevant files with `rg` and targeted reads.
2. Explain the intended edit briefly before changing files.
3. Keep edits scoped to the requested behavior.
4. Validate with at least `npx.cmd tsc --noEmit`.
5. Run `npm.cmd run lint` or `npm.cmd run build` when risk is medium or high.
6. Add an Obsidian log file for completed work.
7. Commit and push only the implementation files, not local notes.

## Common Areas

- Public top page: `src/app/page.tsx`
- Thread detail: `src/app/thread/[id]/page.tsx`
- Thread data/cache helpers: `src/lib/cached-queries.ts`
- Admin page: `src/app/admin/page.tsx`
- Summary pages: `src/app/summary`
- Summary generation: `src/app/api/summary`
- YouTube/Discord notification: `src/app/api/youtube`, `src/lib/youtube-notifier.ts`
- OGP/X card logic: thread metadata and `src/app/og/thread/[id]/route.ts`

## Operational Preferences

- Admin tools should be useful and uncluttered. Remove unused internal tools when requested.
- Automation should default to review-before-posting unless the user explicitly asks for full auto-post.
- For Vercel cron, consider plan limits. Avoid high-frequency cron unless the user confirms the plan supports it or uses an external scheduler.
- For Supabase writes from cron/admin APIs, prefer `createAdminClient()` when RLS or anon policies may block reliable server-side operation.
- Revalidate affected pages or tags after writes.

## When Unsure

- If a change could affect production data, authentication, payments, or mass posting, ask before executing.
- If a feature output is low quality, remove or downgrade it quickly rather than leaving clutter.
- If another AI touched the same files, read the current file state and adapt instead of assuming previous context.
