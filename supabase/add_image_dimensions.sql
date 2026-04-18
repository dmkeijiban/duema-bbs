-- 画像の幅・高さをDBに保存するためのカラム追加
-- Supabase SQL Editor で実行してください

ALTER TABLE threads ADD COLUMN IF NOT EXISTS image_width integer;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS image_height integer;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_width integer;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_height integer;
