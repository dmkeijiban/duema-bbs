/**
 * generate-empty-thread-revival.mjs
 *
 * 72時間以上コメントゼロのスレッドを検出し、
 * リバイバルコメント5件を生成して preview ファイルを出力する。
 *
 * 使い方:
 *   node scripts/generate-empty-thread-revival.mjs
 *   node scripts/generate-empty-thread-revival.mjs --dry-run      # 検出だけ（生成スキップ）
 *   node scripts/generate-empty-thread-revival.mjs --thread 123   # 特定スレのみ
 *   node scripts/generate-empty-thread-revival.mjs --limit 10     # 最大10スレ処理
 *
 * 必要な環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL      Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY     サービスロールキー（.env.local）
 *   ANTHROPIC_API_KEY             コメント自動生成用（なければ dry-run 相当）
 *
 * 出力:
 *   revival-preview-YYYY-MM-DD/
 *     targets.csv     ── 対象スレ一覧
 *     comments.json   ── 生成コメント（insert-approved-revival-comments.mjs への入力）
 *     preview.md      ── 人間が確認する Markdown
 *
 * ⚠️ 絶対ルール:
 *   - このスクリプトは preview を出力するだけ
 *   - DB への INSERT は insert-approved-revival-comments.mjs を別途実行
 *   - 物理削除コード（.delete()）を書かない
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

// ─────────────────────────────────────────────
// 設定定数
// ─────────────────────────────────────────────
const REVIVAL_THRESHOLD_HOURS = 72 // 72時間以上でリバイバル対象
const COMMENTS_PER_THREAD = 5
const ANIMANCH_SEARCH_BASE = 'https://bbs.animanch.com/board/'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-haiku-4-5'

// コメント投稿のタイムオフセット（分）
const TIME_OFFSETS_MIN = [5, 8, 12, 18, 25]

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
  } catch { /* env ファイルなければスキップ */ }
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    threadId: null,
    limit: 50,
    outDir: null,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--dry-run':    args.dryRun = true; break
      case '--thread':     args.threadId = parseInt(argv[++i]); break
      case '--limit':      args.limit = parseInt(argv[++i]); break
      case '--out':        args.outDir = argv[++i]; break
      case '--help': case '-h': args.help = true; break
    }
  }
  return args
}

function usage() {
  return `
使い方:
  node scripts/generate-empty-thread-revival.mjs [オプション]

オプション:
  --dry-run         コメント生成をスキップして対象スレ一覧のみ出力
  --thread <id>     特定スレIDのみ処理
  --limit <n>       処理するスレ数の上限（デフォルト: 50）
  --out <dir>       出力ディレクトリを指定（デフォルト: revival-preview-YYYY-MM-DD）
  -h, --help        このヘルプを表示

必要な環境変数:
  NEXT_PUBLIC_SUPABASE_URL      Supabase URL
  SUPABASE_SERVICE_ROLE_KEY     サービスロールキー
  ANTHROPIC_API_KEY             （省略時は --dry-run 相当になる）
`
}

function addMinutes(isoString, minutes) {
  return new Date(new Date(isoString).getTime() + minutes * 60 * 1000).toISOString()
}

function nowJST() {
  return new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '-').padStart(10, '0')
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

/**
 * 72h以上コメントゼロのスレを検出する
 * is_deleted=false の実コメント数で判定（post_count カラムは信頼しない）
 */
