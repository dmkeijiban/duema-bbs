-- カテゴリを新仕様に更新するマイグレーション
-- Supabase SQL Editor で実行してください

-- Step 1: 既存スレッドのカテゴリを一旦NULLにする（外部キー制約回避）
UPDATE threads SET category_id = NULL;

-- Step 2: 既存カテゴリを全削除
DELETE FROM categories;

-- Step 3: 新カテゴリを挿入
INSERT INTO categories (name, slug, color, description, sort_order) VALUES
  ('新カード・カード評価', 'new-cards',     '#e74c3c', '新カードやカード評価',           1),
  ('デッキ関連',           'deck',          '#3498db', 'デッキ構築・相談',               2),
  ('CS大会・環境関係',     'tournament',    '#27ae60', 'CS大会・環境関係',               3),
  ('高騰・下落情報',       'price',         '#f39c12', 'カード価格情報',                 4),
  ('デュエプレ',           'duel-pro',      '#9b59b6', 'デュエル・マスターズ プレイス',  5),
  ('アニメ・漫画',         'anime',         '#e91e63', 'アニメ・漫画',                   6),
  ('デュエパ等の特殊ルール','special-rules', '#00bcd4', '特殊ルール全般',                 7),
  ('デュエマクラシック',   'classic',       '#795548', 'クラシック',                     8),
  ('雑談',                 'chat',          '#607d8b', '雑談',                           9);

-- Step 4: 既存スレッドを「雑談」カテゴリに割り当て
UPDATE threads SET category_id = (SELECT id FROM categories WHERE slug = 'chat');
