#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { contentHash, extractOfficialCardFaces, PARSER_VERSION } from './card-face-extraction.mjs'

const arg = (name, fallback) => resolve(process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback)
const inputPath = arg('--input', 'data/cards/card-faces.json')
const printingsPath = arg('--printings', 'data/cards/card-printings.json')
const checkpointPath = arg('--checkpoint', 'data/cards/card-faces.checkpoint.json')
const cacheDir = arg('--cache-dir', 'data/cards/official-html-cache')
const reportPath = arg('--report', 'data/cards/card-faces.validation.json')
const payload = JSON.parse(await readFile(inputPath, 'utf8'))
const printings = JSON.parse(await readFile(printingsPath, 'utf8'))
const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'))
const faces = Array.isArray(payload.faces) ? payload.faces : []
const pages = Object.values(checkpoint.items)
const successPages = pages.filter((page) => ['success', 'not_modified'].includes(page.status))
const printingIds = new Set(printings.map((row) => row.id))
const cardIds = new Set(printings.map((row) => row.card_id))
const uniqueUrls = new Set(printings.map((row) => row.official_page_url).filter(Boolean))
const grouped = new Map()
for (const face of faces) grouped.set(face.card_printing_id, [...(grouped.get(face.card_printing_id) ?? []), face])

const duplicateSideKeys = []
const sideIndexGaps = []
const duplicateImagePrintings = []
const sameNamePrintings = []
for (const [printingId, items] of grouped) {
  const indexes = items.map((face) => face.side_index).sort((a, b) => a - b)
  if (new Set(indexes).size !== indexes.length) duplicateSideKeys.push(printingId)
  if (indexes.some((index, position) => index !== position)) sideIndexGaps.push(printingId)
  if (new Set(items.map((face) => face.image_url)).size !== items.length) duplicateImagePrintings.push(printingId)
  if (new Set(items.map((face) => face.normalized_name)).size !== items.length) sameNamePrintings.push(printingId)
}

const cacheHashMismatches = []
const parserCountMismatches = []
const missingCache = []
for (const page of successPages) {
  const path = resolve(cacheDir, `${page.source_key.replace(/[^a-z0-9_-]/gi, '_')}.html`)
  try {
    const html = await readFile(path, 'utf8')
    if (contentHash(html) !== page.content_hash) cacheHashMismatches.push(page.source_key)
    if (extractOfficialCardFaces(html, page.official_page_url).length !== page.extracted_face_count) parserCountMismatches.push(page.source_key)
  } catch {
    missingCache.push(page.source_key)
  }
}

const parentMismatchPages = successPages.filter((page) => new Set((page.printings ?? []).map((printing) => printing.card_id).filter(Boolean)).size > 1).map((page) => page.source_key)
const expectedArtifactFaces = successPages.reduce((total, page) => total + (page.faces?.length ?? 0) * (page.printings?.length ?? 0), 0)
const faceDistribution = [...grouped.values()].reduce((counts, items) => ({ ...counts, [items.length]: (counts[items.length] ?? 0) + 1 }), {})
const maxFaceCount = Math.max(0, ...[...grouped.values()].map((items) => items.length))
const statusCounts = pages.reduce((counts, page) => ({ ...counts, [page.status]: (counts[page.status] ?? 0) + 1 }), {})
const errors = {
  target_checkpoint_mismatch: pages.length === uniqueUrls.size ? 0 : Math.abs(pages.length - uniqueUrls.size),
  checkpoint_artifact_page_mismatch: payload.pages?.length === successPages.length ? 0 : Math.abs((payload.pages?.length ?? 0) - successPages.length),
  checkpoint_artifact_face_mismatch: faces.length === expectedArtifactFaces ? 0 : Math.abs(faces.length - expectedArtifactFaces),
  old_parser_results: successPages.filter((page) => page.parser_version !== PARSER_VERSION).length,
  parser_version_missing: successPages.filter((page) => page.parser_version == null).length,
  missing_name: faces.filter((face) => !face.name?.trim()).length,
  missing_normalized_name: faces.filter((face) => !face.normalized_name?.trim()).length,
  missing_image_url: faces.filter((face) => !face.image_url).length,
  missing_official_page_url: faces.filter((face) => !face.official_page_url).length,
  social_image_misdetected: faces.filter((face) => /\/common\/img\/parts\/ico_(?:twitter|line|share)/i.test(face.image_url ?? '')).length,
  duplicate_printing_side: duplicateSideKeys.length,
  side_index_gap: sideIndexGaps.length,
  orphan_card_id: faces.filter((face) => !cardIds.has(face.card_id)).length,
  orphan_card_printing_id: faces.filter((face) => !printingIds.has(face.card_printing_id)).length,
  parent_card_mismatch: parentMismatchPages.length,
  unexpected_same_image: duplicateImagePrintings.length,
  cache_hash_mismatch: cacheHashMismatches.length,
  parser_face_count_mismatch: parserCountMismatches.length,
  missing_html_cache: missingCache.length,
}
const report = {
  generated_at: new Date().toISOString(), parser_version: PARSER_VERSION,
  totals: {
    target_unique_urls: uniqueUrls.size, checkpoint: pages.length, success: successPages.length,
    exceptions: pages.length - successPages.length, artifact_pages: payload.pages?.length ?? 0, artifact_faces: faces.length,
    printings_with_faces: grouped.size, logical_cards: new Set(faces.map((face) => face.card_id)).size,
    one_face_printings: faceDistribution[1] ?? 0, two_face_printings: faceDistribution[2] ?? 0,
    three_plus_face_printings: [...grouped.values()].filter((items) => items.length >= 3).length,
    max_face_count: maxFaceCount, face_distribution: faceDistribution,
    unique_front_names: new Set([...grouped.values()].map((items) => items.find((face) => face.side_index === 0)?.normalized_name).filter(Boolean)).size,
    unique_back_names: new Set([...grouped.values()].flatMap((items) => items.filter((face) => face.side_index > 0).map((face) => face.normalized_name))).size,
    status_counts: statusCounts,
  },
  errors,
  review: {
    needs_review_pages: successPages.filter((page) => (page.faces ?? []).some((face) => face.extraction_status === 'needs_review')).map((page) => ({ source_key: page.source_key, official_page_url: page.official_page_url, content_hash: page.content_hash, parser_version: page.parser_version, printings: page.printings, faces: page.faces, expected_face_count: page.extracted_face_count, extracted_face_count: page.faces?.length ?? 0 })),
    nonstandard_urls: pages.filter((page) => page.status === 'nonstandard_url'),
    three_plus_printings: [...grouped.entries()].filter(([, items]) => items.length >= 3).map(([printingId, items]) => ({ printing_id: printingId, faces: items })),
    same_name_printings: sameNamePrintings,
    duplicate_image_printings: duplicateImagePrintings,
    parent_mismatch_pages: parentMismatchPages,
    parser_count_mismatches: parserCountMismatches,
  },
}
report.ok = Object.values(errors).every((count) => count === 0)
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ reportPath, ok: report.ok, totals: report.totals, errors: report.errors, review_counts: Object.fromEntries(Object.entries(report.review).map(([key, value]) => [key, value.length])) }, null, 2))
if (!report.ok) process.exitCode = 1
