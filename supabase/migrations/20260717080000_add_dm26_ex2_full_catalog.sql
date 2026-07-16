-- DM26-EX2 悪感謝祭 カリスマBESTの公式先行公開149画像をカードカタログへ追加する。
-- カード名134種と収録版149種を冪等登録し、既存の手動値は上書きしない。
create temporary table dm26_ex2_catalog_seed (
  source_key text primary key,
  name text not null,
  normalized_name text not null,
  image_url text not null,
  card_number text,
  civilization text,
  cost integer,
  card_type text
) on commit drop;

insert into dm26_ex2_catalog_seed
  (source_key, name, normalized_name, image_url, card_number, civilization, cost, card_type)
values
  ('DM26EX2-PREVIEW-001', '瀑水神 ミヅハノオオミカミ', '瀑水神ミヅハノオオミカミ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/001.jpg', 'SPR1/SPR5', null, null, null),
  ('DM26EX2-PREVIEW-002', '世界竜皇 ボルシャック・ヒカリスマ', '世界竜皇ボルシャック・ヒカリスマ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/002.jpg', 'SPR2/SPR5', null, null, null),
  ('DM26EX2-PREVIEW-003', '邪眼魔凰デス・フェニックス', '邪眼魔凰デス・フェニックス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/003.jpg', 'SPR3/SPR5', null, null, null),
  ('DM26EX2-PREVIEW-004', 'SSS級侵略 カリスマゾーン', 'SSS級侵略カリスマゾーン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/004.jpg', 'SPR4/SPR5', null, null, null),
  ('DM26EX2-PREVIEW-005', 'CRY-S-MAX ジャオウガ', 'CRY-S-MAXジャオウガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/005.jpg', 'SPR5/SPR5', null, null, null),
  ('DM26EX2-PREVIEW-006', '引き裂かれし永劫、エムラクール', '引き裂かれし永劫、エムラクール', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/006.jpg', 'PR1/PR10', null, null, null),
  ('DM26EX2-PREVIEW-007', '龍頭星雲人／零誕祭', '龍頭星雲人/零誕祭', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/007.jpg', 'PR2/PR10', null, null, 'ツインパクト'),
  ('DM26EX2-PREVIEW-008', '超神星DOOM・ドラゲリオン', '超神星DOOM・ドラゲリオン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/008.jpg', 'PR3/PR10', null, null, null),
  ('DM26EX2-PREVIEW-009', 'アーテル・ゴルギーニ', 'アーテル・ゴルギーニ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/009.jpg', 'PR4/PR10', null, null, null),
  ('DM26EX2-PREVIEW-010', '轟轟合体 ゴルギーオージャー', '轟轟合体ゴルギーオージャー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/010.jpg', 'PR5/PR10', null, null, null),
  ('DM26EX2-PREVIEW-011', '一音の妖精', '一音の妖精', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/011.jpg', 'PR6/PR10', null, null, null),
  ('DM26EX2-PREVIEW-012', 'ブレイン・スラッシュ', 'ブレイン・スラッシュ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/012.jpg', 'PR7/PR10', null, null, null),
  ('DM26EX2-PREVIEW-013', '百鬼の邪王門', '百鬼の邪王門', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/013.jpg', 'PR8/PR10', null, null, null),
  ('DM26EX2-PREVIEW-014', '策士のシダン ニャハン', '策士のシダンニャハン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/014.jpg', 'PR9/PR10', null, null, null),
  ('DM26EX2-PREVIEW-015', '豊潤フォージュン', '豊潤フォージュン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/015.jpg', 'PR10/PR10', null, null, null),
  ('DM26EX2-PREVIEW-016', '引き裂かれし永劫、エムラクール', '引き裂かれし永劫、エムラクール', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/016.jpg', 'PR1超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-017', '龍頭星雲人／零誕祭', '龍頭星雲人/零誕祭', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/017.jpg', 'PR2超/PR10', null, null, 'ツインパクト'),
  ('DM26EX2-PREVIEW-018', '超神星DOOM・ドラゲリオン', '超神星DOOM・ドラゲリオン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/018.jpg', 'PR3超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-019', 'アーテル・ゴルギーニ', 'アーテル・ゴルギーニ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/019.jpg', 'PR4超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-020', '轟轟合体 ゴルギーオージャー', '轟轟合体ゴルギーオージャー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/020.jpg', 'PR5超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-021', '一音の妖精', '一音の妖精', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/021.jpg', 'PR6超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-022', 'ブレイン・スラッシュ', 'ブレイン・スラッシュ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/022.jpg', 'PR7超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-023', '百鬼の邪王門', '百鬼の邪王門', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/023.jpg', 'PR8超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-024', '策士のシダン ニャハン', '策士のシダンニャハン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/024.jpg', 'PR9超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-025', '豊潤フォージュン', '豊潤フォージュン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/025.jpg', 'PR10超/PR10', null, null, null),
  ('DM26EX2-PREVIEW-026', '瀑水神 ミヅハノオオミカミ', '瀑水神ミヅハノオオミカミ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/026.jpg', 'SPR㊙1超/SPR㊙5', null, null, null),
  ('DM26EX2-PREVIEW-027', '世界竜皇 ボルシャック・ヒカリスマ', '世界竜皇ボルシャック・ヒカリスマ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/027.jpg', 'SPR㊙2超/SPR㊙5', null, null, null),
  ('DM26EX2-PREVIEW-028', '邪眼魔凰デス・フェニックス', '邪眼魔凰デス・フェニックス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/028.jpg', 'SPR㊙3超/SPR㊙5', null, null, null),
  ('DM26EX2-PREVIEW-029', 'SSS級侵略 カリスマゾーン', 'SSS級侵略カリスマゾーン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/029.jpg', 'SPR㊙4超/SPR㊙5', null, null, null),
  ('DM26EX2-PREVIEW-030', 'CRY-S-MAX ジャオウガ', 'CRY-S-MAXジャオウガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/030.jpg', 'SPR㊙5超/SPR㊙5', null, null, null),
  ('DM26EX2-PREVIEW-031', '竜皇神 ボルシャック・バクテラス', '竜皇神ボルシャック・バクテラス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/031.jpg', 'MC1/MC30', null, null, null),
  ('DM26EX2-PREVIEW-032', 'CRYMAX ジャオウガ', 'CRYMAXジャオウガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/032.jpg', 'MC2/MC30', null, null, null),
  ('DM26EX2-PREVIEW-033', '伝説の正体 ギュウジン丸', '伝説の正体ギュウジン丸', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/033.jpg', 'MC3/MC30', null, null, null),
  ('DM26EX2-PREVIEW-034', '絶望と反魂と滅殺の決断', '絶望と反魂と滅殺の決断', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/034.jpg', 'MC4/MC30', null, null, null),
  ('DM26EX2-PREVIEW-035', '煉獄邪神M・R・C・ロマノフ', '煉獄邪神M・R・C・ロマノフ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/035.jpg', 'MC5/MC30', null, null, null),
  ('DM26EX2-PREVIEW-036', '禁断の轟速 ブラックゾーン', '禁断の轟速ブラックゾーン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/036.jpg', 'MC6/MC30', null, null, null),
  ('DM26EX2-PREVIEW-037', '天罪堕将 アルカクラウン', '天罪堕将アルカクラウン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/037.jpg', 'MC7/MC30', null, null, null),
  ('DM26EX2-PREVIEW-038', '魔誕導師ブラックルシファー', '魔誕導師ブラックルシファー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/038.jpg', 'MC8/MC30', null, null, null),
  ('DM26EX2-PREVIEW-039', '不敬合成王 ロマティックダム・アルキング', '不敬合成王ロマティックダム・アルキング', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/039.jpg', 'MC9/MC30', null, null, null),
  ('DM26EX2-PREVIEW-040', '聖霊左神ジャスティス', '聖霊左神ジャスティス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/040.jpg', 'MC10/MC30', null, null, null),
  ('DM26EX2-PREVIEW-041', 'DG ～裁キノ刻～', 'DG~裁キノ刻~', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/041.jpg', 'MC11/MC30', null, null, null),
  ('DM26EX2-PREVIEW-042', '「ちくしょおおおおおおっー!!」', '「ちくしょおおおおおおっー!!」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/042.jpg', 'MC12/MC30', null, null, null),
  ('DM26EX2-PREVIEW-043', 'ヘブンズ・ゲート', 'ヘブンズ・ゲート', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/043.jpg', 'MC13/MC30', null, null, null),
  ('DM26EX2-PREVIEW-044', 'ゴッド・ゲート', 'ゴッド・ゲート', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/044.jpg', 'MC14/MC30', null, null, null),
  ('DM26EX2-PREVIEW-045', 'ゴッド・シグナル', 'ゴッド・シグナル', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/045.jpg', 'MC15/MC30', null, null, null),
  ('DM26EX2-PREVIEW-046', '邪妃左神 バンバーシュート', '邪妃左神バンバーシュート', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/046.jpg', 'MC16/MC30', null, null, null),
  ('DM26EX2-PREVIEW-047', '「覇〇魔ヴォゲンム」', '「覇〇魔ヴォゲンム」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/047.jpg', 'MC17/MC30', null, null, null),
  ('DM26EX2-PREVIEW-048', 'ヴィオラの黒像', 'ヴィオラの黒像', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/048.jpg', 'MC18/MC30', null, null, null),
  ('DM26EX2-PREVIEW-049', 'ロスト・Re:ソウル', 'ロスト・Re:ソウル', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/049.jpg', 'MC19/MC30', null, null, null),
  ('DM26EX2-PREVIEW-050', 'ボルシャック・太陽・ルピア', 'ボルシャック・太陽・ルピア', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/050.jpg', 'MC20/MC30', null, null, null),
  ('DM26EX2-PREVIEW-051', '“必駆”蛮触礼亞', '“必駆”蛮触礼亞', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/051.jpg', 'MC21/MC30', null, null, null),
  ('DM26EX2-PREVIEW-052', 'ルシファー', 'ルシファー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/052.jpg', 'MC22/MC30', null, null, null),
  ('DM26EX2-PREVIEW-053', 'ヨミとイズモの計画', 'ヨミとイズモの計画', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/053.jpg', 'MC23/MC30', null, null, null),
  ('DM26EX2-PREVIEW-054', '豪運の絆', '豪運の絆', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/054.jpg', 'MC24/MC30', null, null, null),
  ('DM26EX2-PREVIEW-055', '鬼寄せの術', '鬼寄せの術', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/055.jpg', 'MC25/MC30', null, null, null),
  ('DM26EX2-PREVIEW-056', '混沌の獅子デスライガー／カオス・チャージャー', '混沌の獅子デスライガー/カオス・チャージャー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/056.jpg', 'MC26/MC30', null, null, 'ツインパクト'),
  ('DM26EX2-PREVIEW-057', '極限右神ダフトパンク・アライブ', '極限右神ダフトパンク・アライブ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/057.jpg', 'MC27/MC30', null, null, null),
  ('DM26EX2-PREVIEW-058', 'ブラッディ・タイフーン', 'ブラッディ・タイフーン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/058.jpg', 'MC28/MC30', null, null, null),
  ('DM26EX2-PREVIEW-059', 'サイバー・チューン', 'サイバー・チューン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/059.jpg', 'MC29/MC30', null, null, null),
  ('DM26EX2-PREVIEW-060', '虚ト成リシ古ノ蛇神ノ咆哮', '虚ト成リシ古ノ蛇神ノ咆哮', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/060.jpg', 'MC30/MC30', null, null, null),
  ('DM26EX2-PREVIEW-061', '飛翔龍 5000VT', '飛翔龍5000VT', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/061.jpg', '1/89', null, 8, null),
  ('DM26EX2-PREVIEW-062', '終来王鬼 ジャオウガ', '終来王鬼ジャオウガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/062.jpg', '2/89', null, 5, null),
  ('DM26EX2-PREVIEW-063', 'ボルシャック・アークゼオスNEX', 'ボルシャック・アークゼオスNEX', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/063.jpg', '3/89', null, 5, null),
  ('DM26EX2-PREVIEW-064', '水雲 フカフチノカミ', '水雲フカフチノカミ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/064.jpg', '4/89', null, 6, null),
  ('DM26EX2-PREVIEW-065', '風神 ミッツノクエビコ', '風神ミッツノクエビコ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/065.jpg', '5/89', null, 5, null),
  ('DM26EX2-PREVIEW-066', '邪眼破壊神R・R・R', '邪眼破壊神R・R・R', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/066.jpg', '6/89', null, 5, null),
  ('DM26EX2-PREVIEW-067', '冥界神に刻まれし魔弾の名', '冥界神に刻まれし魔弾の名', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/067.jpg', '7/89', null, 4, null),
  ('DM26EX2-PREVIEW-068', '夢の轟速 ザ・ランド', '夢の轟速ザ・ランド', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/068.jpg', '8/89', null, 5, null),
  ('DM26EX2-PREVIEW-069', '魔誕の悪魔デスモナーク', '魔誕の悪魔デスモナーク', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/069.jpg', '9/89', null, 3, null),
  ('DM26EX2-PREVIEW-070', '邪眼破壊神デスアポロヌス・ドラゲリオン', '邪眼破壊神デスアポロヌス・ドラゲリオン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/070.jpg', '10/89', null, 13, null),
  ('DM26EX2-PREVIEW-071', '「涅槃」の鬼 ゲドウ大権現', '「涅槃」の鬼ゲドウ大権現', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/071.jpg', '11/89', null, 6, null),
  ('DM26EX2-PREVIEW-072', '禁鬼機関 ジャオウガ-8', '禁鬼機関ジャオウガ-8', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/072.jpg', '12/89', null, 4, null),
  ('DM26EX2-PREVIEW-073', 'ボルシャック・ゴルギーニ', 'ボルシャック・ゴルギーニ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/073.jpg', '13/89', null, 7, null),
  ('DM26EX2-PREVIEW-074', 'ボルシャック・カクメイジン', 'ボルシャック・カクメイジン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/074.jpg', '14/89', null, 5, null),
  ('DM26EX2-PREVIEW-075', 'S級原始 レッドマッド', 'S級原始レッドマッド', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/075.jpg', '15/89', null, 5, null),
  ('DM26EX2-PREVIEW-076', '鬼黒皇 ヴィオラスト・ジャオウガ', '鬼黒皇ヴィオラスト・ジャオウガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/076.jpg', '16/89', null, 5, null),
  ('DM26EX2-PREVIEW-077', 'パルフェ・ルピア／「あとは任せたのんだぞ！」', 'パルフェ・ルピア/「あとは任せたのんだぞ!」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/077.jpg', '17/89', null, 4, 'ツインパクト'),
  ('DM26EX2-PREVIEW-078', '邪眼左神エンドレス', '邪眼左神エンドレス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/078.jpg', '18/89', null, 3, null),
  ('DM26EX2-PREVIEW-079', 'ワダエビノミコト', 'ワダエビノミコト', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/079.jpg', '19/89', null, 3, null),
  ('DM26EX2-PREVIEW-080', '轟速 ザ・ドッグ', '轟速ザ・ドッグ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/080.jpg', '20/89', null, 7, null),
  ('DM26EX2-PREVIEW-081', '怒像アゲ', '怒像アゲ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/081.jpg', '21/89', null, 6, null),
  ('DM26EX2-PREVIEW-082', '邪眼龍神メタル・アポロヌス', '邪眼龍神メタル・アポロヌス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/082.jpg', '22/89', null, 5, null),
  ('DM26EX2-PREVIEW-083', 'ボルテール・ミラー・ドラゴン／ミラー・チャージャー', 'ボルテール・ミラー・ドラゴン/ミラー・チャージャー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/083.jpg', '23/89', null, 5, 'ツインパクト'),
  ('DM26EX2-PREVIEW-084', 'ボルシャック・ゴルファンタジスタ', 'ボルシャック・ゴルファンタジスタ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/084.jpg', '24/89', null, 3, null),
  ('DM26EX2-PREVIEW-085', '氷柱と炎狐の決断', '氷柱と炎狐の決断', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/085.jpg', '25/89', null, 4, null),
  ('DM26EX2-PREVIEW-086', '「鬼情」の極 ジャオウグリラ／「自由で欲望のままに生きるのだ！」', '「鬼情」の極ジャオウグリラ/「自由で欲望のままに生きるのだ!」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/086.jpg', '26/89', null, 4, 'ツインパクト'),
  ('DM26EX2-PREVIEW-087', '暗黒破壊神デス・フェニックス', '暗黒破壊神デス・フェニックス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/087.jpg', '27/89', null, 3, null),
  ('DM26EX2-PREVIEW-088', '轟速 ザ・ロウィン', '轟速ザ・ロウィン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/088.jpg', '28/89', null, 7, null),
  ('DM26EX2-PREVIEW-089', 'ワダユメミノミコト', 'ワダユメミノミコト', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/089.jpg', '29/89', null, 6, null),
  ('DM26EX2-PREVIEW-090', '宿命の決闘', '宿命の決闘', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/090.jpg', '30/89', null, 6, null),
  ('DM26EX2-PREVIEW-091', '覚悟の決闘', '覚悟の決闘', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/091.jpg', '31/89', null, 6, null),
  ('DM26EX2-PREVIEW-092', '野望の決闘', '野望の決闘', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/092.jpg', '32/89', null, 6, null),
  ('DM26EX2-PREVIEW-093', '覇道の決闘', '覇道の決闘', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/093.jpg', '33/89', null, 5, null),
  ('DM26EX2-PREVIEW-094', '一王二命三眼槍の封', '一王二命三眼槍の封', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/094.jpg', '34/89', null, 6, null),
  ('DM26EX2-PREVIEW-095', '孤高の決闘', '孤高の決闘', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/095.jpg', '35/89', null, 3, null),
  ('DM26EX2-PREVIEW-096', 'ポッピ・冠・ラッキー', 'ポッピ・冠・ラッキー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/096.jpg', '36/89', null, 3, null),
  ('DM26EX2-PREVIEW-097', 'ドラゴンズ・サイン', 'ドラゴンズ・サイン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/097.jpg', '37/89', null, 5, null),
  ('DM26EX2-PREVIEW-098', 'シンクロ・ルピア／「D4に敗北は許されない！」', 'シンクロ・ルピア/「D4に敗北は許されない!」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/098.jpg', '38/89', null, 5, 'ツインパクト'),
  ('DM26EX2-PREVIEW-099', '同期の妖精／ド浮きの動悸', '同期の妖精/ド浮きの動悸', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/099.jpg', '39/89', null, 2, 'ツインパクト'),
  ('DM26EX2-PREVIEW-100', 'ワダカニノミコト', 'ワダカニノミコト', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/100.jpg', '40/89', null, 2, null),
  ('DM26EX2-PREVIEW-101', '極限龍神ヘヴィ', '極限龍神ヘヴィ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/101.jpg', '41/89', null, 4, null),
  ('DM26EX2-PREVIEW-102', 'カンゴク入道の巻', 'カンゴク入道の巻', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/102.jpg', '42/89', null, 2, null),
  ('DM26EX2-PREVIEW-103', 'プライマル・サーガ', 'プライマル・サーガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/103.jpg', '43/89', null, 4, null),
  ('DM26EX2-PREVIEW-104', '轟速 ザ・リフル', '轟速ザ・リフル', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/104.jpg', '44/89', null, 4, null),
  ('DM26EX2-PREVIEW-105', '「オレたちのZEROの世界を造るまで」', '「オレたちのZEROの世界を造るまで」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/105.jpg', '45/89', null, 6, null),
  ('DM26EX2-PREVIEW-106', '断罪のロスト・ソーン', '断罪のロスト・ソーン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/106.jpg', '46/89', null, 5, null),
  ('DM26EX2-PREVIEW-107', '希望の太陽 マイハマタワー', '希望の太陽マイハマタワー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/107.jpg', '47/89', null, 2, null),
  ('DM26EX2-PREVIEW-108', '一王伍双三眼槍', '一王伍双三眼槍', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/108.jpg', '48/89', null, 3, null),
  ('DM26EX2-PREVIEW-109', '邪眼神オール', '邪眼神オール', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/109.jpg', '49/89', null, 5, null),
  ('DM26EX2-PREVIEW-110', 'ドンドン火噴くナウ', 'ドンドン火噴くナウ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/110.jpg', '50/89', null, 3, null),
  ('DM26EX2-PREVIEW-111', '鬼核アトム・ジャオウガ', '鬼核アトム・ジャオウガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/111.jpg', '51/89', null, 2, null),
  ('DM26EX2-PREVIEW-112', 'カイザー・ルピア', 'カイザー・ルピア', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/112.jpg', '52/89', null, 3, null),
  ('DM26EX2-PREVIEW-113', '邪眼右神デリート', '邪眼右神デリート', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/113.jpg', '53/89', null, 3, null),
  ('DM26EX2-PREVIEW-114', 'ワダシストノミコト', 'ワダシストノミコト', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/114.jpg', '54/89', null, 2, null),
  ('DM26EX2-PREVIEW-115', '異端流し オニカマス', '異端流しオニカマス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/115.jpg', '55/89', null, 2, null),
  ('DM26EX2-PREVIEW-116', '飛ベル津バサ「曲通風」', '飛ベル津バサ「曲通風」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/116.jpg', '56/89', null, 4, null),
  ('DM26EX2-PREVIEW-117', 'プロジェクト・ゴッド', 'プロジェクト・ゴッド', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/117.jpg', '57/89', null, 5, null),
  ('DM26EX2-PREVIEW-118', '邪眼龍神ヘヴィ・アポロヌス', '邪眼龍神ヘヴィ・アポロヌス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/118.jpg', '58/89', null, 3, null),
  ('DM26EX2-PREVIEW-119', 'レーホウの街・デカッチ／「暴竜爵様のお出ましだッチ！」', 'レーホウの街・デカッチ/「暴竜爵様のお出ましだッチ!」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/119.jpg', '59/89', null, 3, 'ツインパクト'),
  ('DM26EX2-PREVIEW-120', '轟速 ザ・ダラー／「イグニッション!!ソニックドローォォ!!」', '轟速ザ・ダラー/「イグニッション!!ソニックドローォォ!!」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/120.jpg', '60/89', null, 3, 'ツインパクト'),
  ('DM26EX2-PREVIEW-121', '悪霊鬼王ジャオディオス', '悪霊鬼王ジャオディオス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/121.jpg', '61/89', null, 6, null),
  ('DM26EX2-PREVIEW-122', '極限龍神メタル', '極限龍神メタル', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/122.jpg', '62/89', null, 2, null),
  ('DM26EX2-PREVIEW-123', 'シブキ将鬼の巻', 'シブキ将鬼の巻', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/123.jpg', '63/89', null, 3, null),
  ('DM26EX2-PREVIEW-124', 'Dの侵略 クリム・ゾーン', 'Dの侵略クリム・ゾーン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/124.jpg', '64/89', null, 4, null),
  ('DM26EX2-PREVIEW-125', 'バクロ法師の封', 'バクロ法師の封', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/125.jpg', '65/89', null, 2, null),
  ('DM26EX2-PREVIEW-126', 'エボリューション・エッグ', 'エボリューション・エッグ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/126.jpg', '66/89', null, 7, null),
  ('DM26EX2-PREVIEW-127', 'ボルシャック・マントラ', 'ボルシャック・マントラ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/127.jpg', '67/89', null, 4, null),
  ('DM26EX2-PREVIEW-128', 'ワダウサノミコト', 'ワダウサノミコト', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/128.jpg', '68/89', null, 4, null),
  ('DM26EX2-PREVIEW-129', '超轟速 レッドランチャー', '超轟速レッドランチャー', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/129.jpg', '69/89', null, 2, null),
  ('DM26EX2-PREVIEW-130', 'ロジック・サークル', 'ロジック・サークル', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/130.jpg', '70/89', null, 1, null),
  ('DM26EX2-PREVIEW-131', '氷牙レオポル・ディーネ公／エマージェンシー・タイフーン', '氷牙レオポル・ディーネ公/エマージェンシー・タイフーン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/131.jpg', '71/89', null, 4, 'ツインパクト'),
  ('DM26EX2-PREVIEW-132', '水面護り ハコフ／蓄積された魔力の縛り', '水面護りハコフ/蓄積された魔力の縛り', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/132.jpg', '72/89', null, 1, 'ツインパクト'),
  ('DM26EX2-PREVIEW-133', 'ワダフミノミコト', 'ワダフミノミコト', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/133.jpg', '73/89', null, 4, null),
  ('DM26EX2-PREVIEW-134', 'ワダチエノミコト', 'ワダチエノミコト', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/134.jpg', '74/89', null, 2, null),
  ('DM26EX2-PREVIEW-135', 'ワダゲコノミコト', 'ワダゲコノミコト', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/135.jpg', '75/89', null, 1, null),
  ('DM26EX2-PREVIEW-136', '「魔光蟲ヴィルジニア卿」', '「魔光蟲ヴィルジニア卿」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/136.jpg', '76/89', null, 5, null),
  ('DM26EX2-PREVIEW-137', '邪眼右神C・ロマノフ', '邪眼右神C・ロマノフ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/137.jpg', '77/89', null, 2, null),
  ('DM26EX2-PREVIEW-138', '冠火の守護者ジャオウガ・メルキス', '冠火の守護者ジャオウガ・メルキス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/138.jpg', '78/89', null, 2, null),
  ('DM26EX2-PREVIEW-139', 'オソック童子＜ターボ.鬼＞', 'オソック童子<ターボ.鬼>', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/139.jpg', '79/89', null, 2, null),
  ('DM26EX2-PREVIEW-140', '鶏と蛙 クローラ＆ルピア', '鶏と蛙クローラ&ルピア', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/140.jpg', '80/89', null, 3, null),
  ('DM26EX2-PREVIEW-141', '邪眼左神M・ロマノフ', '邪眼左神M・ロマノフ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/141.jpg', '81/89', null, 3, null),
  ('DM26EX2-PREVIEW-142', '轟速 ザ・シオ／「キサマのデュエマは周回遅れだ！」', '轟速ザ・シオ/「キサマのデュエマは周回遅れだ!」', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/142.jpg', '82/89', null, 4, 'ツインパクト'),
  ('DM26EX2-PREVIEW-143', '鬼覇 ザーデッドジャオウガ', '鬼覇ザーデッドジャオウガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/143.jpg', '83/89', null, 4, null),
  ('DM26EX2-PREVIEW-144', '樹界の守護車 アイオン・ユピテル', '樹界の守護車アイオン・ユピテル', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/144.jpg', '84/89', null, 2, null),
  ('DM26EX2-PREVIEW-145', 'ジャスミンの地版', 'ジャスミンの地版', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/145.jpg', '85/89', null, 2, null),
  ('DM26EX2-PREVIEW-146', 'ヘルコプ太の心絵', 'ヘルコプ太の心絵', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/146.jpg', '86/89', null, 1, null),
  ('DM26EX2-PREVIEW-147', 'マントラ・ルピア', 'マントラ・ルピア', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/147.jpg', '87/89', null, 3, null),
  ('DM26EX2-PREVIEW-148', 'チャラ・ルピア', 'チャラ・ルピア', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/148.jpg', '88/89', null, 2, null),
  ('DM26EX2-PREVIEW-149', '轟速 ザ・トリノグ', '轟速ザ・トリノグ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/149.jpg', '89/89', null, 2, null);

insert into public.cards (
  name, normalized_name, image_url, civilization, cost, card_type,
  regulation, is_active, is_catalog_complete, catalog_review_status
)
select distinct on (normalized_name)
  name,
  normalized_name,
  image_url,
  case when civilization is null then '{}'::text[] else string_to_array(civilization, '/') end,
  cost,
  card_type,
  'none',
  true,
  false,
  'needs_review'
from dm26_ex2_catalog_seed
order by normalized_name, source_key
on conflict (normalized_name) do nothing;

-- 既存行は未入力項目だけ補完する。既存画像・コスト・種類・文明は保持する。
with seed_card as (
  select distinct on (normalized_name)
    normalized_name, image_url, civilization, cost, card_type
  from dm26_ex2_catalog_seed
  order by normalized_name, source_key
)
update public.cards as card
set
  image_url = coalesce(card.image_url, seed.image_url),
  civilization = case
    when coalesce(array_length(card.civilization, 1), 0) = 0 and seed.civilization is not null
      then string_to_array(seed.civilization, '/')
    else card.civilization
  end,
  cost = coalesce(card.cost, seed.cost),
  card_type = coalesce(card.card_type, seed.card_type),
  updated_at = case
    when card.image_url is null
      or (coalesce(array_length(card.civilization, 1), 0) = 0 and seed.civilization is not null)
      or (card.cost is null and seed.cost is not null)
      or (card.card_type is null and seed.card_type is not null)
    then now()
    else card.updated_at
  end
from seed_card as seed
where card.normalized_name = seed.normalized_name;

with resolved as (
  select
    card.id as card_id,
    seed.*,
    row_number() over (partition by card.id order by seed.source_key) as printing_order,
    exists (
      select 1 from public.card_printings existing
      where existing.card_id = card.id and existing.is_representative
    ) as already_has_representative
  from dm26_ex2_catalog_seed seed
  join public.cards card on card.normalized_name = seed.normalized_name
)
insert into public.card_printings (
  card_id, source_key, official_page_url, image_url, set_name, card_number, is_representative
)
select
  card_id,
  source_key,
  'https://dm.takaratomy.co.jp/product/dm26ex2/',
  image_url,
  'DM26-EX2 悪感謝祭 カリスマBEST',
  card_number,
  printing_order = 1 and not already_has_representative
from resolved
on conflict (source_key) do update set
  card_id = excluded.card_id,
  official_page_url = excluded.official_page_url,
  image_url = excluded.image_url,
  set_name = excluded.set_name,
  card_number = excluded.card_number,
  updated_at = now();

do $$
declare
  v_seed_count integer;
  v_name_count integer;
  v_printing_count integer;
begin
  select count(*), count(distinct normalized_name)
    into v_seed_count, v_name_count
  from dm26_ex2_catalog_seed;

  select count(*) into v_printing_count
  from public.card_printings
  where source_key like 'DM26EX2-PREVIEW-%';

  if v_seed_count <> 149 then
    raise exception 'DM26_EX2_SEED_COUNT_MISMATCH: %', v_seed_count;
  end if;
  if v_name_count <> 134 then
    raise exception 'DM26_EX2_NAME_COUNT_MISMATCH: %', v_name_count;
  end if;
  if v_printing_count <> 149 then
    raise exception 'DM26_EX2_PRINTING_COUNT_MISMATCH: %', v_printing_count;
  end if;
end $$;


