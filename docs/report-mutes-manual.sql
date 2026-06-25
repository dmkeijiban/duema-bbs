-- 通報受付停止を手動で入れる場合のSQL例
-- /admin/reports で対象の user_id または session_id を確認してから、どちらか片方だけ入れてください。

-- ログインユーザーを止める場合
insert into report_mutes (user_id, session_id, reason, is_active)
values ('ここにuser_id', null, '不要な通報の連投', true);

-- 非ログイン端末を止める場合
insert into report_mutes (user_id, session_id, reason, is_active)
values (null, 'ここにsession_id', '不要な通報の連投', true);

-- 解除する場合
update report_mutes
set is_active = false, revoked_at = now()
where id = ここにID;
