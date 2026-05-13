# 2026-05-13 Tooling integrations

## Added

- Added project-scoped Supabase MCP config:
  - server name: `supabase-readonly`
  - project ref: `nodgfukqvuwvgfnlzvnh`
  - mode: read-only
  - features: database, docs, debugging
- Added PostHog base script behind environment variables:
  - `NEXT_PUBLIC_POSTHOG_KEY`
  - `NEXT_PUBLIC_POSTHOG_HOST`

## Sentry status

- `@sentry/nextjs` is already installed.
- Sentry config files already exist.
- Production DSN variables are present.
- `SENTRY_ORG` and `SENTRY_PROJECT` are not set, so source map upload/release linkage still needs setup.
- `SENTRY_AUTH_TOKEN` was not usable from the pulled production env; verify in the Sentry dashboard before relying on source maps.

## Remaining manual steps

- Authenticate `supabase-readonly` through Claude Code MCP OAuth.
- Create or open a PostHog project and add the public key/host to Vercel env when ready.
- Add `SENTRY_ORG`, `SENTRY_PROJECT`, and a valid `SENTRY_AUTH_TOKEN` in Vercel if source maps are needed.

