-- X自動運用システム v2: post_type / status の値セット更新
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて実行
-- 前提: 20260514_x_posts.sql が適用済みであること

-- ============================================================
-- post_type CHECK 制約を更新
-- ============================================================
ALTER TABLE x_posts DROP CONSTRAINT IF EXISTS x_posts_post_type_check;
ALTER TABLE x_posts ADD CONSTRAINT x_posts_post_type_check
  CHECK (post_type IN (
    'win',        -- 優勝🏆
    'roujinkai',  -- デュエマ老人会
    'iwakan',     -- デュエマ違和感
    'silhouette', -- シルエット選手権
    'kurekore',   -- 黒歴史デュエマ
    'giron',      -- デュエマ物議
    'share',      -- 掲示板共有
    'custom'      -- カスタム（汎用）
  ));

-- ============================================================
-- status CHECK 制約を更新
-- ============================================================
ALTER TABLE x_posts DROP CONSTRAINT IF EXISTS x_posts_status_check;
ALTER TABLE x_posts ADD CONSTRAINT x_posts_status_check
  CHECK (status IN (
    'draft',             -- 下書き（Typefully未送信）
    'typefully_drafted', -- Typefully下書き作成済み
    'scheduled',         -- Typefullyスケジュール予約済み
    'posted',            -- 投稿済み
    'error'              -- エラー
  ));
