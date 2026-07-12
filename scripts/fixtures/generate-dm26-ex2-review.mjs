import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const names = [
  '瀑水神 ミヅハノオオミカミ','世界竜皇 ボルシャック・ヒカリスマ','邪眼魔凰デス・フェニックス','SSS級侵略 カリスマゾーン','CRY-S-MAX ジャオウガ',
  '引き裂かれし永劫、エムラクール','龍頭星雲人／零誕祭','超神星DOOM・ドラゲリオン','アーテル・ゴルギーニ','轟轟合体 ゴルギーオージャー',
  '一音の妖精','ブレイン・スラッシュ','百鬼の邪王門','策士のシダン ニャハン','豊潤フォージュン',
  '引き裂かれし永劫、エムラクール','龍頭星雲人／零誕祭','超神星DOOM・ドラゲリオン','アーテル・ゴルギーニ','轟轟合体 ゴルギーオージャー',
  '一音の妖精','ブレイン・スラッシュ','百鬼の邪王門','策士のシダン ニャハン','豊潤フォージュン',
  '瀑水神 ミヅハノオオミカミ','世界竜皇 ボルシャック・ヒカリスマ','邪眼魔凰デス・フェニックス','SSS級侵略 カリスマゾーン','CRY-S-MAX ジャオウガ',
  '竜皇神 ボルシャック・バクテラス','CRYMAX ジャオウガ','伝説の正体 ギュウジン丸','絶望と反魂と滅殺の決断','煉獄邪神M・R・C・ロマノフ',
  '禁断の轟速 ブラックゾーン','天罪堕将 アルカクラウン','魔誕導師ブラックルシファー','不敬合成王 ロマティックダム・アルキング','聖霊左神ジャスティス',
  'DG ～裁キノ刻～','「ちくしょおおおおおおっー!!」','ヘブンズ・ゲート','ゴッド・ゲート','ゴッド・シグナル',
  '邪妃左神 バンバーシュート','「覇〇魔ヴォゲンム」','ヴィオラの黒像','ロスト・Re:ソウル','ボルシャック・太陽・ルピア',
  '“必駆”蛮触礼亞','ルシファー','ヨミとイズモの計画','豪運の絆','鬼寄せの術',
  '混沌の獅子デスライガー／カオス・チャージャー','極限右神ダフトパンク・アライブ','ブラッディ・タイフーン','サイバー・チューン','虚ト成リシ古ノ蛇神ノ咆哮',
  '飛翔龍 5000VT','終来王鬼 ジャオウガ','ボルシャック・アークゼオスNEX','水雲 フカフチノカミ','風神 ミッツノクエビコ',
  '邪眼破壊神R・R・R','冥界神に刻まれし魔弾の名','夢の轟速 ザ・ランド','魔誕の悪魔デスモナーク','邪眼破壊神デスアポロヌス・ドラゲリオン',
  '「涅槃」の鬼 ゲドウ大権現','禁鬼機関 ジャオウガ-8','ボルシャック・ゴルギーニ','ボルシャック・カクメイジン','S級原始 レッドマッド',
  '鬼黒皇 ヴィオラスト・ジャオウガ','パルフェ・ルピア／「あとは任せたのんだぞ！」','邪眼左神エンドレス','ワダエビノミコト','轟速 ザ・ドッグ',
  '怒像アゲ','邪眼龍神メタル・アポロヌス','ボルテール・ミラー・ドラゴン／ミラー・チャージャー','ボルシャック・ゴルファンタジスタ','氷柱と炎狐の決断',
  '「鬼情」の極 ジャオウグリラ／「自由で欲望のままに生きるのだ！」','暗黒破壊神デス・フェニックス','轟速 ザ・ロウィン','ワダユメミノミコト','宿命の決闘',
  '覚悟の決闘','野望の決闘','覇道の決闘','一王二命三眼槍の封','孤高の決闘',
  'ポッピ・冠・ラッキー','ドラゴンズ・サイン','シンクロ・ルピア／「D4に敗北は許されない！」','同期の妖精／ド浮きの動悸','ワダカニノミコト',
  '極限龍神ヘヴィ','カンゴク入道の巻','プライマル・サーガ','轟速 ザ・リフル','「オレたちのZEROの世界を造るまで」',
  '断罪のロスト・ソーン','希望の太陽 マイハマタワー','一王伍双三眼槍','邪眼神オール','ドンドン火噴くナウ',
  '鬼核アトム・ジャオウガ','カイザー・ルピア','邪眼右神デリート','ワダシストノミコト','異端流し オニカマス',
  '飛ベル津バサ「曲通風」','プロジェクト・ゴッド','邪眼龍神ヘヴィ・アポロヌス','レーホウの街・デカッチ／「暴竜爵様のお出ましだッチ！」','轟速 ザ・ダラー／「イグニッション!!ソニックドローォォ!!」',
  '悪霊鬼王ジャオディオス','極限龍神メタル','シブキ将鬼の巻','Dの侵略 クリム・ゾーン','バクロ法師の封',
  'エボリューション・エッグ','ボルシャック・マントラ','ワダウサノミコト','超轟速 レッドランチャー','ロジック・サークル',
  '氷牙レオポル・ディーネ公／エマージェンシー・タイフーン','水面護り ハコフ／蓄積された魔力の縛り','ワダフミノミコト','ワダチエノミコト','ワダゲコノミコト',
  '「魔光蟲ヴィルジニア卿」','邪眼右神C・ロマノフ','冠火の守護者ジャオウガ・メルキス','オソック童子＜ターボ.鬼＞','鶏と蛙 クローラ＆ルピア',
  '邪眼左神M・ロマノフ','轟速 ザ・シオ／「キサマのデュエマは周回遅れだ！」','鬼覇 ザーデッドジャオウガ','樹界の守護車 アイオン・ユピテル','ジャスミンの地版',
  'ヘルコプ太の心絵','マントラ・ルピア','チャラ・ルピア','轟速 ザ・トリノグ'
];

