-- Allow multiple published zukan articles for the same target.
--
-- Previously, this partial unique index allowed only one published
-- zukan article per (article_type, target_id). That blocked article
-- expansion such as DM-01 overview + DM-01 fire feature + DM-01
-- water feature being public at the same time.
--
-- Keep zukan_articles_slug_idx intact, so article URLs still remain
-- unique. This migration only removes the one-published-per-target
-- limit and does not delete any article data.

drop index if exists public.zukan_articles_one_published_per_target_idx;

notify pgrst, 'reload schema';
