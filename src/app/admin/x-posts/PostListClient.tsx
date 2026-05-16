'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteXPost, sendToTypefully, bulkDeleteXPosts, bulkSendToTypefully, bulkUpdateStatus } from './actions'
import { STATUS_LABEL, STATUS_COLOR, TYPE_LABEL, ALL_STATUSES, ALL_TYPES } from '@/constants/x-post'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
type XPost = {
  id: number
  post_type: string
  status: string
  title: string | null
  thread_lines: string[]
  image_urls: string[]
  typefully_id: string | null
  typefully_share_url: string | null
  scheduled_at: string | null
  sent_at: string | null
  source_ref: string | null
  meta: Record<string, unknown>
  created_at: string
}

// ----------------------------------------------------------------
// Constants (一元管理: src/constants/x-post.ts)
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Date helpers (JST)
// ----------------------------------------------------------------
function toJSTDateKey(isoStr: string): string {
  // 'sv' locale → YYYY-MM-DD
  return new Date(isoStr).toLocaleDateString('sv', { timeZone: 'Asia/Tokyo' })
}
function toJSTDateDisplay(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}
function toJSTTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function groupByDate(posts: XPost[]): [string, XPost[]][] {
  const map = new Map<string, XPost[]>()
  for (const p of posts) {
    const key = p.scheduled_at ? toJSTDateKey(p.scheduled_at) : '日時未設定'
    const arr = map.get(key) ?? []
    arr.push(p)
    map.set(key, arr)
  }
  return Array.from(map.entries())
}

