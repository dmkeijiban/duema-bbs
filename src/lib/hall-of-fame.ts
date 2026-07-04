// 思い出図鑑「殿堂・プレミアム殿堂図鑑」特集の静的データ。
//
// これは公式の最新殿堂レギュレーション一覧ではなく、
// 過去に環境へ大きな影響を与えた殿堂カードを振り返る思い出図鑑内の特集ページ用データ。
// 文章はDMWiki等から転載せず、事実データ（指定日・履歴）のみを扱う。
//
// 将来、他の施行日を追加する場合は HALL_OF_FAME_ENTRIES に HallEntry を1件足すだけでよい。

/** 殿堂特集に載せる1枚分のカード情報 */
export type HallCard = {
  /** カード名（《》は表示側で付与しない。データ内に含める） */
  name: string
  /** その施行日で起きた状態変更（このページの主役表示）。例: 「無制限 → 殿堂入り」。表示ラベルは付けない */
  initial: string
  /** その後の変遷（任意。施行日以降にさらに変動した場合の概要） */
  later?: string
  /** カードの簡単な説明 */
  description: string
  /** 履歴（無制限/殿堂入り/プレミアム殿堂…の時系列ステップ） */
  history: string[]
  /** 公式カード画像URL（任意。未設定や読み込み失敗時はプレースホルダ表示） */
  imageUrl?: string
  /** 公式カード詳細ページURL（任意。出典リンク／画像クリック先） */
  officialUrl?: string
  /**
   * 複数カード画像（任意）。プレミアム殿堂コンビなど複数枚を並べたい場合に使う。
   * 設定されている場合は imageUrl の1枚表示ではなく、これらを横並び（スマホは横スクロール）で表示する。
   */
  images?: { src: string; name: string }[]
}

// 公式カード画像・詳細ページのURLを id から組み立てる（外部APIは使わず静的に保持）。
const officialImage = (id: string) => `https://dm.takaratomy.co.jp/wp-content/card/cardimage/${id}.jpg`
const officialPage = (id: string) => `https://dm.takaratomy.co.jp/card/detail/?id=${id}`

/** 1施行日分の殿堂特集エントリ */
export type HallEntry = {
  /** URLスラッグ兼識別子。例: '2004-03-15' */
  slug: string
  /** 表示用の施行日ラベル。例: '2004年3月15日' */
  dateLabel: string
  /** ページタイトル */
  title: string
  /** ページ説明 */
  description: string
  /** この施行日で指定されたカード一覧 */
  cards: HallCard[]
}

export const OFFICIAL_REGULATION_URL = 'https://dm.takaratomy.co.jp/rule/regulation/'

