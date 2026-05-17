/**
 * X投稿テンプレート自動生成
 * generateThreadLines(postType, theme, tone, meta) → string[]
 * 各要素がひとつのツイート（\n---\n で区切られる前の単位）
 */

export type Tone = 'normal' | 'aggressive' | 'nostalgic' | 'debate'

// ----------------------------------------------------------------
// helpers
// ----------------------------------------------------------------

/** i-形容詞系で終わるテーマは「と思うカードを」形式にする */
function needsOmouForm(theme: string): boolean {
  return /(?:強い|弱い|すごい|ヤバい|ヤバ[Ii]|面白い|つまらない|難しい|かっこいい|カッコいい|かわいい|怖い|うれしい|悲しい|かなしい|たのしい|楽しい|つよい|よわい|かわいそう)$/.test(
    theme,
  )
}

// ----------------------------------------------------------------
// post type builders
// ----------------------------------------------------------------

function buildWin(theme: string, tone: Tone): string[] {
  const omou = needsOmouForm(theme)
  const verbPhrase = omou ? 'と思うカードを' : 'カードを'

  if (tone === 'aggressive') {
    return [
      `デュエマのカードで\n"${theme}"\n${verbPhrase}\n言えた人が優勝🏆`,
      `え、言えないの？\nそれデュエマやってないじゃん笑`,
    ]
  }
  if (tone === 'nostalgic') {
    return [
      `デュエマのカードで\n"${theme}"\n${verbPhrase}\n言えた人が優勝🏆`,
      `昔のデュエマを知ってる人にしか分からない問題です👴`,
    ]
  }
  if (tone === 'debate') {
    return [
      `デュエマのカードで\n"${theme}"\n${verbPhrase}\n言えた人が優勝🏆`,
      `みんなの答えが割れそう…\nコメントで教えて！`,
    ]
  }
  // normal
  return [`デュエマのカードで\n"${theme}"\n${verbPhrase}\n言えた人が優勝🏆`]
}

function buildRoujinkai(theme: string, tone: Tone): string[] {
  if (tone === 'aggressive') {
    return [
      `【デュエマ老人会👴】\n"${theme}"\nを知ってたら本物のデュエマおじさん`,
      `最近の子には絶対わからん\nおじさんだけ反応して😤`,
    ]
  }
  if (tone === 'debate') {
    return [
      `【デュエマ老人会👴】\n"${theme}"\nを知っている人、集まれ！`,
      `知ってる人はRT\n知らない人はコメントで教えて👴`,
    ]
  }
  if (tone === 'nostalgic') {
    return [
      `【デュエマ老人会👴】\nあの頃の"${theme}"\nを覚えていますか…`,
      `懐かしいなぁ\nあの頃のデュエマは最高だった👴`,
    ]
  }
  // normal
  return [`【デュエマ老人会👴】\n"${theme}"\nを知ってたら同世代👴`]
}

function buildIwakan(theme: string, tone: Tone): string[] {
  if (tone === 'aggressive') {
    return [
      `デュエマあるある【違和感】\n\n"${theme}"\n\nこれ絶対おかしいよな？？？`,
      `運営に問い詰めたい\nなんでこうなった😤`,
    ]
  }
  if (tone === 'debate') {
    return [
      `デュエマあるある【違和感】\n\n"${theme}"\n\nこれ、おかしいと思う人👍`,
      `おかしくないと思う人もコメントで！`,
    ]
  }
  if (tone === 'nostalgic') {
    return [
      `デュエマあるある【違和感】\n\n"${theme}"\n\n昔からずっとそうなんだよね…`,
    ]
  }
  // normal
  return [`デュエマあるある【違和感】\n\n"${theme}"\n\nこれってなんかおかしくない？🤔`]
}

function buildSilhouette(theme: string, tone: Tone): string[] {
  if (tone === 'aggressive') {
    return [
      `【シルエット選手権🕵️】\n\n${theme}\n\nこのシルエット何のカードか分かる？`,
      `分かった人はすごい！\n分からなかったら…修行不足だ💪`,
    ]
  }
  if (tone === 'debate') {
    return [
      `【シルエット選手権🕵️】\n\n${theme}\n\nこれ何のカードか分かる人いる？`,
      `コメントで答えてね！\nみんなの答えが割れそう…`,
    ]
  }
  if (tone === 'nostalgic') {
    return [
      `【シルエット選手権🕵️】\n\n${theme}\n\nこの懐かしいカード、名前が言えたら老人会認定👴`,
    ]
  }
  // normal
  return [`【シルエット選手権🕵️】\n\n${theme}\n\nこのシルエット、何のカードか分かる？`]
}

