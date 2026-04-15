'use client'

import { useState } from 'react'
import { reportItem } from '@/app/actions/report'

interface Props {
  itemType: 'post' | 'thread'
  itemId: number
  itemBody: string
}

export function ReportButton({ itemType, itemId, itemBody }: Props) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    await reportItem({ itemType, itemId, reason, itemBody })
    setDone(true)
    setLoading(false)
    setTimeout(() => {
      setOpen(false)
      setDone(false)
      setReason('')
    }, 1500)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] px-1.5 py-0.5 font-medium"
        style={{ color: '#9ca3af', border: '1px solid #9ca3af', background: '#fff' }}
      >
        報告
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white border border-gray-300 p-4 mx-3"
            style={{ width: 280 }}
            onClick={e => e.stopPropagation()}
          >
            {done ? (
              <p className="text-sm text-center py-4" style={{ color: '#155724' }}>
                ✅ 通報しました
              </p>
            ) : (
              <>
                <p className="text-sm font-bold mb-1 text-gray-800">通報する</p>
                <p className="text-xs text-gray-500 mb-2">
                  {itemType === 'thread' ? 'スレッド' : 'レス'}を管理者に報告します
                </p>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="理由を入力（任意）"
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 py-1.5 text-sm border border-gray-300 text-gray-600"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 py-1.5 text-sm text-white font-medium disabled:opacity-50"
                    style={{ background: '#dc3545' }}
                  >
                    {loading ? '送信中...' : '通報する'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