export const HALL_OF_FAME_ENTRIES: HallEntry[] = [
  {
    slug: '2004-03-15',
    dateLabel: '2004年3月15日',
    title: '2004年3月15日 殿堂発表',
    description: 'デュエル・マスターズ初期に初めて殿堂入りしたカードたちを振り返るページです。',
    cards: [
      {
        name: '《サイバー・ブレイン》',
        initial: '無制限 → 殿堂入り',
        later: 'プレミアム殿堂 → 殿堂入り → 無制限',
        description: '初期デュエマを代表する強力ドロー呪文。',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm01-052'),
        officialUrl: officialPage('dm01-052'),
      },
      {
        name: '《アストラル・リーフ》',
        initial: '無制限 → 殿堂入り',
        later: '無制限',
        description: '青単速攻や進化クリーチャーの象徴的存在。',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm04-002'),
        officialUrl: officialPage('dm04-002'),
      },
      {
        name: '《エメラル》',
        initial: '無制限 → 殿堂入り',
        description: 'シールド操作で多くのデッキに採用されたカード。',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm03-042'),
        officialUrl: officialPage('dm03-042'),
      },
      {
        name: '《ストリーミング・シェイパー》',
        initial: '無制限 → 殿堂入り',
        description: '水文明デッキの手札補充を支えた呪文。',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm03-011'),
        officialUrl: officialPage('dm03-011'),
      },
      {
        name: '《ディープ・オペレーション》',
        initial: '無制限 → 殿堂入り',
        later: '無制限',
        description: '大量ドローが狙える初期の水文明呪文。',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm02-026'),
        officialUrl: officialPage('dm02-026'),
      },
    ],
  },
  {
    slug: '2005-03-15',
    dateLabel: '2005年3月15日',
    title: '2005年3月15日 殿堂発表',
    description: '2005年3月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《アクアン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm04-010'),
        officialUrl: officialPage('dm04-010'),
      },
    ],
  },
  {
    slug: '2005-07-15',
    dateLabel: '2005年7月15日',
    title: '2005年7月15日 殿堂発表',
    description: '2005年7月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《スケルトン・バイス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm08-014'),
        officialUrl: officialPage('dm08-014'),
      },
      {
        name: '《無双竜機ボルバルザーク》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm10-009'),
        officialUrl: officialPage('dm10-009'),
      },
      {
        name: '《ヘル・スラッシュ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm06-057'),
        officialUrl: officialPage('dm06-057'),
      },
      {
        name: '《ロスト・チャージャー》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm09-014'),
        officialUrl: officialPage('dm09-014'),
      },
    ],
  },
  {
    slug: '2006-03-15',
    dateLabel: '2006年3月15日',
    title: '2006年3月15日 殿堂発表',
    description: '2006年3月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《炎槍と水剣の裁》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '無制限'],
        imageUrl: officialImage('dm13-031'),
        officialUrl: officialPage('dm13-031'),
      },
      {
        name: '《無双竜機ボルバルザーク》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm10-009'),
        officialUrl: officialPage('dm10-009'),
      },
    ],
  },
  {
    slug: '2007-01-15',
    dateLabel: '2007年1月15日',
    title: '2007年1月15日 殿堂発表',
    description: '2007年1月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《ヘル・スラッシュ》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm06-057'),
        officialUrl: officialPage('dm06-057'),
      },
      {
        name: '《ロスト・チャージャー》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm09-014'),
        officialUrl: officialPage('dm09-014'),
      },
      {
        name: '《ボルメテウス・サファイア・ドラゴン》',
        initial: '無制限 → プレミアム殿堂',
        description: '',
        history: ['無制限', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmc27-004'),
        officialUrl: officialPage('dmc27-004'),
      },
      {
        name: '《フューチャー・スラッシュ》',
        initial: '無制限 → プレミアム殿堂',
        description: '',
        history: ['無制限', 'プレミアム殿堂'],
        imageUrl: officialImage('promoy3-023'),
        officialUrl: officialPage('promoy3-023'),
      },
    ],
  },
  {
    slug: '2007-08-15',
    dateLabel: '2007年8月15日',
    title: '2007年8月15日 殿堂発表',
    description: '2007年8月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《アクア・パトロール》',
        initial: '無制限 → プレミアム殿堂',
        description: '',
        history: ['無制限', 'プレミアム殿堂'],
        imageUrl: officialImage('dm15-002'),
        officialUrl: officialPage('dm15-002'),
      },
    ],
  },
  {
    slug: '2007-11-15',
    dateLabel: '2007年11月15日',
    title: '2007年11月15日 殿堂発表',
    description: '2007年11月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《炎槍と水剣の裁》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '無制限'],
        imageUrl: officialImage('dm13-031'),
        officialUrl: officialPage('dm13-031'),
      },
      {
        name: '《クローン・バイス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm12-026'),
        officialUrl: officialPage('dm12-026'),
      },
      {
        name: '《予言者マリエル》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm08-008'),
        officialUrl: officialPage('dm08-008'),
      },
    ],
  },
  {
    slug: '2007-11-23',
    dateLabel: '2007年11月23日',
    title: '2007年11月23日 殿堂発表',
    description: '2007年11月23日の殿堂発表で指定されたプレミアム殿堂コンビを振り返るページです。',
    cards: [
      {
        // プレミアム殿堂コンビ（単体カードではなくコンビ指定）。3枚の画像を並べて表示する。
        name: '《龍仙ロマネスク》と《母なる大地》または《母なる紋章》',
        initial: '無制限 → プレミアム殿堂コンビ',
        description: '',
        history: ['無制限', 'プレミアム殿堂コンビ', '無制限'],
        imageUrl: officialImage('dm25-s04'),
        officialUrl: officialPage('dm25-s04'),
        images: [
          { src: officialImage('dm25-s04'), name: '龍仙ロマネスク' },
          { src: officialImage('dm10-036'), name: '母なる大地' },
          { src: officialImage('dmx01-010'), name: '母なる紋章' },
        ],
      },
    ],
  },
  {
    slug: '2008-04-15',
    dateLabel: '2008年4月15日',
    title: '2008年4月15日 殿堂発表',
    description: '2008年4月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《アクア・ハルカス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmex08-247'),
        officialUrl: officialPage('dmex08-247'),
      },
      {
        name: '《呪紋の化身》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm07-019'),
        officialUrl: officialPage('dm07-019'),
      },
      {
        name: '《母なる大地》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmc39-025'),
        officialUrl: officialPage('dmc39-025'),
      },
      {
        name: '《魂と記憶の盾》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm23bd7-043'),
        officialUrl: officialPage('dm23bd7-043'),
      },
      {
        name: '《パシフィック・チャンピオン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmx22b-067'),
        officialUrl: officialPage('dmx22b-067'),
      },
      {
        name: '《インフェルノ・ゲート》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmc44-027'),
        officialUrl: officialPage('dmc44-027'),
      },
      {
        name: '《インフィニティ・ドラゴン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dmx16-006'),
        officialUrl: officialPage('dmx16-006'),
      },
      {
        name: '《超竜バジュラ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm25ex1-PR4'),
        officialUrl: officialPage('dm25ex1-PR4'),
      },
    ],
  },
  {
    slug: '2008-10-15',
    dateLabel: '2008年10月15日',
    title: '2008年10月15日 殿堂発表',
    description: '2008年10月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《バジュラズ・ソウル》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmex17-Cho07'),
        officialUrl: officialPage('dmex17-Cho07'),
      },
      {
        name: '《凶星王ダーク・ヒドラ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmex17-Cho03'),
        officialUrl: officialPage('dmex17-Cho03'),
      },
      {
        name: '《スケルトン・バイス》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm08-014'),
        officialUrl: officialPage('dm08-014'),
      },
    ],
  },
  {
    slug: '2009-04-15',
    dateLabel: '2009年4月15日',
    title: '2009年4月15日 殿堂発表',
    description: '2009年4月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《凶星王ダーク・ヒドラ》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmex17-Cho03'),
        officialUrl: officialPage('dmex17-Cho03'),
      },
      {
        name: '《母なる大地》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmc39-025'),
        officialUrl: officialPage('dmc39-025'),
      },
      {
        name: '《雷鳴の守護者ミスト・リエス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('promoy1-019'),
        officialUrl: officialPage('promoy1-019'),
      },
      {
        name: '《ソウル・アドバンテージ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm28-027'),
        officialUrl: officialPage('dm28-027'),
      },
      {
        name: '《母なる紋章》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmx01-010'),
        officialUrl: officialPage('dmx01-010'),
      },
      {
        name: '《英知と追撃の宝剣》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm24ex1-SP5'),
        officialUrl: officialPage('dm24ex1-SP5'),
      },
      {
        name: '《龍仙ロマネスク》と《母なる大地》または《母なる紋章》',
        initial: 'プレミアム殿堂コンビ → 無制限',
        description: '',
        history: ['無制限', 'プレミアム殿堂コンビ', '無制限'],
        imageUrl: officialImage('dm25-s04'),
        officialUrl: officialPage('dm25-s04'),
        images: [
          { src: officialImage('dm25-s04'), name: '龍仙ロマネスク' },
          { src: officialImage('dm10-036'), name: '母なる大地' },
          { src: officialImage('dmx01-010'), name: '母なる紋章' },
        ],
      },
    ],
  },
  {
    slug: '2009-12-19',
    dateLabel: '2009年12月19日',
    title: '2009年12月19日 殿堂発表',
    description: '2009年12月19日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《呪紋の化身》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm07-019'),
        officialUrl: officialPage('dm07-019'),
      },
      {
        name: '《インフェルノ・ゲート》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmc44-027'),
        officialUrl: officialPage('dmc44-027'),
      },
      {
        name: '《ソウル・アドバンテージ》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm28-027'),
        officialUrl: officialPage('dm28-027'),
      },
      {
        name: '《不滅の精霊パーフェクト・ギャラクシー》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('28-SEC001'),
        officialUrl: officialPage('28-SEC001'),
      },
      {
        name: '《聖鎧亜キング・アルカディアス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm24ex4-013'),
        officialUrl: officialPage('dm24ex4-013'),
      },
      {
        name: '《インフェルノ・サイン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm23bd7-054'),
        officialUrl: officialPage('dm23bd7-054'),
      },
    ],
  },
  {
    slug: '2010-05-15',
    dateLabel: '2010年5月15日',
    title: '2010年5月15日 殿堂発表',
    description: '2010年5月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《聖鎧亜キング・アルカディアス》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm24ex4-013'),
        officialUrl: officialPage('dm24ex4-013'),
      },
      {
        name: '《パラダイス・アロマ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmex08-296'),
        officialUrl: officialPage('dmex08-296'),
      },
      {
        name: '《蒼狼の始祖アマテラス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmd13-013'),
        officialUrl: officialPage('dmd13-013'),
      },
      {
        name: '《龍仙ロマネスク》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm25ex1-PR5'),
        officialUrl: officialPage('dm25ex1-PR5'),
      },
      {
        name: '《エンペラー・キリコ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り'],
        imageUrl: officialImage('promoy25-019'),
        officialUrl: officialPage('promoy25-019'),
      },
      {
        name: '《スパイラル・ゲート》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmex08-257'),
        officialUrl: officialPage('dmex08-257'),
      },
    ],
  },
  {
    slug: '2011-01-15',
    dateLabel: '2011年1月15日',
    title: '2011年1月15日 殿堂発表',
    description: '2011年1月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《アクアン》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm04-010'),
        officialUrl: officialPage('dm04-010'),
      },
      {
        name: '《サイバー・ブレイン》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm01-052'),
        officialUrl: officialPage('dm01-052'),
      },
      {
        name: '《光牙忍ハヤブサマル》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('promoy24-052'),
        officialUrl: officialPage('promoy24-052'),
      },
      {
        name: '《龍神ヘヴィ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm23ex1-018'),
        officialUrl: officialPage('dm23ex1-018'),
      },
      {
        name: '《魔光蟲ヴィルジニア卿》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmpcd03-b10'),
        officialUrl: officialPage('dmpcd03-b10'),
      },
      {
        name: '《威牙の幻ハンゾウ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm24bd4-005'),
        officialUrl: officialPage('dm24bd4-005'),
      },
      {
        name: '《邪神M・ロマノフ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り'],
        imageUrl: officialImage('dmex17-037'),
        officialUrl: officialPage('dmex17-037'),
      },
      {
        name: '《ラッキー・ダーツ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('promoy23-y100'),
        officialUrl: officialPage('promoy23-y100'),
      },
      {
        name: '《転生プログラム》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmx22b-137'),
        officialUrl: officialPage('dmx22b-137'),
      },
      {
        name: '《ハイドロ・ハリケーン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dmex08-131'),
        officialUrl: officialPage('dmex08-131'),
      },
    ],
  },
  {
    slug: '2011-07-23',
    dateLabel: '2011年7月23日',
    title: '2011年7月23日 殿堂発表',
    description: '2011年7月23日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《時空の支配者ディアボロス Z》/《最凶の覚醒者デビル・ディアボロス Z》と《超次元バイス・ホール》',
        initial: '無制限 → プレミアム殿堂超次元コンビ',
        description: '',
        history: ['無制限', 'プレミアム殿堂超次元コンビ', '無制限'],
        imageUrl: officialImage('dm26rp1-TR009'),
        officialUrl: officialPage('dm26rp1-TR009'),
        images: [
          { src: officialImage('dm26rp1-TR009'), name: '時空の支配者ディアボロス Z / 最凶の覚醒者デビル・ディアボロス Z' },
          { src: officialImage('promoy10-019'), name: '超次元バイス・ホール' },
        ],
      },
      {
        name: '《超次元ドラヴィタ・ホール》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm37-023'),
        officialUrl: officialPage('dm37-023'),
      },
      {
        name: '《天雷の導士アヴァラルド公》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm23bd7-044'),
        officialUrl: officialPage('dm23bd7-044'),
      },
      {
        name: '《斬隠オロチ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dmbd18-se07'),
        officialUrl: officialPage('dmbd18-se07'),
      },
      {
        name: '《再誕の社》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm23bd5-042'),
        officialUrl: officialPage('dm23bd5-042'),
      },
      {
        name: '《王機聖者ミル・アーマ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmx22b-119'),
        officialUrl: officialPage('dmx22b-119'),
      },
      {
        name: '《ダンディ・ナスオ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm26rp1-074'),
        officialUrl: officialPage('dm26rp1-074'),
      },
    ],
  },
]

