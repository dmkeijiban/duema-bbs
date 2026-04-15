-- レス削除時にpost_countを正確な値に再計算するRPC
create or replace function recalculate_post_count(p_thread_id bigint)
returns void language plpgsql security definer as $$
begin
  update threads
  set post_count = (select count(*) from posts where thread_id = p_thread_id)
  where id = p_thread_id;
end;
$$;
