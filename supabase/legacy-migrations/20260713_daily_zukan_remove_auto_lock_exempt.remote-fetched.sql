-- 0時に自動生成される思い出図鑑スレを通常の自動ロック対象へ戻す。
update public.threads
set auto_lock_exempt = false
where auto_lock_exempt = true
  and id in (
    select thread_id
    from public.daily_zukan_thread_logs
    where thread_id is not null
  );;
