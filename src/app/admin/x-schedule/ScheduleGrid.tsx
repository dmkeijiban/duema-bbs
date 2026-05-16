'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { TYPE_LABEL, STATUS_LABEL, STATUS_COLOR } from '@/constants/x-post'
import { EditModal } from './EditModal'
import { DuplicateModal, type DuplicateEntry } from './DuplicateModal'
import { TypefullySendModal } from './TypefullySendModal'

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface MockPost {
  id: number
  date: string        // "2026-05-18"
  slot: string        // "07:00" | "12:00" | "19:00" | "22:00"
  postType: string
  text: string
  imageUrl: string | null
  status: string
  sentToTypefully: boolean
}

interface Props {
  posts: MockPost[]
}

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
const SLOTS = ['07:00', '12:00', '19:00', '22:00'] as const
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

const TYPE_COLOR: Record<string, string> = {
  win:        'bg-yellow-100 text-yellow-800 border border-yellow-300',
  roujinkai:  'bg-purple-100 text-purple-800 border border-purple-300',
  iwakan:     'bg-orange-100 text-orange-800 border border-orange-300',
  silhouette: 'bg-cyan-100 text-cyan-800 border border-cyan-300',
  kurekore:   'bg-pink-100 text-pink-800 border border-pink-300',
  giron:      'bg-red-100 text-red-800 border border-red-300',
  share:      'bg-green-100 text-green-800 border border-green-300',
  kouton:     'bg-emerald-100 text-emerald-800 border border-emerald-300',
  custom:     'bg-gray-100 text-gray-700 border border-gray-300',
}

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------
/** 指定日が属する週の月曜日（0:日→1:月 に合わせる）を返す */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // 0=日 → 前の月曜に戻す、それ以外は day-1 引く
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Date → "YYYY-MM-DD" */
function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

