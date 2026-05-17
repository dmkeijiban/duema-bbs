/**
 * 1週間分X投稿一括生成
 * buildWeeklyPosts(startDateStr, existingTitles) → WeeklyPostInsert[]
 * 7日 × 4枠 = 28件
 *
 * スロット構成
 *  7:00  軽め共感系
 * 12:00  優勝🏆系（固定フォーマット）
 * 19:00  長時間悩む系 / 高騰下落 / チャレンジ枠
 * 22:00  懐古・エモ共感
 */

import { generateThreadLines } from './x-post-templates'

export type WeeklyPostInsert = {
  post_type: string
  title: string | null
  thread_lines: string[]
  image_urls: string[]
  meta: Record<string, unknown>
  status: string
  scheduled_at: string
  source_ref: string
}

interface Template {
  post_type: string
  title: string
  thread_lines: string[]
}

// ----------------------------------------------------------------
// 7:00 — 軽め共感系 (10候補)
// ----------------------------------------------------------------
const MORNING_POOL: Template[] = [
  {
    post_type: 'custom',
    title: 'デュエマ用語が日常に溢れる',
    thread_lines: [
      'デュエマやってると日常会話に\n「シールド」「バトルゾーン」「タップ」\nが自然に出てきてしまう問題😂\n\nデュエマおじさんあるあるだろ？',
    ],
  },
  {
    post_type: 'custom',
    title: 'デッキ選択の葛藤',
    thread_lines: [
      '大会前夜\n「このデッキで行く！」→「やっぱり違う」を\n3回繰り返したことある人👋\n\nデュエマプレイヤーは絶対あるあるのはず😂',
    ],
  },
  {
    post_type: 'custom',
    title: 'カードを売ったら即高騰',
    thread_lines: [
      'カードを売ったら次の日高騰する\nこれがデュエマプレイヤーの宿命😭\n\n「もう少し持っておけば…」\nってなった人いる？',
    ],
  },
  {
    post_type: 'custom',
    title: '「1枚だけ買う」の嘘',
    thread_lines: [
      '「1枚だけ買おう」\n→ 3枚追加注文してる\n\nカードゲームの呪いだよこれ😂\nデュエマあるあるすぎる',
    ],
  },
  {
    post_type: 'custom',
    title: 'デュエマ引退を宣言した日',
    thread_lines: [
      '「デュエマ引退する」\n→ 1週間後に復帰してた\n\nこれ何回繰り返したか分からない😅\nデュエマって辞められないんだよな',
    ],
  },
  {
    post_type: 'custom',
    title: '睡眠を削ってデッキ構築',
    thread_lines: [
      '「ちょっとだけデッキ考えよ」\n→ 気づいたら深夜3時\n\nデュエマプレイヤー全員心当たりあるでしょ😂',
    ],
  },
  {
    post_type: 'custom',
    title: 'S・トリガーへの信仰',
    thread_lines: [
      'S・トリガーを信じて\n負けそうでも諦めない気持ちになれるのが\nデュエマの最高なところだよ🔥\n\n奇跡を信じる心が大事',
    ],
  },
  {
    post_type: 'custom',
    title: '初めて知らないカードを見た瞬間',
    thread_lines: [
      '「え、こんなカードあったの！？」\nって久々のパック開封でなる瞬間\n最高すぎる😍\n\nデュエマはまだまだ知らないカードだらけ',
    ],
  },
  {
    post_type: 'custom',
    title: 'デッキレシピ公開への緊張',
    thread_lines: [
      '自分のデッキレシピを公開するときの\nドキドキ感、分かる？😅\n「批判されたらどうしよう」って\n毎回なる',
    ],
  },
  {
    post_type: 'custom',
    title: '相手の顔が見えない対戦の面白さ',
    thread_lines: [
      'デュエマの相手の顔が見えない分\n「絶対今焦ってるだろ」ってニヤニヤしながら\nプレイするの楽しすぎる😂\n\nオンライン対戦あるある',
    ],
  },
]

// ----------------------------------------------------------------
// 12:00 — 優勝🏆系 (12テーマ・固定フォーマット)
// ----------------------------------------------------------------
const WIN_THEMES: string[] = [
  '1コストのくせに強すぎる',
  '初心者に優しくない',
  '名前が長すぎる',
  'フィニッシャーになれる',
  '除去されると困る',
  'コンボに使えそう',
  '絵が怖い',
  '進化元にぴったり',
  '持っててよかったと思う',
  '環境で見ない',
  '再録してほしい',
  '絶対に失いたくない',
]