function buildKurekore(theme: string, tone: Tone): string[] {
  if (tone === 'aggressive') {
    return [
      `【黒歴史デュエマ😱】\n\n"${theme}"\n\nこれを許容してた当時の自分が恥ずかしい`,
      `みんなも黒歴史あるでしょ？\n正直に言えよ😤`,
    ]
  }
  if (tone === 'debate') {
    return [
      `【黒歴史デュエマ😱】\n\n"${theme}"\n\nこれ黒歴史だと思う人👍`,
      `懐かしいと思う人もいるはず\nコメントで教えて！`,
    ]
  }
  if (tone === 'nostalgic') {
    return [
      `【黒歴史デュエマ😱】\n\n"${theme}"\n\nあの頃の自分には戻れない…でも懐かしい`,
    ]
  }
  // normal
  return [`【黒歴史デュエマ😱】\n\n"${theme}"\n\nデュエマやってた頃を思い出して恥ずかしい`]
}

function buildGiron(theme: string, tone: Tone): string[] {
  if (tone === 'aggressive') {
    return [
      `【デュエマ論争🔥】\n\n"${theme}"\n\nこれ絶対に議論になるやつ`,
      `賛成派と反対派でコメント欄荒れそう\nどっち派？`,
    ]
  }
  if (tone === 'debate') {
    return [
      `【デュエマ論争🔥】\n\n"${theme}"\n\nみんなはどう思う？`,
      `賛成：👍\n反対：👎\n\nコメントで理由も教えて！`,
    ]
  }
  if (tone === 'nostalgic') {
    return [
      `【デュエマ論争🔥】\n\n"${theme}"\n\n昔からずっと議論されてきた問題…`,
    ]
  }
  // normal
  return [`【デュエマ論争🔥】\n\n"${theme}"\n\nこれについてみんなの意見が聞きたい🤔`]
}

function buildShare(
  theme: string,
  tone: Tone,
  meta?: Record<string, unknown>,
): string[] {
  const bullets = (meta?.bullets as string[] | undefined) ?? []
  const validBullets = bullets.filter((b) => b.trim())

  const bulletLines =
    validBullets.length > 0
      ? validBullets.map((b) => `・${b}`).join('\n')
      : '・盛り上がっています'

  if (tone === 'aggressive') {
    return [
      `【掲示板より🗣️】\n\n"${theme}"\n\nデュエマ掲示板でこんな話題が盛り上がってる！`,
      `${bulletLines}\n\nみんなはどう思う？`,
    ]
  }
  if (tone === 'debate') {
    return [
      `【掲示板より🗣️】\n\n"${theme}"\n\nデュエマ掲示板で話題になってるよ！`,
      `${bulletLines}\n\nコメントで意見を聞かせて！`,
    ]
  }
  if (tone === 'nostalgic') {
    return [
      `【掲示板より🗣️】\n\n"${theme}"\n\nデュエマ掲示板に懐かしい話題が！`,
      bulletLines,
    ]
  }
  // normal
  return [
    `【掲示板より🗣️】\n\n"${theme}"\n\nデュエマ掲示板で話題になってます！`,
    bulletLines,
  ]
}

function buildKouton(theme: string, tone: Tone): string[] {
  if (tone === 'aggressive') {
    return [
      `【デュエマ高騰情報📈】\n\n"${theme}"\n\nこれ持ってない人、今すぐ確認して！`,
      `手放してたら後悔するやつ\n気をつけて😤`,
    ]
  }
  if (tone === 'debate') {
    return [
      `【デュエマ相場情報📈】\n\n"${theme}"\n\n高騰？下落？\nみんなの見解を聞かせて！`,
    ]
  }
  if (tone === 'nostalgic') {
    return [
      `【デュエマ高騰情報📈】\n\n"${theme}"\n\n昔は安かったのに…時代は変わるね`,
    ]
  }
  // normal
  return [`【デュエマ高騰情報📈】\n\n"${theme}"\n\n最近の相場をチェックしてみて！`]
}

// ----------------------------------------------------------------
// main export
// ----------------------------------------------------------------

