#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PARSER_VERSION } from './card-face-extraction.mjs'

const checkpointPath = resolve(process.argv.find((arg) => arg.startsWith('--checkpoint='))?.slice(13) ?? 'data/cards/card-faces.checkpoint.json')
const inputPath = resolve(process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) ?? 'data/cards/card-printings.json')
const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'))
const input = JSON.parse(await readFile(inputPath, 'utf8'))
const pages = Object.values(checkpoint.items)
const successes = pages.filter((page) => ['success', 'not_modified'].includes(page.status))
const faces = successes.flatMap((page) => page.faces ?? [])
const statusCount = (status) => pages.filter((page) => page.status === status).length
const timeout = pages.filter((page) => /Timeout|AbortError|timed?\s*out/i.test(page.last_error ?? '')).length
const printingSideKeys = successes.flatMap((page) => (page.printings ?? []).flatMap((printing) => (page.faces ?? []).map((face) => `${printing.id}:${face.side_index}`)))
const duplicateCandidates = printingSideKeys.length - new Set(printingSideKeys).size
const uniqueUrls = new Set(input.map((row) => row.official_page_url).filter(Boolean)).size
const parserV4Pages = successes.filter((page) => page.parser_version === PARSER_VERSION)
const report = {
  processed: pages.length,
  total_unique_urls: uniqueUrls,
  success: successes.length,
  new_official_fetch: parserV4Pages.filter((page) => page.cache_used === false).length,
  cache_reparsed: parserV4Pages.filter((page) => page.cache_used === true).length,
  checkpoint_skipped: parserV4Pages.filter((page) => page.cache_used === true).length + statusCount('nonstandard_url'),
  one_face: successes.filter((page) => page.extracted_face_count === 1).length,
  two_faces: successes.filter((page) => page.extracted_face_count === 2).length,
  three_plus_faces: successes.filter((page) => page.extracted_face_count >= 3).length,
  max_face_count: Math.max(0, ...successes.map((page) => page.extracted_face_count ?? 0)),
  nonstandard_url: statusCount('nonstandard_url'),
  needs_review: successes.filter((page) => (page.faces ?? []).some((face) => face.extraction_status === 'needs_review')).length,
  http_404: statusCount('http_404'),
  http_429: statusCount('http_429'),
  http_5xx: statusCount('http_5xx'),
  timeout,
  parse_failed: statusCount('parse_failed'),
  missing_images: faces.filter((face) => !face.image_url).length,
  duplicate_candidates: duplicateCandidates,
  parser_version: PARSER_VERSION,
  old_parser_results: successes.filter((page) => page.parser_version !== PARSER_VERSION).length,
  remaining: Math.max(0, uniqueUrls - pages.length),
  estimated_remaining_hours: Number((Math.max(0, uniqueUrls - pages.length) * 1.25 / 3_600).toFixed(1)),
  checkpoint_saved_at: checkpoint.updated_at,
}
console.log(JSON.stringify(report, null, 2))
