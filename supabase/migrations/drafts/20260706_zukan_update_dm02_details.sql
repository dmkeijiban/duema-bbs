-- Draft: enrich existing DM-02 zukan card details.
-- Apply manually in Supabase SQL Editor only after reviewing.
-- This file intentionally uses UPDATE only. It must not insert, delete, recreate, or change slug/id/pack_id/sort_order.
--
-- Before applying, confirm the existing target rows and current detail state:
-- select slug, name, ability_text, flavor_text, illustrator, official_page_url
-- from public.zukan_cards
-- where slug like 'dm02-%'
-- order by sort_order;
--
-- Expected target count before and after this draft: 60 rows.
-- select count(*) from public.zukan_cards where slug like 'dm02-%';
--
-- Note: unlike the initial seed, this draft does not use on conflict do nothing.
-- Running UPDATE against a missing slug updates 0 rows, so check row counts after applying.

begin;

update public.zukan_cards
set
  ability_text = 'ブロッカー(相手クリーチャーが攻撃するとき、このクリーチャーをタップして、その攻撃を阻止してよい。 そのあと、その相手クリーチャーとバトルする。) 進化ー自分のガーディアン１体の上に置く。
W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)',
  flavor_text = null,
  illustrator = 'Kou1',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-s01'
where slug = 'dm02-001';

update public.zukan_cards
set
  ability_text = '進化ー自分のリキッド・ピープル１体の上に置く。 このクリーチャーがバトルゾーンに出たとき、バトルゾーンにある「ブロッカー」を持つクリーチャーをすべて、持ち主の手札に戻す。',
  flavor_text = null,
  illustrator = 'Eiji Kaneda',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-s02'
where slug = 'dm02-002';

update public.zukan_cards
set
  ability_text = '進化ー自分のパラサイトワーム１体の上に置く。
W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)',
  flavor_text = null,
  illustrator = 'Hikaru Ikusa',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-s03'
where slug = 'dm02-003';

update public.zukan_cards
set
  ability_text = '進化ー自分のヒューマノイド１体の上に置く。
W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)
このクリーチャーがバトルゾーンにある間、バトルゾーンにある自分の他のヒューマノイドすべてのパワーは、+1000される。',
  flavor_text = null,
  illustrator = 'Hisashi Momose',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-s04'
where slug = 'dm02-004';

update public.zukan_cards
set
  ability_text = '進化ー自分のビーストフォーク１体の上に置く。
このクリーチャーがバトルゾーンに出たとき、自分の山札の一番上のカードを２枚表にして、自分のマナゾーンに置く。
W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)',
  flavor_text = null,
  illustrator = 'Ryoya Yuki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-s05'
where slug = 'dm02-005';

update public.zukan_cards
set
  ability_text = 'このクリーチャーはブロックされない。',
  flavor_text = '精霊の力は、はるかな星空にまで及ぶという。',
  illustrator = 'Seki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-001'
where slug = 'dm02-006';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、バトルゾーンにある相手のクリーチャーと同じ枚数のカードを引いてよい。',
  flavor_text = '地上侵攻用プログラム。1対多数戦闘を想定し、自動追尾システムを強化。',
  illustrator = 'Daisuke Izuka',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-002'
where slug = 'dm02-007';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、相手の手札からカードを１枚見ないで選び、相手はそれを持ち主の墓地に置く。',
  flavor_text = '闇の軍勢は、フィアナの森を住み慣れた地獄に変えた。',
  illustrator = 'Masateru Ikeda',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-003'
where slug = 'dm02-008';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、相手のマナゾーンからカードを１枚選び、持ち主の墓地に置く。',
  flavor_text = '東のボルシャックが目覚めた時、西のボルザードが咆哮する。',
  illustrator = 'Dustmoss',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-004'
where slug = 'dm02-009';

update public.zukan_cards
set
  ability_text = 'このクリーチャーは、パワー5000以下のクリーチャーにブロックされない。
W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)',
  flavor_text = '闇のワームがその力を飲み込み、平和な森を地獄に変えた。',
  illustrator = 'Katsuya',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-005'
where slug = 'dm02-010';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンに出たとき、自分の墓地から呪文を１枚選び、自分の手札に戻してよい。',
  flavor_text = 'これはまだ演習にすぎない。',
  illustrator = 'Daisuke Izuka',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-006'
where slug = 'dm02-011';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、自分の山札から呪文を１枚さがして相手に見せ、自分の手札に加えてよい。そのあと、山札をシャッフルする。',
  flavor_text = '大いなる異変を確認するために、予見者は伝道師を派遣した。',
  illustrator = 'D-Suzuki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-007'
