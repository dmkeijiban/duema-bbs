import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../..')
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, 'drafts/articles')
const DM_WIKI_ORIGIN = 'https://dmwiki.net'
const OFFICIAL_CARD_ORIGIN = 'https://dm.takaratomy.co.jp'

const BANNED_TERMS = [
  'こんにちは',
  'あるいは、お久しぶりです',
  '皆様をご招待いたします',
  '掲示板向きの議論ポイントです',
  'この記事の下で語りましょう',
  '量産記事として',
  'SEO的に',
  '読者導線',
  'ガチまとめっぽく',
]

const HISTORY_KEYWORDS = [
  '勝舞',
  'ボルメテウス',
  'ヘヴィ',
  'メタル',
  'ゴッド',
  'インビンシブル',
  'デル・フィン',
  'チャクラ',
  'ヴェノム',
  'ランブル',
  'ボルシャック',
  'ロマノフ',
  'ニバイケン',
  'ハッスル',
  'キャッスル',
]

function parseArgs(argv) {
  const args = {
    url: null,
    outDir: DEFAULT_OUT_DIR,
    maxCards: 5,
    format: 'markdown',
    images: true,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--url') args.url = argv[++i]
    else if (arg === '--out') args.outDir = path.resolve(argv[++i])
    else if (arg === '--max-cards') args.maxCards = Number(argv[++i] || 5)
    else if (arg === '--no-images') args.images = false
    else if (arg === '--help' || arg === '-h') args.help = true
  }

  return args
}

