'use client'

import { TYPE_LABEL, STATUS_LABEL } from '@/constants/x-post'

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface MockPost {
  id: number
  date: string
  slot: string
  postType: string
  text: string
  imageUrl: string | null
  status: string
  sentToTypefully: boolean
}

export interface DuplicateEntry {
  original: MockPost
  newDate: string
  hasConflict: boolean
}

interface Props {
  sourceDateRange: string
  targetDateRange: string
  entries: DuplicateEntry[]
  hasAnyConflict: boolean
  onConfirm: () => void
  onClose: () => void
}

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------
/** "YYYY-MM-DD" → "M/D(曜)" */
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatMDDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const m = date.getMonth() + 1
  const d = date.getDate()
  const day = DAY_LABELS[date.getDay()]
  return `${m}/${d}(${day})`
}

// ----------------------------------------------------------------
// DuplicateModal
// ----------------------------------------------------------------
export function DuplicateModal({
  sourceDateRange,
  targetDateRange,
  entries,
  hasAnyConflict,
  onConfirm,
  onClose,
}: Props) {
  // 背景クリックで閉じる
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const conflictCount = entries.filter((e) => e.hasConflict).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-sm font-bold text-gray-800">1か月後に複製</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {sourceDateRange} → {targetDateRange}（+28日）
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-lg leading-none"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* Typefully 安全警告 */}
        <div className="mx-5 mt-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] text-blue-700 leading-relaxed">
            この操作は<strong>ローカルデータの複製のみ</strong>です。Typefully への送信は一切行いません。
            複製された投稿の <code className="bg-blue-100 px-1 rounded">sentToTypefully</code> はすべて <strong>false</strong>、
            <code className="bg-blue-100 px-1 rounded">status</code> はすべて <strong>draft</strong> にリセットされます。
          </p>
        </div>

        {/* コンフリクト警告 */}
        {hasAnyConflict && (
          <div className="mx-5 mt-3 flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2.5">
            <span className="text-sm flex-shrink-0">⚠️</span>
            <p className="text-[11px] text-red-700 leading-relaxed">
              <strong>{conflictCount}件</strong>のスロットに既存の投稿があります。
              複製を実行すると、同じ日時に複数の投稿が登録されます（既存データは変更されません）。
            </p>
          </div>
        )}

        {/* サマリー */}
        <div className="mx-5 mt-3 flex items-center gap-3 text-xs text-gray-600">
          <span className="bg-gray-100 rounded px-2 py-1">複製対象 {entries.length}本</span>
          {hasAnyConflict && (
            <span className="bg-red-100 text-red-700 rounded px-2 py-1">
              コンフリクト {conflictCount}件
            </span>
          )}
        </div>

        {/* 投稿一覧 */}
        <div className="overflow-y-auto flex-1 px-5 py-3 mt-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left font-medium pb-1.5 pr-2">元の日時</th>
                <th className="text-left font-medium pb-1.5 pr-2">→ 複製先</th>
                <th className="text-left font-medium pb-1.5 pr-2">タイプ</th>
                <th className="text-left font-medium pb-1.5 pr-2">画像</th>
                <th className="text-left font-medium pb-1.5">内容（先頭40字）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((entry) => (
                <tr
                  key={entry.original.id}
                  className={entry.hasConflict ? 'bg-red-50' : ''}
                >
                  <td className="py-1.5 pr-2 font-mono text-gray-500 whitespace-nowrap">
                    {formatMDDay(entry.original.date)} {entry.original.slot}
                  </td>
                  <td className="py-1.5 pr-2 font-mono whitespace-nowrap">
                    <span className={entry.hasConflict ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                      {formatMDDay(entry.newDate)} {entry.original.slot}
                    </span>
                    {entry.hasConflict && (
                      <span className="ml-1 text-[10px] bg-red-100 text-red-600 border border-red-200 rounded px-1 py-0.5">
                        競合
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    <span className="text-gray-600">
                      {TYPE_LABEL[entry.original.postType] ?? entry.original.postType}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {entry.original.imageUrl ? (
                      <span className="text-blue-500">あり</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-gray-500 break-all">
                    {entry.original.text.replace(/\n/g, ' ').slice(0, 40)}
                    {entry.original.text.length > 40 ? '…' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-gray-200 bg-gray-50">
          <p className="text-[10px] text-gray-400">
            複製後のデータはローカルのみに保存されます
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 transition"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-1.5 text-sm rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition font-medium"
            >
              {entries.length}本を複製する
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
