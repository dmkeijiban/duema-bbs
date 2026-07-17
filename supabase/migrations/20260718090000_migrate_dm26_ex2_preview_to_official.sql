-- Generated from official DM26-EX2 cache and reviewed 149:149 match JSON.
-- Additive/rollback-friendly: printing/card UUIDs are preserved and old source keys remain resolvable.
begin;

alter table public.card_printings add column if not exists is_search_visible boolean not null default true;
alter table public.card_printings add column if not exists source_status text not null default 'official'
  check (source_status in ('preview','official','superseded'));

create table if not exists public.card_printing_source_aliases (
  old_source_key text primary key,
  printing_id uuid not null references public.card_printings(id) on delete restrict,
  official_source_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists card_printing_source_aliases_printing_idx on public.card_printing_source_aliases(printing_id);
alter table public.card_printing_source_aliases enable row level security;
comment on table public.card_printing_source_aliases is '保存済みデッキ等の旧収録版source_keyを正式収録版へ解決する';

create temporary table dm26_ex2_match(
  preview_source_key text primary key, official_source_key text unique not null, official_name text not null, official_normalized_name text not null,
  official_page_url text not null, image_url text not null, set_name text, card_number text
) on commit drop;
insert into dm26_ex2_match values
  ('DM26EX2-PREVIEW-001','dm26ex2-SPR001','瀑水神 ミヅハノオオミカミ','瀑水神ミヅハノオオミカミ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPR001','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPR001.jpg','DM26EX2 SPR1/SPR5','SPR1/SPR5'),
  ('DM26EX2-PREVIEW-002','dm26ex2-SPR002','世界竜皇 ボルシャック・ヒカリスマ','世界竜皇ボルシャック・ヒカリスマ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPR002','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPR002.jpg','DM26EX2 SPR2/SPR5','SPR2/SPR5'),
  ('DM26EX2-PREVIEW-003','dm26ex2-SPR003','邪眼魔凰デス・フェニックス','邪眼魔凰デス・フェニックス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPR003','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPR003.jpg','DM26EX2 SPR3/SPR5','SPR3/SPR5'),
  ('DM26EX2-PREVIEW-004','dm26ex2-SPR004','SSS級侵略 カリスマゾーン','SSS級侵略カリスマゾーン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPR004','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPR004.jpg','DM26EX2 SPR4/SPR5','SPR4/SPR5'),
  ('DM26EX2-PREVIEW-005','dm26ex2-SPR005','CRY-S-MAX ジャオウガ','CRY-S-MAXジャオウガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPR005','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPR005.jpg','DM26EX2 SPR5/SPR5','SPR5/SPR5'),
  ('DM26EX2-PREVIEW-006','dm26ex2-PR001','引き裂かれし永劫、エムラクール','引き裂かれし永劫、エムラクール','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR001','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR001.jpg','DM26EX2 PR1/PR10','PR1/PR10'),
  ('DM26EX2-PREVIEW-007','dm26ex2-PR002','龍頭星雲人 / 零誕祭','龍頭星雲人/零誕祭','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR002','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR002a.jpg','DM26EX2 PR2/PR10','PR2/PR10'),
  ('DM26EX2-PREVIEW-008','dm26ex2-PR003','超神星DOOM・ドラゲリオン','超神星DOOM・ドラゲリオン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR003','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR003.jpg','DM26EX2 PR3/PR10','PR3/PR10'),
  ('DM26EX2-PREVIEW-009','dm26ex2-PR004','アーテル・ゴルギーニ','アーテル・ゴルギーニ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR004','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR004.jpg','DM26EX2 PR4/PR10','PR4/PR10'),
  ('DM26EX2-PREVIEW-010','dm26ex2-PR005','轟䡛合体 ゴルギーオージャー','轟䡛合体ゴルギーオージャー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR005','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR005.jpg','DM26EX2 PR5/PR10','PR5/PR10'),
  ('DM26EX2-PREVIEW-011','dm26ex2-PR006','一音の妖精','一音の妖精','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR006','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR006.jpg','DM26EX2 PR6/PR10','PR6/PR10'),
  ('DM26EX2-PREVIEW-012','dm26ex2-PR007','ブレイン・スラッシュ','ブレイン・スラッシュ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR007','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR007.jpg','DM26EX2 PR7/PR10','PR7/PR10'),
  ('DM26EX2-PREVIEW-013','dm26ex2-PR008','百鬼の邪王門','百鬼の邪王門','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR008','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR008.jpg','DM26EX2 PR8/PR10','PR8/PR10'),
  ('DM26EX2-PREVIEW-014','dm26ex2-PR009','策士のシダン ニャハン','策士のシダンニャハン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR009','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR009.jpg','DM26EX2 PR9/PR10','PR9/PR10'),
  ('DM26EX2-PREVIEW-015','dm26ex2-PR010','豊潤フォージュン','豊潤フォージュン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR010','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR010.jpg','DM26EX2 PR10/PR10','PR10/PR10'),
  ('DM26EX2-PREVIEW-016','dm26ex2-PR001CHO','引き裂かれし永劫、エムラクール','引き裂かれし永劫、エムラクール','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR001CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR001CHO.jpg','DM26EX2 PR1超/PR10','PR1超/PR10'),
  ('DM26EX2-PREVIEW-017','dm26ex2-PR002CHO','龍頭星雲人 / 零誕祭','龍頭星雲人/零誕祭','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR002CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR002CHOa.jpg','DM26EX2 PR2超/PR10','PR2超/PR10'),
  ('DM26EX2-PREVIEW-018','dm26ex2-PR003CHO','超神星DOOM・ドラゲリオン','超神星DOOM・ドラゲリオン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR003CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR003CHO.jpg','DM26EX2 PR3超/PR10','PR3超/PR10'),
  ('DM26EX2-PREVIEW-019','dm26ex2-PR004CHO','アーテル・ゴルギーニ','アーテル・ゴルギーニ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR004CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR004CHO.jpg','DM26EX2 PR4超/PR10','PR4超/PR10'),
  ('DM26EX2-PREVIEW-020','dm26ex2-PR005CHO','轟䡛合体 ゴルギーオージャー','轟䡛合体ゴルギーオージャー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR005CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR005CHO.jpg','DM26EX2 PR5超/PR10','PR5超/PR10'),
  ('DM26EX2-PREVIEW-021','dm26ex2-PR006CHO','一音の妖精','一音の妖精','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR006CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR006CHO.jpg','DM26EX2 PR6超/PR10','PR6超/PR10'),
  ('DM26EX2-PREVIEW-022','dm26ex2-PR007CHO','ブレイン・スラッシュ','ブレイン・スラッシュ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR007CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR007CHO.jpg','DM26EX2 PR7超/PR10','PR7超/PR10'),
  ('DM26EX2-PREVIEW-023','dm26ex2-PR008CHO','百鬼の邪王門','百鬼の邪王門','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR008CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR008CHO.jpg','DM26EX2 PR8超/PR10','PR8超/PR10'),
  ('DM26EX2-PREVIEW-024','dm26ex2-PR009CHO','策士のシダン ニャハン','策士のシダンニャハン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR009CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR009CHO.jpg','DM26EX2 PR9超/PR10','PR9超/PR10'),
  ('DM26EX2-PREVIEW-025','dm26ex2-PR010CHO','豊潤フォージュン','豊潤フォージュン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-PR010CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-PR010CHO.jpg','DM26EX2 PR10超/PR10','PR10超/PR10'),
  ('DM26EX2-PREVIEW-026','dm26ex2-SPRSEC001CHO','瀑水神 ミヅハノオオミカミ','瀑水神ミヅハノオオミカミ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC001CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC001CHO.jpg','DM26EX2 SPR㊙1超/SPR㊙5','SPR㊙1超/SPR㊙5'),
  ('DM26EX2-PREVIEW-027','dm26ex2-SPRSEC002CHO','世界竜皇 ボルシャック・ヒカリスマ','世界竜皇ボルシャック・ヒカリスマ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC002CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC002CHO.jpg','DM26EX2 SPR㊙2超/SPR㊙5','SPR㊙2超/SPR㊙5'),
  ('DM26EX2-PREVIEW-028','dm26ex2-SPRSEC003CHO','邪眼魔凰デス・フェニックス','邪眼魔凰デス・フェニックス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC003CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC003CHO.jpg','DM26EX2 SPR㊙3超/SPR㊙5','SPR㊙3超/SPR㊙5'),
  ('DM26EX2-PREVIEW-029','dm26ex2-SPRSEC004CHO','SSS級侵略 カリスマゾーン','SSS級侵略カリスマゾーン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC004CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC004CHO.jpg','DM26EX2 SPR㊙4超/SPR㊙5','SPR㊙4超/SPR㊙5'),
  ('DM26EX2-PREVIEW-030','dm26ex2-SPRSEC005CHO','CRY-S-MAX ジャオウガ','CRY-S-MAXジャオウガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC005CHO','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC005CHO.jpg','DM26EX2 SPR㊙5超/SPR㊙5','SPR㊙5超/SPR㊙5'),
  ('DM26EX2-PREVIEW-031','dm26ex2-MC001','竜皇神 ボルシャック・バクテラス','竜皇神ボルシャック・バクテラス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC001','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC001.jpg','DM26EX2 MC1/30','MC1/30'),
  ('DM26EX2-PREVIEW-032','dm26ex2-MC002','CRYMAX ジャオウガ','CRYMAXジャオウガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC002','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC002.jpg','DM26EX2 MC2/30','MC2/30'),
  ('DM26EX2-PREVIEW-033','dm26ex2-MC003','伝説の正体 ギュウジン丸','伝説の正体ギュウジン丸','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC003','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC003.jpg','DM26EX2 MC3/30','MC3/30'),
  ('DM26EX2-PREVIEW-034','dm26ex2-MC004','絶望と反魂と滅殺の決断','絶望と反魂と滅殺の決断','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC004','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC004.jpg','DM26EX2 MC4/30','MC4/30'),
  ('DM26EX2-PREVIEW-035','dm26ex2-MC005','煉獄邪神M・R・C・ロマノフ','煉獄邪神M・R・C・ロマノフ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC005','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC005.jpg','DM26EX2 MC5/30','MC5/30'),
  ('DM26EX2-PREVIEW-036','dm26ex2-MC006','禁断の轟速 ブラックゾーン','禁断の轟速ブラックゾーン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC006','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC006.jpg','DM26EX2 MC6/30','MC6/30'),
  ('DM26EX2-PREVIEW-037','dm26ex2-MC007','天罪堕将 アルカクラウン','天罪堕将アルカクラウン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC007','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC007.jpg','DM26EX2 MC7/30','MC7/30'),
  ('DM26EX2-PREVIEW-038','dm26ex2-MC008','魔誕導師ブラックルシファー','魔誕導師ブラックルシファー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC008','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC008.jpg','DM26EX2 MC8/30','MC8/30'),
  ('DM26EX2-PREVIEW-039','dm26ex2-MC009','不敬合成王 ロマティックダム・アルキング','不敬合成王ロマティックダム・アルキング','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC009','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC009.jpg','DM26EX2 MC9/30','MC9/30'),
  ('DM26EX2-PREVIEW-040','dm26ex2-MC010','聖霊左神ジャスティス','聖霊左神ジャスティス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC010','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC010.jpg','DM26EX2 MC10/30','MC10/30'),
  ('DM26EX2-PREVIEW-041','dm26ex2-MC011','DG ～裁キノ刻～','DG~裁キノ刻~','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC011','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC011.jpg','DM26EX2 MC11/30','MC11/30'),
  ('DM26EX2-PREVIEW-042','dm26ex2-MC012','「ちくしょおおおおおおっー!!」','「ちくしょおおおおおおっー!!」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC012','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC012.jpg','DM26EX2 MC12/30','MC12/30'),
  ('DM26EX2-PREVIEW-043','dm26ex2-MC013','ヘブンズ・ゲート','ヘブンズ・ゲート','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC013','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC013.jpg','DM26EX2 MC13/30','MC13/30'),
  ('DM26EX2-PREVIEW-044','dm26ex2-MC014','ゴッド・ゲート','ゴッド・ゲート','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC014','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC014.jpg','DM26EX2 MC14/30','MC14/30'),
  ('DM26EX2-PREVIEW-045','dm26ex2-MC015','ゴッド・シグナル','ゴッド・シグナル','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC015','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC015.jpg','DM26EX2 MC15/30','MC15/30'),
  ('DM26EX2-PREVIEW-046','dm26ex2-MC016','邪妃左神 バンバーシュート','邪妃左神バンバーシュート','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC016','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC016.jpg','DM26EX2 MC16/30','MC16/30'),
  ('DM26EX2-PREVIEW-047','dm26ex2-MC017','堕∞魔 ヴォゲンム','堕∞魔ヴォゲンム','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC017','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC017.jpg','DM26EX2 MC17/30','MC17/30'),
  ('DM26EX2-PREVIEW-048','dm26ex2-MC018','ヴィオラの黒像','ヴィオラの黒像','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC018','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC018.jpg','DM26EX2 MC18/30','MC18/30'),
  ('DM26EX2-PREVIEW-049','dm26ex2-MC019','ロスト・Re:ソウル','ロスト・Re:ソウル','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC019','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC019.jpg','DM26EX2 MC19/30','MC19/30'),
  ('DM26EX2-PREVIEW-050','dm26ex2-MC020','ボルシャック・太陽・ルピア','ボルシャック・太陽・ルピア','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC020','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC020.jpg','DM26EX2 MC20/30','MC20/30'),
  ('DM26EX2-PREVIEW-051','dm26ex2-MC021','“必駆”蛮触礼亞','“必駆”蛮触礼亞','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC021','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC021.jpg','DM26EX2 MC21/30','MC21/30'),
  ('DM26EX2-PREVIEW-052','dm26ex2-MC022','ルシファー','ルシファー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC022','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC022.jpg','DM26EX2 MC22/30','MC22/30'),
  ('DM26EX2-PREVIEW-053','dm26ex2-MC023','ヨミとイズモの計画','ヨミとイズモの計画','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC023','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC023.jpg','DM26EX2 MC23/30','MC23/30'),
  ('DM26EX2-PREVIEW-054','dm26ex2-MC024','豪運の絆','豪運の絆','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC024','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC024.jpg','DM26EX2 MC24/30','MC24/30'),
  ('DM26EX2-PREVIEW-055','dm26ex2-MC025','鬼寄せの術','鬼寄せの術','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC025','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC025.jpg','DM26EX2 MC25/30','MC25/30'),
  ('DM26EX2-PREVIEW-056','dm26ex2-MC026','混沌の獅子デスライガー / カオス・チャージャー','混沌の獅子デスライガー/カオス・チャージャー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC026','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC026a.jpg','DM26EX2 MC26/30','MC26/30'),
  ('DM26EX2-PREVIEW-057','dm26ex2-MC027','極限右神ダフトパンク・アライブ','極限右神ダフトパンク・アライブ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC027','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC027.jpg','DM26EX2 MC27/30','MC27/30'),
  ('DM26EX2-PREVIEW-058','dm26ex2-MC028','ブラッディ・タイフーン','ブラッディ・タイフーン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC028','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC028.jpg','DM26EX2 MC28/30','MC28/30'),
  ('DM26EX2-PREVIEW-059','dm26ex2-MC029','サイバー・チューン','サイバー・チューン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC029','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC029.jpg','DM26EX2 MC29/30','MC29/30'),
  ('DM26EX2-PREVIEW-060','dm26ex2-MC030','虚ト成リシ古ノ蛇神ノ咆哮','虚ト成リシ古ノ蛇神ノ咆哮','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-MC030','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-MC030.jpg','DM26EX2 MC30/30','MC30/30'),
  ('DM26EX2-PREVIEW-061','dm26ex2-001','飛翔龍 5000VT','飛翔龍5000VT','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-001','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-001.jpg','DM26EX2 1/89','1/89'),
  ('DM26EX2-PREVIEW-062','dm26ex2-002','終来王鬼 ジャオウガ','終来王鬼ジャオウガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-002','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-002.jpg','DM26EX2 2/89','2/89'),
  ('DM26EX2-PREVIEW-063','dm26ex2-003','ボルシャック・アークゼオスNEX','ボルシャック・アークゼオスNEX','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-003','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-003.jpg','DM26EX2 3/89','3/89'),
  ('DM26EX2-PREVIEW-064','dm26ex2-004','水蜃 フカフチノカミ','水蜃フカフチノカミ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-004','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-004.jpg','DM26EX2 4/89','4/89'),
  ('DM26EX2-PREVIEW-065','dm26ex2-005','嵐神 ミヅハノクエビコ','嵐神ミヅハノクエビコ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-005','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-005.jpg','DM26EX2 5/89','5/89'),
  ('DM26EX2-PREVIEW-066','dm26ex2-006','邪眼破壊神R・R・R','邪眼破壊神R・R・R','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-006','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-006.jpg','DM26EX2 6/89','6/89'),
  ('DM26EX2-PREVIEW-067','dm26ex2-007','～墓碑に刻まれし魔弾の名～','~墓碑に刻まれし魔弾の名~','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-007','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-007.jpg','DM26EX2 7/89','7/89'),
  ('DM26EX2-PREVIEW-068','dm26ex2-008','夢の轟速 ザ・ランド','夢の轟速ザ・ランド','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-008','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-008.jpg','DM26EX2 8/89','8/89'),
  ('DM26EX2-PREVIEW-069','dm26ex2-009','魔誕の悪魔デスモナーク','魔誕の悪魔デスモナーク','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-009','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-009.jpg','DM26EX2 9/89','9/89'),
  ('DM26EX2-PREVIEW-070','dm26ex2-010','邪眼破壊神デスアポロヌス・ドラゲリオン','邪眼破壊神デスアポロヌス・ドラゲリオン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-010','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-010.jpg','DM26EX2 10/89','10/89'),
  ('DM26EX2-PREVIEW-071','dm26ex2-011','「涅槃」の鬼 ゲドウ大権現','「涅槃」の鬼ゲドウ大権現','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-011','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-011.jpg','DM26EX2 11/89','11/89'),
  ('DM26EX2-PREVIEW-072','dm26ex2-012','禁鬼機関 ジャオウガ-8','禁鬼機関ジャオウガ-8','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-012','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-012a.jpg','DM26EX2 12/89','12/89'),
  ('DM26EX2-PREVIEW-073','dm26ex2-013','ボルシャック・ゴルギーニ','ボルシャック・ゴルギーニ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-013','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-013.jpg','DM26EX2 13/89','13/89'),
  ('DM26EX2-PREVIEW-074','dm26ex2-014','ボルシャック・カクメイジン','ボルシャック・カクメイジン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-014','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-014.jpg','DM26EX2 14/89','14/89'),
  ('DM26EX2-PREVIEW-075','dm26ex2-015','S級原始 レッドマッド','S級原始レッドマッド','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-015','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-015.jpg','DM26EX2 15/89','15/89'),
  ('DM26EX2-PREVIEW-076','dm26ex2-016','鬼黒皇グレイテスト・ジャオウガ','鬼黒皇グレイテスト・ジャオウガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-016','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-016.jpg','DM26EX2 16/89','16/89'),
  ('DM26EX2-PREVIEW-077','dm26ex2-017','パルフェ・ルピア / 「あとはたのんだぞ」','パルフェ・ルピア/「あとはたのんだぞ」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-017','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-017a.jpg','DM26EX2 17/89','17/89'),
  ('DM26EX2-PREVIEW-078','dm26ex2-018','邪眼左神エンドレス','邪眼左神エンドレス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-018','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-018.jpg','DM26EX2 18/89','18/89'),
  ('DM26EX2-PREVIEW-079','dm26ex2-019','ワダエビノミコト','ワダエビノミコト','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-019','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-019.jpg','DM26EX2 19/89','19/89'),
  ('DM26EX2-PREVIEW-080','dm26ex2-020','轟速 ザ・ドック','轟速ザ・ドック','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-020','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-020.jpg','DM26EX2 20/89','20/89'),
  ('DM26EX2-PREVIEW-081','dm26ex2-021','怒像アゲ','怒像アゲ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-021','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-021.jpg','DM26EX2 21/89','21/89'),
  ('DM26EX2-PREVIEW-082','dm26ex2-022','邪眼龍神メタル・アポロヌス','邪眼龍神メタル・アポロヌス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-022','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-022.jpg','DM26EX2 22/89','22/89'),
  ('DM26EX2-PREVIEW-083','dm26ex2-023','ボルテール・ミラー・ドラゴン / ミラー・チャージャー','ボルテール・ミラー・ドラゴン/ミラー・チャージャー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-023','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-023a.jpg','DM26EX2 23/89','23/89'),
  ('DM26EX2-PREVIEW-084','dm26ex2-024','ボルシャック・ゴルファンタジスタ','ボルシャック・ゴルファンタジスタ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-024','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-024.jpg','DM26EX2 24/89','24/89'),
  ('DM26EX2-PREVIEW-085','dm26ex2-025','氷柱と炎弧の決断','氷柱と炎弧の決断','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-025','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-025.jpg','DM26EX2 25/89','25/89'),
  ('DM26EX2-PREVIEW-086','dm26ex2-026','「鬼情」の極 ジャオウグリラ / 「自由で欲望のままに生きるのだ！」','「鬼情」の極ジャオウグリラ/「自由で欲望のままに生きるのだ!」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-026','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-026a.jpg','DM26EX2 26/89','26/89'),
  ('DM26EX2-PREVIEW-087','dm26ex2-027','暗黒破壊神デス・フェニックス','暗黒破壊神デス・フェニックス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-027','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-027.jpg','DM26EX2 27/89','27/89'),
  ('DM26EX2-PREVIEW-088','dm26ex2-028','轟速 ザ・ロウィン','轟速ザ・ロウィン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-028','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-028.jpg','DM26EX2 28/89','28/89'),
  ('DM26EX2-PREVIEW-089','dm26ex2-029','ワダユメ＝縛＝ノミコト','ワダユメ=縛=ノミコト','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-029','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-029.jpg','DM26EX2 29/89','29/89'),
  ('DM26EX2-PREVIEW-090','dm26ex2-030','宿命の決闘','宿命の決闘','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-030','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-030.jpg','DM26EX2 30/89','30/89'),
  ('DM26EX2-PREVIEW-091','dm26ex2-031','覚悟の決闘','覚悟の決闘','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-031','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-031.jpg','DM26EX2 31/89','31/89'),
  ('DM26EX2-PREVIEW-092','dm26ex2-032','野望の決闘','野望の決闘','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-032','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-032.jpg','DM26EX2 32/89','32/89'),
  ('DM26EX2-PREVIEW-093','dm26ex2-033','覇道の決闘','覇道の決闘','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-033','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-033.jpg','DM26EX2 33/89','33/89'),
  ('DM26EX2-PREVIEW-094','dm26ex2-034','一王二命三眼槍の封','一王二命三眼槍の封','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-034','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-034.jpg','DM26EX2 34/89','34/89'),
  ('DM26EX2-PREVIEW-095','dm26ex2-035','孤高の決闘','孤高の決闘','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-035','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-035.jpg','DM26EX2 35/89','35/89'),
  ('DM26EX2-PREVIEW-096','dm26ex2-036','ポッピ・冠・ラッキー','ポッピ・冠・ラッキー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-036','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-036.jpg','DM26EX2 36/89','36/89'),
  ('DM26EX2-PREVIEW-097','dm26ex2-037','ドラゴンズ・サイン','ドラゴンズ・サイン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-037','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-037.jpg','DM26EX2 37/89','37/89'),
  ('DM26EX2-PREVIEW-098','dm26ex2-038','シンクロ・ルピア / 「D4に敗北は許されない！」','シンクロ・ルピア/「D4に敗北は許されない!」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-038','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-038a.jpg','DM26EX2 38/89','38/89'),
  ('DM26EX2-PREVIEW-099','dm26ex2-039','同期の妖精 / ド浮きの動悸','同期の妖精/ド浮きの動悸','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-039','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-039a.jpg','DM26EX2 39/89','39/89'),
  ('DM26EX2-PREVIEW-100','dm26ex2-040','ワダカニノミコト','ワダカニノミコト','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-040','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-040.jpg','DM26EX2 40/89','40/89'),
  ('DM26EX2-PREVIEW-101','dm26ex2-041','極限龍神ヘヴィ','極限龍神ヘヴィ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-041','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-041.jpg','DM26EX2 41/89','41/89'),
  ('DM26EX2-PREVIEW-102','dm26ex2-042','カンゴク入道の巻','カンゴク入道の巻','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-042','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-042.jpg','DM26EX2 42/89','42/89'),
  ('DM26EX2-PREVIEW-103','dm26ex2-043','プライマル・サーガ','プライマル・サーガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-043','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-043.jpg','DM26EX2 43/89','43/89'),
  ('DM26EX2-PREVIEW-104','dm26ex2-044','轟速 ザ・リフル','轟速ザ・リフル','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-044','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-044.jpg','DM26EX2 44/89','44/89'),
  ('DM26EX2-PREVIEW-105','dm26ex2-045','「オレたちのZEROの世界を造るまで」','「オレたちのZEROの世界を造るまで」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-045','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-045.jpg','DM26EX2 45/89','45/89'),
  ('DM26EX2-PREVIEW-106','dm26ex2-046','断罪のロスト・サイン','断罪のロスト・サイン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-046','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-046.jpg','DM26EX2 46/89','46/89'),
  ('DM26EX2-PREVIEW-107','dm26ex2-047','希望の太陽 マイハマタワー','希望の太陽マイハマタワー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-047','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-047.jpg','DM26EX2 47/89','47/89'),
  ('DM26EX2-PREVIEW-108','dm26ex2-048','一王伝双三眼槍','一王伝双三眼槍','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-048','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-048.jpg','DM26EX2 48/89','48/89'),
  ('DM26EX2-PREVIEW-109','dm26ex2-049','邪眼神オール','邪眼神オール','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-049','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-049.jpg','DM26EX2 49/89','49/89'),
  ('DM26EX2-PREVIEW-110','dm26ex2-050','ドンドン火噴くナウ','ドンドン火噴くナウ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-050','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-050.jpg','DM26EX2 50/89','50/89'),
  ('DM26EX2-PREVIEW-111','dm26ex2-051','鬼核アトム・ジャオウガ','鬼核アトム・ジャオウガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-051','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-051a.jpg','DM26EX2 51/89','51/89'),
  ('DM26EX2-PREVIEW-112','dm26ex2-052','カイザー・ルピア','カイザー・ルピア','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-052','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-052.jpg','DM26EX2 52/89','52/89'),
  ('DM26EX2-PREVIEW-113','dm26ex2-053','邪眼右神デリート','邪眼右神デリート','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-053','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-053.jpg','DM26EX2 53/89','53/89'),
  ('DM26EX2-PREVIEW-114','dm26ex2-054','ワダシストノミコト','ワダシストノミコト','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-054','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-054.jpg','DM26EX2 54/89','54/89'),
  ('DM26EX2-PREVIEW-115','dm26ex2-055','異端流し オニカマス','異端流しオニカマス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-055','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-055.jpg','DM26EX2 55/89','55/89'),
  ('DM26EX2-PREVIEW-116','dm26ex2-056','飛ベル津バサ「曲通風」','飛ベル津バサ「曲通風」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-056','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-056.jpg','DM26EX2 56/89','56/89'),
  ('DM26EX2-PREVIEW-117','dm26ex2-057','プロジェクト・ゴッド','プロジェクト・ゴッド','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-057','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-057.jpg','DM26EX2 57/89','57/89'),
  ('DM26EX2-PREVIEW-118','dm26ex2-058','邪眼龍神ヘヴィ・アポロヌス','邪眼龍神ヘヴィ・アポロヌス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-058','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-058.jpg','DM26EX2 58/89','58/89'),
  ('DM26EX2-PREVIEW-119','dm26ex2-059','レーホウ・衛・デカッチ / 「暴竜爵様のお出ましだッチ！」','レーホウ・衛・デカッチ/「暴竜爵様のお出ましだッチ!」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-059','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-059a.jpg','DM26EX2 59/89','59/89'),
  ('DM26EX2-PREVIEW-120','dm26ex2-060','轟速 ザ・ダラー / 「イグニッション！ソニックドロォォォ!!」','轟速ザ・ダラー/「イグニッション!ソニックドロォォォ!!」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-060','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-060a.jpg','DM26EX2 60/89','60/89'),
  ('DM26EX2-PREVIEW-121','dm26ex2-061','悪霊鬼王ジャオディオス','悪霊鬼王ジャオディオス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-061','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-061.jpg','DM26EX2 61/89','61/89'),
  ('DM26EX2-PREVIEW-122','dm26ex2-062','極限龍神メタル','極限龍神メタル','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-062','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-062.jpg','DM26EX2 62/89','62/89'),
  ('DM26EX2-PREVIEW-123','dm26ex2-063','シブキ将鬼の巻','シブキ将鬼の巻','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-063','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-063.jpg','DM26EX2 63/89','63/89'),
  ('DM26EX2-PREVIEW-124','dm26ex2-064','Dの侵略 クリム・ゾーン','Dの侵略クリム・ゾーン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-064','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-064.jpg','DM26EX2 64/89','64/89'),
  ('DM26EX2-PREVIEW-125','dm26ex2-065','バクロ法師の封','バクロ法師の封','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-065','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-065.jpg','DM26EX2 65/89','65/89'),
  ('DM26EX2-PREVIEW-126','dm26ex2-066','エボリューション・エッグ','エボリューション・エッグ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-066','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-066.jpg','DM26EX2 66/89','66/89'),
  ('DM26EX2-PREVIEW-127','dm26ex2-067','ボルシャック・マントラ','ボルシャック・マントラ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-067','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-067a.jpg','DM26EX2 67/89','67/89'),
  ('DM26EX2-PREVIEW-128','dm26ex2-068','ワダウザノミコト','ワダウザノミコト','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-068','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-068.jpg','DM26EX2 68/89','68/89'),
  ('DM26EX2-PREVIEW-129','dm26ex2-069','超轟速 レッドランチャー','超轟速レッドランチャー','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-069','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-069.jpg','DM26EX2 69/89','69/89'),
  ('DM26EX2-PREVIEW-130','dm26ex2-070','ロジック・サークル','ロジック・サークル','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-070','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-070.jpg','DM26EX2 70/89','70/89'),
  ('DM26EX2-PREVIEW-131','dm26ex2-071','氷牙レオポル・ディーネ公 / エマージェンシー・タイフーン','氷牙レオポル・ディーネ公/エマージェンシー・タイフーン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-071','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-071a.jpg','DM26EX2 71/89','71/89'),
  ('DM26EX2-PREVIEW-132','dm26ex2-072','水面護り ハコフ / 蓄積された魔力の縛り','水面護りハコフ/蓄積された魔力の縛り','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-072','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-072a.jpg','DM26EX2 72/89','72/89'),
  ('DM26EX2-PREVIEW-133','dm26ex2-073','ワダフミノミコト','ワダフミノミコト','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-073','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-073.jpg','DM26EX2 73/89','73/89'),
  ('DM26EX2-PREVIEW-134','dm26ex2-074','ワダチエノミコト','ワダチエノミコト','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-074','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-074.jpg','DM26EX2 74/89','74/89'),
  ('DM26EX2-PREVIEW-135','dm26ex2-075','ワダゲコノミコト','ワダゲコノミコト','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-075','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-075.jpg','DM26EX2 75/89','75/89'),
  ('DM26EX2-PREVIEW-136','dm26ex2-076','魔光蟲ヴィルジニア卿','魔光蟲ヴィルジニア卿','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-076','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-076.jpg','DM26EX2 76/89','76/89'),
  ('DM26EX2-PREVIEW-137','dm26ex2-077','邪眼右神C・ロマノフ','邪眼右神C・ロマノフ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-077','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-077.jpg','DM26EX2 77/89','77/89'),
  ('DM26EX2-PREVIEW-138','dm26ex2-078','鬼火の守護者ジャオウガ・メルキス','鬼火の守護者ジャオウガ・メルキス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-078','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-078.jpg','DM26EX2 78/89','78/89'),
  ('DM26EX2-PREVIEW-139','dm26ex2-079','オンソク童子','オンソク童子','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-079','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-079.jpg','DM26EX2 79/89','79/89'),
  ('DM26EX2-PREVIEW-140','dm26ex2-080','鶏と蛙 ケローラ&ルピア','鶏と蛙ケローラ&ルピア','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-080','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-080a.jpg','DM26EX2 80/89','80/89'),
  ('DM26EX2-PREVIEW-141','dm26ex2-081','邪眼左神M・ロマノフ','邪眼左神M・ロマノフ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-081','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-081.jpg','DM26EX2 81/89','81/89'),
  ('DM26EX2-PREVIEW-142','dm26ex2-082','轟速 ザ・ジオ / 「キサマのデュエマは周回遅れだ！」','轟速ザ・ジオ/「キサマのデュエマは周回遅れだ!」','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-082','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-082a.jpg','DM26EX2 82/89','82/89'),
  ('DM26EX2-PREVIEW-143','dm26ex2-083','鬼覇 ザ=デッドジャオウガ','鬼覇ザ=デッドジャオウガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-083','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-083a.jpg','DM26EX2 83/89','83/89'),
  ('DM26EX2-PREVIEW-144','dm26ex2-084','樹界の守護車 アイオン・ユピテル','樹界の守護車アイオン・ユピテル','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-084','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-084.jpg','DM26EX2 84/89','84/89'),
  ('DM26EX2-PREVIEW-145','dm26ex2-085','ジャスミンの地版','ジャスミンの地版','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-085','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-085.jpg','DM26EX2 85/89','85/89'),
  ('DM26EX2-PREVIEW-146','dm26ex2-086','ヘルコプ太の心絵','ヘルコプ太の心絵','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-086','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-086.jpg','DM26EX2 86/89','86/89'),
  ('DM26EX2-PREVIEW-147','dm26ex2-087','マントラ・ルピア','マントラ・ルピア','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-087','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-087.jpg','DM26EX2 87/89','87/89'),
  ('DM26EX2-PREVIEW-148','dm26ex2-088','チャラ・ルピア','チャラ・ルピア','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-088','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-088.jpg','DM26EX2 88/89','88/89'),
  ('DM26EX2-PREVIEW-149','dm26ex2-089','轟速 ザ・トリング','轟速ザ・トリング','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-089','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-089.jpg','DM26EX2 89/89','89/89');

do $$ begin
  if (select count(*) from dm26_ex2_match) <> 149 then raise exception 'DM26-EX2 match count mismatch'; end if;
  if exists(select 1 from dm26_ex2_match m where (select count(*) from public.card_printings p where p.source_key in (m.preview_source_key,m.official_source_key)) <> 1) then raise exception 'DM26-EX2 source identity is not exactly one row'; end if;
end $$;

insert into public.card_printing_source_aliases(old_source_key,printing_id,official_source_key)
select m.preview_source_key,p.id,m.official_source_key from dm26_ex2_match m join public.card_printings p on p.source_key in (m.preview_source_key,m.official_source_key)
on conflict(old_source_key) do update set printing_id=excluded.printing_id,official_source_key=excluded.official_source_key;

do $$ begin
  if exists(
    select 1 from (
      select distinct p.card_id,m.official_normalized_name
      from dm26_ex2_match m join public.card_printings p on p.source_key in (m.preview_source_key,m.official_source_key)
    ) x join public.cards other on other.normalized_name=x.official_normalized_name and other.id<>x.card_id
  ) then raise exception 'DM26-EX2 normalized_name collision'; end if;
end $$;

with official_cards as (
  select distinct on (p.card_id) p.card_id,m.official_name,m.official_normalized_name
  from dm26_ex2_match m join public.card_printings p on p.source_key in (m.preview_source_key,m.official_source_key)
  order by p.card_id,m.official_source_key
)
update public.cards c set name=x.official_name,normalized_name=x.official_normalized_name
from official_cards x where c.id=x.card_id and (c.name is distinct from x.official_name or c.normalized_name is distinct from x.official_normalized_name);

update public.card_printings p set
  source_key=m.official_source_key, official_page_url=m.official_page_url, image_url=m.image_url,
  set_name=m.set_name, card_number=m.card_number, is_search_visible=true, source_status='official', updated_at=now()
from dm26_ex2_match m where p.source_key=m.preview_source_key;

create temporary table dm26_ex2_official_only(
  source_key text primary key, official_name text not null, normalized_name text not null, official_page_url text not null,
  image_url text not null, set_name text, card_number text
) on commit drop;
insert into dm26_ex2_official_only values
  ('dm26ex2-SPRSEC001','瀑水神 ミヅハノオオミカミ','瀑水神ミヅハノオオミカミ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC001','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC001.jpg','DM26EX2 SPR㊙1/SPR㊙5','SPR㊙1/SPR㊙5'),
  ('dm26ex2-SPRSEC002','世界竜皇 ボルシャック・ヒカリスマ','世界竜皇ボルシャック・ヒカリスマ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC002','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC002.jpg','DM26EX2 SPR㊙2/SPR㊙5','SPR㊙2/SPR㊙5'),
  ('dm26ex2-SPRSEC003','邪眼魔凰デス・フェニックス','邪眼魔凰デス・フェニックス','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC003','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC003.jpg','DM26EX2 SPR㊙3/SPR㊙5','SPR㊙3/SPR㊙5'),
  ('dm26ex2-SPRSEC004','SSS級侵略 カリスマゾーン','SSS級侵略カリスマゾーン','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC004','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC004.jpg','DM26EX2 SPR㊙4/SPR㊙5','SPR㊙4/SPR㊙5'),
  ('dm26ex2-SPRSEC005','CRY-S-MAX ジャオウガ','CRY-S-MAXジャオウガ','https://dm.takaratomy.co.jp/card/detail/?id=dm26ex2-SPRSEC005','https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex2-SPRSEC005.jpg','DM26EX2 SPR㊙5/SPR㊙5','SPR㊙5/SPR㊙5');

insert into public.card_printings(card_id,source_key,official_page_url,image_url,set_name,card_number,is_representative,is_search_visible,source_status)
select c.id,x.source_key,x.official_page_url,x.image_url,x.set_name,x.card_number,false,true,'official'
from dm26_ex2_official_only x
join public.cards c on c.normalized_name = x.normalized_name
on conflict(source_key) do update set official_page_url=excluded.official_page_url,image_url=excluded.image_url,set_name=excluded.set_name,card_number=excluded.card_number,is_search_visible=true,source_status='official',updated_at=now();

do $$ begin
  if (select count(*) from public.card_printings where source_key like 'DM26EX2-PREVIEW-%') <> 0 then raise exception 'preview keys remain'; end if;
  if (select count(*) from public.card_printings where source_key like 'dm26ex2-%') <> 154 then raise exception 'official printing count mismatch'; end if;
  if (select count(*) from public.card_printing_source_aliases where old_source_key like 'DM26EX2-PREVIEW-%') <> 149 then raise exception 'alias count mismatch'; end if;
end $$;

commit;
