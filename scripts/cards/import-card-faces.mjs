#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const PRODUCTION_PROJECT_REF = 'nodgfukqvuwvgfnlzvnh'
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
const pageByPrintingId = new Map(pages.flatMap((page) => (page.printings ?? []).map((printing) => [printing.id, page])))
const dbFaces = faces.map((face) => {
  const page = pageByPrintingId.get(face.card_printing_id)
  return {
    card_id: face.card_id, card_printing_id: face.card_printing_id, side_index: face.side_index, side_kind: face.side_kind,
    name: face.name, normalized_name: face.normalized_name, name_kana: face.name_kana, card_number: face.card_number ?? null,
    card_type: face.card_type ?? null, image_url: face.image_url, official_page_url: face.official_page_url,
    extraction_status: face.extraction_status, extracted_at: face.extracted_at, parser_version: page?.parser_version ?? null,
    content_hash: page?.content_hash ?? null,
  }
})
const runRows = pages.map((page) => ({
  source_key: page.source_key, official_page_url: page.official_page_url, status: page.status, attempts: page.attempts ?? 0,
  last_error: page.last_error ?? null, content_hash: page.content_hash ?? null, extracted_face_count: page.extracted_face_count ?? 0,
  checked_at: page.checked_at, parser_version: page.parser_version ?? null, cache_kind: page.cache_kind ?? 'html',
}))
const summary = {
  mode: execute ? 'execute' : 'dry-run', target, faces: faces.length,
  excluded_needs_review_faces: allFaces.length - faces.length, excluded_needs_review_printings: reviewPrintingIds.size,
  pages: pages.length, logical_cards: new Set(faces.map((face) => face.card_id)).size,
}
if (!execute) {
  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}

for (const line of (await readFile(process.env.ENV_FILE ?? '.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const databaseUrl = process.env.SUPABASE_DB_URL
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!databaseUrl || !publicUrl) throw new Error('SUPABASE_DB_URLとNEXT_PUBLIC_SUPABASE_URLが必要です（値は表示しません）')
const actualProjectRef = new URL(publicUrl).hostname.split('.')[0]
const expectedProjectRef = target === 'production' ? PRODUCTION_PROJECT_REF : process.env.CARD_FACES_PREVIEW_PROJECT_REF
if (!expectedProjectRef) throw new Error('Preview投入にはCARD_FACES_PREVIEW_PROJECT_REFが必須です')
if (actualProjectRef !== expectedProjectRef) throw new Error(`接続先project refが${target}指定と一致しません`)
if (target === 'preview' && actualProjectRef === PRODUCTION_PROJECT_REF) throw new Error('Preview接続先が本番project refです。投入を停止します')
console.log(JSON.stringify({ target, project_ref: actualProjectRef, key_values_printed: false }, null, 2))

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
const comparable = (value) => value instanceof Date ? value.toISOString() : String(value ?? '')
const different = (left, right, fields) => fields.some((field) => comparable(left?.[field]) !== comparable(right?.[field]))
const faceFields = ['card_id','card_printing_id','side_index','side_kind','name','normalized_name','name_kana','card_number','card_type','image_url','official_page_url','extraction_status','extracted_at','parser_version','content_hash']
const runFields = ['source_key','official_page_url','status','attempts','last_error','content_hash','extracted_face_count','checked_at','parser_version','cache_kind']
const upsertBatches = async (table, rows, fields, conflictFields) => {
  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250)
    const values = batch.flatMap((row) => fields.map((field) => row[field] ?? null))
    const tuples = batch.map((_, rowIndex) => `(${fields.map((__, fieldIndex) => `$${rowIndex * fields.length + fieldIndex + 1}`).join(',')})`).join(',')
    const updates = fields.filter((field) => !conflictFields.includes(field)).map((field) => `${field}=excluded.${field}`).join(',')
    const changed = fields.filter((field) => !conflictFields.includes(field)).map((field) => `${table}.${field} is distinct from excluded.${field}`).join(' or ')
    await client.query(`insert into public.${table} (${fields.join(',')}) values ${tuples} on conflict (${conflictFields.join(',')}) do update set ${updates}, updated_at=now() where ${changed}`, values)
  }
}

await client.connect()
try {
  await client.query('begin')
  const beforeCards = Number((await client.query('select count(*)::bigint count from public.cards')).rows[0].count)
  const beforePrintings = Number((await client.query('select count(*)::bigint count from public.card_printings')).rows[0].count)
  const existingFaces = (await client.query('select * from public.card_faces')).rows
  const existingRuns = (await client.query('select * from public.face_import_runs')).rows
  const existingFaceMap = new Map(existingFaces.map((row) => [`${row.card_printing_id}:${row.side_index}`, row]))
  const existingRunMap = new Map(existingRuns.map((row) => [`${row.source_key}:${row.official_page_url}`, row]))
  const faceInserts = dbFaces.filter((row) => !existingFaceMap.has(`${row.card_printing_id}:${row.side_index}`)).length
  const faceUpdates = dbFaces.filter((row) => { const old = existingFaceMap.get(`${row.card_printing_id}:${row.side_index}`); return old && different(old, row, faceFields) }).length
  const runInserts = runRows.filter((row) => !existingRunMap.has(`${row.source_key}:${row.official_page_url}`)).length
  const runUpdates = runRows.filter((row) => { const old = existingRunMap.get(`${row.source_key}:${row.official_page_url}`); return old && different(old, row, runFields) }).length
  await upsertBatches('card_faces', dbFaces, faceFields, ['card_printing_id','side_index'])
  await upsertBatches('face_import_runs', runRows, runFields, ['source_key','official_page_url'])
  const afterCards = Number((await client.query('select count(*)::bigint count from public.cards')).rows[0].count)
  const afterPrintings = Number((await client.query('select count(*)::bigint count from public.card_printings')).rows[0].count)
  if (beforeCards !== afterCards || beforePrintings !== afterPrintings) throw new Error('既存cards/card_printings件数が変化しました')
  await client.query('commit')
  console.log(JSON.stringify({ ...summary, face_inserts: faceInserts, face_updates: faceUpdates, run_inserts: runInserts, run_updates: runUpdates, cards_changed: 0, card_printings_changed: 0, physical_deletes: 0, transaction: 'committed' }, null, 2))
} catch (error) {
  await client.query('rollback')
  console.error(JSON.stringify({ transaction: 'rolled_back', error: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 1
} finally {
  await client.end()
}
