-- スレッドのレス数・最終投稿日時を更新するRPC関数
-- security definer でRLSを回避して確実に更新します
-- Supabase SQL Editor で実行してください

create or replace function increment_post_count(p_thread_id bigint)
returns void language plpgsql security definer as $$
begin
  update threads
  set
    post_count     = post_count + 1,
    last_posted_at = now()
  where id = p_thread_id;
end;
$$;
