begin;

alter table public.deck_submissions add column if not exists key_card_id uuid references public.cards(id) on delete restrict;
alter table public.deck_submissions add column if not exists key_card_printing_id uuid references public.card_printings(id) on delete restrict;
alter table public.deck_submissions add column if not exists view_count bigint not null default 0 check (view_count >= 0);
alter table public.deck_submissions add column if not exists copy_count bigint not null default 0 check (copy_count >= 0);

update public.deck_submissions submission set
  key_card_id = (submission.deck_data -> 0 ->> 'id')::uuid,
  key_card_printing_id = nullif(submission.deck_data -> 0 ->> 'printingId', '')::uuid
where submission.key_card_id is null
  and jsonb_array_length(submission.deck_data) > 0;

create index if not exists deck_submissions_key_card_idx on public.deck_submissions(key_card_id);

create or replace function public.increment_deck_submission_metric(target_id uuid, metric_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if metric_name = 'view' then
    update public.deck_submissions set view_count = view_count + 1 where id = target_id and is_public = true;
  elsif metric_name = 'copy' then
    update public.deck_submissions set copy_count = copy_count + 1 where id = target_id and is_public = true;
  else
    raise exception 'unsupported metric';
  end if;
end;
$$;

revoke all on function public.increment_deck_submission_metric(uuid, text) from public, anon, authenticated;
grant execute on function public.increment_deck_submission_metric(uuid, text) to service_role;

commit;
