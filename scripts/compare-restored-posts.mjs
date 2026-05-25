#!/usr/bin/env node
/**
 * Read-only recovery dry-run helper.
 *
 * Compares a restored/cloned Supabase project against the current project and
 * writes restore candidates to local JSON/CSV files. It never writes to either DB.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const DEFAULT_ENV = '.env.production.local'
const DEFAULT_OUT_DIR = 'recovery-dry-run'

function usage() {
  return `
Usage:
  node scripts/compare-restored-posts.mjs --restored-url <url> --restored-key <anon-or-service-key> [options]

Options:
  --current-env <path>      Current production env file. Default: ${DEFAULT_ENV}
  --restored-env <path>     Restored project env file with NEXT_PUBLIC_SUPABASE_URL and a key.
  --current-url <url>       Override current Supabase URL.
  --current-key <key>       Override current Supabase anon/service key.
  --restored-url <url>      Restored/cloned Supabase URL. Required unless RESTORED_SUPABASE_URL is set.
  --restored-key <key>      Restored/cloned Supabase key. Required unless RESTORED_SUPABASE_KEY is set.
  --out-dir <path>          Output directory. Default: ${DEFAULT_OUT_DIR}
  --before <iso>            Candidate cutoff. Default: 2026-05-03T00:00:00+09:00
  --include-deleted         Include restored posts with is_deleted=true.
  --help                    Show this help.

Safety:
  This script only performs SELECT requests and local file writes.
`.trim()
}

function parseArgs(argv) {
  const args = {
    currentEnv: DEFAULT_ENV,
    outDir: DEFAULT_OUT_DIR,
    before: '2026-05-03T00:00:00+09:00',
    includeDeleted: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--include-deleted') args.includeDeleted = true
    else if (arg === '--current-env') args.currentEnv = argv[++i]
    else if (arg === '--restored-env') args.restoredEnv = argv[++i]
    else if (arg === '--current-url') args.currentUrl = argv[++i]
    else if (arg === '--current-key') args.currentKey = argv[++i]
    else if (arg === '--restored-url') args.restoredUrl = argv[++i]
    else if (arg === '--restored-key') args.restoredKey = argv[++i]
    else if (arg === '--out-dir') args.outDir = argv[++i]
    else if (arg === '--before') args.before = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const env = {}
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    value = value.replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
  return env
}

function firstTruthy(...values) {
  return values.find(value => typeof value === 'string' && value.length > 0)
}

function makeClient(url, key, label) {
  if (!url) throw new Error(`${label} URL is required`)
  if (!key) throw new Error(`${label} key is required`)
  return createClient(url, key, { auth: { persistSession: false } })
}

async function fetchAll(client, table, select, orderColumn) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await client
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: true })
      .range(from, to)
    if (error) throw new Error(`${table} fetch failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

function normalizeBody(body) {
  return String(body ?? '').replace(/\r\n/g, '\n').trim()
}

function bodyHashKey(row) {
  return [
    row.thread_id ?? '',
    row.post_number ?? '',
    normalizeBody(row.body),
  ].join('\u001f')
}

function bodyOnlyKey(row) {
  return [
    row.thread_id ?? '',
    normalizeBody(row.body),
  ].join('\u001f')
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function writeCsv(filePath, rows) {
  const columns = [
    'restore_candidate_id',
    'original_post_id',
    'thread_id',
    'thread_title',
    'post_number',
    'body_preview',
    'body_full_exists',
    'name',
    'created_at',
    'source',
    'current_thread_exists',
    'current_posts_count',
    'duplicate_risk',
    'restore_status',
  ]
  const lines = [columns.join(',')]
  for (const row of rows) lines.push(columns.map(col => csvEscape(row[col])).join(','))
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return
  }

  const env = readEnvFile(path.resolve(ROOT, args.currentEnv))
  const restoredEnv = args.restoredEnv ? readEnvFile(path.resolve(ROOT, args.restoredEnv)) : {}
  const currentUrl = firstTruthy(args.currentUrl, process.env.CURRENT_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL)
  const currentKey = firstTruthy(
    args.currentKey,
    process.env.CURRENT_SUPABASE_KEY,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
  const restoredUrl = firstTruthy(
    args.restoredUrl,
    process.env.RESTORED_SUPABASE_URL,
    restoredEnv.NEXT_PUBLIC_SUPABASE_URL,
  )
  const restoredKey = firstTruthy(
    args.restoredKey,
    process.env.RESTORED_SUPABASE_KEY,
    restoredEnv.SUPABASE_SERVICE_ROLE_KEY,
    restoredEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  const current = makeClient(currentUrl, currentKey, 'Current Supabase')
  const restored = makeClient(restoredUrl, restoredKey, 'Restored Supabase')

  const [currentThreads, currentPosts, restoredPosts] = await Promise.all([
    fetchAll(current, 'threads', 'id,title,created_at,last_posted_at,post_count,is_archived', 'id'),
    fetchAll(current, 'posts', 'id,thread_id,post_number,body,author_name,created_at,is_deleted', 'id'),
    fetchAll(restored, 'posts', 'id,thread_id,post_number,body,author_name,created_at,is_deleted', 'id'),
  ])

  const currentThreadMap = new Map(currentThreads.map(t => [t.id, t]))
  const currentPostsByThread = new Map()
  const currentExact = new Set()
  const currentBodyOnly = new Set()
  for (const post of currentPosts) {
    if (!currentPostsByThread.has(post.thread_id)) currentPostsByThread.set(post.thread_id, [])
    currentPostsByThread.get(post.thread_id).push(post)
    currentExact.add(bodyHashKey(post))
    currentBodyOnly.add(bodyOnlyKey(post))
  }

  const beforeTime = new Date(args.before).getTime()
  if (Number.isNaN(beforeTime)) throw new Error(`Invalid --before value: ${args.before}`)

  const candidates = []
  let index = 1
  for (const post of restoredPosts) {
    const createdTime = new Date(post.created_at).getTime()
    if (Number.isNaN(createdTime) || createdTime >= beforeTime) continue
    if (!args.includeDeleted && post.is_deleted === true) continue
    if (currentExact.has(bodyHashKey(post))) continue

    const currentThread = currentThreadMap.get(post.thread_id)
    const currentThreadPosts = currentPostsByThread.get(post.thread_id) ?? []
    const body = normalizeBody(post.body)
    const bodyExistsElsewhere = currentBodyOnly.has(bodyOnlyKey(post))

    let duplicateRisk = 'low'
    let restoreStatus = 'safe'
    if (!currentThread) {
      duplicateRisk = 'high'
      restoreStatus = 'needs_review'
    } else if (bodyExistsElsewhere) {
      duplicateRisk = 'medium'
      restoreStatus = 'needs_review'
    } else if (!body) {
      duplicateRisk = 'high'
      restoreStatus = 'impossible'
    }

    candidates.push({
      restore_candidate_id: `pitr-${String(index).padStart(4, '0')}`,
      original_post_id: post.id,
      thread_id: post.thread_id,
      thread_title: currentThread?.title ?? '',
      post_number: post.post_number,
      body_preview: body.replace(/\s+/g, ' ').slice(0, 120),
      body_full_exists: body.length > 0,
      name: post.author_name ?? '',
      created_at: post.created_at,
      source: 'restored-supabase',
      current_thread_exists: Boolean(currentThread),
      current_posts_count: currentThreadPosts.filter(p => p.is_deleted !== true).length,
      duplicate_risk: duplicateRisk,
      restore_status: restoreStatus,
    })
    index += 1
  }

  const outDir = path.resolve(ROOT, args.outDir)
  fs.mkdirSync(outDir, { recursive: true })
  const jsonPath = path.join(outDir, 'restore-candidates.json')
  const csvPath = path.join(outDir, 'restore-candidates.csv')
  const summaryPath = path.join(outDir, 'summary.json')
  fs.writeFileSync(jsonPath, `${JSON.stringify(candidates, null, 2)}\n`, 'utf8')
  writeCsv(csvPath, candidates)
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    before: args.before,
    current_threads: currentThreads.length,
    current_posts: currentPosts.length,
    restored_posts: restoredPosts.length,
    candidates: candidates.length,
    safe: candidates.filter(c => c.restore_status === 'safe').length,
    needs_review: candidates.filter(c => c.restore_status === 'needs_review').length,
    impossible: candidates.filter(c => c.restore_status === 'impossible').length,
    output: {
      json: path.relative(ROOT, jsonPath),
      csv: path.relative(ROOT, csvPath),
    },
  }, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify({
    ok: true,
    candidates: candidates.length,
    json: path.relative(ROOT, jsonPath),
    csv: path.relative(ROOT, csvPath),
    summary: path.relative(ROOT, summaryPath),
  }, null, 2))
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
