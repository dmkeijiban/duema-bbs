'use client'

import { useState } from 'react'
import { generateThreadLines, type Tone } from '@/lib/x-post-templates'

// POST_TYPES はここでも定義（server/client 共有にするなら別ファイルへ切り出し可能）
const POST_TYPES = [
  { value: 'win', label: '優勝🏆' },
  { value: 'roujinkai', label: 'デュエマ老人会' },
  { value: 'iwakan', label: 'デュエマ違和感' },
  { value: 'silhouette', label: 'シルエット選手権' },
  { value: 'kurekore', label: '黒歴史デュエマ' },
  { value: 'giron', label: 'デュエマ物議' },
  { value: 'share', label: '掲示板共有' },
  { value: 'kouton', label: '高騰下落情報' },
  { value: 'custom', label: 'カスタム' },
]

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'normal', label: '通常' },
  { value: 'aggressive', label: '煽り強め' },
  { value: 'nostalgic', label: '懐古寄り' },
  { value: 'debate', label: '議論寄り' },
]

const STATUSES = [
  { value: 'draft', label: '下書き' },
  { value: 'typefully_drafted', label: 'Typefully下書き済み' },
  { value: 'scheduled', label: '予約済み' },
  { value: 'posted', label: '投稿済み' },
  { value: 'error', label: 'エラー' },
]

interface XPostGeneratorProps {
  action: (formData: FormData) => Promise<void>
}

