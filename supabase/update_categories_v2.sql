-- カテゴリ名変更・追加・全スレ雑談に移動
-- Supabase SQL Editor で実行してください

-- Step 1: 全スレッドを雑談カテゴリに移す
UPDATE threads SET category_id = (SELECT id FROM categories WHERE slug = 'chat' LIMIT 1);

-- Step 2: カテゴリ名変更
UPDATE categories SET name = '新カード・新商品情報' WHERE slug = 'new-cards';
UPDATE categories SET name = 'デッキ相談・コンボ等' WHERE slug = 'deck';
UPDATE categories SET name = '思い出・昔話・過去商品' WHERE slug = 'classic';

-- Step 3: デュエチューバーを追加（重複防止）
INSERT INTO categories (name, slug, color, description, sort_order)
SELECT 'デュエチューバー', 'youtuber', '#e67e22', 'デュエマYouTuber関連', 8
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'youtuber');

-- Step 4: sort_order を整理（雑談を一番下に）
UPDATE categories SET sort_order = 1  WHERE slug = 'new-cards';
UPDATE categories SET sort_order = 2  WHERE slug = 'deck';
UPDATE categories SET sort_order = 3  WHERE slug = 'tournament';
UPDATE categories SET sort_order = 4  WHERE slug = 'price';
UPDATE categories SET sort_order = 5  WHERE slug = 'duel-pro';
UPDATE categories SET sort_order = 6  WHERE slug = 'youtuber';
UPDATE categories SET sort_order = 7  WHERE slug = 'anime';
UPDATE categories SET sort_order = 8  WHERE slug = 'special-rules';
UPDATE categories SET sort_order = 9  WHERE slug = 'classic';
UPDATE categories SET sort_order = 10 WHERE slug = 'chat';