// ----------------------------------------------------------------
// 19:00 — 長時間悩む系 / 高騰下落 / チャレンジ枠 (7候補)
// ----------------------------------------------------------------
const EVENING_POOL: Template[] = [
  {
    post_type: 'giron',
    title: '強いデッキ vs 好きなデッキ',
    thread_lines: [
      '【デュエマ論争🔥】\n\n"強いデッキ vs 好きなデッキ"\n\nみんなはどっちを使う？',
      '強いデッキで勝つのも楽しいけど\n好きなデッキで勝ったときの快感はまた別物\n\nどっち派？コメントで教えて！',
    ],
  },
  {
    post_type: 'kouton',
    title: 'スーパーレアの相場変動',
    thread_lines: [
      '【デュエマ高騰情報📈】\n\n最近スーパーレアクラスのカードの相場が\nジワジワ動いています\n\n環境変化とともにチェックしておきたい',
      '持ってるカードは定期的に相場確認を！\n意外なカードが高騰してることも😲',
    ],
  },
  {
    post_type: 'iwakan',
    title: 'シールドが0の緊張感',
    thread_lines: [
      'デュエマあるある【違和感】\n\nシールドが0になってから\nなぜか全力になる\n\nこれってなんかおかしくない？🤔',
      '最初から全力でやれよって話なんだけど\n追い詰められてから覚醒するのがデュエマ',
    ],
  },
  {
    post_type: 'giron',
    title: 'ガチャ vs シングル購入',
    thread_lines: [
      '【デュエマ論争🔥】\n\n"パックを剥く vs シングル買い"\n\nどっちが正解？',
      '剥く楽しさ vs 確実に揃える効率\n\n賛成（パック派）：👍\nシングル派：👎\n\nコメントで教えて！',
    ],
  },
  {
    post_type: 'kouton',
    title: '殿堂カードの価値',
    thread_lines: [
      '【デュエマ高騰情報📈】\n\n殿堂・プレミアム殿堂カードの相場\nいつの間にか動いてることが多い\n\n最新情報は常にチェックを！',
    ],
  },
  {
    post_type: 'iwakan',
    title: '1ターン目マナ置きの悩み',
    thread_lines: [
      'デュエマあるある【違和感】\n\n1ターン目に何をマナに置くか\n5分悩んでしまう\n\nこれ絶対おかしいよな？🤔',
      '「とりあえず低コストを…いや、あのカードは残したい」\nって毎回なる',
    ],
  },
  {
    post_type: 'giron',
    title: '環境デッキへの賛否',
    thread_lines: [
      '【デュエマ論争🔥】\n\n"環境最強デッキを使うのはアリかナシか"\n\nみんなの意見が聞きたい🤔',
      '勝ちたいなら環境デッキが正直強い\nでも「自分らしさ」を出したい気持ちもある\n\nどっち派？コメントで！',
    ],
  },
]

// ----------------------------------------------------------------
// 22:00 — 懐古・エモ共感 (10候補)
// ----------------------------------------------------------------
const NIGHT_POOL: Template[] = [
  {
    post_type: 'roujinkai',
    title: '初めてデュエマをした日',
    thread_lines: [
      '【デュエマ老人会👴】\n初めてデュエマをした日のこと\n覚えてますか？\n\nあの頃のドキドキ感、忘れられないな…',
      '最初に使ったデッキ、何でしたか？\n昔話を語りましょう👴',
    ],
  },
  {
    post_type: 'custom',
    title: '深夜のデッキ思考',
    thread_lines: [
      '深夜に布団の中で\n「このカードとこのカードでコンボできるんじゃ…」\nって閃いてしまうデュエマプレイヤーへ\n\n全員おかしいぞ笑',
    ],
  },
  {
    post_type: 'roujinkai',
    title: '学校の休み時間のデュエマ',
    thread_lines: [
      '【デュエマ老人会👴】\n学校の休み時間にデュエマしてた頃\nが懐かしい\n\n放課後も友達の家でずっとやってたよなぁ👴',
    ],
  },
  {
    post_type: 'custom',
    title: 'カードの匂いの記憶',
    thread_lines: [
      '新品パックの封を開けた時の\nあの独特の匂い\n\n嗅いだ瞬間に学生時代に戻れる気がするのは\nデュエマプレイヤーだけだと思う',
    ],
  },
  {
    post_type: 'roujinkai',
    title: '親にカードを捨てられた記憶',
    thread_lines: [
      '【デュエマ老人会👴】\n親に「こんなカードの山、捨てるよ！」\nって言われた記憶\n\n今思えば高額カードもあったかも…😭',
    ],
  },
  {
    post_type: 'custom',
    title: '引退したはずの友人との再戦',
    thread_lines: [
      '「デュエマ引退した」って言ってた友達と\n久しぶりに集まったら\n結局デュエマやってる\n\nこれが本当のデュエマあるある🥲',
    ],
  },
  {
    post_type: 'custom',
    title: '昔持っていた幻のデッキ',
    thread_lines: [
      'あの頃組んでたデッキ\n今見たら相当なお宝だったかも…\n\n売らなければよかった後悔は\nデュエマプレイヤー全員持ってると思う😭',
    ],
  },
  {
    post_type: 'roujinkai',
    title: 'デュエマを友達に教えた日',
    thread_lines: [
      '【デュエマ老人会👴】\n友達にデュエマを教えた日\n「そんな楽しいゲームがあるのか！」\nってなってたあの頃が懐かしい👴',
    ],
  },
  {
    post_type: 'custom',
    title: 'ゲームショップで過ごした時間',
    thread_lines: [
      '地元のカードショップで\nトレードしながら過ごした放課後\n\nあの空間がなくなってしまったの\n本当に寂しいよな…🥲',
    ],
  },
  {
    post_type: 'custom',
    title: '最強デッキだった頃の思い出',
    thread_lines: [
      '「俺のデッキ最強！」\nって思ってた頃が懐かしい\n\nあの純粋な自信はどこへ消えたのか😂\n大人になったってことかな',
    ],
  },
]

