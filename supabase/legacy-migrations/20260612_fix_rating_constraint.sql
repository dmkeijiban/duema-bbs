-- Fix: replace NULLS NOT DISTINCT unique constraint with separate constraints
-- that work correctly for both logged-in and anonymous users.
-- The old constraint treated multiple NULL user_ids as equal, blocking all
-- second-and-later anonymous ratings on the same card.

-- Drop the problematic constraint
ALTER TABLE zukan_card_ratings
  DROP CONSTRAINT IF EXISTS zukan_card_ratings_user_unique;

-- Logged-in users: 1 rating per card (standard UNIQUE ignores NULLs)
ALTER TABLE zukan_card_ratings
  ADD CONSTRAINT zukan_card_ratings_user_unique
  UNIQUE (card_id, user_id);

-- Anonymous users: 1 rating per (card, anon_key)
ALTER TABLE zukan_card_ratings
  ADD CONSTRAINT zukan_card_ratings_anon_unique
  UNIQUE (card_id, anon_key);