async function detectZeroCommentThreads(supabase, { threadId, limit }) {
  const thresholdDate = new Date(Date.now() - REVIVAL_THRESHOLD_HOURS * 60 * 60 * 1000)

  // ① is_deleted=false の post が存在する thread_id を全件取得
  // PostgREST デフォルト 1000 行上限を回避するため limit(100000) を明示
  const { data: activePosts, error: epErr } = await supabase
    .from('posts')
    .select('thread_id')
    .eq('is_deleted', false)
    .limit(100000)

  if (epErr) throw new Error(`posts 取得失敗: ${epErr.message}`)

  const activeThreadIds = new Set((activePosts ?? []).map(p => p.thread_id))

  // ② 対象スレを取得
  let query = supabase
    .from('threads')
    .select('id, title, body, created_at, post_count, category_id, categories(name)')
    .eq('is_archived', false)
    .eq('is_protected', false)
    .lt('created_at', thresholdDate.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit * 3) // 実コメントフィルタで減るので多めに取る

  if (threadId) {
    query = query.eq('id', threadId)
  }

  const { data: threads, error: tErr } = await query
  if (tErr) throw new Error(`threads 取得失敗: ${tErr.message}`)

  // ③ 実コメントがないスレのみ絞り込み
  const targets = (threads ?? [])
    .filter(t => !activeThreadIds.has(t.id))
    .slice(0, limit)

  return targets
}

// ─────────────────────────────────────────────
// animanch 参照取得
// ─────────────────────────────────────────────

async function fetchAnimanchReference(threadTitle) {
  try {
    const searchUrl = `https://bbs.animanch.com/board/search/?q=${encodeURIComponent(threadTitle)}&limit=5`
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'duema-bbs-revival-tool/0.1 (+local)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // スレタイトルと本文の抜粋を簡易抽出
    const snippets = []
    const titleMatches = html.matchAll(/<a[^>]+class="[^"]*thread[^"]*"[^>]*>([^<]{5,80})<\/a>/gi)
    for (const m of titleMatches) {
      const text = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      if (text) snippets.push(text)
      if (snippets.length >= 5) break
    }
    return snippets.length > 0 ? snippets.join(' / ') : null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// Anthropic API でコメント生成
// ─────────────────────────────────────────────

async function generateCommentsWithAI(thread, animanchRef) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return null // API キーなし → 呼び出し元で dry-run 扱い
  }

  const categoryName = thread.categories?.name ?? 'デュエマ全般'
  const refText = animanchRef
    ? `\n\n参考（animanch の関連スレ抜粋）:\n${animanchRef}`
    : ''

  const systemPrompt = `あなたはデュエル・マスターズ掲示板の一般ユーザーです。
以下のルールを必ず守ってコメントを書いてください：

【絶対ルール】
- 口語・くだけた口調で書く（「〜だよね」「〜じゃない？」「〜かな」など）
- AI らしい説明文・箇条書き・まとめ文は使わない
- スレタイトルに沿った内容にする
- 根拠なく特定カードを断定しない
- 相場・環境を「〇〇円」「環境トップ」などと断定しない
- #res数字 は使わない
- HTML タグ・URL は書かない
- 実在の人物・店舗への批判はしない
- コメント同士の内容をコピペ・使いまわしをしない
- 各コメントは 30〜120 文字程度

出力形式（JSON のみ、前後に余計なテキスト不要）:
{"comments": ["コメント1", "コメント2", "コメント3", "コメント4", "コメント5"]}`

  const userPrompt = `スレタイトル: 「${thread.title}」
カテゴリ: ${categoryName}
${thread.body ? `スレ本文: ${thread.body.slice(0, 200)}` : ''}${refText}

このスレッドへの自然な返信コメントを5件生成してください。`

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic API エラー: ${res.status} ${body}`)
  }

  const data = await res.json()
  const content = data?.content?.[0]?.text ?? ''

  // JSON を抽出してパース
  const match = content.match(/\{[\s\S]*"comments"[\s\S]*\}/)
  if (!match) throw new Error(`コメント JSON をパースできませんでした: ${content.slice(0, 200)}`)
  const parsed = JSON.parse(match[0])

  if (!Array.isArray(parsed.comments) || parsed.comments.length !== COMMENTS_PER_THREAD) {
    throw new Error(`コメント数が${COMMENTS_PER_THREAD}件ではありません: ${parsed.comments?.length}`)
  }

  return parsed.comments
}

// ─────────────────────────────────────────────
// バリデーション
// ─────────────────────────────────────────────

function validateComments(comments, threadId) {
  const errors = []
  if (!Array.isArray(comments) || comments.length !== COMMENTS_PER_THREAD) {
    errors.push(`スレ${threadId}: コメント数が${COMMENTS_PER_THREAD}件ではありません（${comments?.length}件）`)
    return errors
  }
  for (let i = 0; i < comments.length; i++) {
    const c = comments[i]
    if (!c || c.trim().length < 5) errors.push(`スレ${threadId} コメント${i+1}: 内容が短すぎます`)
    if (/<[a-z]/i.test(c)) errors.push(`スレ${threadId} コメント${i+1}: HTML タグを含みます`)
    if (/https?:\/\//.test(c)) errors.push(`スレ${threadId} コメント${i+1}: URL を含みます`)
    if (/#res\d/.test(c)) errors.push(`スレ${threadId} コメント${i+1}: #res 記法を含みます`)
  }
  // 重複チェック
  const seen = new Set()
  for (const c of comments) {
    if (seen.has(c)) errors.push(`スレ${threadId}: 重複コメントがあります`)
    seen.add(c)
  }
  return errors
}

