/**
 * insert-approved-revival-comments.mjs
 *
 * generate-empty-thread-revival.mjs で生成した comments.json を
 * 確認・承認後に本番 DB へ INSERT するスクリプト。
 *
 * 使い方:
 *   node scripts/insert-approved-revival-comments.mjs --file revival-preview-2026-05-25/comments.json
 *   node scripts/insert-approved-revival-comments.mjs --file .../comments.json --dry-run   # DB 書き込みなし
 *
 * 必要な環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL     Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY    サービスロールキー（.env.local）
 *
 * ⚠️ 絶対ルール:
 *   - 物理削除コード（.delete()）は書かない・呼ばない
 *   - preview ファイルのコメントを必ずユーザーが確認してから実行する
 *   - 対象スレ以外には絶対に触らない
 *   - 本番 DB への直接 INSERT は preview 確認後のこのスクリプトでのみ行う
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

async function loadEnvFile(file) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index < 0) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch { /* なければスキップ */ }
}

function parseArgs(argv) {
  const args = { file: null, dryRun: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--file':    args.file = argv[++i]; break
      case '--dry-run': args.dryRun = true; break
      case '--help': case '-h': args.help = true; break
    }
  }
  return args
}

function usage() {
  return `
使い方:
  node scripts/insert-approved-revival-comments.mjs --file <comments.json>

オプション:
  --file <path>   generate-empty-thread-revival.mjs が出力した comments.json のパス（必須）
  --dry-run       DB 書き込みをスキップして確認のみ
  -h, --help      このヘルプを表示

例:
  node scripts/insert-approved-revival-comments.mjs --file revival-preview-2026-05-25/comments.json
  node scripts/insert-approved-revival-comments.mjs --file revival-preview-2026-05-25/comments.json --dry-run
`
}

