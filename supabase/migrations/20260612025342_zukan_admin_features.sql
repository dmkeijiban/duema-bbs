-- Admin notes per post (荒らし/重複/不適切/テスト投稿 etc.) - admin only
CREATE TABLE IF NOT EXISTS zukan_admin_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_type text NOT NULL CHECK (post_type IN ('pack_review', 'card_review', 'rating')),
  post_id bigint NOT NULL,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zukan_admin_notes_post_idx
  ON zukan_admin_notes (post_type, post_id);

-- Card memos: admin-entered short description shown on card detail page
CREATE TABLE IF NOT EXISTS zukan_card_memos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES zukan_cards(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 200),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zukan_card_memos_card_idx
  ON zukan_card_memos (card_id);

-- Manually linked related threads per card
CREATE TABLE IF NOT EXISTS zukan_related_threads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES zukan_cards(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zukan_related_threads_card_thread_idx
  ON zukan_related_threads (card_id, thread_id);

-- RLS
ALTER TABLE zukan_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE zukan_card_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE zukan_related_threads ENABLE ROW LEVEL SECURITY;

-- admin_notes: no public access (service role bypasses RLS)
CREATE POLICY "zukan_admin_notes_no_public_select"
  ON zukan_admin_notes FOR SELECT USING (false);

-- card_memos: public can read non-empty memos
CREATE POLICY "zukan_card_memos_public_select"
  ON zukan_card_memos FOR SELECT USING (body <> '');

-- related_threads: public can read
CREATE POLICY "zukan_related_threads_public_select"
  ON zukan_related_threads FOR SELECT USING (true);;
