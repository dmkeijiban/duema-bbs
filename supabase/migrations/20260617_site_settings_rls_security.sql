-- site_settings RLS security fix.
-- Non-destructive: no data deletion, no table drops, no row updates.
--
-- Before: "site_settings_all" allows FOR ALL (SELECT/INSERT/UPDATE/DELETE) to everyone.
-- After:  anon/authenticated can only SELECT; writes require service_role (admin Server Actions).

-- Drop the permissive catch-all policy
DROP POLICY IF EXISTS "site_settings_all" ON site_settings;

-- Allow public read (needed for top page banner, terms, thread rules, etc.)
CREATE POLICY "site_settings_select_public"
  ON site_settings
  FOR SELECT
  USING (true);

-- Explicitly deny INSERT/UPDATE/DELETE for anon and authenticated roles.
-- service_role bypasses RLS entirely, so admin Server Actions (createAdminClient) continue to work.
