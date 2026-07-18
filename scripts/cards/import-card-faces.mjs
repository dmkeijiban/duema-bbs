#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const PRODUCTION_PROJECT_REF = 'nodgfukqvuwvgfnlzvnh'
const PRODUCTION_CONFIRMATION = 'I_APPROVE_CARD_FACE_PRODUCTION_UPSERT'
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.split('=')
  return [key, value.join('=') || true]
}))
const inputPath = resolve(String(args.get('--input') ?? 'data/cards/card-faces.json'))
const execute = args.has('--execute')
const environment = String(args.get('--environment') ?? args.get('--target') ?? 'preview')

if (!['local', 'preview', 'production'].includes(environment)) {
  throw new Error('--environmentはlocal、preview、productionのいずれかです')
}
if (environment === 'production' && (!execute || args.get('--confirm-production') !== PRODUCTION_CONFIRMATION)) {
  throw new Error(`本番投入には --execute --environment=production --confirm-production=${PRODUCTION_CONFIRMATION} が必要です`)
}

const payload = JSON.parse(await readFile(inputPath, 'utf8'))
const allFaces = Array.isArray(payload.faces) ? payload.faces : []
const pages = Array.isArray(payload.pages) ? payload.pages : []
const reviewPrintingIds = new Set(allFaces.filter((face) => face.extraction_status === 'needs_review').map((face) => face.card_printing_id))
const faces = allFaces.filter((face) => !reviewPrintingIds.has(face.card_printing_id))
const pageByPrintingId = new Map(pages.flatMap((page) => (page.printings ?? []).map((printing) => [printing.id, page])))

const dbFaces = faces.map((face) => {
  const page = pageByPrintingId.get(face.card_printing_id)
  return {
    card_id: face.card_id ?? null,
    card_printing_id: face.card_printing_id ?? null,
    side_index: face.side_index ?? null,
    side_kind: face.side_kind ?? null,
    name: face.name ?? null,
    normalized_name: face.normalized_name ?? null,
    name_kana: face.name_kana ?? null,
    card_number: face.card_number ?? null,
    card_type: face.card_type ?? null,
    image_url: face.image_url ?? null,
    official_page_url: face.official_page_url ?? null,
    extraction_status: face.extraction_status ?? null,
    extracted_at: face.extracted_at ?? null,
    parser_version: page?.parser_version ?? null,
    content_hash: page?.content_hash ?? null,
  }
})
const runRows = pages.map((page) => ({
  source_key: page.source_key ?? null,
  official_page_url: page.official_page_url ?? null,
  status: page.status ?? null,
  attempts: page.attempts ?? 0,
  last_error: page.last_error ?? null,
  content_hash: page.content_hash ?? null,
  extracted_face_count: page.extracted_face_count ?? 0,
  checked_at: page.checked_at ?? null,
  parser_version: page.parser_version ?? null,
  cache_kind: page.cache_kind ?? 'html',
}))

const summaryBase = {
  mode: execute ? 'execute' : 'dry-run',
  environment,
  attempted: dbFaces.length,
  excludedNeedsReview: allFaces.length - faces.length,
  pages: runRows.length,
  logicalCards: new Set(faces.map((face) => face.card_id)).size,
}

if (!execute) {
  console.log(JSON.stringify(summaryBase, null, 2))
  process.exit(0)
}

