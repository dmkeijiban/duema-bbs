
ALTER TABLE zukan_card_ratings
  DROP CONSTRAINT IF EXISTS zukan_card_ratings_user_unique;

ALTER TABLE zukan_card_ratings
  ADD CONSTRAINT zukan_card_ratings_user_unique
  UNIQUE (card_id, user_id);

ALTER TABLE zukan_card_ratings
  ADD CONSTRAINT zukan_card_ratings_anon_unique
  UNIQUE (card_id, anon_key);
;
