-- 閲覧数インクリメントRPCをSECURITY DEFINERに変更
-- 理由: threadsテーブルにUPDATEポリシーがなくRLSでブロックされていたため
create or replace function increment_view_count(thread_id bigint)
returns void as $$
  update threads set view_count = view_count + 1 where id = thread_id;
$$ language sql security definer;
