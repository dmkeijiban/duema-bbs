#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { extractOfficialCardFaces, isSuspiciousFaceName, OFFICIAL_DETAIL_URL, PARSER_VERSION } from './card-face-extraction.mjs'

const args = new Map(process.argv.slice(2).map((arg) => { const [key, ...value] = arg.split('='); return [key, value.join('=') || true] }))
const checkpointPath = resolve(String(args.get('--checkpoint') ?? 'data/cards/card-faces.checkpoint.json'))
const cacheDir = resolve(String(args.get('--cache-dir') ?? 'data/cards/official-html-cache'))
const outputPath = resolve(String(args.get('--output') ?? 'data/cards/card-face-sample-audit.json'))
const checkImages = args.has('--check-images')
const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'))
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const cachePath = (key) => resolve(cacheDir, `${key.replace(/[^a-z0-9_-]/gi, '_')}.html`)
const stableRank = (key) => createHash('sha256').update(`2026-07-18:${key}`).digest('hex')

const candidates = []
for (const page of Object.values(checkpoint.items)) {
  if (page.status !== 'success' || page.extracted_face_count < 2) continue
  const html = await readFile(cachePath(page.source_key), 'utf8')
  const faces = extractOfficialCardFaces(html, page.official_page_url)
  const types = faces.map((face) => face.card_type ?? '').join(' ')
  const names = faces.map((face) => face.name).join(' ')
  const category = faces.length >= 3 || /禁断|零龍|卍誕|鼓動/.test(`${types} ${names}`) ? 'special'
    : /サイキック/.test(types) ? 'psychic'
    : /ドラグハート|ウエポン|フォートレス/.test(types) ? 'dragheart'
      : 'other'
  candidates.push({ page, html, faces, category, rank: stableRank(page.source_key) })
}

const selected = []
const selectionRoles = new Map()
const automaticExceptions = candidates.filter((row) => row.faces.some((face) => isSuspiciousFaceName(face.name)))
const take = (category, count) => {
  const rows = candidates.filter((row) => row.category === category && !automaticExceptions.includes(row) && !selected.includes(row)).sort((a, b) => a.rank.localeCompare(b.rank)).slice(0, count)
  selected.push(...rows)
  for (const row of rows) selectionRoles.set(row, category)
  return rows.length
}
const categoryCounts = { psychic: take('psychic', 5), dragheart: take('dragheart', 3), special: take('special', 2) }
const randomRows = candidates.filter((row) => !automaticExceptions.includes(row) && !selected.includes(row)).sort((a, b) => a.rank.localeCompare(b.rank)).slice(0, 10)
selected.push(...randomRows)
for (const row of randomRows) selectionRoles.set(row, 'random')
if (categoryCounts.psychic < 5 || categoryCounts.dragheart < 3 || categoryCounts.special < 2 || selected.length < 20) {
  throw new Error(`必要カテゴリが不足しています: ${JSON.stringify({ categoryCounts, selected: selected.length })}`)
}

const results = []
let lastImageRequestAt = 0
for (const row of selected) {
  const { page, html, faces, category } = row
  const starts = [...html.matchAll(/<div\b[^>]*class=(['"])[^'"]*\bcardDetail\b[^'"]*\1[^>]*>/gi)]
  const rawFaceCount = starts.length
  const rejectedDetails = starts.map((start, index) => {
    const from = (start.index ?? 0) + start[0].length
    const to = starts[index + 1]?.index ?? html.indexOf('<div class="productCard">', from)
    const block = html.slice(from, to > from ? to : html.length)
    return block.match(/<div\b[^>]*class=(?:['"])[^'"]*\bcard-img\b[^'"]*(?:['"])[^>]*>\s*<img\b[^>]*src=(?:['"])([^'"]*)/i)?.[1] ?? null
  }).filter((imagePath) => !imagePath)
  const imageChecks = []
  if (checkImages) {
    for (const face of faces) {
      const wait = Math.max(0, 1_100 - (Date.now() - lastImageRequestAt))
      if (wait) await sleep(wait)
      lastImageRequestAt = Date.now()
      try {
        const response = await fetch(face.image_url, { headers: { Range: 'bytes=0-0', 'User-Agent': 'DuemaBBSCardFaceAuditor/1.0 (+https://www.duema-bbs.com/contact)' }, signal: AbortSignal.timeout(20_000) })
        imageChecks.push({ image_url: face.image_url, status: response.status, ok: response.status === 200 || response.status === 206 })
      } catch (error) {
        imageChecks.push({ image_url: face.image_url, status: null, ok: false, error: error instanceof Error ? error.name : 'unknown' })
      }
    }
  }
  const parentCardIds = [...new Set((page.printings ?? []).map((printing) => printing.card_id).filter(Boolean))]
  const checks = {
    official_detail_url: OFFICIAL_DETAIL_URL.test(page.official_page_url),
    raw_count_explained: rawFaceCount === faces.length + rejectedDetails.length,
    ordered_side_indexes: faces.every((face, index) => face.side_index === index),
    front_back_kinds: faces.every((face, index) => face.side_kind === (index === 0 ? 'front' : 'back')),
    names_present: faces.every((face) => Boolean(face.name?.trim())),
    names_not_placeholder: faces.every((face) => !isSuspiciousFaceName(face.name)),
    card_numbers_present: faces.every((face) => Boolean(face.card_number?.trim())),
    images_present: faces.every((face) => Boolean(face.image_url)),
    images_distinct: new Set(faces.map((face) => face.image_url)).size === faces.length,
    one_parent_card: parentCardIds.length === 1,
    image_http_ok: !checkImages || imageChecks.every((check) => check.ok),
  }
  results.push({ source_key: page.source_key, selection_role: selectionRoles.get(row), category, parser_version: PARSER_VERSION, official_page_url: page.official_page_url, raw_card_detail_count: rawFaceCount, rejected_empty_image_details: rejectedDetails.length, extracted_face_count: faces.length, parent_card_ids: parentCardIds, faces, image_checks: imageChecks, checks, ok: Object.values(checks).every(Boolean) })
}

const report = {
  generated_at: new Date().toISOString(), parser_version: PARSER_VERSION, cache_only_html: true,
  selected: results.length, category_counts: results.reduce((counts, row) => ({ ...counts, [row.category]: (counts[row.category] ?? 0) + 1 }), {}),
  selection_counts: results.reduce((counts, row) => ({ ...counts, [row.selection_role]: (counts[row.selection_role] ?? 0) + 1 }), {}),
  automatic_exceptions: automaticExceptions.map((row) => ({ source_key: row.page.source_key, official_page_url: row.page.official_page_url, names: row.faces.map((face) => face.name), reason: 'official_name_placeholder' })),
  failed: results.filter((row) => !row.ok).length, results,
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, parser_version: PARSER_VERSION, selected: report.selected, selection_counts: report.selection_counts, category_counts: report.category_counts, automatic_exceptions: report.automatic_exceptions.length, failed: report.failed }, null, 2))
if (report.failed) process.exitCode = 1