for (const line of (await readFile(process.env.ENV_FILE ?? '.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}

const databaseUrl = process.env.SUPABASE_DB_URL
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const expectedRef = environment === 'production'
  ? PRODUCTION_PROJECT_REF
  : environment === 'preview' ? process.env.CARD_FACES_PREVIEW_PROJECT_REF : null
if (!databaseUrl || (environment !== 'local' && !publicUrl)) throw new Error('接続先設定が不足しています（値は表示しません）')
if (environment === 'preview' && !expectedRef) throw new Error('Preview投入にはCARD_FACES_PREVIEW_PROJECT_REFが必須です')
if (environment === 'preview' && expectedRef === PRODUCTION_PROJECT_REF) throw new Error('本番project refをPreviewとして指定できません')

const databaseHost = new URL(databaseUrl).hostname
if (environment === 'local') {
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) throw new Error('local指定はloopback DB以外へ接続できません')
} else {
  const publicRef = new URL(publicUrl).hostname.split('.')[0]
  const databaseUrlObject = new URL(databaseUrl)
  const databaseRef = databaseHost.startsWith('db.')
    ? databaseHost.split('.')[1]
    : decodeURIComponent(databaseUrlObject.username).match(/^(?:postgres|cli_login_postgres)\.([a-z0-9]{20})$/)?.[1]
  if (!databaseRef) throw new Error('DB接続先project refを取得できません')
  if (publicRef !== expectedRef || databaseRef !== expectedRef) throw new Error(`${environment}指定と接続先project refが一致しません`)
  if (environment === 'preview' && (publicRef === PRODUCTION_PROJECT_REF || databaseRef === PRODUCTION_PROJECT_REF)) {
    throw new Error('Preview接続先が本番project refです。投入を停止します')
  }
}
console.log(JSON.stringify({ environment, projectRef: expectedRef ?? 'local-loopback', secretsPrinted: false }, null, 2))

const client = new pg.Client({ connectionString: databaseUrl, ssl: environment === 'local' ? false : { rejectUnauthorized: false } })
const resultSummary = { ...summaryBase, inserted: 0, updated: 0, unchanged: 0, failed: 0, rolledBack: false, orphan: 0, duplicates: 0, parentMismatch: 0, missingRequired: 0 }

await client.connect()
try {
  await client.query('begin')
  if (environment === 'production') await client.query('set local role postgres')
  await client.query('set local lock_timeout = \'15s\'')
  await client.query('set local statement_timeout = \'10min\'')
  await client.query(`
    create temp table stage_card_faces (
      card_id uuid, card_printing_id uuid, side_index integer, side_kind text, name text,
      normalized_name text, name_kana text, card_number text, card_type text, image_url text,
      official_page_url text, extraction_status text, extracted_at timestamptz,
      parser_version integer, content_hash text
    ) on commit drop;
    create temp table stage_face_import_runs (
      source_key text, official_page_url text, status text, attempts integer, last_error text,
      content_hash text, extracted_face_count integer, checked_at timestamptz,
      parser_version integer, cache_kind text
    ) on commit drop;
  `)
  await client.query(`
    insert into stage_card_faces (
      card_id, card_printing_id, side_index, side_kind, name, normalized_name, name_kana,
      card_number, card_type, image_url, official_page_url, extraction_status, extracted_at,
      parser_version, content_hash
    )
    select * from jsonb_to_recordset($1::jsonb) as x(
      card_id uuid, card_printing_id uuid, side_index integer, side_kind text, name text,
      normalized_name text, name_kana text, card_number text, card_type text, image_url text,
      official_page_url text, extraction_status text, extracted_at timestamptz,
      parser_version integer, content_hash text
    )`, [JSON.stringify(dbFaces)])
  await client.query(`
    insert into stage_face_import_runs (
      source_key, official_page_url, status, attempts, last_error, content_hash,
      extracted_face_count, checked_at, parser_version, cache_kind
    )
    select * from jsonb_to_recordset($1::jsonb) as x(
      source_key text, official_page_url text, status text, attempts integer, last_error text,
      content_hash text, extracted_face_count integer, checked_at timestamptz,
      parser_version integer, cache_kind text
    )`, [JSON.stringify(runRows)])

  const audit = (await client.query(`
    select
      (select count(*) from stage_card_faces where card_id is null or card_printing_id is null or side_index is null or name is null or btrim(name) = '' or normalized_name is null or btrim(normalized_name) = '' or extraction_status is null or parser_version is null or content_hash is null or official_page_url is null)::int as missing_required,
      (select count(*) from (select card_printing_id, side_index from stage_card_faces group by 1,2 having count(*) > 1) d)::int as duplicates,
      (select count(*) from stage_card_faces s left join public.cards c on c.id = s.card_id where c.id is null)::int as orphan,
      (select count(*) from stage_card_faces s join public.card_printings p on p.id = s.card_printing_id where p.card_id is distinct from s.card_id)::int as parent_mismatch,
      (select count(*) from stage_card_faces s left join public.card_printings p on p.id = s.card_printing_id where p.id is null)::int as missing_printing
  `)).rows[0]
  resultSummary.missingRequired = audit.missing_required
  resultSummary.duplicates = audit.duplicates
  resultSummary.orphan = audit.orphan + audit.missing_printing
  resultSummary.parentMismatch = audit.parent_mismatch
  if (resultSummary.missingRequired || resultSummary.duplicates || resultSummary.orphan || resultSummary.parentMismatch) {
    throw new Error('staging全件検証に失敗しました')
  }

  const before = (await client.query(`
    select (select count(*) from public.cards)::bigint as cards,
           (select count(*) from public.card_printings)::bigint as printings
  `)).rows[0]
  const faceResult = (await client.query(`
    with changed as (
      insert into public.card_faces (
        card_id, card_printing_id, side_index, side_kind, name, normalized_name, name_kana,
        card_number, card_type, image_url, official_page_url, extraction_status, extracted_at,
        parser_version, content_hash
      )
      select card_id, card_printing_id, side_index, side_kind, name, normalized_name, name_kana,
             card_number, card_type, image_url, official_page_url, extraction_status, extracted_at,
             parser_version, content_hash
      from stage_card_faces
      on conflict (card_printing_id, side_index) do update set
        card_id = excluded.card_id, side_kind = excluded.side_kind, name = excluded.name,
        normalized_name = excluded.normalized_name, name_kana = excluded.name_kana,
        card_number = excluded.card_number, card_type = excluded.card_type, image_url = excluded.image_url,
        official_page_url = excluded.official_page_url, extraction_status = excluded.extraction_status,
        extracted_at = excluded.extracted_at, parser_version = excluded.parser_version,
        content_hash = excluded.content_hash, updated_at = now()
      where (card_faces.card_id, card_faces.card_printing_id, card_faces.side_index, card_faces.side_kind,
             card_faces.name, card_faces.normalized_name, card_faces.name_kana, card_faces.card_number,
             card_faces.card_type, card_faces.image_url, card_faces.official_page_url,
             card_faces.extraction_status, card_faces.extracted_at, card_faces.parser_version,
             card_faces.content_hash)
        is distinct from
            (excluded.card_id, excluded.card_printing_id, excluded.side_index, excluded.side_kind,
             excluded.name, excluded.normalized_name, excluded.name_kana, excluded.card_number,
             excluded.card_type, excluded.image_url, excluded.official_page_url,
             excluded.extraction_status, excluded.extracted_at, excluded.parser_version,
             excluded.content_hash)
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted)::int as inserted,
           count(*) filter (where not inserted)::int as updated
    from changed
  `)).rows[0]
  resultSummary.inserted = faceResult.inserted
  resultSummary.updated = faceResult.updated
  resultSummary.unchanged = resultSummary.attempted - resultSummary.inserted - resultSummary.updated

  await client.query(`
    insert into public.face_import_runs (
      source_key, official_page_url, status, attempts, last_error, content_hash,
      extracted_face_count, checked_at, parser_version, cache_kind
    )
    select source_key, official_page_url, status, attempts, last_error, content_hash,
           extracted_face_count, checked_at, parser_version, cache_kind
    from stage_face_import_runs
    on conflict (source_key, official_page_url) do update set
      status = excluded.status, attempts = excluded.attempts, last_error = excluded.last_error,
      content_hash = excluded.content_hash, extracted_face_count = excluded.extracted_face_count,
      checked_at = excluded.checked_at, parser_version = excluded.parser_version,
      cache_kind = excluded.cache_kind, updated_at = now()
    where (face_import_runs.status, face_import_runs.attempts, face_import_runs.last_error,
           face_import_runs.content_hash, face_import_runs.extracted_face_count,
           face_import_runs.checked_at, face_import_runs.parser_version, face_import_runs.cache_kind)
      is distinct from
          (excluded.status, excluded.attempts, excluded.last_error, excluded.content_hash,
           excluded.extracted_face_count, excluded.checked_at, excluded.parser_version,
           excluded.cache_kind)
  `)
  const after = (await client.query(`
    select (select count(*) from public.cards)::bigint as cards,
           (select count(*) from public.card_printings)::bigint as printings,
           (select count(*) from public.card_faces)::bigint as faces
  `)).rows[0]
  if (before.cards !== after.cards || before.printings !== after.printings) throw new Error('既存cards/card_printings件数が変化しました')
  if (Number(after.faces) < resultSummary.attempted) throw new Error('card_faces件数が投入件数を下回っています')
  await client.query('commit')
  console.log(JSON.stringify({ ...resultSummary, cardsChanged: 0, cardPrintingsChanged: 0, physicalDeletes: 0 }, null, 2))
} catch (error) {
  await client.query('rollback')
  resultSummary.failed = resultSummary.attempted
  resultSummary.inserted = 0
  resultSummary.updated = 0
  resultSummary.unchanged = 0
  resultSummary.rolledBack = true
  console.error(JSON.stringify({ ...resultSummary, error: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 1
} finally {
  await client.end()
}
