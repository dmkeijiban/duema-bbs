-- maker共通基盤を再利用する「殿堂解除選手権」。本番未適用。
insert into public.maker_projects(slug,title,type,status,is_public,config)
values ('hall-of-fame-release','殿堂解除選手権','prediction','published',true,'{"groups":[{"key":"release","label":"殿堂解除予想","color":"border-orange-300 bg-orange-50 text-orange-900"}],"unrated":true,"allowDuplicates":false,"ordered":true,"overwrite":true,"maxChoices":null}'::jsonb)
on conflict(slug) do update set config=excluded.config,updated_at=now();

insert into public.maker_project_cards(project_id,card_id,sort_order)
select p.id,c.id,row_number() over(order by c.source_key)::int
from public.maker_projects p
cross join public.cards c
where p.slug='hall-of-fame-release' and c.source_kind='takaratomy_card_id' and c.is_active
  and c.regulation in ('hall','premium_hall')
on conflict(project_id,card_id) do nothing;

do $$ begin
  if (select count(*) from public.maker_project_cards pc join public.maker_projects p on p.id=pc.project_id where p.slug='hall-of-fame-release') <> 128 then
    raise exception 'HALL_RELEASE_PROJECT_POOL_NOT_128';
  end if;
end $$;

create or replace view public.maker_selection_aggregates as
select p.id project_id,c.id card_id,count(distinct i.submission_id)::int selection_count,
  count(distinct s.id)::int submission_count,
  case when count(distinct s.id)=0 then 0
  else round(count(distinct i.submission_id)::numeric/count(distinct s.id)*100,1) end selection_rate
from public.maker_projects p
join public.maker_project_cards pc on pc.project_id=p.id
join public.cards c on c.id=pc.card_id
left join public.maker_submissions s on s.project_id=p.id and s.is_valid
left join public.maker_submission_items i on i.submission_id=s.id and i.card_id=c.id and i.group_key='release'
group by p.id,c.id;
revoke all on public.maker_selection_aggregates from anon,authenticated;