where slug = 'dm02-012';

update public.zukan_cards
set
  ability_text = 'ブロッカー(相手クリーチャーが攻撃するとき、このクリーチャーをタップして、その攻撃を阻止してよい。そのあと、その相手クリーチャーとバトルする。)
このクリーチャーをブロックのためにタップしたときは、バトルのあとでアンタップする。',
  flavor_text = null,
  illustrator = 'Hisashi Momose',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-008'
where slug = 'dm02-013';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンにある間、すべてのリキッド・ピープルはブロックされない。
W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)',
  flavor_text = 'サイバーロードは水の領域最大の生物をも兵器に変えた。',
  illustrator = 'Tomofumi Ogasawara',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-009'
where slug = 'dm02-014';

update public.zukan_cards
set
  ability_text = 'ブロッカー(相手クリーチャーが攻撃するとき、このクリーチャーをタップして、その攻撃を阻止してよい。そのあと、その相手クリーチャーとバトルする。)
このクリーチャーがバトルゾーンに出たとき、バトルゾーンにあるクリーチャーを１体選び、持ち主の手札に戻してよい。',
  flavor_text = null,
  illustrator = 'Ryoya Yuki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-010'
where slug = 'dm02-015';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、カードを１枚引いてよい。',
  flavor_text = 'サイバーロードは、封印された12のプログラムを入力し、リキッド・ピープルの精鋭を生み出した。',
  illustrator = 'Youichi Kai',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-011'
where slug = 'dm02-016';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、自分のシールドを１枚選び、自分の墓地に置く。
W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)',
  flavor_text = 'この日、ダークロードは念願の地上侵略を決意した。',
  illustrator = 'Hideaki Takamura',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-012'
where slug = 'dm02-017';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンに出たとき、バトルゾーンにあるパワー3000以下の自分のクリーチャーを１体選び、自分の墓地に置く。',
  flavor_text = '地上のクリーチャーを食い荒らし、ワームたちはさらなる発達をとげた。',
  illustrator = 'Masaki Hirooka',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-013'
where slug = 'dm02-018';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、自分の墓地からクリーチャーを１体選び、自分の手札に戻してよい。',
  flavor_text = '「ちくりとするだけです。すぐに楽になりますよ。」 ー闇道化マルパス',
  illustrator = 'Daisuke Izuka',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-014'
where slug = 'dm02-019';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、相手がブロックする前に、バトルゾーンにある相手の「ブロッカー」を持つクリーチャーを１体選び、持ち主の墓地に置く。
W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)',
  flavor_text = null,
  illustrator = 'Jason',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-015'
where slug = 'dm02-020';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンから墓地に置かれるとき、各プレイヤーは自分自身のマナゾーンからカードを２枚ずつ選び、それぞれの墓地に置く。',
  flavor_text = '「液体岩石内に生息。危険度A。」リキッド・ピープルの報告書。',
  illustrator = 'Akira Hamada',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-016'
where slug = 'dm02-021';

update public.zukan_cards
set
  ability_text = '攻撃中、このクリーチャーのパワーは、バトルゾーンにある自分の他のタップされているクリーチャー１体につき+2000される。',
  flavor_text = '「い?やっほおおおっっっ！！！」海岸線に火の領域の最初の援軍が到着した。',
  illustrator = 'Akifumi Yamamoto',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-017'
where slug = 'dm02-022';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンに出たとき、相手のマナゾーンからカードを２枚まで選び、持ち主の墓地に置く。',
  flavor_text = '「なんて分解しがいのあるやつだ。」　ー放浪の勇者ジージョ',
  illustrator = 'Masaki Hirooka',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-018'
where slug = 'dm02-023';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンに出たとき、自分の山札からクリーチャーを１枚さがして相手に見せ、自分の手札に加える。そのあと、山札をシャッフルする。',
  flavor_text = null,
  illustrator = 'Ittoku',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-019'
where slug = 'dm02-024';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンにある間、自分のクリーチャーを召喚するとき、支払うコストは１少なくなる。ただし、コストが１のときは少なくならない。',
  flavor_text = '最初に森に入ったキマイラたちは、森そのものから攻撃を受けた。',
  illustrator = 'Yusaku Nakaaki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-020'
where slug = 'dm02-025';

update public.zukan_cards
set
  ability_text = '進化ー自分のガーディアン１体の上に置く。