if (names.length !== 149) throw new Error(`expected 149 names, got ${names.length}`);

const baseCosts = [8,5,5,6,5,5,4,5,3,13,6,4,7,5,5,5,4,3,3,7,6,5,5,3,4,4,3,7,6,6,6,6,5,6,3,3,5,5,2,2,4,2,4,4,6,5,2,3,5,3,2,3,3,2,2,4,5,3,3,3,6,2,3,4,2,7,4,4,2,1,4,1,4,2,1,5,2,2,2,3,3,4,4,2,2,1,3,2,2];
if (baseCosts.length !== 89) throw new Error(`expected 89 base costs, got ${baseCosts.length}`);

const baseStart = 61;
const rows = names.map((cardName, index) => {
  const imageNo = index + 1;
  const normalNo = imageNo >= baseStart ? imageNo - 60 : null;
  const isTwinpact = cardName.includes('／');
  const specialNumber = imageNo <= 5 ? `SPR${imageNo}/SPR5`
    : imageNo <= 15 ? `PR${imageNo - 5}/PR10`
    : imageNo <= 25 ? `PR${imageNo - 15}超/PR10`
    : imageNo <= 30 ? `SPR㊙${imageNo - 25}超/SPR㊙5`
    : imageNo <= 60 ? `MC${imageNo - 30}/MC30`
    : null;
  const rarity = normalNo === 1 ? 'V'
    : normalNo === 2 ? 'KGM'
    : normalNo && normalNo <= 16 ? 'SR'
    : normalNo && normalNo <= 35 ? 'VR'
    : normalNo && normalNo <= 51 ? 'R'
    : normalNo && normalNo <= 69 ? 'U'
    : normalNo ? 'C'
    : imageNo <= 5 ? null
    : imageNo <= 25 ? 'キャラプレミアムトレジャー'
    : imageNo <= 30 ? 'シークレット'
    : 'MC';
  return {
    source_image_url: `https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/${String(imageNo).padStart(3, '0')}.jpg`,
    card_number: normalNo ? `${normalNo}/89` : specialNumber,
    card_name: cardName,
    civilization: null,
    cost: normalNo ? baseCosts[normalNo - 1] : null,
    card_type: isTwinpact ? 'ツインパクト' : null,
    rarity,
    is_twinpact: isTwinpact,
    illustration_variant: imageNo <= 60 ? (imageNo <= 15 ? 'special_illustration' : imageNo <= 30 ? 'alternate_illustration' : 'manga_illustration') : 'standard',
    finish_variant: null,
    review_status: imageNo <= 60 ? 'variant_only' : 'needs_review',
    review_note: imageNo <= 60
      ? '公式画像で名称を確認。特殊番号と分類は公式画像を優先しDMWikiの収録一覧で照合。通常版との同一性はカード名だけでは確定しない。'
      : '公式商品ページ画像を目視確認。番号・名称・コストを公式画像で確認し、レアリティ区分をDMWikiでも照合。文明またはカード種類が未確定のためneeds_review。',
    field_sources: {
      card_number: 'official', card_name: 'official', rarity: rarity ? (normalNo ? 'dmwiki' : 'official') : 'unresolved',
      civilization: 'unresolved', cost: normalNo ? 'official' : 'unresolved', card_type: isTwinpact ? 'official' : 'unresolved'
    },
    source_conflict: false,
    source_conflict_note: null
  };
});

const out = resolve('scripts/fixtures/dm26-ex2-official-preview.reviewed.json');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
console.log(`wrote ${rows.length} rows to ${out}`);