/** "YYYY-MM-DD" → "M/D" */
function formatMD(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

// ----------------------------------------------------------------
// スロットカード
// ----------------------------------------------------------------
function SlotCard({
  post,
  onEdit,
}: {
  post: MockPost
  onEdit: (post: MockPost) => void
}) {
  const typeLabel = TYPE_LABEL[post.postType] ?? post.postType
  const typeColor = TYPE_COLOR[post.postType] ?? TYPE_COLOR.custom
  const statusLabel = STATUS_LABEL[post.status] ?? post.status
  const statusColor = STATUS_COLOR[post.status] ?? 'bg-gray-100 text-gray-600'

  // テキストプレビュー（改行→スペース、最大60字）
  const textPreview = post.text.replace(/\n/g, ' ').slice(0, 60) + (post.text.length > 60 ? '…' : '')

  return (
    <div className="group flex gap-2 items-start relative">
      {/* サムネイル */}
      {post.imageUrl ? (
        <div className="relative flex-shrink-0 w-12 h-12 rounded overflow-hidden border border-gray-200 bg-gray-100">
          <Image
            src={post.imageUrl}
            alt="投稿画像"
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-12 h-12 rounded border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
          <span className="text-gray-300 text-[10px]">画像なし</span>
        </div>
      )}

      {/* テキスト + バッジ */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 leading-snug mb-1.5 break-words">
          {textPreview}
        </p>
        <div className="flex flex-wrap gap-1 items-center">
          {/* 投稿タイプバッジ */}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColor}`}>
            {typeLabel}
          </span>
          {/* ステータスバッジ */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor}`}>
            {statusLabel}
          </span>
          {/* Typefully送信済みインジケーター */}
          {post.sentToTypefully && (
            <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Typefully
            </span>
          )}
        </div>
      </div>

      {/* 編集ボタン（ホバー時に表示） */}
      <button
        onClick={() => onEdit(post)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[10px] text-gray-500 border border-gray-300 bg-white hover:bg-gray-50 hover:text-gray-700"
        aria-label="編集"
      >
        編集
      </button>
    </div>
  )
}

// ----------------------------------------------------------------
// 日カード
// ----------------------------------------------------------------
function DayCard({
  dateStr,
  dayLabel,
  isToday,
  posts,
  onEdit,
}: {
  dateStr: string
  dayLabel: string
  isToday: boolean
  posts: MockPost[]
  onEdit: (post: MockPost) => void
}) {
  // 優勝🏆 の数を確認
  const winCount = posts.filter((p) => p.postType === 'win').length
  const hasDuplicateWin = winCount >= 2

  const postsBySlot: Record<string, MockPost[]> = {}
  for (const slot of SLOTS) {
    postsBySlot[slot] = posts.filter((p) => p.slot === slot)
  }

  return (
    <div
      className={`rounded-lg border bg-white overflow-hidden ${
        isToday ? 'border-blue-400 shadow-md' : 'border-gray-200 shadow-sm'
      }`}
    >
      {/* ヘッダー */}
      <div
        className={`px-3 py-2 flex items-center justify-between ${
          isToday ? 'bg-blue-50' : 'bg-gray-50'
        }`}
      >
        <span className="font-bold text-sm text-gray-800">
          {dayLabel}{' '}
          <span className="font-normal text-gray-500 text-xs">{formatMD(dateStr)}</span>
        </span>
        {isToday && (
          <span className="text-[10px] bg-blue-500 text-white rounded px-1.5 py-0.5">今日</span>
        )}
      </div>

      {/* 優勝🏆 重複警告 */}
      {hasDuplicateWin && (
        <div className="mx-3 mt-2 text-[11px] bg-red-50 border border-red-300 text-red-700 rounded px-2 py-1 flex items-center gap-1">
          <span>⚠️</span>
          <span>優勝🏆 が{winCount}本あります（1日1本まで）</span>
        </div>
      )}

      {/* スロット一覧 */}
      <div className="divide-y divide-gray-100">
        {SLOTS.map((slot) => {
          const slotPosts = postsBySlot[slot]
          return (
            <div key={slot} className="px-3 py-2">
              <div className="text-[10px] font-mono text-gray-400 mb-1">{slot}</div>
              {slotPosts.length === 0 ? (
                <div className="text-[11px] text-gray-300 italic">空き</div>
              ) : (
                <div className="space-y-2">
                  {slotPosts.map((post) => (
                    <SlotCard key={post.id} post={post} onEdit={onEdit} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
const STORAGE_KEY = 'x-schedule-posts'

// ----------------------------------------------------------------
// メイングリッド
// ----------------------------------------------------------------
export function ScheduleGrid({ posts: initialPosts }: Props) {
  const [posts, setPosts] = useState<MockPost[]>(initialPosts)
  const [editingPost, setEditingPost] = useState<MockPost | null>(null)
  const [duplicateState, setDuplicateState] = useState<{
    entries: DuplicateEntry[]
    sourceDateRange: string
    targetDateRange: string
    hasAnyConflict: boolean
  } | null>(null)
  const [showTypefullySend, setShowTypefullySend] = useState(false)
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()))
  // localStorage から読み込んだかどうか（読み込み前はフラッシュを防ぐため保存しない）
  const [storageLoaded, setStorageLoaded] = useState(false)
  // localStorage データを使用中かどうか（リセットボタンの表示切り替え用）
  const [hasLocalData, setHasLocalData] = useState(false)

  // マウント時: localStorage → posts に反映
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as MockPost[]
        setPosts(parsed)
        setHasLocalData(true)
      }
    } catch {
      // 破損データは無視
    }
    setStorageLoaded(true)
  }, [])

  // posts が変わったら localStorage に保存（初回読み込み後のみ）
  useEffect(() => {
    if (!storageLoaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  }, [posts, storageLoaded])

  // リセット: localStorage を削除して initialPosts に戻す
  function handleReset() {
    localStorage.removeItem(STORAGE_KEY)
    setPosts(initialPosts)
    setHasLocalData(false)
  }

  const todayStr = toDateStr(new Date())

  // 今週の月〜日の日付文字列を生成
  const weekDates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday)
    d.setDate(d.getDate() + i)
    return toDateStr(d)
  })

  const weekLabel = `${formatMD(weekDates[0])} 〜 ${formatMD(weekDates[6])}`

  function prevWeek() {
    setCurrentMonday((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }

  function nextWeek() {
    setCurrentMonday((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }

  function goToCurrentWeek() {
    setCurrentMonday(getMonday(new Date()))
  }

  function handleSave(updated: MockPost) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setHasLocalData(true)
    setEditingPost(null)
  }

  function handleOpenDuplicate() {
    const weekPosts = posts.filter((p) => weekDates.includes(p.date))
    if (weekPosts.length === 0) return

    const targetWeekDates = weekDates.map((d) => {
      const date = new Date(d + 'T00:00:00')
      date.setDate(date.getDate() + 28)
      return toDateStr(date)
    })

    const entries: DuplicateEntry[] = weekPosts.map((post) => {
      const dayIdx = weekDates.indexOf(post.date)
      const newDate = targetWeekDates[dayIdx]
      const hasConflict = posts.some((p) => p.date === newDate && p.slot === post.slot)
      return { original: post, newDate, hasConflict }
    })

    setDuplicateState({
      entries,
      sourceDateRange: `${formatMD(weekDates[0])} 〜 ${formatMD(weekDates[6])}`,
      targetDateRange: `${formatMD(targetWeekDates[0])} 〜 ${formatMD(targetWeekDates[6])}`,
      hasAnyConflict: entries.some((e) => e.hasConflict),
    })
  }

  function handleMarkSent(sentIds: number[]) {
    setPosts((prev) =>
      prev.map((p) =>
        sentIds.includes(p.id) ? { ...p, sentToTypefully: true } : p,
      ),
    )
    setHasLocalData(true)
  }

  function handleConfirmDuplicate() {
    if (!duplicateState) return
    const maxId = Math.max(...posts.map((p) => p.id), 0)
    const newPosts: MockPost[] = duplicateState.entries.map((entry, i) => ({
      ...entry.original,
      id: maxId + i + 1,
      date: entry.newDate,
      sentToTypefully: false,
      status: 'draft',
    }))
    setPosts((prev) => [...prev, ...newPosts])
    setHasLocalData(true)
    setDuplicateState(null)
  }

  // 6/1 Typefully送信対象（dry-run用フィルタ）
  const jun1Posts = posts.filter(
    (p) =>
      p.date === '2026-06-01' &&
      !p.sentToTypefully &&
      ['draft', 'pending'].includes(p.status) &&
      p.text.trim() !== '' &&
      new Date(`${p.date}T${p.slot}:00+09:00`) > new Date(),
  )

  // 投稿数サマリー
  const weekPosts = posts.filter((p) => weekDates.includes(p.date))
  const totalCount = weekPosts.length
  const scheduledCount = weekPosts.filter(
    (p) => p.status === 'scheduled' || p.status === 'posted',
  ).length
  const typefullyCount = weekPosts.filter((p) => p.sentToTypefully).length

  return (
    <div>
      {/* ナビゲーションバー */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={prevWeek}
          className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          ← 前週
        </button>
        <span className="font-semibold text-gray-700 text-sm min-w-[120px] text-center">
          {weekLabel}
        </span>
        <button
          onClick={nextWeek}
          className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          次週 →
        </button>
        <button
          onClick={goToCurrentWeek}
          className="ml-1 px-3 py-1.5 rounded border border-blue-300 bg-blue-50 text-sm text-blue-600 hover:bg-blue-100 transition"
        >
          今週
        </button>
        <button
          onClick={handleOpenDuplicate}
          disabled={weekPosts.length === 0}
          className="px-3 py-1.5 rounded border border-indigo-300 bg-indigo-50 text-sm text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="表示中の週の投稿を1か月後（+28日）に複製する"
        >
          📋 1か月後に複製
        </button>
        <button
          onClick={() => setShowTypefullySend(true)}
          className="px-3 py-1.5 rounded border border-sky-300 bg-sky-50 text-sm text-sky-600 hover:bg-sky-100 transition"
          title="6/1の4投稿をTypefullyに送信する前の確認（dry-run）"
        >
          📤 6/1 Typefully確認
        </button>

        {/* ローカル保存バッジ + リセットボタン */}
        {hasLocalData && (
          <>
            <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-300 rounded px-2 py-1">
              ローカル保存中
            </span>
            <button
              onClick={handleReset}
              className="text-[11px] px-2 py-1 rounded border border-gray-300 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition"
            >
              リセット
            </button>
          </>
        )}

        {/* サマリーバッジ */}
        <div className="ml-auto flex gap-2 text-xs text-gray-500">
          <span className="bg-gray-100 rounded px-2 py-1">投稿数 {totalCount}</span>
          <span className="bg-indigo-50 text-indigo-700 rounded px-2 py-1">
            予約済み {scheduledCount}
          </span>
          <span className="bg-blue-50 text-blue-700 rounded px-2 py-1">
            Typefully {typefullyCount}
          </span>
        </div>
      </div>

      {/* 7日グリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {weekDates.map((dateStr, i) => {
          const dayPosts = posts.filter((p) => p.date === dateStr)
          return (
            <DayCard
              key={dateStr}
              dateStr={dateStr}
              dayLabel={DAY_LABELS[i]}
              isToday={dateStr === todayStr}
              posts={dayPosts}
              onEdit={setEditingPost}
            />
          )
        })}
      </div>

      {/* 編集モーダル */}
      {editingPost && (
        <EditModal
          post={editingPost}
          onSave={handleSave}
          onClose={() => setEditingPost(null)}
        />
      )}

      {/* 複製確認モーダル */}
      {duplicateState && (
        <DuplicateModal
          sourceDateRange={duplicateState.sourceDateRange}
          targetDateRange={duplicateState.targetDateRange}
          entries={duplicateState.entries}
          hasAnyConflict={duplicateState.hasAnyConflict}
          onConfirm={handleConfirmDuplicate}
          onClose={() => setDuplicateState(null)}
        />
      )}

      {/* Typefully送信確認モーダル（dry-run） */}
      {showTypefullySend && (
        <TypefullySendModal
          posts={jun1Posts}
          onClose={() => setShowTypefullySend(false)}
          onMarkSent={handleMarkSent}
        />
      )}
    </div>
  )
}
