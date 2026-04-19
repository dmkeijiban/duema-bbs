-- カテゴリ追加: ルール・裁定関連、管理者連絡
-- sort_order は既存カテゴリの末尾に追加（必要に応じて値を調整してください）
INSERT INTO categories (name, slug, color, sort_order)
VALUES
  ('ルール・裁定関連', 'rules', '#6c757d', 90),
  ('管理者連絡',       'admin-contact', '#dc3545', 100)
ON CONFLICT (slug) DO NOTHING;
