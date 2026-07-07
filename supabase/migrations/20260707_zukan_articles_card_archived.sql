alter table public.zukan_articles
  drop constraint if exists zukan_articles_article_type_check;

alter table public.zukan_articles
  add constraint zukan_articles_article_type_check
  check (article_type in ('pack_article', 'card_article', 'hall_of_fame_article'));

alter table public.zukan_articles
  drop constraint if exists zukan_articles_status_check;

alter table public.zukan_articles
  add constraint zukan_articles_status_check
  check (status in ('draft', 'published', 'archived'));

notify pgrst, 'reload schema';