このクリーチャーがバトルゾーンに出たとき、バトルゾーンにある相手の「ブロッカー」を持つクリーチャーをすべてタップする。',
  flavor_text = null,
  illustrator = 'Akifumi Yamamoto',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-021'
where slug = 'dm02-026';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、相手のシールドを１枚選んで見てよい。そのあとそれを元に戻す。',
  flavor_text = '姿消え行く予言者は、新しい時代を予見した。',
  illustrator = 'Kou1',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-022'
where slug = 'dm02-027';

update public.zukan_cards
set
  ability_text = 'このターン、バトルゾーンにある自分のクリーチャーはすべて、たとえ召喚酔いであったり、「このクリーチャーは攻撃することができない」または「このクリーチャーは相手プレイヤーを攻撃できない」と書かれていても、相手プレイヤーを攻撃することができる。',
  flavor_text = '今、光の封印を解き放つ。',
  illustrator = 'Akifumi Yamamoto',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-023'
where slug = 'dm02-028';

update public.zukan_cards
set
  ability_text = '進化ー自分のリキッド・ピープル１体の上に置く。 W(ダブル)・ブレイカー(シールドを攻撃したとき、このクリーチャーはシールドを２枚ブレイクする。)
このクリーチャーはブロックされない。',
  flavor_text = null,
  illustrator = 'Norikatsu Miyoshi',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-024'
where slug = 'dm02-029';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、相手がブロックする前に、バトルゾーンにある火または自然のクリーチャーを１体選び、持ち主の手札に戻してよい。',
  flavor_text = '地上侵攻用プログラム。特定領域のクリーチャーへの対応システムを強化。',
  illustrator = 'Atsushi Kawasaki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-025'
where slug = 'dm02-030';

update public.zukan_cards
set
  ability_text = 'S(シールド)・トリガー(このカードをシールドゾーンから手札に戻すとき、コストを支払わずにすぐ使ってよい。)
バトルゾーンにある相手のクリーチャーと同じ枚数のカードを引く。',
  flavor_text = null,
  illustrator = 'Daisuke Izuka',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-026'
where slug = 'dm02-031';

update public.zukan_cards
set
  ability_text = '進化ー自分のパラサイトワーム１体の上に置く。
このクリーチャーがバトルゾーンに出たとき、バトルゾーンにある相手のクリーチャーを１体選び、持ち主の墓地に置いてよい。',
  flavor_text = null,
  illustrator = 'Naoki Saito',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-027'
where slug = 'dm02-032';

update public.zukan_cards
set
  ability_text = 'ブロッカー(相手クリーチャーが攻撃するとき、このクリーチャーをタップして、その攻撃を阻止してよい。 そのあと、その相手クリーチャーとバトルする。)
このクリーチャーは相手プレイヤーを攻撃できない。',
  flavor_text = 'むさぼり食うことでは満たされない飢えがある。',
  illustrator = 'Nottsuo',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-028'
where slug = 'dm02-033';

update public.zukan_cards
set
  ability_text = '相手は自分自身の手札をすべて、持ち主の墓地に置く。',
  flavor_text = null,
  illustrator = 'Tomofumi Ogasawara',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-029'
where slug = 'dm02-034';

update public.zukan_cards
set
  ability_text = '進化ー自分のヒューマノイド１体の上に置く。
攻撃中、このクリーチャーのパワーは、バトルゾーンにある他のヒューマノイド１体につき+2000される。',
  flavor_text = null,
  illustrator = 'Dai',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-030'
where slug = 'dm02-035';

update public.zukan_cards
set
  ability_text = 'このクリーチャーは、タップされていないクリーチャーを攻撃できる。',
  flavor_text = '騎兵たちは、全速で戦場を駆け抜ける。闘いの始まりを報告するために。',
  illustrator = 'Atsushi Kawasaki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-031'
where slug = 'dm02-036';

update public.zukan_cards
set
  ability_text = 'S(シールド)・トリガー(このカードをシールドゾーンから手札に戻すとき、コストを支払わずにすぐ使ってよい。)
各プレイヤーは、バトルゾーンにあるパワー2000以下のクリーチャーすべてを、それぞれの墓地に置く。',
  flavor_text = null,
  illustrator = 'Sansyu',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-032'
where slug = 'dm02-037';

update public.zukan_cards
set
  ability_text = '進化ー自分のビーストフォーク１体の上に置く。
