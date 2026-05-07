-- summaries.type に 'manual' を追加
ALTER TABLE summaries DROP CONSTRAINT IF EXISTS summaries_type_check;
ALTER TABLE summaries ADD CONSTRAINT summaries_type_check
  CHECK (type IN ('weekly', 'monthly', 'manual'));