function logSection(title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

// ─────────────────────────────────────────────
// Supabase
// ─────────────────────────────────────────────

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─────────────────────────────────────────────
// バリデーション
// ─────────────────────────────────────────────

function validatePreviewData(data) {
  const errors = []

  if (!Array.isArray(data.threads) || data.threads.length === 0) {
    errors.push('threads 配列が空か不正です')
    return errors
  }

  for (const t of data.threads) {
    if (!t.thread_id) errors.push(`thread_id が未設定のエントリがあります`)
    if (!t.title) errors.push(`スレ #${t.thread_id}: title が未設定`)
    if (!t.created_at) errors.push(`スレ #${t.thread_id}: created_at が未設定`)
    if (t.status !== 'generated') {
      errors.push(`スレ #${t.thread_id}: status="${t.status}" (generated のみ insert 対象)`)
      continue
    }
    if (!Array.isArray(t.comments) || t.comments.length !== 5) {
      errors.push(`スレ #${t.thread_id}: コメントが5件ではありません（${t.comments?.length}件）`)
      continue
    }
    for (let i = 0; i < t.comments.length; i++) {
      const c = t.comments[i]
      if (!c.body || c.body.trim().length < 5) {
        errors.push(`スレ #${t.thread_id} コメント${i+1}: body が短すぎます`)
      }
      if (!c.author_name) {
        errors.push(`スレ #${t.thread_id} コメント${i+1}: author_name が未設定`)
      }
      if (!c.created_at) {
        errors.push(`スレ #${t.thread_id} コメント${i+1}: created_at が未設定`)
      }
      if (c.post_number !== i + 1) {
        errors.push(`スレ #${t.thread_id} コメント${i+1}: post_number が不正 (${c.post_number})`)
      }
      // スレの created_at より前のタイムスタンプはNG
      if (new Date(c.created_at) <= new Date(t.created_at)) {
        errors.push(`スレ #${t.thread_id} コメント${i+1}: created_at がスレ作成日時以前`)
      }
    }
  }

  return errors
}

// ─────────────────────────────────────────────
// DB 操作
// ─────────────────────────────────────────────

async function checkThreadExists(supabase, threadId) {
  const { data, error } = await supabase
    .from('threads')
    .select('id, is_archived, is_protected, post_count')
    .eq('id', threadId)
    .single()
  if (error) throw new Error(`スレ #${threadId} の確認失敗: ${error.message}`)
  return data
}

async function checkExistingPosts(supabase, threadId) {
  const { data, error } = await supabase
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
  if (error) throw new Error(`posts 確認失敗: ${error.message}`)
  return (data ?? []).length
}

async function insertRevivalComments(supabase, threadEntry) {
  const { thread_id, comments, created_at } = threadEntry

  // posts を INSERT
  const rows = comments.map(c => ({
    thread_id,
    post_number: c.post_number,
    body: c.body,
    author_name: c.author_name,
    created_at: c.created_at,
    is_deleted: false,
  }))

  const { error: insertErr } = await supabase.from('posts').insert(rows)
  if (insertErr) throw new Error(`posts INSERT 失敗: ${insertErr.message}`)

  // threads.post_count と last_posted_at を UPDATE
  const lastCreatedAt = comments[comments.length - 1].created_at
  const { error: updateErr } = await supabase
    .from('threads')
    .update({
      post_count: comments.length,
      last_posted_at: lastCreatedAt,
    })
    .eq('id', thread_id)
  if (updateErr) throw new Error(`threads UPDATE 失敗: ${updateErr.message}`)

  return { inserted: rows.length, last_posted_at: lastCreatedAt }
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

async function main() {
  await loadEnvFile(path.join(ROOT_DIR, '.env.local'))
  await loadEnvFile(path.join(ROOT_DIR, '.env.vercel.prod'))

  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(usage()); process.exit(0) }

  if (!args.file) {
    console.error('❌ --file オプションが必要です')
    console.log(usage())
    process.exit(1)
  }

  logSection('① preview ファイル読み込み')
  const filePath = path.resolve(args.file)
  console.log(`  ファイル: ${filePath}`)

  let data
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    data = JSON.parse(raw)
  } catch (e) {
    console.error(`❌ ファイル読み込みエラー: ${e.message}`)
    process.exit(1)
  }

  console.log(`  生成日時: ${data.generated_at}`)
  console.log(`  総スレ数: ${data.total_threads}`)
  console.log(`  生成済み: ${data.generated_threads}`)

  logSection('② バリデーション')
  const errors = validatePreviewData(data)
  if (errors.length > 0) {
    console.error('❌ バリデーションエラー:')
    errors.forEach(e => console.error(`  - ${e}`))
    process.exit(1)
  }
  console.log('  ✅ バリデーション通過')

  // generated のみが insert 対象
  const targets = data.threads.filter(t => t.status === 'generated')
  console.log(`  INSERT 対象: ${targets.length} スレ × 5コメント = ${targets.length * 5}件`)

  logSection('③ DB 事前確認')
  const supabase = createSupabaseClient()
  const skipped = []

  for (const t of targets) {
    const thread = await checkThreadExists(supabase, t.thread_id)
    const existingCount = await checkExistingPosts(supabase, t.thread_id)

    let issues = []
    if (thread.is_archived) issues.push('is_archived=true（アーカイブ済み）')
    if (thread.is_protected) issues.push('is_protected=true（保護済み）')
    if (existingCount > 0) issues.push(`有効コメント${existingCount}件が既に存在`)

    if (issues.length > 0) {
      console.warn(`  ⚠️  スレ #${t.thread_id} をスキップ: ${issues.join(', ')}`)
      skipped.push(t.thread_id)
    } else {
      console.log(`  ✅ スレ #${t.thread_id}: 問題なし`)
    }
  }

  const insertTargets = targets.filter(t => !skipped.includes(t.thread_id))

  if (insertTargets.length === 0) {
    console.log('\n  INSERT 対象が0件のため終了します。')
    process.exit(0)
  }

  if (args.dryRun) {
    logSection('dry-run 完了（DB 書き込みなし）')
    console.log(`  INSERT 予定: ${insertTargets.length} スレ × 5 = ${insertTargets.length * 5}件`)
    console.log('  dry-run なので実際には何もしません。')
    console.log('  本番 INSERT するには --dry-run を外して実行してください。')
    process.exit(0)
  }

  logSection(`④ 本番 DB INSERT（${insertTargets.length}スレ）`)
  console.log('  ⚠️  ここから本番 DB を変更します。Ctrl+C で中断できます。')
  console.log('  3秒後に開始します...')
  await new Promise(r => setTimeout(r, 3000))

  const results = []
  for (const t of insertTargets) {
    process.stdout.write(`  スレ #${t.thread_id} ${t.title.slice(0, 30)}... `)
    try {
      const result = await insertRevivalComments(supabase, t)
      console.log(`✅ ${result.inserted}件 INSERT`)
      results.push({ threadId: t.thread_id, status: 'success', inserted: result.inserted })
    } catch (e) {
      console.log(`❌ ${e.message}`)
      results.push({ threadId: t.thread_id, status: 'error', error: e.message })
    }
  }

  logSection('⑤ 結果サマリ')
  const success = results.filter(r => r.status === 'success')
  const failed = results.filter(r => r.status === 'error')
  console.log(`  成功: ${success.length}スレ（${success.length * 5}件）`)
  console.log(`  失敗: ${failed.length}スレ`)
  if (failed.length > 0) {
    failed.forEach(r => console.error(`    スレ #${r.threadId}: ${r.error}`))
  }

  // 結果ログを preview ディレクトリに保存
  const logDir = path.dirname(filePath)
  const logPath = path.join(logDir, 'insert-result.json')
  await fs.writeFile(logPath, JSON.stringify({
    executed_at: new Date().toISOString(),
    results,
    skipped,
  }, null, 2), 'utf8')
  console.log(`\n  結果ログ: ${logPath}`)

  logSection('⑥ 次のステップ')
  console.log('  ① キャッシュ期限（60〜300秒）を待つ')
  console.log('  ② 本番サイトでリバイバルスレのページを2回アクセスして表示を確認')
  console.log('  ③ トップページ（page=1）に古いスレが浮上していないか確認')
  console.log('  ④ Obsidian 開発ログに記録する')
}

main().catch(e => {
  console.error('\n❌ 致命的エラー:', e.message)
  process.exit(1)
})
