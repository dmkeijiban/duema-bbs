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
  /** 初回指定（この施行日での変更内容）例: 「無制限 → 殿堂入り」 */
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
]

/** スラッグから殿堂特集エントリを取得（なければ null） */
export function getHallEntry(slug: string): HallEntry | null {
  return HALL_OF_FAME_ENTRIES.find(e => e.slug === slug) ?? null
}
