-- X自動運用システム v3: post_type に 'kouton'（高騰下落情報）を追加
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて実行
-- 前提: 20260514_x_posts_v2.sql が適用済みであること

-- ============================================================
-- post_type CHECK 制約を更新（kouton を追加）
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
    'kouton',     -- 高騰下落情報
    'custom'      -- カスタム（汎用）
  ));
