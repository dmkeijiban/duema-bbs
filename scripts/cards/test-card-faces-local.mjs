#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import EmbeddedPostgres from 'embedded-postgres'

const root = resolve(import.meta.dirname, '../..')
const payload = JSON.parse(await readFile(resolve(root, 'data/cards/card-faces.json'), 'utf8'))
const migration = await readFile(resolve(root, 'supabase/migrations/20260718143000_card_faces.sql'), 'utf8')
const temp = await mkdtemp(join(tmpdir(), 'duema-card-faces-'))
const port = 56000 + Math.floor(Math.random() * 3000)
const password = 'local-card-face-test'
const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`
const pg = new EmbeddedPostgres({ databaseDir: join(temp, 'db'), user: 'postgres', password, port, persistent: false, onLog: () => {}, onError: () => {} })

const runImport = (input, expectSuccess = true) => new Promise((resolvePromise, reject) => {
  const child = spawn(process.execPath, ['scripts/cards/import-card-faces.mjs', '--execute', '--environment=local', `--input=${input}`], {
    cwd: root,
    env: { ...process.env, SUPABASE_DB_URL: databaseUrl, ENV_FILE: resolve(root, '.env.local.example') },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.on('error', reject)
  child.on('close', (code) => {
    const lines = (expectSuccess ? stdout : stderr).trim().split(/\r?\n/)
    const start = lines.findIndex((line) => line.startsWith('{') && lines.slice(lines.indexOf(line)).join('\n').includes('"attempted"'))
    let parsed
    for (let index = Math.max(0, start); index < lines.length; index += 1) {
      try { parsed = JSON.parse(lines.slice(index).join('\n')); break } catch {}
    }
    if ((code === 0) !== expectSuccess || !parsed) return reject(new Error(`import result mismatch code=${code} stderr=${stderr.slice(-1000)}`))
    resolvePromise(parsed)
  })
})

const writeFixture = async (name, mutate) => {
  const fixture = structuredClone(payload)
  mutate(fixture)
  const path = join(temp, `${name}.json`)
  await writeFile(path, JSON.stringify(fixture))
  return path
}

await pg.initialise()
await pg.start()
const client = pg.getPgClient()
await client.connect()
try {
  await client.query('create role anon nologin; create role authenticated nologin; create extension if not exists pgcrypto; create extension if not exists pg_trgm;')
  await client.query(`
    create table public.cards (id uuid primary key, name text not null, normalized_name text not null);
    create table public.card_printings (id uuid primary key, card_id uuid not null references public.cards(id) on delete restrict, source_key text);
  `)
  const cardIds = [...new Set(payload.faces.map((face) => face.card_id))]
  const printingRows = [...new Map(payload.faces.map((face) => [face.card_printing_id, { id: face.card_printing_id, card_id: face.card_id }])).values()]
  const extraCards = Array.from({ length: 11623 - cardIds.length }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
  await client.query(`insert into public.cards(id,name,normalized_name) select id, id, id from jsonb_to_recordset($1::jsonb) x(id uuid)`, [JSON.stringify([...cardIds, ...extraCards].map((id) => ({ id })))])
  await client.query(`insert into public.card_printings(id,card_id,source_key) select id,card_id,id::text from jsonb_to_recordset($1::jsonb) x(id uuid,card_id uuid)`, [JSON.stringify(printingRows)])
  assert.equal(Number((await client.query('select count(*) n from cards')).rows[0].n), 11623)
  assert.equal(Number((await client.query('select count(*) n from card_printings')).rows[0].n), 22922)
  const parentIdHashes = (await client.query(`select
    (select md5(string_agg(id::text, '' order by id)) from cards) cards,
    (select md5(string_agg(id::text, '' order by id)) from card_printings) printings
  `)).rows[0]

  await client.query(migration)
  const first = await runImport(resolve(root, 'data/cards/card-faces.json'))
  assert.deepEqual({ inserted: first.inserted, updated: first.updated, unchanged: first.unchanged, failed: first.failed, rolledBack: first.rolledBack }, { inserted: 23403, updated: 0, unchanged: 0, failed: 0, rolledBack: false })
  assert.equal(Number((await client.query('select count(*) n from card_faces')).rows[0].n), 23403)

  await client.query(migration)
  const second = await runImport(resolve(root, 'data/cards/card-faces.json'))
  assert.deepEqual({ inserted: second.inserted, updated: second.updated, unchanged: second.unchanged, failed: second.failed, rolledBack: second.rolledBack }, { inserted: 0, updated: 0, unchanged: 23403, failed: 0, rolledBack: false })

  const baseline = (await client.query('select md5(string_agg(card_printing_id::text || side_index || name, \'\' order by card_printing_id, side_index)) hash from card_faces')).rows[0].hash
  const badFixtures = [
    ['missing', (data) => { data.faces[0].name = null }, 'missingRequired'],
    ['orphan', (data) => { data.faces[0].card_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff' }, 'orphan'],
    ['duplicate', (data) => { data.faces.push(structuredClone(data.faces[0])) }, 'duplicates'],
    ['parent-mismatch', (data) => { data.faces[0].card_id = data.faces.find((face) => face.card_id !== data.faces[0].card_id).card_id }, 'parentMismatch'],
  ]
  for (const [name, mutate, field] of badFixtures) {
    const result = await runImport(await writeFixture(name, mutate), false)
    assert.equal(result.rolledBack, true)
    assert.ok(result[field] > 0)
    assert.equal(Number((await client.query('select count(*) n from card_faces')).rows[0].n), 23403)
    assert.equal((await client.query('select md5(string_agg(card_printing_id::text || side_index || name, \'\' order by card_printing_id, side_index)) hash from card_faces')).rows[0].hash, baseline)
  }

  await client.query(`
    create function fail_second_face() returns trigger language plpgsql as $$
    begin if new.side_index = 0 and new.name like 'ROLLBACK-%' then raise exception 'injected failure'; end if; return new; end $$;
    create trigger card_faces_injected_failure before update on card_faces for each row execute function fail_second_face();
  `)
  const interrupted = await writeFixture('interrupted', (data) => {
    data.faces[0].name = `ROLLBACK-${data.faces[0].name}`
    data.faces[0].normalized_name = `rollback-${data.faces[0].normalized_name}`
  })
  const interruptedResult = await runImport(interrupted, false)
  assert.equal(interruptedResult.rolledBack, true)
  assert.equal((await client.query('select md5(string_agg(card_printing_id::text || side_index || name, \'\' order by card_printing_id, side_index)) hash from card_faces')).rows[0].hash, baseline)
  await client.query('drop trigger card_faces_injected_failure on card_faces; drop function fail_second_face();')

  const finalCounts = (await client.query('select (select count(*) from cards)::int cards, (select count(*) from card_printings)::int printings, (select count(*) from card_faces)::int faces')).rows[0]
  assert.deepEqual(finalCounts, { cards: 11623, printings: 22922, faces: 23403 })
  assert.deepEqual((await client.query(`select
    (select md5(string_agg(id::text, '' order by id)) from cards) cards,
    (select md5(string_agg(id::text, '' order by id)) from card_printings) printings
  `)).rows[0], parentIdHashes)
  console.log(JSON.stringify({ ok: true, first, second, rollbackFixtures: 5, finalCounts, physicalDeletes: 0 }, null, 2))
} finally {
  await client.end().catch(() => {})
  await pg.stop().catch(() => {})
  await rm(temp, { recursive: true, force: true })
}
