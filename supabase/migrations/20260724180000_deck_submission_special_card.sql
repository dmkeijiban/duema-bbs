begin;

-- The advance-format special slot (「なし／ドルマゲドン／零龍」相当のラジオ択一) is a
-- single deck-level pick, not a cards-array entry: it has no quantity, is mutually
-- exclusive by construction (one column, one value), and must not gain "component
-- cards" auto-added alongside it. A dedicated nullable column captures exactly
-- that — distinct from deck_data's cards array, which only ever holds main/gr/
-- hyperspatial entries going forward.
alter table public.deck_submissions
  add column if not exists special_card_id uuid references public.cards(id) on delete set null;

comment on column public.deck_submissions.special_card_id is
  'アドバンス特殊枠（なし/ドルマゲドン相当/零龍相当）の単一カードID。cards.deck_zone_class = ''special'' のカードのみ設定可能。cards配列とは独立。';

commit;