function usage() {
  return `Usage:
  npm run content:article -- --url https://dmwiki.net/DM26-RP1
  node scripts/content/generate-history-article.mjs --url https://dmwiki.net/DM26-RP1 --max-cards 5
`
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'user-agent': 'duema-bbs-content-tool/0.1 (+local draft generation)',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${url}`)
  }
  return response.text()
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function stripRuby(html) {
  return String(html ?? '')
    .replace(/<rt[\s\S]*?<\/rt>/g, '')
    .replace(/<rp[\s\S]*?<\/rp>/g, '')
}

function stripTags(html) {
  return decodeHtml(
    stripRuby(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function normalizeSpaces(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function compactJapaneseSpaces(value) {
  return normalizeSpaces(value)
    .replace(/\s+([」』）])/g, '$1')
    .replace(/([「『（])\s+/g, '$1')
    .replace(/第\s+(\d+)\s+弾/g, '第$1弾')
}

function normalizeCardName(value) {
  const text = stripTags(value)
  const match = text.match(/《([^》]+)》/)
  return match ? `《${normalizeSpaces(match[1])}》` : ''
}

function bareCardName(cardName) {
  return cardName.replace(/^《|》$/g, '')
}

function slugify(value) {
  return String(value ?? 'draft')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

function productCodeFromUrl(url) {
  const last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '')
  return last.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function extractMainText(html) {
  const segment = extractProductSegment(html)
  return stripTags(segment || html)
}

function extractProductTitle(html) {
  const h2 = html.match(/<h2[^>]*id="content_1_0"[^>]*>([\s\S]*?)<\/h2>/)
  if (!h2) return 'デュエル・マスターズ商品'
  return compactJapaneseSpaces(stripTags(h2[1]).replace(/\[ 編集 \]/g, ''))
}

function extractProductSegment(html) {
  const start = html.search(/<h2[^>]*id="content_1_0"/)
  if (start < 0) return html
  const afterStart = html.slice(start)
  const end = afterStart.search(/<h3[^>]*id="content_1_13"/)
  return end > 0 ? afterStart.slice(0, end) : afterStart
}

function extractCardLinks(html) {
  const links = []
  const re = /<a\s+href="([^"]+)"\s+title="(《[^"]+》)"[^>]*>([\s\S]*?)<\/a>/g
  let match
  while ((match = re.exec(html))) {
    const name = normalizeCardName(match[2])
    if (!name) continue
    const href = match[1].startsWith('http') ? match[1] : `${DM_WIKI_ORIGIN}${match[1]}`
    if (!links.some(item => item.name === name)) {
      links.push({ name, href })
    }
  }
  return links
}

function extractProductInfo(html, url) {
  const title = extractProductTitle(html)
  const productSegment = extractProductSegment(html)
  const text = extractMainText(html)
  const cardLinks = extractCardLinks(productSegment)
  const productCode = productCodeFromUrl(url)
  const releaseDate = text.match(/(\d{4}年\d{1,2}月\d{1,2}日発売)/)?.[1] || ''
  const packSpec = text.match(/1パック[^。]+。/)?.[0] || ''
  const catchCopy = text.match(/キャッチコピーは「([^」]+)」/)?.[1] || ''
  const newAbility = text.match(/新\s*能力\s*として\s*([^。\s]+)\s*が登場/)?.[1] || ''
  const newRace = text.match(/新\s*種族\s*として\s*([^。\s]+)\s*が登場/)?.[1] || ''
  const newCardType = text.match(/新\s*カードタイプ\s*として\s*([^。\s]+)\s*が登場/)?.[1] || ''
  const revivalGimmicks = [...text.matchAll(/([^。]*(?:約\d+年ぶり|再登場)[^。]*。)/g)]
    .map(match => normalizeSpaces(match[1]))
    .slice(0, 3)

  return {
    sourceUrl: url,
    productCode,
    title,
    releaseDate,
    packSpec,
    catchCopy,
    newAbility,
    newRace,
    newCardType,
    revivalGimmicks,
    cardLinks,
    sourceExcerpt: text.slice(0, 4500),
  }
}

function selectMajorCards(product, maxCards) {
  const scored = product.cardLinks.map((card, index) => {
    const bare = bareCardName(card.name)
    const score =
      (index < 12 ? 20 - index : 0) +
      HISTORY_KEYWORDS.reduce((sum, keyword) => sum + (bare.includes(keyword) ? 8 : 0), 0)
    return { ...card, index, score }
  })

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxCards)
    .sort((a, b) => a.index - b.index)
}

function extractCardFacts(html, card) {
  const text = stripTags(extractProductSegment(html))
  const start = text.indexOf(bareCardName(card.name))
  const focused = start >= 0 ? text.slice(start, start + 2600) : text.slice(0, 2600)
  const related = [...focused.matchAll(/《[^》]+》/g)]
    .map(match => match[0])
    .filter(name => name !== card.name)
    .filter((name, index, array) => array.indexOf(name) === index)
    .slice(0, 6)

  const mechanics = [
    'Zラッシュ',
    'G城',
    'シールド・フォース',
    'ニンジャ・ストライク',
    'クロスギア',
    '手札進化',
    'シールド・プラス',
    '進化',
    'ゴッド',
    'Q・ブレイカー',
  ].filter(word => focused.includes(word))

  return {
    ...card,
    factsText: focused,
    related,
    mechanics,
  }
}

function inferCut(product) {
  if (product.title.includes('逆札篇') || product.sourceExcerpt.includes('勝舞編')) {
    return '勝舞編の記憶を、令和デュエマの速度で作り直したパック'
  }
  if (product.newAbility || product.newCardType) {
    return '懐かしい名前と新しい動きを同じ箱に入れたパック'
  }
  return 'カードリスト以上に、時代の移り変わりが見える商品'
}

function cardParagraph(card, product) {
  const name = card.name
  const bare = bareCardName(name)
  const related = card.related.length ? '関連カードの存在も見えるが、ここでは名前の連想よりも、このカード自身が今のゲームで何を担当するかを見たい。' : ''
  const mechanics = card.mechanics.length ? `能力面では${card.mechanics.join('、')}が文脈になる。` : ''
  const modern = product.newAbility ? `${product.newAbility}という新しい速度感の中で、昔の名前が単なる再録ではなく別の役割を与えられている。` : '昔の印象を残しながら、今のゲームで役割を持てる形に寄せている。'

  if (bare.includes('ボルメテウス')) {
    return `${name}は、この弾の方向性をもっとも分かりやすく示すカードだ。ボルメテウスという名前は、長くシールドへの干渉とフィニッシャーの記憶を背負ってきた。ここで面白いのは、その記憶をそのまま置き直すのではなく、今のゲーム速度に合わせて「着地してから何を残すか」まで含めて再設計しているところにある。${mechanics}${related}${modern}`
  }

  if (bare.includes('ヘヴィ') || bare.includes('メタル') || bare.includes('龍神')) {
    return `${name}は、かつて複数枚をそろえることで成立していたロマンを、現代的な1枚の圧力へ圧縮したような存在に見える。昔のゴッド的な魅力は「そろった時の迫力」にあったが、今のデュエマではそこに到達する前のテンポも問われる。だからこそ、このカードは懐古の象徴でありながら、実際にはかなり現代向けの自己完結性を意識して読むべきカードになっている。${mechanics}${related}${modern}`
  }

  if (bare.includes('インビンシブル') || bare.includes('デル・フィン') || bare.includes('チャクラ')) {
    return `${name}は、カード名から受ける印象と現代デュエマで期待される役割のズレが面白い。昔なら大技や制圧のイメージが先に立つ名前でも、今はそれだけでは間に合わない。盤面に触る、手札や展開に絡む、相手の動きを縛る。そうした「今必要な仕事」を背負わせることで、古い名前が現在のカードとして読めるようになっている。${mechanics}${related}${modern}`
  }

  return `${name}は、単に過去の名前を借りたカードとして見るより、昔の記憶をどこまで現在のゲームに接続できるかを見る方が面白い。名前に反応する層と、性能から入る現役プレイヤーの視線がずれるからこそ、このカードには読み物としての引っかかりがある。${mechanics}${related}${modern}`
}

function buildArticle(product, cards) {
  const cut = inferCut(product)
  const titleLine = product.title.replace(/\s+/g, ' ')
  const leadTitle = titleLine.includes('「') ? titleLine.match(/「(.+)」/)?.[1] || titleLine : titleLine
  const features = [
    product.newAbility && `新能力の${product.newAbility}`,
    product.newRace && `新種族の${product.newRace}`,
    product.newCardType && `新カードタイプの${product.newCardType}`,
  ].filter(Boolean)

  const title = `${leadTitle}は“懐古パック”ではない`
  const subtitle = `${cut}だった`
  const paragraphs = []

  paragraphs.push(`# ${title}`)
  paragraphs.push(`## ${subtitle}`)
  paragraphs.push(`${titleLine}は、${product.releaseDate || '発売時期'}のデュエル・マスターズ商品である。${product.packSpec ? `${product.packSpec}` : ''}名前だけを見ると、過去を知るプレイヤーへ向けた懐古パックに見える。だが実際には、昔のカード名やギミックをそのまま戻した商品というより、過去の記憶を現在のゲーム速度に合わせて組み替えたパックとして読む方がしっくりくる。`)
  paragraphs.push(`この弾を一言で言うなら、${cut}。${product.catchCopy ? `キャッチコピーの「${product.catchCopy}」も、その方向性をかなり直接に示している。` : ''}`)

  paragraphs.push('## 懐かしい名前を、今のゲームに置き直す')
  paragraphs.push(`${features.length ? `${features.join('、')}が登場したことは、単なる商品上の新要素にとどまらない。` : 'この商品で目立つのは、新旧の要素を同じ場所に置く作り方だ。'}${product.sourceExcerpt.includes('勝舞編') ? '勝舞編のカード名や空気を参照しながら、それを当時のテンポのまま再現するのではなく、令和のゲームで成立する動きへ変換している。' : '過去の文脈を拾いながら、現在のカードプールで意味を持つ形に調整している。'}懐かしいだけなら復刻で足りる。しかしこの商品は、名前の記憶と実際のカードの動きの間に、はっきりと現代化の手つきを入れている。`)

  if (product.revivalGimmicks.length) {
    paragraphs.push(`${product.revivalGimmicks.join('')}長く新カードが出ていなかったギミックが戻ってくる時、重要なのは「昔と同じことができるか」ではない。今の速度で使った時に、どの部分が残り、どの部分が別物になったのか。そこにこの弾の読みどころがある。`)
  }

  paragraphs.push('## 主要カードを見る')
  for (const card of cards) {
    paragraphs.push(`### ${card.name}`)
    paragraphs.push(cardParagraph(card, product))
  }

  paragraphs.push('## 逆札篇第1弾が置かれた場所')
  paragraphs.push(`${leadTitle}は、過去のカード名を並べて懐かしませるだけの商品ではない。むしろ、昔のロマンを今の自己完結力に変換する試みとして見ると輪郭がはっきりする。かつては複数ターンをかけて準備した動き、そろった時に初めて強かったギミック、名前だけで十分に盛り上がれた大型カード。それらを、現在のデュエマが要求する速度と干渉力の中へ置き直している。`)
  paragraphs.push(`だからこのパックの面白さは、「懐かしいカードが帰ってきた」だけでは終わらない。名前は昔を向いているのに、動きは明らかに今を向いている。そのズレがあるから、当時を知っている人には引っかかりがあり、現役プレイヤーには新しいカードとして読む余地がある。`)
  paragraphs.push('## まとめ')
  paragraphs.push(`${leadTitle}は、勝舞編の復刻ではなく、勝舞編の再設計だった。過去を飾るための懐古ではなく、過去の名前を使って今のデュエマを組み直す。その意味で、この弾はカードリスト以上に、デュエマが自分の歴史をどう扱うかを見せる商品になっている。`)

  return paragraphs.join('\n\n')
}

