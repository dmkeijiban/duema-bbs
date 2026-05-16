'use client'

import { useState } from 'react'
import { POST_TYPES, STATUSES } from '@/constants/x-post'

/** UTC ISO文字列をJSTの datetime-local 入力値（YYYY-MM-DDTHH:MM）に変換 */
function utcToJSTDatetimeLocal(isoStr: string): string {
  const ms = new Date(isoStr).getTime() + 9 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 16)
}

interface XPostFormProps {
  action: (formData: FormData) => Promise<void>
  defaultValues?: {
    id?: number
    post_type?: string
    title?: string
    thread_lines?: string[]
    image_urls?: string[]
    meta?: Record<string, unknown>
    status?: string
    scheduled_at?: string | null
    source_ref?: string | null
  }
}

export function XPostForm({ action, defaultValues }: XPostFormProps) {
  const [postType, setPostType] = useState(defaultValues?.post_type ?? 'win')
  const [threadContent, setThreadContent] = useState(
    (defaultValues?.thread_lines ?? ['']).join('\n---\n'),
  )
  const [charCounts, setCharCounts] = useState<number[]>(() =>
    (defaultValues?.thread_lines ?? ['']).map((l) => l.length),
  )

  const handleThreadChange = (value: string) => {
    setThreadContent(value)
    const tweets = value.split(/\n---\n/)
    setCharCounts(tweets.map((t) => t.trim().length))
  }

  const tweetCount = threadContent.split(/\n---\n/).filter((t) => t.trim()).length
  const hasOverLimit = charCounts.some((c) => c > 280)

  const defaultImageUrls = (defaultValues?.image_urls ?? []).join('\n')
  const defaultMeta =
    defaultValues?.meta && Object.keys(defaultValues.meta).length > 0
      ? JSON.stringify(defaultValues.meta, null, 2)
      : ''

  return (
    <form action={action} className="space-y-4">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      {/* 投稿種別 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          投稿種別 <span className="text-red-500">*</span>
        </label>
        <select
          name="post_type"
          value={postType}
          onChange={(e) => setPostType(e.target.value)}
          className="w-full border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400"
        >
          {POST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* タイトル（管理用） */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          タイトル（管理用・省略可）
        </label>
        <input
          type="text"
          name="title"
          defaultValue={defaultValues?.title ?? ''}
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
            ⚠️ 280文字を超えているツイートがあります（日本語は1文字≒2文字換算のため実際はより少ない場合があります）
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
          defaultValue={defaultImageUrls}
          rows={3}
          placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
          className="w-full border border-gray-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-400 resize-y"
        />
        <p className="text-[10px] text-gray-400 mt-0.5">
          Typefully送信時に最後のツイートの末尾へ追記されます
        </p>
      </div>

      {/* ステータス */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">ステータス</label>
        <select
          name="status"
          defaultValue={defaultValues?.status ?? 'draft'}
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
          スケジュール日時（省略時は下書きとして保存）
        </label>
        <input
          type="datetime-local"
          name="scheduled_at"
          defaultValue={
            defaultValues?.scheduled_at
              ? utcToJSTDatetimeLocal(defaultValues.scheduled_at)
              : ''
          }
          className="border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
        />
        <p className="text-[10px] text-gray-400 mt-0.5 ml-1">
          設定するとTypefully送信時に自動でスケジュール予約されます
        </p>
      </div>

      {/* ソース参照 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          ソース参照（内部管理用・省略可）
        </label>
        <input
          type="text"
          name="source_ref"
          defaultValue={defaultValues?.source_ref ?? ''}
          placeholder="例: tournament:123 / thread:456"
          className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
        />
        <p className="text-[10px] text-gray-400 mt-0.5">投稿本文には出力されません</p>
      </div>

      {/* メタ情報 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          メタ情報（JSON・省略可）
        </label>
        <textarea
          name="meta"
          defaultValue={defaultMeta}
          rows={4}
          placeholder={'{"winner": "プレイヤー名", "deck": "デッキ名"}'}
          className="w-full border border-gray-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-400 resize-y"
        />
        <p className="text-[10px] text-gray-400 mt-0.5">
          無効なJSONは保存時に空オブジェクト{' {} '}に変換されます
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="px-4 py-2 text-xs text-white font-medium hover:opacity-90"
          style={{ background: '#0d6efd' }}
        >
          保存
        </button>
      </div>
    </form>
  )
}
