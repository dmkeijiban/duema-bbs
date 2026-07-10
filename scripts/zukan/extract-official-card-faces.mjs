import fs from 'node:fs/promises'

const CARD_DETAIL_PATTERN = /<div border='0' cellspacing='0' cellpadding='0' class='cardDetail'>([\s\S]*?)(?=<div border='0' cellspacing='0' cellpadding='0' class='cardDetail'>|<div class="productCard">)/g

function decodeHtml(value) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

function capture(block, pattern) {
  const match = block.match(pattern)
  return match ? decodeHtml(match[1]) || null : null
}

function numberOrNull(value) {
  if (!value || value === '-') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function extractOfficialCardFaces(html, officialPageUrl) {
  const faces = [...html.matchAll(CARD_DETAIL_PATTERN)].map((match) => {
    const block = match[1]
    const imagePath = capture(block, /<div class="card-img"><img src="([^"]+)"/)
    const packLabel = capture(block, /<span class='packname'>\((.*?)\)<\/span>/)

    return {
      name: capture(block, /<h3 class='card-name'>(.*?)<span class='packname'>/),
      card_number: packLabel?.replace(/^DMR01\s+/i, '') ?? null,
      card_type: capture(block, /<td class='type'>(.*?)<\/td>/),
      civilization: capture(block, /<td class='civil'>(.*?)<\/td>/),
      cost: numberOrNull(capture(block, /<td class='cost'>(.*?)<\/td>/)),
      mana: numberOrNull(capture(block, /<td class='mana'>(.*?)<\/td>/)),
      race: capture(block, /<td class='race'>(.*?)<\/td>/),
      power: capture(block, /<td class='power'>(.*?)<\/td>/),
      rarity: capture(block, /<td class='rarelity'>(.*?)<\/td>/),
      illustrator: capture(block, /<td[^>]*class='illusttxt'[^>]*>(.*?)<\/td>/),
      ability_text: capture(block, /<td class='skills full'>([\s\S]*?)<\/td>/),
      flavor_text: capture(block, /<td class='flavor full'>([\s\S]*?)<\/td>/),
      image_url: imagePath ? new URL(imagePath, officialPageUrl).href : null,
      official_page_url: officialPageUrl,
    }
  })

  return faces.filter((face) => face.name)
}

async function main() {
  const packPath = process.argv[2]
  if (!packPath) throw new Error('Usage: node scripts/zukan/extract-official-card-faces.mjs <pack-json>')

  const pack = JSON.parse(await fs.readFile(packPath, 'utf8'))
  const results = []
  const sourceCards = process.argv.includes('--psychic-only')
    ? pack.cards.filter((card) => card.card_type === 'サイキック・クリーチャー')
    : pack.cards

  for (const card of sourceCards) {
    const response = await fetch(card.official_page_url)
    if (!response.ok) throw new Error(`${card.slug}: official page returned ${response.status}`)
    const faces = extractOfficialCardFaces(await response.text(), card.official_page_url)
    if (faces.length > 1) results.push({ slug: card.slug, official_card_id: new URL(card.official_page_url).searchParams.get('id'), faces })
  }

  process.stdout.write(`${JSON.stringify({ checked: sourceCards.length, multi_face_count: results.length, cards: results }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
