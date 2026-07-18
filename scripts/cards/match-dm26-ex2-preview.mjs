#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const officialPath = resolve(process.argv.find((arg) => arg.startsWith('--official='))?.slice(11) ?? 'data/cards/dm26-ex2-official.json')
const migrationPath = resolve(process.argv.find((arg) => arg.startsWith('--migration='))?.slice(12) ?? 'supabase/migrations/20260717080000_add_dm26_ex2_full_catalog.sql')
const outputPath = resolve(process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'data/cards/dm26-ex2-preview-official-matches.json')
const reportPath = resolve(process.argv.find((arg) => arg.startsWith('--report='))?.slice(9) ?? 'data/cards/dm26-ex2-match-report.json')

const normalize = (value) => String(value ?? '').normalize('NFKC').toLowerCase()
  .replace(/[／∕]/g, '/').replace(/[＆]/g, '&').replace(/[！]/g, '!')
  .replace(/[＜]/g, '<').replace(/[＞]/g, '>').replace(/[‐‑‒–—―]/g, '-')
  .replace(/[\s\u3000・]/g, '')
const normalizeCardNumber = (value) => String(value ?? '').normalize('NFKC').replace(/^([A-Z㊙]+)(\d+)\/\1(\d+)$/i, '$1$2/$3')
const sqlUnquote = (value) => value.replaceAll("''", "'")

const sql = await readFile(migrationPath, 'utf8')
const previews = [...sql.matchAll(/\('(DM26EX2-PREVIEW-\d{3})',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'(https:\/\/[^']+)',\s*'([^']+)'/g)].map((match) => ({
  source_key: match[1], name: sqlUnquote(match[2]), normalized_name: sqlUnquote(match[3]), image_url: match[4], card_number: match[5],
}))
if (previews.length !== 149) throw new Error(`先行データ件数が149ではありません: ${previews.length}`)

const official = JSON.parse(await readFile(officialPath, 'utf8'))
if (!Array.isArray(official)) throw new Error('正式データが配列ではありません')
const officialByNumber = new Map()
for (const row of official) {
  const number = normalizeCardNumber(row.card_number)
  const list = officialByNumber.get(number) ?? []
  list.push(row)
  officialByNumber.set(number, list)
}

const usedOfficial = new Set()
const matches = previews.map((preview) => {
  const byNumber = officialByNumber.get(normalizeCardNumber(preview.card_number)) ?? []
  const byNumberAndName = byNumber.filter((row) => normalize(row.name) === normalize(preview.name) || normalize(row.name) === normalize(preview.normalized_name))
  const candidates = byNumberAndName.length ? byNumberAndName : byNumber
  const officialRow = candidates.length === 1 ? candidates[0] : null
  if (officialRow) usedOfficial.add(officialRow.source_key)
  const status = officialRow ? 'matched' : candidates.length > 1 ? 'ambiguous' : 'preview_only'
  return {
    previewSourceKey: preview.source_key,
    officialSourceKey: officialRow?.source_key ?? null,
    cardId: null,
    previewName: preview.name,
    officialName: officialRow?.name ?? null,
    cardNumber: preview.card_number,
    previewImageUrl: preview.image_url,
    officialImageUrl: officialRow?.image_url ?? null,
    officialPageUrl: officialRow?.official_page_url ?? null,
    matchMethod: officialRow ? (byNumberAndName.length === 1 ? 'card_number_and_normalized_name' : 'card_number') : null,
    confidence: officialRow ? 'exact' : candidates.length > 1 ? 'ambiguous' : 'none',
    status,
    candidateOfficialSourceKeys: candidates.length > 1 ? candidates.map((row) => row.source_key) : undefined,
  }
})

for (const row of official) if (!usedOfficial.has(row.source_key)) matches.push({
  previewSourceKey: null, officialSourceKey: row.source_key, cardId: null, previewName: null, officialName: row.name,
  cardNumber: row.card_number, previewImageUrl: null, officialImageUrl: row.image_url, officialPageUrl: row.official_page_url,
  matchMethod: null, confidence: 'none', status: 'official_only',
})

const counts = Object.fromEntries(['matched', 'ambiguous', 'preview_only', 'official_only', 'already_migrated'].map((status) => [status, matches.filter((row) => row.status === status).length]))
const matchedOfficial = matches.filter((row) => row.status === 'matched').map((row) => row.officialSourceKey)
const report = {
  generatedAt: new Date().toISOString(), previewPrintings: previews.length, officialPrintings: official.length,
  officialLogicalCards: new Set(official.map((row) => normalize(row.name))).size, ...counts,
  oneToOne: counts.matched, duplicateMatchedOfficialKeys: matchedOfficial.length - new Set(matchedOfficial).size,
  officialSourceKeyDuplicates: official.length - new Set(official.map((row) => row.source_key)).size,
  cardNumberDuplicates: [...officialByNumber].filter(([, rows]) => rows.length > 1).map(([cardNumber, rows]) => ({ cardNumber, sourceKeys: rows.map((row) => row.source_key), names: rows.map((row) => row.name) })),
  stopRequired: counts.ambiguous > 0 || counts.preview_only > 0 || matchedOfficial.length !== new Set(matchedOfficial).size,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(matches, null, 2)}\n`)
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