// ----------------------------------------------------------------
// helpers
// ----------------------------------------------------------------

/** YYYY-MM-DD に days 日を加算して返す */
function addDays(dateStr: string, days: number): string {
  // `T00:00:00+09:00` で JST の 0 時として解釈させる
  const d = new Date(`${dateStr}T00:00:00+09:00`)
  d.setUTCDate(d.getUTCDate() + days)
  // ISO 文字列の先頭10文字が日付
  // JST は UTC+9 なので getUTCDate ずらし後に再計算
  return new Date(d.getTime()).toISOString().slice(0, 10)
}

/** YYYY-MM-DDTHH:00:00+09:00 形式の JST 文字列を返す */
function jstIso(dateStr: string, hour: number): string {
  const hh = String(hour).padStart(2, '0')
  return `${dateStr}T${hh}:00:00+09:00`
}

/**
 * pool から n 件選ぶ。existingTitles に含まれないものを優先し、
 * 足りない場合は pool から循環して補う。
 */
function pickTemplates(pool: Template[], existingTitles: string[], n: number): Template[] {
  const used = new Set(existingTitles)
  const unused = pool.filter((t) => !used.has(t.title))
  const source = unused.length >= n ? unused : pool
  const result: Template[] = []
  for (let i = 0; i < n; i++) {
    result.push(source[i % source.length])
  }
  return result
}

/** 文字列プールから n 件選ぶ（未使用優先・循環補完） */
function pickStrings(pool: string[], existingTitles: string[], n: number): string[] {
  const used = new Set(existingTitles)
  const unused = pool.filter((t) => !used.has(t))
  const source = unused.length >= n ? unused : pool
  const result: string[] = []
  for (let i = 0; i < n; i++) {
    result.push(source[i % source.length])
  }
  return result
}

// ----------------------------------------------------------------
// main export
// ----------------------------------------------------------------

/**
 * startDateStr: "YYYY-MM-DD"（開始日・JST）
 * existingTitles: 既存 x_posts の title 一覧（重複回避用）
 * → 28件の WeeklyPostInsert を返す
 */
export function buildWeeklyPosts(
  startDateStr: string,
  existingTitles: string[],
): WeeklyPostInsert[] {
  const posts: WeeklyPostInsert[] = []

  const morningPick = pickTemplates(MORNING_POOL, existingTitles, 7)
  const winThemePick = pickStrings(WIN_THEMES, existingTitles, 7)
  const eveningPick = pickTemplates(EVENING_POOL, existingTitles, 7)
  const nightPick = pickTemplates(NIGHT_POOL, existingTitles, 7)

  for (let day = 0; day < 7; day++) {
    const dateStr = addDays(startDateStr, day)

    // 7:00 軽め共感系
    const m = morningPick[day]
    posts.push({
      post_type: m.post_type,
      title: m.title,
      thread_lines: m.thread_lines,
      image_urls: [],
      meta: {},
      status: 'draft',
      scheduled_at: jstIso(dateStr, 7),
      source_ref: 'weekly-auto',
    })

    // 12:00 優勝🏆系
    const winTheme = winThemePick[day]
    posts.push({
      post_type: 'win',
      title: winTheme,
      thread_lines: generateThreadLines('win', winTheme, 'normal'),
      image_urls: [],
      meta: {},
      status: 'draft',
      scheduled_at: jstIso(dateStr, 12),
      source_ref: 'weekly-auto',
    })

    // 19:00 長時間悩む系 / 高騰下落 / チャレンジ枠
    const e = eveningPick[day]
    posts.push({
      post_type: e.post_type,
      title: e.title,
      thread_lines: e.thread_lines,
      image_urls: [],
      meta: {},
      status: 'draft',
      scheduled_at: jstIso(dateStr, 19),
      source_ref: 'weekly-auto',
    })

    // 22:00 懐古・エモ共感
    const n = nightPick[day]
    posts.push({
      post_type: n.post_type,
      title: n.title,
      thread_lines: n.thread_lines,
      image_urls: [],
      meta: {},
      status: 'draft',
      scheduled_at: jstIso(dateStr, 22),
      source_ref: 'weekly-auto',
    })
  }

  return posts
}
