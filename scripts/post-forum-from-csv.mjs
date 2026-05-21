/**
 * post-forum-from-csv.mjs
 * CSV に登録した X 投稿内容を scheduled_at を過ぎたら掲示板スレッドとして投稿する
 *
 * CSV列（ヘッダー必須）:
 *   scheduled_at, x_text, image_url, forum_status, forum_thread_id, forum_error
 *
 * 使い方:
 *   node scripts/post-forum-from-csv.mjs                  # 通常実行
 *   node scripts/post-forum-from-csv.mjs --dry-run        # 送らずにログだけ
 *   node scripts/post-forum-from-csv.mjs --csv /path/to/file.csv
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

// ─── パス解決 ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR  = join(__dirname, '..')

// ─── .env.local 読み込み ─────────────────────────────────────────────────────
const ENV_PATH = join(ROOT_DIR, '.env.local')
if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/)
    if (m) {
      const val = m[2].replace(/^["']|["']$/g, '')
      if (!process.env[m[1]]) process.env[m[1]] = val
    }
  }
}

// ─── 設定 ────────────────────────────────────────────────────────────────────
const DRY_RUN    = process.argv.includes('--dry-run')
const csvArgIdx  = process.argv.indexOf('--csv')
const CSV_PATH   = csvArgIdx !== -1
  ? resolve(process.argv[csvArgIdx + 1])
  : join(ROOT_DIR, 'scripts', 'x-posts.csv')
const LOG_PATH   = join(ROOT_DIR, 'scripts', 'post-forum.log')

const API_BASE   = process.env.FORUM_API_BASE_URL ?? 'https://www.duema-bbs.com'
const API_SECRET = process.env.INTERNAL_POST_SECRET ?? ''
const API_URL    = `${API_BASE}/api/internal/create-thread-from-post`

// ─── ロガー ──────────────────────────────────────────────────────────────────
function log(message) {
  const ts   = new Date().toISOString()
  const line = `[${ts}] ${message}\n`
  process.stdout.write(line)
  appendFileSync(LOG_PATH, line)
}

// ─── API呼び出し ─────────────────────────────────────────────────────────────
async function postToForum(row) {
  const body = {
    text:        row.x_text,
    source:      'x-csv',
    scheduledAt: row.scheduled_at,
  }

  if (row.image_url?.trim()) {
    body.imageUrl = row.image_url.trim()
  }

  if (DRY_RUN) {
    log(`[DRY-RUN] 送信スキップ: ${JSON.stringify(body).slice(0, 120)}…`)
    return { threadId: 'dry-run', threadUrl: 'dry-run' }
  }

  const res = await fetch(API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${API_SECRET}`,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))

  if (res.status === 409) {
    // 重複: 既存スレッドIDを記録
    return { duplicate: true, threadId: json.threadId ?? '', threadUrl: json.threadUrl ?? '' }
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${json.error ?? '(no message)'} ${json.detail ?? ''}`.trim())
  }

  return { threadId: json.threadId, threadUrl: json.threadUrl }
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  log('=== post-forum-from-csv 起動 ===')

  if (!DRY_RUN && !API_SECRET) {
    log('ERROR: INTERNAL_POST_SECRET が .env.local に設定されていません')
    process.exit(1)
  }

  if (!existsSync(CSV_PATH)) {
    log(`ERROR: CSVファイルが見つかりません: ${CSV_PATH}`)
    process.exit(1)
  }

  const csvContent = readFileSync(CSV_PATH, 'utf-8')
  const rows = parse(csvContent, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
    relax_quotes:     true,
  })

  const now          = new Date()
  let   postedCount  = 0
  let   skippedCount = 0
  let   failedCount  = 0
  let   needsWrite   = false

  for (const row of rows) {
    // pending 以外はスキップ
    if (row.forum_status !== 'pending') {
      continue
    }

    // scheduled_at が未来ならスキップ
    const scheduledAt = new Date(row.scheduled_at)
    if (isNaN(scheduledAt.getTime())) {
      log(`[SKIP] scheduled_at が不正: "${row.scheduled_at}"`)
      skippedCount++
      continue
    }
    if (scheduledAt > now) {
      log(`[SKIP] 予定時刻未到達: ${row.scheduled_at}`)
      skippedCount++
      continue
    }

    const preview = (row.x_text ?? '').slice(0, 40).replace(/\n/g, ' ')
    log(`[POST] scheduled=${row.scheduled_at} text="${preview}…"`)

    try {
      const result = await postToForum(row)

      if (result.duplicate) {
        log(`[SKIP] 重複: threadId=${result.threadId} url=${result.threadUrl}`)
        row.forum_status    = 'posted'
        row.forum_thread_id = String(result.threadId)
        row.forum_error     = 'duplicate'
        skippedCount++
      } else {
        log(`✅ 成功: threadId=${result.threadId} url=${result.threadUrl}`)
        row.forum_status    = DRY_RUN ? 'pending' : 'posted'
        row.forum_thread_id = DRY_RUN ? '' : String(result.threadId)
        row.forum_error     = ''
        postedCount++
      }
    } catch (err) {
      log(`❌ 失敗: ${err.message}`)
      row.forum_status    = 'failed'
      row.forum_thread_id = ''
      row.forum_error     = err.message.slice(0, 200)
      failedCount++
    }
    needsWrite = true
  }

  // CSV 書き戻し
  if (needsWrite && !DRY_RUN) {
    const output = stringify(rows, {
      header:  true,
      columns: [
        'scheduled_at',
        'x_text',
        'image_url',
        'forum_status',
        'forum_thread_id',
        'forum_error',
      ],
      quoted_string: true,
    })
    writeFileSync(CSV_PATH, output)
    log('CSV を更新しました')
  }

  log(`=== 完了: 投稿${postedCount}件 / スキップ${skippedCount}件 / 失敗${failedCount}件 ===`)
}

main().catch(err => {
  log(`FATAL: ${err.message}`)
  process.exit(1)
})