export function generateThreadLines(
  postType: string,
  theme: string,
  tone: Tone = 'normal',
  meta?: Record<string, unknown>,
): string[] {
  switch (postType) {
    case 'win':
      return buildWin(theme, tone)
    case 'roujinkai':
      return buildRoujinkai(theme, tone)
    case 'iwakan':
      return buildIwakan(theme, tone)
    case 'silhouette':
      return buildSilhouette(theme, tone)
    case 'kurekore':
      return buildKurekore(theme, tone)
    case 'giron':
      return buildGiron(theme, tone)
    case 'share':
      return buildShare(theme, tone, meta)
    case 'kouton':
      return buildKouton(theme, tone)
    default:
      return theme ? [theme] : []
  }
}

// ----------------------------------------------------------------
// 旧テンプレート関数（後方互換のためエクスポートを維持）
// ----------------------------------------------------------------
// 以下は古い tournament_result / silhouette_quiz 用のヘルパー。
// 現行 x_posts テーブルでは post_type として使われていないが、
// 他箇所から import している可能性があるため残しておく。

export interface TournamentResultParams {
  tournamentName: string
  date: string
  participants: number
  winner: string
  winnerDeck: string
  runnerUp?: string
  runnerUpDeck?: string
  siteUrl?: string
}

export function buildTournamentResultThread(params: TournamentResultParams): string[] {
  const {
    tournamentName,
    date,
    participants,
    winner,
    winnerDeck,
    runnerUp,
    runnerUpDeck,
    siteUrl = 'https://duema-bbs.com',
  } = params

  const lines: string[] = []
  lines.push(
    `🏆 大会結果速報！\n\n${tournamentName}\n📅 ${date}｜👥 ${participants}名参加\n\n優勝：${winner} 選手\n使用デッキ：${winnerDeck}\n\nおめでとうございます🎉`,
  )
  let tweet2 = `📊 大会詳細\n\n🥇 優勝｜${winner}（${winnerDeck}）\n`
  if (runnerUp && runnerUpDeck) {
    tweet2 += `🥈 準優勝｜${runnerUp}（${runnerUpDeck}）\n`
  }
  tweet2 += `\n詳細はデュエマ掲示板をチェック👇\n${siteUrl}`
  lines.push(tweet2)
  return lines
}

export interface QuizSilhouetteParams {
  quizNo: number
  hint?: string
  answer?: string
}

export function buildQuizSilhouetteThread(params: QuizSilhouetteParams): string[] {
  const { quizNo, hint, answer } = params
  if (answer) {
    return [
      `✅ 第${quizNo}回 シルエットクイズ 正解発表！\n\n正解は「${answer}」でした！\n\nわかりましたか？🎯\n\n#デュエマ #デュエルマスターズ #クイズ`,
    ]
  }
  let tweet =
    `🎮 第${quizNo}回 デュエマ シルエットクイズ！\n\nこのシルエット、何のデッキかわかるかな？🤔\n\n`
  if (hint) tweet += `💡 ヒント：${hint}\n\n`
  tweet += `答えは明日公開予定👀\n\n#デュエマ #デュエルマスターズ #クイズ`
  return [tweet]
}

export interface QuizOddOneOutParams {
  quizNo: number
  choices: string[]
  answerIndex?: number
  explanation?: string
}

export function buildQuizOddOneOutThread(params: QuizOddOneOutParams): string[] {
  const { quizNo, choices, answerIndex, explanation } = params
  const labels = ['A', 'B', 'C', 'D']
  if (answerIndex !== undefined) {
    const answer = choices[answerIndex]
    let tweet =
      `✅ 第${quizNo}回 仲間はずれクイズ 正解発表！\n\n正解は ${labels[answerIndex]}「${answer}」でした！\n`
    if (explanation) tweet += `\n${explanation}\n`
    tweet += `\n#デュエマ #デュエルマスターズ #クイズ`
    return [tweet]
  }
  let tweet =
    `🎯 第${quizNo}回 仲間はずれクイズ！\n\n1枚だけ仲間はずれのカードがあります。どれかな？🤔\n\n`
  choices.forEach((c, i) => {
    if (i < labels.length) tweet += `${labels[i]}. ${c}\n`
  })
  tweet += `\n答えは明日発表予定👀\n\n#デュエマ #デュエルマスターズ #クイズ`
  return [tweet]
}

export interface AnnouncementParams {
  title: string
  body: string
  url?: string
}

export function buildAnnouncementThread(params: AnnouncementParams): string[] {
  const { title, body, url } = params
  let tweet = `📢 ${title}\n\n${body}`
  if (url) tweet += `\n\n詳細はこちら👇\n${url}`
  tweet += `\n\n#デュエマ #デュエルマスターズ`
  return [tweet]
}
