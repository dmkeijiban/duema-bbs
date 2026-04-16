'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Notice, NoticeItem, NoticeBlock } from '@/components/NoticeBlock'
import { saveNotice, deleteNotice, moveNotice } from '@/app/admin/actions'

interface Props {
  position: 'top' | 'mid' | 'bot'
  notices: Notice[]
}

const positionLabel: Record<string, string> = {
  top: 'top',
  mid: 'mid',
  bot: 'bot',
}

const emptyItem = (): NoticeItem => ({ image_url: '', title: '', body: '', link_url: '' })

function NoticeModal({
  position,
  editing,
  onClose,
}: {
  position: 'top' | 'mid' | 'bot'
  editing: Partial<Notice> | null
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [columns, setColumns] = useState<number>(editing?.columns ?? 1)
  const [items, setItems] = useState<NoticeItem[]>(
    editing?.items?.length ? editing.items : [emptyItem()]
  )
  const [headerText, setHeaderText] = useState(editing?.header_text ?? '')
  const [sortOrder, setSortOrder] = useState<number>(editing?.sort_order ?? 0)
  const [isActive, setIsActive] = useState<boolean>(editing?.is_active ?? true)
  const [uploading, setUploading] = useState<boolean[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])

  // columns が変わったら items を調整
  useEffect(() => {
    setItems(prev => {
      const next = [...prev]
      while (next.length < columns) next.push(emptyItem())
      return next.slice(0, columns)
    })
  }, [columns])

  function updateItem(index: number, field: keyof NoticeItem, value: string) {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(prev => { const n = [...prev]; n[index] = true; return n })
    setUploadErrors(prev => { const n = [...prev]; n[index] = ''; return n })

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const path = `notices/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('bbs-images').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('bbs-images').getPublicUrl(path)
      updateItem(index, 'image_url', publicUrl)
    } catch (err) {
      setUploadErrors(prev => { const n = [...prev]; n[index] = '画像アップロードに失敗しました'; return n })
      console.error(err)
    } finally {
      setUploading(prev => { const n = [...prev]; n[index] = false; return n })
    }
  }

  function handleSave() {
    startTransition(async () => {
      await saveNotice({
        id: editing?.id,
        position,
        sort_order: sortOrder,
        header_text: headerText,
        columns,
        items,
        is_active: isActive,
      })
      onClose()
    })
  }

  const isUploading = uploading.some(Boolean)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="max-w-lg w-full mx-3 p-5 bg-white border border-gray-300 overflow-y-auto"
        style={{ maxHeight: '90vh' }}
      >
        <h2 className="font-bold text-sm text-orange-800 mb-4">
          {editing?.id ? '✏️ お知らせを編集' : '➕ お知らせを追加'} ({positionLabel[position]})
        </h2>

        <div className="space-y-4">
          {/* セクションタイトル */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">セクションタイトル（任意）</label>
            <input
              type="text"
              value={headerText}
              onChange={e => setHeaderText(e.target.value)}
              placeholder="PR新商品予約リンク↓（任意）"
              className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* 列数 */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">列数</label>
            <select
              value={columns}
              onChange={e => setColumns(Number(e.target.value))}
              className="border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            >
              <option value={1}>1列</option>
              <option value={2}>2列</option>
              <option value={3}>3列</option>
              <option value={4}>4列</option>
            </select>
          </div>

          {/* 各列フォーム */}
          {items.map((item, i) => (
            <div key={i} className="border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-bold text-gray-600">{columns > 1 ? `列 ${i + 1}` : '画像・リンク設定'}</p>

              {/* 画像 */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">画像アップロード</label>
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt="プレビュー"
                    className="mb-2 max-h-24 object-contain border border-gray-200"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => handleFileChange(e, i)}
                  disabled={uploading[i]}
                  className="block w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:border file:border-gray-300 file:text-xs file:bg-gray-50"
                />
                {uploading[i] && <p className="text-xs text-orange-600 mt-1">アップロード中...</p>}
                {uploadErrors[i] && <p className="text-xs text-red-500 mt-1">{uploadErrors[i]}</p>}
              </div>

              {/* リンクURL */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">リンクURL（任意）</label>
                <input
                  type="text"
                  value={item.link_url}
                  onChange={e => updateItem(i, 'link_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* タイトル（画像オーバーレイ） */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">タイトル（画像に重ねるテキスト・任意）</label>
                <input
                  type="text"
                  value={item.title}
                  onChange={e => updateItem(i, 'title', e.target.value)}
                  placeholder="画像に重ねるテキスト（任意）"
                  className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* 本文 */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">補足テキスト（任意）</label>
                <textarea
                  rows={2}
                  value={item.body}
                  onChange={e => updateItem(i, 'body', e.target.value)}
                  placeholder="補足テキスト（任意）"
                  className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 resize-y"
                />
              </div>
            </div>
          ))}

          {/* 並び順 */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">並び順</label>
            <input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(Number(e.target.value))}
              className="w-24 border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* 表示中 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active_modal"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            <label htmlFor="is_active_modal" className="text-xs text-gray-600">表示中</label>
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || isUploading}
              className="px-4 py-1.5 text-white text-xs font-medium disabled:opacity-50"
              style={{ background: '#fd7e14' }}
            >
              {isPending ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NoticeAdminBar({ position, notices }: Props) {
  const [isPending, startTransition] = useTransition()
  const [editingNotice, setEditingNotice] = useState<Partial<Notice> | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  function openCreate() {
    setEditingNotice(null)
    setModalOpen(true)
  }

  function openEdit(notice: Notice) {
    setEditingNotice(notice)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingNotice(null)
  }

  function handleDelete(notice: Notice) {
    if (!confirm('このお知らせを削除しますか？')) return
    startTransition(async () => {
      await deleteNotice(notice.id)
    })
  }

  function handleMove(notice: Notice, direction: 'up' | 'down') {
    startTransition(async () => {
      await moveNotice(notice.id, direction)
    })
  }

  return (
    <>
      {/* 既存お知らせ */}
      {notices.map(n => (
        <div key={n.id}>
          {/* 管理バー */}
          <div
            className="flex items-center gap-1 px-2 py-1 text-xs mb-0"
            style={{ background: '#fff3cd', border: '1px dashed #fd7e14' }}
          >
            <button
              type="button"
              onClick={() => handleMove(n, 'up')}
              disabled={isPending}
              className="px-1.5 py-0.5 text-[10px] border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
              title="上へ"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => handleMove(n, 'down')}
              disabled={isPending}
              className="px-1.5 py-0.5 text-[10px] border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
              title="下へ"
            >
              ↓
            </button>
            <span className="flex-1 text-gray-700 truncate mx-1">
              {n.header_text || '（タイトルなし）'}
            </span>
            <button
              type="button"
              onClick={() => openEdit(n)}
              disabled={isPending}
              className="px-2 py-0.5 text-[10px] border border-orange-400 text-orange-700 hover:bg-orange-50 disabled:opacity-40"
            >
              ✏️ 編集
            </button>
            <button
              type="button"
              onClick={() => handleDelete(n)}
              disabled={isPending}
              className="px-2 py-0.5 text-[10px] border border-red-400 text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              🗑️ 削除
            </button>
          </div>
          {/* お知らせ本体 */}
          <NoticeBlock notice={n} />
        </div>
      ))}

      {/* 追加ボタン */}
      <div className="mb-2">
        <button
          type="button"
          onClick={openCreate}
          disabled={isPending}
          className="w-full text-xs py-1.5 px-3 text-left font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          style={{ background: '#ffe5cc', border: '1px dashed #fd7e14', color: '#c85a00' }}
        >
          ＋ お知らせを追加（{positionLabel[position]}）
        </button>
      </div>

      {/* モーダル */}
      {modalOpen && (
        <NoticeModal
          position={position}
          editing={editingNotice}
          onClose={closeModal}
        />
      )}
    </>
  )
}