/** スラッグから殿堂特集エントリを取得（なければ null） */
export function getHallEntry(slug: string): HallEntry | null {
  return HALL_OF_FAME_ENTRIES.find(e => e.slug === slug) ?? null
}

/** 施行年（4桁）一覧を昇順で返す（例: ['2004','2005','2006','2007']） */
export function getHallYears(): string[] {
  const years = new Set(HALL_OF_FAME_ENTRIES.map(e => e.slug.slice(0, 4)))
  return Array.from(years).sort()
}

/** 指定した施行年のエントリ一覧を日付順（配列定義順）で返す */
export function getEntriesByYear(year: string): HallEntry[] {
  return HALL_OF_FAME_ENTRIES.filter(e => e.slug.startsWith(`${year}-`))
}

/**
 * 1施行日エントリから代表カード画像を最大3枚集める（年ページの日付カード用サムネ）。
 * コンビ殿堂など images を持つカードはその画像を優先し、無ければ各カードの imageUrl を使う。
 */
export function getEntryThumbnails(entry: HallEntry): { src: string; name: string }[] {
  const out: { src: string; name: string }[] = []
  for (const card of entry.cards) {
    if (card.images && card.images.length > 0) {
      for (const img of card.images) {
        out.push({ src: img.src, name: img.name })
        if (out.length >= 3) return out
      }
    } else if (card.imageUrl) {
      out.push({ src: card.imageUrl, name: card.name })
      if (out.length >= 3) return out
    }
  }
  return out
}

/** 指定した施行年の先頭カード画像を最大3枚集める（殿堂図鑑トップの年度カード用サムネ）。 */
export function getYearThumbnails(year: string): { src: string; name: string }[] {
  const out: { src: string; name: string }[] = []
  for (const entry of getEntriesByYear(year)) {
    for (const thumb of getEntryThumbnails(entry)) {
      out.push(thumb)
      if (out.length >= 3) return out
    }
  }
  return out
}
