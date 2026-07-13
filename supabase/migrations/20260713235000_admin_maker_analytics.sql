-- 管理画面の企画横断分析用。
-- slugを列挙せず、maker_projectsに追加された企画を自動で対象にする。
create index if not exists maker_events_created_project_type_idx
  on public.maker_events(created_at,project_id,event_type);
create index if not exists maker_submissions_updated_project_valid_idx
  on public.maker_submissions(updated_at,project_id) where is_valid;

create or replace function public.admin_maker_project_stats(p_period_start timestamptz default null)
returns table(project_id uuid,slug text,title text,project_type text,status text,is_public boolean,
  page_views bigint,today_page_views bigint,unique_visitors bigint,registrants bigint,submission_count bigint,
  tier_created bigint,image_saved bigint,x_shared bigint,aggregate_viewed bigint,signup_completed bigint)
language sql security definer set search_path=public as $$
  with event_stats as (
    select e.project_id,
      count(*) filter(where e.event_type='page_viewed') page_views,
      count(*) filter(where e.event_type='page_viewed' and e.created_at>=date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo') today_page_views,
      count(distinct coalesce(e.user_id::text,e.anonymous_id)) filter(where e.event_type='page_viewed') unique_visitors,
      count(*) filter(where e.event_type='tier_created') tier_created,
      count(*) filter(where e.event_type='image_saved') image_saved,
      count(*) filter(where e.event_type='x_shared') x_shared,
      count(*) filter(where e.event_type='aggregate_viewed') aggregate_viewed,
      count(*) filter(where e.event_type='signup_completed') signup_completed
    from public.maker_events e where p_period_start is null or e.created_at>=p_period_start group by e.project_id
  ), submission_stats as (
    select s.project_id,count(distinct s.user_id) registrants,count(*) submission_count
    from public.maker_submissions s where s.is_valid and (p_period_start is null or s.updated_at>=p_period_start) group by s.project_id
  )
  select p.id,p.slug,p.title,p.type,p.status,p.is_public,
    coalesce(e.page_views,0),coalesce(e.today_page_views,0),coalesce(e.unique_visitors,0),coalesce(s.registrants,0),coalesce(s.submission_count,0),
    coalesce(e.tier_created,0),coalesce(e.image_saved,0),coalesce(e.x_shared,0),coalesce(e.aggregate_viewed,0),coalesce(e.signup_completed,0)
  from public.maker_projects p left join event_stats e on e.project_id=p.id left join submission_stats s on s.project_id=p.id order by p.created_at
$$;
revoke all on function public.admin_maker_project_stats(timestamptz) from public,anon,authenticated;
grant execute on function public.admin_maker_project_stats(timestamptz) to service_role;
