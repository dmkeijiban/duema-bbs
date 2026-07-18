#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = new Map(process.argv.slice(2).map((arg) => { const [key, ...value] = arg.split('='); return [key, value.join('=') || true] }))
const inputPath = resolve(String(args.get('--input') ?? 'data/cards/card-faces.json'))
const execute = args.has('--execute')
const target = String(args.get('--target') ?? 'preview')
if (!['preview', 'production'].includes(target)) throw new Error('--targetはpreviewまたはproductionです')
if (target === 'production' && (!execute || args.get('--confirm') !== 'I_APPROVE_CARD_FACE_PRODUCTION_UPSERT')) {
  throw new Error('本番投入には --execute --target=production --confirm=I_APPROVE_CARD_FACE_PRODUCTION_UPSERT が必要です')
}
const payload = JSON.parse(await readFile(inputPath, 'utf8'))
const allFaces = Array.isArray(payload.faces) ? payload.faces : []
const reviewPrintingIds = new Set(allFaces.filter((face) => face.extraction_status === 'needs_review').map((face) => face.card_printing_id))
const faces = allFaces.filter((face) => !reviewPrintingIds.has(face.card_printing_id))
const pages = Array.isArray(payload.pages) ? payload.pages : []
const invalid = faces.filter((face) => !face.card_id || !face.card_printing_id || !face.name || !Number.isInteger(face.side_index))
if (invalid.length) throw new Error(`必須項目不足のfaceが${invalid.length}件あります`)
const duplicateKeys = faces.map((face) => `${face.card_printing_id}:${face.side_index}`).filter((key, index, all) => all.indexOf(key) !== index)
if (duplicateKeys.length) throw new Error(`同一収録版・同一面が${new Set(duplicateKeys).size}件重複しています`)

const summary = { mode: execute ? 'execute' : 'dry-run', target, inputPath, faces: faces.length, excluded_needs_review_faces: allFaces.length - faces.length, excluded_needs_review_printings: reviewPrintingIds.size, pages: pages.length, logical_cards: new Set(faces.map((face) => face.card_id)).size }
if (!execute) {
  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}

for (const line of (await readFile(process.env.ENV_FILE ?? '.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase環境変数が必要です（値は表示しません）')
if (target === 'preview' && process.env.CARD_FACES_PREVIEW_PROJECT_REF && !url.includes(process.env.CARD_FACES_PREVIEW_PROJECT_REF)) {
  throw new Error('接続先がCARD_FACES_PREVIEW_PROJECT_REFと一致しません')
}
const supabase = createClient(url, key, { auth: { persistSession: false } })
const dbFaces = faces.map((face) => ({
  card_id: face.card_id, card_printing_id: face.card_printing_id, side_index: face.side_index, side_kind: face.side_kind,
  name: face.name, normalized_name: face.normalized_name, name_kana: face.name_kana, card_number: face.card_number ?? null,
  card_type: face.card_type ?? null, image_url: face.image_url, official_page_url: face.official_page_url,
  extraction_status: face.extraction_status, extracted_at: face.extracted_at, updated_at: new Date().toISOString(),
}))
for (let index = 0; index < dbFaces.length; index += 200) {
  const { error } = await supabase.from('card_faces').upsert(dbFaces.slice(index, index + 200), { onConflict: 'card_printing_id,side_index' })
  if (error) throw error
}
const runRows = pages.map((page) => ({ source_key: page.source_key, official_page_url: page.official_page_url, status: page.status, attempts: page.attempts ?? 0, last_error: page.last_error ?? null, content_hash: page.content_hash ?? null, extracted_face_count: page.extracted_face_count ?? 0, checked_at: page.checked_at, updated_at: new Date().toISOString() }))
for (let index = 0; index < runRows.length; index += 200) {
  const { error } = await supabase.from('face_import_runs').upsert(runRows.slice(index, index + 200), { onConflict: 'source_key,official_page_url' })
  if (error) throw error
}
console.log(JSON.stringify({ ...summary, upserted_faces: faces.length, upserted_runs: runRows.length }, null, 2))