export function XPostGenerator({ action }: XPostGeneratorProps) {
  // --- generator state ---
  const [postType, setPostType] = useState('win')
  const [theme, setTheme] = useState('')
  const [tone, setTone] = useState<Tone>('normal')
  const [bullets, setBullets] = useState(['', '', ''])

  // --- form fields ---
  const [title, setTitle] = useState('')
  const [threadContent, setThreadContent] = useState('')
  const [imageUrls, setImageUrls] = useState('')
  const [status, setStatus] = useState('draft')
  const [scheduledAt, setScheduledAt] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [metaRaw, setMetaRaw] = useState('')

  // --- preview ---
  const [previewLines, setPreviewLines] = useState<string[]>([])

  // ----------------------------------------------------------------
  // helpers
  // ----------------------------------------------------------------

  function computeCharCounts(content: string): number[] {
    return content.split(/\n---\n/).map((t) => t.trim().length)
  }

  const charCounts = computeCharCounts(threadContent)
  const hasOverLimit = charCounts.some((c) => c > 280)
  const tweetCount = threadContent.split(/\n---\n/).filter((t) => t.trim()).length

  function updateBullet(idx: number, val: string) {
    const next = [...bullets]
    next[idx] = val
    setBullets(next)
    const meta = JSON.stringify({ bullets: next })
    setMetaRaw(meta)
  }

  /** meta として送る値：share の場合は bullets JSON、それ以外は metaRaw textarea */
  const effectiveMetaRaw =
    postType === 'share' ? JSON.stringify({ bullets }) : metaRaw

  // ----------------------------------------------------------------
  // generate
  // ----------------------------------------------------------------

  function handleGenerate() {
    if (!theme.trim()) return

    const meta: Record<string, unknown> =
      postType === 'share' ? { bullets } : {}

    const lines = generateThreadLines(postType, theme.trim(), tone, meta)
    const content = lines.join('\n---\n')

    setThreadContent(content)
    setPreviewLines(lines)
    if (!title) setTitle(theme.trim())
  }

  function handleThreadChange(value: string) {
    setThreadContent(value)
    const lines = value.split(/\n---\n/)
    setPreviewLines(lines)
  }

  // ----------------------------------------------------------------
  // render
  // ----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ===== ① ジェネレーター パネル ===== */}
      <div className="bg-blue-50 border border-blue-200 px-3 py-3 space-y-3">
        <p className="text-xs font-semibold text-blue-800">📝 テンプレート自動生成</p>

        {/* 投稿種別 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">投稿種別</label>
          <select
            value={postType}
            onChange={(e) => {
              setPostType(e.target.value)
              setBullets(['', '', ''])
              setMetaRaw('')
            }}
            className="w-full border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400"
          >
            {POST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* テーマ入力 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            テーマ / キーワード <span className="text-red-500">*</span>
          </label>
          {postType === 'share' ? (
            <>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="例：最強のデッキは何か問題"
                className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 mb-2"
              />
              <p className="text-[10px] text-gray-500 mb-1">掲示板の話題ポイント（最大3件）</p>
              {bullets.map((b, i) => (
                <input
                  key={i}
                  type="text"
                  value={b}
                  onChange={(e) => updateBullet(i, e.target.value)}
                  placeholder={`ポイント ${i + 1}`}
                  className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 mb-1"
                />
              ))}
            </>
          ) : (
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder={
                postType === 'win'
                  ? '例：弱いって言われると悲しくなる'
                  : postType === 'roujinkai'
                    ? '例：ドラゴンズ・シグナル'
                    : postType === 'iwakan'
                      ? '例：進化クリーチャーはコストが重い'
                      : postType === 'kouton'
                        ? '例：ボルシャックドラゴン'
                        : 'テーマを入力'
              }
              className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
            />
          )}
        </div>

        {/* トーン */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">トーン</label>
          <div className="flex gap-3 flex-wrap">
            {TONE_OPTIONS.map((t) => (
              <label key={t.value} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={tone === t.value}
                  onChange={() => setTone(t.value)}
                  className="w-3 h-3"
                />
                <span className="text-xs">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 生成ボタン */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!theme.trim() && postType !== 'custom'}
          className="px-4 py-1.5 text-xs text-white font-medium hover:opacity-90 disabled:opacity-40"
          style={{ background: '#6f42c1' }}
        >
          ✨ 投稿文を自動生成
        </button>
      </div>

      {/* ===== ② プレビュー ===== */}
      {previewLines.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">👁 プレビュー（生成結果）</p>
          <div className="space-y-2">
            {previewLines.map((line, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded px-3 py-2.5 flex gap-2.5"
              >
                {/* X アバター */}
                <div className="shrink-0 w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                  𝕏
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-semibold text-gray-800">デュエマ掲示板</span>
                    <span className="text-[10px] text-gray-400">@duema_bbs</span>
                    {previewLines.length > 1 && (
                      <span className="text-[9px] px-1 bg-gray-100 text-gray-500 ml-auto">
                        {i + 1}/{previewLines.length}
                      </span>
                    )}
                  </div>
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans break-words">
                    {line}
                  </pre>
                  <p
                    className={`text-[10px] mt-1 text-right ${
                      line.trim().length > 280
                        ? 'text-red-600'
                        : line.trim().length > 240
                          ? 'text-yellow-600'
                          : 'text-gray-400'
                    }`}
                  >
                    {line.trim().length} 字
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== ③ 投稿フォーム（hidden name で createXPost に渡す） ===== */}
      <form action={action} className="space-y-4">
        {/* post_type */}
        <input type="hidden" name="post_type" value={postType} />

        {/* タイトル */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            タイトル（管理用・省略可）
          </label>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="管理しやすいタイトルを入力"
            className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* スレッド本文 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-700">
              スレッド本文 <span className="text-red-500">*</span>
            </label>
            <span className="text-[10px] text-gray-500">
              {tweetCount}ツイート ／ ツイート間は「---」で区切る
            </span>
          </div>
          <textarea
            name="thread_lines"
            value={threadContent}
            onChange={(e) => handleThreadChange(e.target.value)}
            rows={12}
            placeholder={`1ツイート目の本文\n---\n2ツイート目の本文\n---\n3ツイート目の本文`}
            className="w-full border border-gray-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-400 resize-y"
          />
          {/* 文字数カウント */}
          <div className="flex flex-wrap gap-1 mt-1">
            {charCounts.map((count, i) => (
              <span
                key={i}
                className={`text-[10px] px-1.5 py-0.5 ${
                  count > 280
                    ? 'bg-red-100 text-red-700'
                    : count > 240
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                #{i + 1}: {count}字
              </span>
            ))}
          </div>
          {hasOverLimit && (
            <p className="text-[10px] text-red-600 mt-1">
              ⚠️ 280文字を超えているツイートがあります
            </p>
          )}
        </div>

        {/* 画像URL */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            画像URL（1行1URL・省略可）
          </label>
          <textarea
            name="image_urls"
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            rows={3}
            placeholder="https://example.com/image1.jpg"
            className="w-full border border-gray-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-400 resize-y"
          />
        </div>

        {/* ステータス */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">ステータス</label>
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* スケジュール日時 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            スケジュール日時（省略時は下書き）
          </label>
          <input
            type="datetime-local"
            name="scheduled_at"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* ソース参照 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            ソース参照（内部管理用・省略可）
          </label>
          <input
            type="text"
            name="source_ref"
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
            placeholder="例: tournament:123 / thread:456"
            className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* メタ情報 */}
        {postType === 'share' ? (
          // share: bullets は上の generator で入力済み → hidden で送る
          <input type="hidden" name="meta" value={effectiveMetaRaw} />
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              メタ情報（JSON・省略可）
            </label>
            <textarea
              name="meta"
              value={metaRaw}
              onChange={(e) => setMetaRaw(e.target.value)}
              rows={3}
              placeholder={'{"winner": "プレイヤー名", "deck": "デッキ名"}'}
              className="w-full border border-gray-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-400 resize-y"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="px-4 py-2 text-xs text-white font-medium hover:opacity-90"
            style={{ background: '#0d6efd' }}
          >
            保存（下書き作成）
          </button>
        </div>
      </form>
    </div>
  )
}