function extractArticleCardNames(markdown) {
  return [...markdown.matchAll(/《([^》]+)》/g)]
    .map(match => `《${match[1]}》`)
    .filter((name, index, array) => array.indexOf(name) === index)
}

async function searchOfficialCard(cardName, productCode) {
  const params = new URLSearchParams()
  params.set('keyword', bareCardName(cardName))
  params.append('keyword_type[]', 'card_name')

  const html = await fetchText(`${OFFICIAL_CARD_ORIGIN}/card/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const candidates = []
  const re = /<img class='cardImage' data-href='([^']+)' src='([^']+)'/g
  let match
  while ((match = re.exec(html))) {
    const detailPath = match[1]
    const thumbPath = match[2]
    const id = new URL(detailPath, OFFICIAL_CARD_ORIGIN).searchParams.get('id') || ''
    candidates.push({
      id,
      detailUrl: new URL(detailPath, OFFICIAL_CARD_ORIGIN).toString(),
      thumbUrl: new URL(thumbPath, OFFICIAL_CARD_ORIGIN).toString(),
    })
  }

  const preferred = [
    ...candidates.filter(candidate => candidate.id.toLowerCase().startsWith(productCode)),
    ...candidates.filter(candidate => !candidate.id.toLowerCase().startsWith(productCode)),
  ].slice(0, 8)

  const checked = []
  for (const candidate of preferred) {
    const detailHtml = await fetchText(candidate.detailUrl)
    const title = stripTags(detailHtml.match(/<h3 class='card-name'>([\s\S]*?)<\/h3>/)?.[1] || '')
      .replace(/\(.+?\)$/g, '')
      .trim()
    const imagePath = detailHtml.match(/<img src="([^"]*\/wp-content\/card\/cardimage\/[^"]+)"/)?.[1]
    const imageUrl = imagePath ? new URL(imagePath, OFFICIAL_CARD_ORIGIN).toString() : ''
    checked.push({ ...candidate, title, imageUrl })
  }

  const exact = checked.filter(candidate => candidate.title === bareCardName(cardName))
  const exactInProduct = exact.filter(candidate => candidate.id.toLowerCase().startsWith(productCode))
  if (exactInProduct.length === 1) return { status: 'found', ...exactInProduct[0], candidates: checked }
  if (exact.length === 1 && exact[0].imageUrl) return { status: 'found', ...exact[0], candidates: checked }
  if (exactInProduct.length > 1 || exact.length > 1) return { status: 'ambiguous', candidates: exactInProduct.length > 1 ? exactInProduct : exact }
  return { status: checked.length ? 'ambiguous' : 'not_found', candidates: checked }
}

function insertImages(markdown, imageMap) {
  const inserted = new Set()
  const lines = markdown.split('\n')
  const output = []

  for (const line of lines) {
    output.push(line)
    const names = [...line.matchAll(/《([^》]+)》/g)].map(match => `《${match[1]}》`)
    for (const name of names) {
      const image = imageMap.get(name)
      if (!image?.imageUrl || inserted.has(name)) continue
      output.push('')
      output.push(`![${bareCardName(name)}](${image.imageUrl})`)
      inserted.add(name)
    }
  }

  return output.join('\n')
}

function runQualityChecks(markdown, imageMap) {
  const cardNames = extractArticleCardNames(markdown)
  const issues = []
  for (const term of BANNED_TERMS) {
    if (markdown.includes(term)) issues.push(`禁止表現が含まれています: ${term}`)
  }
  if (!/^# .+/.test(markdown)) issues.push('タイトル見出しがありません')
  if (!markdown.includes('昔') || !markdown.includes('今')) issues.push('昔と今の対比が弱い可能性があります')
  if (markdown.includes('Wikiによると')) issues.push('「Wikiによると」を使っています')
  if (cardNames.length === 0) issues.push('《カード名》表記が見つかりません')
  for (const [name, image] of imageMap.entries()) {
    if (image.status === 'found' && !markdown.includes(`![${bareCardName(name)}](`)) {
      issues.push(`${name} の初出直後に画像が入っていません`)
    }
    if (image.status === 'found' && !image.imageUrl.startsWith(`${OFFICIAL_CARD_ORIGIN}/`)) {
      issues.push(`${name} の画像URLが公式カード検索由来ではありません`)
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    checked: [
      '禁止表現',
      'タイトルの切り口',
      '昔と今の対比',
      'カード名の《》表記',
      '初出カード画像',
      '公式画像URL',
    ],
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.url) {
    console.log(usage())
    return
  }

  await fs.mkdir(args.outDir, { recursive: true })
  console.log(`[article] fetch wiki: ${args.url}`)
  const wikiHtml = await fetchText(args.url)
  const product = extractProductInfo(wikiHtml, args.url)
  const majorCards = selectMajorCards(product, args.maxCards)

  console.log(`[article] product: ${product.title}`)
  console.log(`[article] cards: ${majorCards.map(card => card.name).join(', ')}`)

  const cards = []
  for (const card of majorCards) {
    console.log(`[article] fetch card wiki: ${card.name}`)
    const html = await fetchText(card.href)
    cards.push(extractCardFacts(html, card))
  }

  let markdown = buildArticle(product, cards)
  const articleCardNames = extractArticleCardNames(markdown)
  const imageMap = new Map()
  const imageLog = []

  if (args.images) {
    for (const cardName of articleCardNames) {
      console.log(`[article] search official image: ${cardName}`)
      const result = await searchOfficialCard(cardName, product.productCode)
      imageMap.set(cardName, result)
      imageLog.push({
        cardName,
        status: result.status,
        imageUrl: result.imageUrl || null,
        detailUrl: result.detailUrl || null,
        candidates: (result.candidates || []).map(candidate => ({
          id: candidate.id,
          title: candidate.title,
          imageUrl: candidate.imageUrl || candidate.thumbUrl,
          detailUrl: candidate.detailUrl,
        })),
      })
    }
    markdown = insertImages(markdown, imageMap)
  }

  const quality = runQualityChecks(markdown, imageMap)
  const basename = `${new Date().toISOString().slice(0, 10)}-${slugify(product.title)}`
  const articlePath = path.join(args.outDir, `${basename}.md`)
  const sourcePath = path.join(args.outDir, `${basename}.source.json`)
  const qualityPath = path.join(args.outDir, `${basename}.quality.json`)

  const frontmatter = [
    '---',
    `source_url: ${product.sourceUrl}`,
    `product: ${JSON.stringify(product.title)}`,
    `generated_at: ${new Date().toISOString()}`,
    'status: draft',
    '---',
    '',
  ].join('\n')

  await fs.writeFile(articlePath, `${frontmatter}${markdown}\n`, 'utf8')
  await fs.writeFile(sourcePath, JSON.stringify({ product, cards, images: imageLog }, null, 2), 'utf8')
  await fs.writeFile(qualityPath, JSON.stringify(quality, null, 2), 'utf8')

  console.log(`[article] saved: ${path.relative(ROOT_DIR, articlePath)}`)
  console.log(`[article] source: ${path.relative(ROOT_DIR, sourcePath)}`)
  console.log(`[article] quality: ${quality.ok ? 'ok' : 'needs review'} (${path.relative(ROOT_DIR, qualityPath)})`)
  if (quality.issues.length) {
    for (const issue of quality.issues) console.log(`  - ${issue}`)
  }
}

main().catch(error => {
  console.error('[article:error]', error)
  process.exitCode = 1
})
