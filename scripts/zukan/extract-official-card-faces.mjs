import fs from 'node:fs/promises'
import { extractOfficialCardFaces } from '../cards/card-face-extraction.mjs'

export { extractOfficialCardFaces }

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
  main().catch((error) => { console.error(error); process.exitCode = 1 })
}
