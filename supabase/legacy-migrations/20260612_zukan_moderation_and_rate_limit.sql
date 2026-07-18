-- Zukan moderation/rate-limit extension.
-- Non-destructive: no data deletion, no table drops, no Storage/image changes.

alter table zukan_pack_reviews
  add column if not exists anon_key text;

alter table zukan_card_reviews
  add column if not exists anon_key text;

alter table zukan_card_ratings
  add column if not exists display_name text not null default '匿名',
  add column if not exists is_hidden boolean not null default false;

create index if not exists zukan_pack_reviews_anon_recent_idx
  on zukan_pack_reviews(anon_key, created_at desc);

create index if not exists zukan_card_reviews_anon_recent_idx
  on zukan_card_reviews(anon_key, created_at desc);

create index if not exists zukan_pack_reviews_user_recent_idx
  on zukan_pack_reviews(user_id, created_at desc);

create index if not exists zukan_card_reviews_user_recent_idx
  on zukan_card_reviews(user_id, created_at desc);

drop policy if exists "card_ratings select" on zukan_card_ratings;
create policy "card_ratings select" on zukan_card_ratings
  for select using (is_deleted = false and is_hidden = false);