このクリーチャーがバトルゾーンにあり、タップされていれば、バトルゾーンにある自分の他のビーストフォークすべてのパワーは+2000される。',
  flavor_text = '怒りが究極の力を呼び起こす。',
  illustrator = 'Tsutomu Kawade',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-033'
where slug = 'dm02-038';

update public.zukan_cards
set
  ability_text = 'パワーアタッカー+2000(攻撃中、このクリーチャーのパワーは+2000される。)',
  flavor_text = '彼の拳がフィアナの森を救った。その命と引き換えに。',
  illustrator = 'Sansyu',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-034'
where slug = 'dm02-039';

update public.zukan_cards
set
  ability_text = 'S(シールド)・トリガー(このカードをシールドゾーンから手札に戻すとき、コストを支払わずにすぐ使ってよい。)
相手のマナゾーンからカードを１枚選び、持ち主の墓地に置く。',
  flavor_text = null,
  illustrator = 'Tsutomu Kawade',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-035'
where slug = 'dm02-040';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンに出たとき、カードを１枚引いてよい。',
  flavor_text = '磁力の使徒よ覚醒せよ。汝の翼は意思の鎖なり。',
  illustrator = 'Hisanobu Kometani',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-036'
where slug = 'dm02-041';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンに出たとき、バトルゾーンにある相手のクリーチャーを１体選び、タップしてよい。',
  flavor_text = 'くろがねに輝く予言者は、変化を見守ることを選んだ。',
  illustrator = 'Dustmoss',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-037'
where slug = 'dm02-042';

update public.zukan_cards
set
  ability_text = null,
  flavor_text = '大いなる異変を察知して、まず守護者たちが変化に対応した。',
  illustrator = 'Norikatsu Miyoshi',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-038'
where slug = 'dm02-043';

update public.zukan_cards
set
  ability_text = 'S(シールド)・トリガー(このカードをシールドゾーンから手札に戻すとき、コストを支払わずにすぐに使ってよい。)
自分の山札から呪文を１枚さがして相手に見せ、自分の手札に加える。そのあと、山札をシャッフルする。',
  flavor_text = null,
  illustrator = 'Atsushi Kawasaki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-039'
where slug = 'dm02-044';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンに出たとき、バトルゾーンにある相手のクリーチャーを１体選び、持ち主の山札の１番上に置く。',
  flavor_text = 'サイバーロードの科学力をもってしても、水中都市の崩壊は止まらなかった。',
  illustrator = 'Hikaru Ikusa',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-040'
where slug = 'dm02-045';

update public.zukan_cards
set
  ability_text = null,
  flavor_text = '火の領域の海岸線は、上陸した水の軍勢で真っ青に染まった。',
  illustrator = 'Seki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-041'
where slug = 'dm02-046';

update public.zukan_cards
set
  ability_text = 'ブロッカー(相手クリーチャーが攻撃するとき、このクリーチャーをタップして、その攻撃を阻止してよい。 そのあと、その相手クリーチャーとバトルする。)',
  flavor_text = 'リキッド・ピープルはプログラムによりその能力を変える。',
  illustrator = 'Tsutomu Kawade',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-042'
where slug = 'dm02-047';

update public.zukan_cards
set
  ability_text = '相手のシールドを１枚選んで見る。そのあと、それを元に戻す。 これをあと２回まで行ってよい。',
  flavor_text = 'なんだ、この程度か。',
  illustrator = 'Katsuya',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-043'
where slug = 'dm02-048';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンから自分の墓地に置かれるとき、自分の手札からカードを１枚選んで墓地に置いてよい。 その場合、このクリーチャーを墓地に置くかわりに手札に戻す。',
  flavor_text = 'ダークロードは、まず痛みを感じないキマイラたちを地上に放った。',
  illustrator = 'Jason',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-044'
where slug = 'dm02-049';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、相手の手札からカードを１枚見ないで選び、相手はそれを持ち主の墓地に置く。',
  flavor_text = '「良いワームは好き嫌いをしないものだ。」 ー覇王ブラック・モナーク',
  illustrator = 'Naoki Saito',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-045'
where slug = 'dm02-050';

update public.zukan_cards
set
  ability_text = 'ブロッカー(相手クリーチャーが攻撃するとき、このクリーチャーをタップして、その攻撃を阻止してよい。そのあと、その相手クリーチャーとバトルする。)
このクリーチャーは相手プレイヤーを攻撃したあと、持ち主の墓地に置かれる。',
  flavor_text = '大災害が闇の住人にすら耐えられない闇をもたらした。',
  illustrator = 'Katsuya',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-046'
where slug = 'dm02-051';

