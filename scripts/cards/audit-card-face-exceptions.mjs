#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const arg = (name, fallback) => resolve(process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback)
const payload = JSON.parse(await readFile(arg('--input', 'data/cards/card-faces.json'), 'utf8'))
const printings = JSON.parse(await readFile(arg('--printings', 'data/cards/card-printings.json'), 'utf8'))
const checkpoint = JSON.parse(await readFile(arg('--checkpoint', 'data/cards/card-faces.checkpoint.json'), 'utf8'))
const outputPath = arg('--report', 'data/cards/card-face-exception-review.json')
const cacheDir = arg('--cache-dir', 'data/cards/official-html-cache')
const printingById = new Map(printings.map((row) => [row.id, row]))
const grouped = new Map()
for (const face of payload.faces) grouped.set(face.card_printing_id, [...(grouped.get(face.card_printing_id) ?? []), face])
const summarize = ([printingId, faces]) => {
  const printing = printingById.get(printingId)
  const ordered = [...faces].sort((a, b) => a.side_index - b.side_index)
  return {
    card_printing_id: printingId,
    source_key: printing?.source_key,
    card_id: printing?.card_id,
    official_page_url: printing?.official_page_url,
    face_count: ordered.length,
    checks: {
      contiguous_side_indexes: ordered.every((face, index) => face.side_index === index),
      one_parent_card: new Set(ordered.map((face) => face.card_id)).size === 1 && ordered[0]?.card_id === printing?.card_id,
      distinct_images: new Set(ordered.map((face) => face.image_url)).size === ordered.length,
      official_card_images_only: ordered.every((face) => /^https:\/\/dm\.takaratomy\.co\.jp\/wp-content\/card\/cardimage\//.test(face.image_url ?? '')),
      official_detail_page_only: ordered.every((face) => /^https:\/\/dm\.takaratomy\.co\.jp\/card\/detail\/\?id=/.test(face.official_page_url ?? '')),
    },
    faces: ordered.map((face) => ({
      side_index: face.side_index, side_kind: face.side_kind, name: face.name, normalized_name: face.normalized_name,
      card_number: face.card_number, card_type: face.card_type, image_url: face.image_url,
    })),
  }
}
const threeAndFour = [...grouped].filter(([, faces]) => faces.length >= 3).map(summarize)
const twoFace = [...grouped].filter(([, faces]) => faces.length === 2)
const categories = [
  ['psychic', (faces) => faces.some((face) => /サイキック/.test(face.card_type ?? ''))],
  ['dragheart', (faces) => faces.some((face) => /ドラグハート/.test(face.card_type ?? ''))],
  ['forbidden', (faces) => faces.some((face) => /禁断/.test(`${face.name}${face.card_type}`))],
  ['zero_dragon', (faces) => faces.some((face) => /零龍|零龍卍誕/.test(face.name ?? ''))],
  ['twin_pact', (faces) => faces.some((face) => /ツインパクト/.test(face.card_type ?? ''))],
  ['landscape', (faces) => faces.some((face) => /サイキック|ドラグハート|禁断|零龍/.test(`${face.name}${face.card_type}`))],
]
const structuralSamples = Object.fromEntries(categories.map(([name, predicate]) => [name, twoFace.filter(([, faces]) => predicate(faces)).slice(0, 5).map(summarize)]))
const truncatedHtml = []
for (const page of Object.values(checkpoint.items)) {
  if (page.cache_kind === 'extracted_json') continue
  const path = resolve(cacheDir, `${page.source_key.replace(/[^a-z0-9_-]/gi, '_')}.html`)
  const html = await readFile(path, 'utf8')
  // Collector caches the official card-detail section fragment, not the full
  // document. A complete fragment ends with the section closing tag.
  if (!/<\/section>\s*$/i.test(html)) truncatedHtml.push(page.source_key)
}
const allSpecialChecksPass = [...threeAndFour, ...Object.values(structuralSamples).flat()].every((row) => Object.values(row.checks).every(Boolean))
const report = {
  generated_at: new Date().toISOString(),
  nonstandard_url: {
    count: 1,
    classification: 'intentional_quarantine_resolved',
    detail: 'The former DM26EX2 product-page source was removed from the current target and replaced by 154 formal card-detail URLs and printing IDs using the reviewed extracted JSON artifact.',
  },
  needs_review: payload.faces.filter((face) => face.extraction_status === 'needs_review').map((face) => ({ card_printing_id: face.card_printing_id, side_index: face.side_index, name: face.name })),
  manual_overrides: payload.faces.filter((face) => face.manual_override).map((face) => ({ card_printing_id: face.card_printing_id, side_index: face.side_index, name: face.name, reason: face.manual_override.reason })),
  three_and_four_face_printings: threeAndFour,
  structural_two_face_samples: structuralSamples,
  same_name_multiple_faces: [...grouped].filter(([, faces]) => new Set(faces.map((face) => face.normalized_name)).size !== faces.length).map(([printingId]) => printingId),
  truncated_html_cache: truncatedHtml,
  all_special_checks_pass: allSpecialChecksPass && truncatedHtml.length === 0,
}
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ report: outputPath, three_face: threeAndFour.filter((row) => row.face_count === 3).length, four_face: threeAndFour.filter((row) => row.face_count === 4).length, needs_review: report.needs_review.length, manual_overrides: report.manual_overrides.length, truncated_html: truncatedHtml.length, all_special_checks_pass: report.all_special_checks_pass }, null, 2))
if (!report.all_special_checks_pass || report.needs_review.length) process.exitCode = 1
