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
        imageUrl: officialImage('dm01-080'),
        officialUrl: officialPage('dm01-080'),
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
        imageUrl: officialImage('dm10-036'),
        officialUrl: officialPage('dm10-036'),
      },
      {
        name: '《魂と記憶の盾》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm11-004'),
        officialUrl: officialPage('dm11-004'),
      },
      {
        name: '《パシフィック・チャンピオン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm13-009'),
        officialUrl: officialPage('dm13-009'),
      },
      {
        name: '《インフェルノ・ゲート》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm19-027'),
        officialUrl: officialPage('dm19-027'),
      },
      {
        name: '《インフィニティ・ドラゴン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm22-015'),
        officialUrl: officialPage('dm22-015'),
      },
      {
        name: '《超竜バジュラ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm08-s04'),
        officialUrl: officialPage('dm08-s04'),
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
        imageUrl: officialImage('dm15-s04'),
        officialUrl: officialPage('dm15-s04'),
      },
      {
        name: '《凶星王ダーク・ヒドラ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('sp-005'),
        officialUrl: officialPage('sp-005'),
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
        imageUrl: officialImage('sp-005'),
        officialUrl: officialPage('sp-005'),
      },
      {
        name: '《母なる大地》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm10-036'),
        officialUrl: officialPage('dm10-036'),
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
        imageUrl: officialImage('dm24-030'),
        officialUrl: officialPage('dm24-030'),
      },
      {
        name: '《英知と追撃の宝剣》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm11-s03'),
        officialUrl: officialPage('dm11-s03'),
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
          { src: officialImage('dm24-030'), name: '母なる紋章' },
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
        imageUrl: officialImage('dm19-027'),
        officialUrl: officialPage('dm19-027'),
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
        imageUrl: officialImage('dm26-s03'),
        officialUrl: officialPage('dm26-s03'),
      },
      {
        name: '《インフェルノ・サイン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dmc44-001'),
        officialUrl: officialPage('dmc44-001'),
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
        imageUrl: officialImage('dm26-s03'),
        officialUrl: officialPage('dm26-s03'),
      },
      {
        name: '《パラダイス・アロマ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm16-042'),
        officialUrl: officialPage('dm16-042'),
      },
      {
        name: '《蒼狼の始祖アマテラス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm31-010'),
        officialUrl: officialPage('dm31-010'),
      },
      {
        name: '《龍仙ロマネスク》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm25-s04'),
        officialUrl: officialPage('dm25-s04'),
      },
      {
        name: '《エンペラー・キリコ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り'],
        imageUrl: officialImage('dm32-s03'),
        officialUrl: officialPage('dm32-s03'),
      },
      {
        name: '《スパイラル・ゲート》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm01-086'),
        officialUrl: officialPage('dm01-086'),
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
        imageUrl: officialImage('dm29-037'),
        officialUrl: officialPage('dm29-037'),
      },
      {
        name: '《龍神ヘヴィ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmc40-002'),
        officialUrl: officialPage('dmc40-002'),
      },
      {
        name: '《魔光蟲ヴィルジニア卿》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm30-044'),
        officialUrl: officialPage('dm30-044'),
      },
      {
        name: '《威牙の幻ハンゾウ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm29-003'),
        officialUrl: officialPage('dm29-003'),
      },
      {
        name: '《邪神M・ロマノフ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り'],
        imageUrl: officialImage('dmc58-003'),
        officialUrl: officialPage('dmc58-003'),
      },
      {
        name: '《ラッキー・ダーツ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm12-007'),
        officialUrl: officialPage('dm12-007'),
      },
      {
        name: '《転生プログラム》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm10-021'),
        officialUrl: officialPage('dm10-021'),
      },
      {
        name: '《ハイドロ・ハリケーン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm04-011'),
        officialUrl: officialPage('dm04-011'),
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
        imageUrl: officialImage('dm39-s05a'),
        officialUrl: officialPage('dm39-s05a'),
        images: [
          { src: officialImage('dm39-s05a'), name: '時空の支配者ディアボロス Z / 最凶の覚醒者デビル・ディアボロス Z' },
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
        imageUrl: officialImage('dm28-043'),
        officialUrl: officialPage('dm28-043'),
      },
      {
        name: '《斬隠オロチ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm29-002'),
        officialUrl: officialPage('dm29-002'),
      },
      {
        name: '《再誕の社》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm36-069'),
        officialUrl: officialPage('dm36-069'),
      },
      {
        name: '《王機聖者ミル・アーマ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmc52-004'),
        officialUrl: officialPage('dmc52-004'),
      },
      {
        name: '《ダンディ・ナスオ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm17-055'),
        officialUrl: officialPage('dm17-055'),
      },
    ],
  },
  {
    slug: '2012-03-15',
    dateLabel: '2012年3月15日',
    title: '2012年3月15日 殿堂発表',
    description: '2012年3月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《エンペラー・キリコ》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り'],
        imageUrl: officialImage('dm32-s03'),
        officialUrl: officialPage('dm32-s03'),
      },
      {
        name: '《邪神M・ロマノフ》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り'],
        imageUrl: officialImage('dmc58-003'),
        officialUrl: officialPage('dmc58-003'),
      },
      {
        name: '《母なる紋章》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm24-030'),
        officialUrl: officialPage('dm24-030'),
      },
      {
        name: '《カラフル・ダンス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm27-030'),
        officialUrl: officialPage('dm27-030'),
      },
    ],
  },
  {
    slug: '2012-08-11',
    dateLabel: '2012年8月11日',
    title: '2012年8月11日 殿堂発表',
    description: '2012年8月11日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《ボルバルザーク・エクス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmx04-s05'),
        officialUrl: officialPage('dmx04-s05'),
      },
      {
        name: '《次元流の豪力》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmr01-104'),
        officialUrl: officialPage('dmr01-104'),
      },
      {
        name: '《ビックリ・イリュージョン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm20-035'),
        officialUrl: officialPage('dm20-035'),
      },
      {
        name: '《偽りの名 ゾルゲ》と《紅蓮の怒 鬼流院 刃》',
        initial: '無制限 → プレミアム殿堂超次元コンビ',
        description: '',
        history: ['無制限', 'プレミアム殿堂超次元コンビ', '無制限'],
        imageUrl: officialImage('dmr03-s05'),
        officialUrl: officialPage('dmr03-s05'),
        images: [
          { src: officialImage('dmr03-s05'), name: '偽りの名 ゾルゲ' },
          { src: officialImage('dmx06-v01a'), name: '紅蓮の怒 鬼流院 刃' },
        ],
      },
    ],
  },
  {
    slug: '2013-03-15',
    dateLabel: '2013年3月15日',
    title: '2013年3月15日 殿堂発表',
    description: '2013年3月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《セブンス・タワー》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm14-109'),
        officialUrl: officialPage('dm14-109'),
      },
      {
        name: '《ミラクルとミステリーの扉》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り'],
        imageUrl: officialImage('dm26-049'),
        officialUrl: officialPage('dm26-049'),
      },
    ],
  },
  {
    slug: '2013-06-22',
    dateLabel: '2013年6月22日',
    title: '2013年6月22日 殿堂発表',
    description: '2013年6月22日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《ホーガン・ブラスター》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm39-026'),
        officialUrl: officialPage('dm39-026'),
      },
      {
        name: '《獰猛なる大地》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm27-012'),
        officialUrl: officialPage('dm27-012'),
      },
      {
        name: '《アクア・メルゲ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm37-010'),
        officialUrl: officialPage('dm37-010'),
      },
      {
        name: '《カモン・ピッピー》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmr03-026'),
        officialUrl: officialPage('dmr03-026'),
      },
    ],
  },
  {
    slug: '2014-03-15',
    dateLabel: '2014年3月15日',
    title: '2014年3月15日 殿堂発表',
    description: '2014年3月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《超次元バイス・ホール》',
        initial: '無制限 → プレミアム殿堂',
        description: '',
        history: ['無制限', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('promoy10-019'),
        officialUrl: officialPage('promoy10-019'),
      },
      {
        name: '《ミラクルとミステリーの扉》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂', '殿堂入り'],
        imageUrl: officialImage('dm26-049'),
        officialUrl: officialPage('dm26-049'),
      },
      {
        name: '《ガチンコ・ルーレット》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmr07-035'),
        officialUrl: officialPage('dmr07-035'),
      },
      {
        name: '《ポジトロン・サイン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm32-015'),
        officialUrl: officialPage('dm32-015'),
      },
      {
        name: '《希望の絆 鬼修羅》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmr08-s05'),
        officialUrl: officialPage('dmr08-s05'),
      },
      {
        name: '《パーロックのミラクルフィーバー》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmr01-021'),
        officialUrl: officialPage('dmr01-021'),
      },
      {
        name: '《盗掘人形モールス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm16-027'),
        officialUrl: officialPage('dm16-027'),
      },
      {
        name: '《時空の支配者ディアボロス Z》/《最凶の覚醒者デビル・ディアボロス Z》と《超次元バイス・ホール》',
        initial: 'プレミアム殿堂超次元コンビ → 無制限',
        description: '',
        history: ['無制限', 'プレミアム殿堂超次元コンビ', '無制限'],
        imageUrl: officialImage('dm39-s05a'),
        officialUrl: officialPage('dm39-s05a'),
        images: [
          { src: officialImage('dm39-s05a'), name: '時空の支配者ディアボロス Z / 最凶の覚醒者デビル・ディアボロス Z' },
          { src: officialImage('promoy10-019'), name: '超次元バイス・ホール' },
        ],
      },
    ],
  },
  {
    slug: '2014-05-24',
    dateLabel: '2014年5月24日',
    title: '2014年5月24日 殿堂発表',
    description: '2014年5月24日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《勝利宣言 鬼丸「覇」》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmr06-v01'),
        officialUrl: officialPage('dmr06-v01'),
      },
      {
        name: '《予言者ローラン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm36-012'),
        officialUrl: officialPage('dm36-012'),
      },
      {
        name: '《疾封怒闘 キューブリック》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dmr08s-005'),
        officialUrl: officialPage('dmr08s-005'),
      },
      {
        name: '《デビル・ドレーン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm03-014'),
        officialUrl: officialPage('dm03-014'),
      },
      {
        name: '《鎧亜の咆哮キリュー・ジルヴェス》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dm25-035'),
        officialUrl: officialPage('dm25-035'),
      },
      {
        name: '《陰陽の舞》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm39-034'),
        officialUrl: officialPage('dm39-034'),
      },
    ],
  },
  {
    slug: '2015-03-14',
    dateLabel: '2015年3月14日',
    title: '2015年3月14日 殿堂発表',
    description: '2015年3月14日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《蒼狼の始祖アマテラス》',
        initial: '殿堂入り → プレミアム殿堂',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dm31-010'),
        officialUrl: officialPage('dm31-010'),
      },
      {
        name: '《超次元ホワイトグリーン・ホール》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmr02-031'),
        officialUrl: officialPage('dmr02-031'),
      },
      {
        name: '《ミステリー・キューブ》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmr09-039'),
        officialUrl: officialPage('dmr09-039'),
      },
    ],
  },
  {
    slug: '2015-06-15',
    dateLabel: '2015年6月15日',
    title: '2015年6月15日 殿堂発表',
    description: '2015年6月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《魔天降臨》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dm10-026'),
        officialUrl: officialPage('dm10-026'),
      },
      {
        name: '《鎧亜戦隊ディス・マジシャン》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmr03-019'),
        officialUrl: officialPage('dmr03-019'),
      },
      {
        name: '《ヒラメキ・プログラム》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り', 'プレミアム殿堂'],
        imageUrl: officialImage('dmr05-022'),
        officialUrl: officialPage('dmr05-022'),
      },
      {
        name: '《暴龍警報》',
        initial: '無制限 → 殿堂入り',
        description: '',
        history: ['無制限', '殿堂入り'],
        imageUrl: officialImage('dmr14-051'),
        officialUrl: officialPage('dmr14-051'),
      },
    ],
  },
  {
    slug: '2015-09-19',
    dateLabel: '2015年9月19日',
    title: '2015年9月19日 殿堂発表',
    description: '2015年9月19日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《ボルメテウス・サファイア・ドラゴン》',
        initial: 'プレミアム殿堂 → 殿堂入り',
        description: '',
        history: ['無制限', 'プレミアム殿堂', '殿堂入り', '無制限'],
        imageUrl: officialImage('dmc27-004'),
        officialUrl: officialPage('dmc27-004'),
      },
    ],
  },
  {
    slug: '2015-12-15',
    dateLabel: '2015年12月15日',
    title: '2015年12月15日 殿堂発表',
    description: '2015年12月15日の殿堂発表で指定されたカードを振り返るページです。',
    cards: [
      {
        name: '《禁断 ～封印されしX～》/《伝説の禁断 ドキンダムX》',
        initial: '登場と同時に殿堂入り',
        description: '',
        history: ['殿堂入り', '無制限'],
        imageUrl: officialImage('dmr19-fl01a'),
        officialUrl: officialPage('dmr19-fl01'),
        images: [
          { src: officialImage('dmr19-fl01a'), name: '禁断 ～封印されしX～' },
          { src: officialImage('dmr19-fl01b'), name: '伝説の禁断 ドキンダムX' },
        ],
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