// ----------------------------------------------------------------
// PostCard — individual card
// ----------------------------------------------------------------
function PostCard({
  post,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onDelete,
  onTypefullySend,
  isPending,
}: {
  post: XPost
  isSelected: boolean
  isExpanded: boolean
  onSelect: (id: number, checked: boolean) => void
  onToggleExpand: (id: number) => void
  onDelete: (id: number, title: string) => void
  onTypefullySend: (id: number) => void
  isPending: boolean
}) {
  const PREVIEW_LINES = 6
  const allLines = post.thread_lines
  const needsExpand = allLines.length > PREVIEW_LINES
  const visibleLines = isExpanded ? allLines : allLines.slice(0, PREVIEW_LINES)
  const canSendTypefully = post.status === 'draft' || post.status === 'error'

  return (
    <div
      className={`bg-white border rounded transition-colors ${
        isSelected ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 px-3 pt-2 pb-1">
        {/* Checkbox */}
        <input
          type="checkbox"
          className="mt-0.5 shrink-0 cursor-pointer accent-blue-500"
          checked={isSelected}
          onChange={(e) => onSelect(post.id, e.target.checked)}
        />

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
          <span
            className={`text-[9px] px-1.5 py-0.5 font-medium rounded-sm shrink-0 ${STATUS_COLOR[post.status] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {STATUS_LABEL[post.status] ?? post.status}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-sm shrink-0">
            {TYPE_LABEL[post.post_type] ?? post.post_type}
          </span>
          {post.scheduled_at && (
            <span className="text-[10px] text-gray-500 shrink-0">
              {toJSTTime(post.scheduled_at)}
            </span>
          )}
          {post.source_ref && (
            <span
              className="text-[9px] px-1 py-0.5 bg-orange-50 text-orange-600 rounded-sm shrink-0 truncate max-w-[120px]"
              title={post.source_ref}
            >
              {post.source_ref}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {canSendTypefully && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onTypefullySend(post.id)}
              className="text-[9px] px-1.5 py-0.5 border border-blue-300 text-blue-600 hover:bg-blue-50 rounded-sm disabled:opacity-50"
            >
              Typefully送信
            </button>
          )}
          {post.typefully_share_url && (
            <a
              href={post.typefully_share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] px-1.5 py-0.5 border border-gray-300 hover:bg-gray-50 rounded-sm"
            >
              Typefully↗
            </a>
          )}
          <Link
            href={`/admin/x-posts/${post.id}`}
            className="text-[9px] px-1.5 py-0.5 border border-gray-300 hover:bg-gray-50 rounded-sm"
          >
            編集
          </Link>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onDelete(post.id, post.title ?? `#${post.id}`)}
            className="text-[9px] px-1.5 py-0.5 text-white rounded-sm disabled:opacity-50"
            style={{ background: '#dc3545' }}
          >
            削除
          </button>
        </div>
      </div>

      {/* Title */}
      {post.title && (
        <div className="px-3 pb-1">
          <p className="text-xs font-semibold text-gray-800 leading-tight">{post.title}</p>
        </div>
      )}

      {/* Thread lines preview */}
      {allLines.length > 0 && (
        <div className="px-3 pb-1">
          <div className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-relaxed border-l-2 border-gray-100 pl-2">
            {visibleLines.map((line, i) => (
              <span key={i}>
                {i > 0 && (
                  <span className="block text-[9px] text-gray-300 my-0.5">── ツイート {i + 1} ──</span>
                )}
                {line}
              </span>
            ))}
          </div>
          {needsExpand && (
            <button
              type="button"
              onClick={() => onToggleExpand(post.id)}
              className="mt-1 text-[10px] text-blue-500 hover:underline"
            >
              {isExpanded ? `▲ 折りたたむ` : `▼ もっと見る（全${allLines.length}ツイート）`}
            </button>
          )}
        </div>
      )}

      {/* Image thumbnails */}
      <div className="px-3 pb-2">
        {post.image_urls.length > 0 ? (
          <div className="flex gap-1 mt-1">
            {post.image_urls.slice(0, 3).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`画像${i + 1}`}
                  className="h-12 w-16 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </a>
            ))}
            {post.image_urls.length > 3 && (
              <div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded border border-gray-200 text-[10px] text-gray-500">
                +{post.image_urls.length - 3}
              </div>
            )}
          </div>
        ) : (
          <span className="text-[9px] text-gray-300">画像なし</span>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// PostListClient — main client component
// ----------------------------------------------------------------
export function PostListClient({ posts }: { posts: XPost[] }) {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterSourceRef, setFilterSourceRef] = useState('')
  const [filterUnsentOnly, setFilterUnsentOnly] = useState(false)

  // Bulk status select
  const [bulkStatus, setBulkStatus] = useState('posted')

  // ---- Filtering ----
  const filtered = posts.filter((p) => {
    if (filterStatus && p.status !== filterStatus) return false
    if (filterType && p.post_type !== filterType) return false
    if (filterDate) {
      const dateKey = p.scheduled_at ? toJSTDateKey(p.scheduled_at) : ''
      if (dateKey !== filterDate) return false
    }
    if (filterSourceRef && !(p.source_ref ?? '').includes(filterSourceRef)) return false
    if (filterUnsentOnly && (p.status === 'posted' || p.status === 'typefully_drafted' || p.status === 'scheduled')) return false
    return true
  })

  // ---- Selection helpers ----
  const filteredIds = filtered.map((p) => p.id)
  const selectedIds = filteredIds.filter((id) => selected.has(id))
  const selectedCount = selectedIds.length
  const allSelected = filteredIds.length > 0 && selectedCount === filteredIds.length
  const someSelected = selectedCount > 0 && !allSelected

  const handleSelect = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(filteredIds))
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredIds.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  // ---- Action handlers ----
  const handleDelete = (id: number, title: string) => {
    if (!confirm(`「${title}」を削除しますか？\n取り消せません。`)) return
    const fd = new FormData()
    fd.set('id', String(id))
    startTransition(async () => {
      await deleteXPost(fd)
    })
  }

  const handleTypefullySend = (id: number) => {
    if (!confirm('Typefully に送信しますか？\n下書きが登録されます（自動投稿ではありません）。')) return
    const fd = new FormData()
    fd.set('id', String(id))
    startTransition(async () => {
      await sendToTypefully(fd)
    })
  }

  const handleBulkDelete = () => {
    if (!confirm(`選択した ${selectedCount} 件を削除しますか？\n取り消せません。`)) return
    const fd = new FormData()
    fd.set('ids', JSON.stringify(selectedIds))
    startTransition(async () => {
      await bulkDeleteXPosts(fd)
    })
  }

  const handleBulkTypefully = () => {
    if (!confirm(`選択した ${selectedCount} 件を Typefully に送信しますか？\n下書き登録のみです（完全自動投稿ではありません）。`)) return
    const fd = new FormData()
    fd.set('ids', JSON.stringify(selectedIds))
    startTransition(async () => {
      await bulkSendToTypefully(fd)
    })
  }

  const handleBulkStatusChange = () => {
    if (!confirm(`${selectedCount} 件のステータスを「${STATUS_LABEL[bulkStatus] ?? bulkStatus}」に変更しますか？`)) return
    const fd = new FormData()
    fd.set('ids', JSON.stringify(selectedIds))
    fd.set('status', bulkStatus)
    startTransition(async () => {
      await bulkUpdateStatus(fd)
    })
  }

  const handleToggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearFilters = () => {
    setFilterStatus('')
    setFilterType('')
    setFilterDate('')
    setFilterSourceRef('')
    setFilterUnsentOnly(false)
  }

  // ---- Date grouping ----
  const groups = groupByDate(filtered)

  // ---- Unique dates for filter ----
  const uniqueDates = Array.from(
    new Set(posts.filter((p) => p.scheduled_at).map((p) => toJSTDateKey(p.scheduled_at!)))
  ).sort()

  return (
    <div className={pending ? 'opacity-60 pointer-events-none' : ''}>
      {/* Filter bar */}
      <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3 flex flex-wrap items-center gap-2">
        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-blue-400"
        >
          <option value="">すべてのステータス</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-blue-400"
        >
          <option value="">すべての種別</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
          ))}
        </select>

        {/* Date filter */}
        <select
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-blue-400"
        >
          <option value="">すべての日付</option>
          {uniqueDates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Source ref filter */}
        <input
          type="text"
          value={filterSourceRef}
          onChange={(e) => setFilterSourceRef(e.target.value)}
          placeholder="source_ref で絞り込み"
          className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-blue-400 w-36"
        />

        {/* Unsent only */}
        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filterUnsentOnly}
            onChange={(e) => setFilterUnsentOnly(e.target.checked)}
            className="accent-blue-500"
          />
          未送信のみ
        </label>

        {/* Clear */}
        {(filterStatus || filterType || filterDate || filterSourceRef || filterUnsentOnly) && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[10px] px-2 py-0.5 text-red-500 border border-red-200 rounded hover:bg-red-50"
          >
            フィルタをクリア
          </button>
        )}

        <span className="text-[10px] text-gray-400 ml-auto">
          {filtered.length} / {posts.length} 件表示
        </span>
      </div>

      {/* Bulk action bar */}
      {filtered.length > 0 && (
        <div className="bg-white border border-gray-200 rounded px-3 py-2 mb-3 flex flex-wrap items-center gap-2">
          {/* Select all checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="accent-blue-500 cursor-pointer"
            />
            <span className="text-xs text-gray-600">
              {selectedCount > 0 ? `${selectedCount} 件選択中` : 'すべて選択'}
            </span>
          </label>

          {selectedCount > 0 && (
            <>
              <div className="w-px h-4 bg-gray-200" />

              {/* Bulk Typefully */}
              <button
                type="button"
                disabled={pending}
                onClick={handleBulkTypefully}
                className="text-xs px-2 py-1 border border-blue-300 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50"
              >
                📨 Typefully一括送信
              </button>

              {/* Bulk status change */}
              <div className="flex items-center gap-1">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white focus:outline-none"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleBulkStatusChange}
                  className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  ステータス変更
                </button>
              </div>

              {/* Bulk delete */}
              <button
                type="button"
                disabled={pending}
                onClick={handleBulkDelete}
                className="text-xs px-2 py-1 text-white rounded hover:opacity-80 disabled:opacity-50 ml-auto"
                style={{ background: '#dc3545' }}
              >
                🗑 {selectedCount} 件削除
              </button>
            </>
          )}
        </div>
      )}

      {/* No results */}
      {filtered.length === 0 && (
        <div className="bg-white border border-gray-200 px-4 py-8 text-center text-xs text-gray-400 rounded">
          {posts.length === 0
            ? '投稿がありません。「新規作成」から追加してください。'
            : 'フィルタ条件に一致する投稿がありません。'}
        </div>
      )}

      {/* Date-grouped cards */}
      <div className="space-y-4">
        {groups.map(([dateKey, groupPosts]) => (
          <div key={dateKey}>
            {/* Date heading */}
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {dateKey === '日時未設定'
                  ? '📅 日時未設定'
                  : `📅 ${toJSTDateDisplay(groupPosts[0].scheduled_at!)}`}
              </div>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] text-gray-400">{groupPosts.length} 件</span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {groupPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isSelected={selected.has(post.id)}
                  isExpanded={expanded.has(post.id)}
                  onSelect={handleSelect}
                  onToggleExpand={handleToggleExpand}
                  onDelete={handleDelete}
                  onTypefullySend={handleTypefullySend}
                  isPending={pending}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