update public.zukan_cards
set
  ability_text = 'S(シールド)・トリガー(このカードをシールドゾーンから手札に戻すとき、コストを支払わずにすぐ使ってよい。)
バトルゾーンにある相手の「ブロッカー」を持つクリーチャーを１体選び、持ち主の墓地に置く。',
  flavor_text = null,
  illustrator = 'Nottsuo',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-047'
where slug = 'dm02-052';

update public.zukan_cards
set
  ability_text = 'バトルゾーンに他に自分のクリーチャーがなければ、このクリーチャーは「パワーアタッカー+4000」と「W・ブレイカー」を得る。 (攻撃中、そのクリーチャーのパワーは+4000され、シールドを攻撃したとき、シールドを２枚ブレイクする。)',
  flavor_text = '最初に上陸したリキッド・ピープルの部隊は、大地に触れたとたん蒸発した。',
  illustrator = 'Sansyu',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-048'
where slug = 'dm02-053';

update public.zukan_cards
set
  ability_text = 'パワーアタッカー+1000(攻撃中、このクリーチャーのパワーは+1000される。)
このクリーチャーは、毎ターン攻撃しなければならない。',
  flavor_text = '「絶対、機神装甲を着られるくらい強くなるんだ！」 ー小さな勇者ゲット',
  illustrator = 'Ittoku',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-049'
where slug = 'dm02-054';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンから自分の墓地に置かれるとき、各プレイヤーは自分自身のマナゾーンからカードを１枚選び、それぞれの墓地に置く。',
  flavor_text = '「完璧完璧、超OK。水の機械の分解なんてお茶の子さいさいさ。」ー技師ピーポ',
  illustrator = 'Seki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-050'
where slug = 'dm02-055';

update public.zukan_cards
set
  ability_text = 'このターン、バトルゾーンにある自分のクリーチャーすべてのパワーは+1000され、タップされていないクリーチャーを攻撃できる。',
  flavor_text = '安心するのはまだ早いぜ。',
  illustrator = 'Kou1',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-051'
where slug = 'dm02-056';

update public.zukan_cards
set
  ability_text = '攻撃中、このクリーチャーのパワーは、バトルゾーンにある自分のクリーチャー１体につき+1000される。',
  flavor_text = '強く、そして美しい獣たち。',
  illustrator = 'Miho Midorikawa',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-052'
where slug = 'dm02-057';

update public.zukan_cards
set
  ability_text = 'このクリーチャーが攻撃するとき、自分の山札の一番上のカードを表にして、自分のマナゾーンに置いてよい。',
  flavor_text = '銀髭団は立ち上がった。家族と森を守るために。',
  illustrator = 'Syuichi Obata',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-053'
where slug = 'dm02-058';

update public.zukan_cards
set
  ability_text = 'このクリーチャーがバトルゾーンにある間、自分の呪文を唱えるとき、支払うコストは１少なくなる。 ただし、コストが１のときは少なくならない。',
  flavor_text = '銀髭団が傷つき倒れた時、美しい妖精たちがその窮地を救った。',
  illustrator = 'Eiji Kaneda',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-054'
where slug = 'dm02-059';

update public.zukan_cards
set
  ability_text = '自分の山札からカードを１枚さがして表にし、自分のマナゾーンに置く。 そのあと、山札をシャッフルする。',
  flavor_text = 'まずは下準備さ。',
  illustrator = 'Yusaku Nakaaki',
  official_page_url = 'https://dm.takaratomy.co.jp/card/detail/?id=dm02-055'
where slug = 'dm02-060';

commit;

-- After applying, confirm all DM-02 rows still exist and detail fields were filled as expected:
-- select count(*) as dm02_count
-- from public.zukan_cards
-- where slug like 'dm02-%';
--
-- select count(*) as dm02_with_illustrator,
--        count(ability_text) as dm02_with_ability_text,
--        count(flavor_text) as dm02_with_flavor_text,
--        count(official_page_url) as dm02_with_official_page_url
-- from public.zukan_cards
-- where slug like 'dm02-%';
--
-- Expected: dm02_count=60, dm02_with_illustrator=60, dm02_with_ability_text=58,
-- dm02_with_flavor_text=41, dm02_with_official_page_url=60.
--
-- Spot check detail rows:
-- select slug, name, ability_text, flavor_text, illustrator, official_page_url
-- from public.zukan_cards
-- where slug in ('dm02-001', 'dm02-002', 'dm02-034', 'dm02-060')
-- order by sort_order;
