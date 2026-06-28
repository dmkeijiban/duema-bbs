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

/**
 * 指定した施行年の代表カード画像を最大 max 枚集める（年度トップ一覧カードのサムネ用）。
 * その年のエントリを古い順（配列定義順）に見て、各カードの images（コンビ殿堂など）→ imageUrl の順で先頭から拾う。
 */
export function getYearThumbnails(year: string, max = 3): { src: string; name: string }[] {
  const out: { src: string; name: string }[] = []
  for (const entry of getEntriesByYear(year)) {
    for (const card of entry.cards) {
      if (card.images && card.images.length > 0) {
        for (const img of card.images) {
          out.push({ src: img.src, name: img.name })
          if (out.length >= max) return out
        }
      } else if (card.imageUrl) {
        out.push({ src: card.imageUrl, name: card.name })
        if (out.length >= max) return out
      }
    }
  }
  return out
}