// ─────────────────────────────────────────────
// preview ファイル出力
// ─────────────────────────────────────────────

async function writePreviewFiles(outDir, targets, results) {
  await fs.mkdir(outDir, { recursive: true })

  // targets.csv
  const csvHeader = 'thread_id,title,category,created_at,comments_generated\n'
  const csvRows = targets.map(t => {
    const r = results.find(r => r.threadId === t.id)
    const generated = r?.comments ? 'yes' : 'no'
    const title = `"${(t.title ?? '').replace(/"/g, '""')}"`
    const cat = `"${(t.categories?.name ?? '').replace(/"/g, '""')}"`
    return `${t.id},${title},${cat},${t.created_at},${generated}`
  }).join('\n')
  await fs.writeFile(path.join(outDir, 'targets.csv'), csvHeader + csvRows, 'utf8')

  // comments.json
  const jsonData = {
    generated_at: new Date().toISOString(),
    total_threads: targets.length,
    generated_threads: results.filter(r => r.comments).length,
    threads: results.map(r => ({
      thread_id: r.threadId,
      title: r.title,
      created_at: r.created_at,
      category: r.category,
      status: r.comments ? 'generated' : (r.error ? 'error' : 'skipped'),
      error: r.error ?? null,
      comments: (r.comments ?? []).map((body, i) => ({
        post_number: i + 1,
        body,
        author_name: '名無しのデュエリスト',
        created_at: addMinutes(r.created_at, TIME_OFFSETS_MIN[i]),
      })),
    })),
  }
  await fs.writeFile(path.join(outDir, 'comments.json'), JSON.stringify(jsonData, null, 2), 'utf8')

  // preview.md
  let md = `# リバイバルコメント プレビュー\n\n`
  md += `生成日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}  \n`
  md += `対象スレ数: ${targets.length}件  \n`
  md += `生成済み: ${results.filter(r => r.comments).length}件  \n\n`
  md += `---\n\n`
  md += `## ⚠️ 確認事項\n\n`
  md += `- [ ] 各スレに exactly 5 件のコメントがあるか\n`
  md += `- [ ] コメント内容がスレタイトルに沿っているか\n`
  md += `- [ ] 不自然な表現・断定がないか\n`
  md += `- [ ] 重複コメントがないか\n`
  md += `- [ ] 対象外スレが含まれていないか\n\n`
  md += `確認後、insert-approved-revival-comments.mjs を実行して本番 DB に反映する。\n\n`
  md += `---\n\n`

  for (const r of results) {
    md += `## スレ #${r.threadId}: ${r.title}\n\n`
    md += `- カテゴリ: ${r.category}\n`
    md += `- 作成日時: ${new Date(r.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n`
    md += `- ステータス: ${r.comments ? '✅ 生成済み' : r.error ? `❌ エラー: ${r.error}` : '⏭️ スキップ'}\n\n`

    if (r.comments) {
      for (let i = 0; i < r.comments.length; i++) {
        const ts = new Date(addMinutes(r.created_at, TIME_OFFSETS_MIN[i]))
          .toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
        md += `**[${i + 1}]** (${ts})\n`
        md += `> ${r.comments[i]}\n\n`
      }
    } else if (r.error) {
      md += `エラー内容: ${r.error}\n\n`
    }

    md += `---\n\n`
  }

  await fs.writeFile(path.join(outDir, 'preview.md'), md, 'utf8')
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

async function main() {
  await loadEnvFile(path.join(ROOT_DIR, '.env.local'))
  await loadEnvFile(path.join(ROOT_DIR, '.env.vercel.prod')) // 本番用（存在しなければスキップ）

  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(usage()); process.exit(0) }

  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
  const dryRun = args.dryRun || !hasAnthropicKey

  if (!hasAnthropicKey && !args.dryRun) {
    console.warn('⚠️  ANTHROPIC_API_KEY が未設定のため、コメント生成をスキップします（--dry-run 相当）')
  }

  const outDir = args.outDir ?? path.join(ROOT_DIR, `revival-preview-${nowJST()}`)

  logSection('① 接続確認')
  const supabase = createSupabaseClient()
  console.log(`  Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`  dry-run: ${dryRun}`)
  console.log(`  出力先: ${outDir}`)

  logSection('② 対象スレ検出（72h以上コメントゼロ）')
  const targets = await detectZeroCommentThreads(supabase, {
    threadId: args.threadId,
    limit: args.limit,
  })
  console.log(`  検出: ${targets.length} 件`)
  for (const t of targets) {
    const age = Math.floor((Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60))
    console.log(`  #${t.id} (${age}h前) ${t.title}`)
  }

  if (targets.length === 0) {
    console.log('\n  対象スレがありません。終了します。')
    process.exit(0)
  }

  const results = []

  if (dryRun) {
    logSection('③ dry-run モード（コメント生成スキップ）')
    for (const t of targets) {
      results.push({
        threadId: t.id,
        title: t.title,
        created_at: t.created_at,
        category: t.categories?.name ?? '',
        comments: null,
        error: null,
      })
    }
  } else {
    logSection('③ コメント生成 + animanch 参照')
    for (const t of targets) {
      process.stdout.write(`  スレ #${t.id} ${t.title.slice(0, 30)}... `)

      let comments = null
      let error = null

      try {
        // animanch 参照（エラーでも続行）
        const animanchRef = await fetchAnimanchReference(t.title).catch(() => null)

        // AI 生成
        const generated = await generateCommentsWithAI(t, animanchRef)
        if (!generated) throw new Error('生成結果が空です')

        // バリデーション
        const errors = validateComments(generated, t.id)
        if (errors.length > 0) throw new Error(errors.join('; '))

        comments = generated
        console.log(`✅ ${comments.length}件`)
      } catch (e) {
        error = e.message
        console.log(`❌ ${error}`)
      }

      results.push({
        threadId: t.id,
        title: t.title,
        created_at: t.created_at,
        category: t.categories?.name ?? '',
        comments,
        error,
      })

      // API レート制限対策
      await new Promise(r => setTimeout(r, 500))
    }
  }

  logSection('④ preview ファイル出力')
  await writePreviewFiles(outDir, targets, results)
  console.log(`  targets.csv  → ${path.join(outDir, 'targets.csv')}`)
  console.log(`  comments.json → ${path.join(outDir, 'comments.json')}`)
  console.log(`  preview.md   → ${path.join(outDir, 'preview.md')}`)

  const generatedCount = results.filter(r => r.comments).length
  const errorCount = results.filter(r => r.error).length

  logSection('完了')
  console.log(`  対象: ${targets.length}件 / 生成済み: ${generatedCount}件 / エラー: ${errorCount}件`)
  if (dryRun) {
    console.log('\n  ✅ dry-run 完了。コメント生成するには ANTHROPIC_API_KEY を設定してください。')
  } else {
    console.log('\n  ✅ preview ファイルを確認後、以下を実行してください:')
    console.log(`  node scripts/insert-approved-revival-comments.mjs --file ${outDir}/comments.json`)
  }
}

main().catch(e => {
  console.error('\n❌ 致命的エラー:', e.message)
  process.exit(1)
})
