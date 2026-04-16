'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Notice } from '@/components/NoticeBlock'
import { inlineCreateNotice, inlineUpdateNotice, inlineDeleteNotice } from '@/app/admin/actions'

interface Props {
  position: 'top' | 'mid' | 'bot'
  notices: Notice[]
}

const positionLabel: Record<string, string> = {
  top: 'top',
  mid: 'mid',
  bot: 'bot',
}

type ModalMode = 'create' | 'edit'

interface ModalState {
  mode: ModalMode
  notice?: Notice
}

function NoticeModal({
  position,
  modal,
  onClose,
}: {
  position: 'top' | 'mid' | 'bot'
  modal: ModalState
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [imageUrl, setImageUrl] = useState(modal.notice?.image_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const isEdit = modal.mode === 'edit'
  const notice = modal.notice

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const path = `notices/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('bbs-images').upload(path, file)
      if (error) throw error
      const publicUrl = supabase.storage.from('bbs-images').getPublicUrl(path).data.publicUrl
      setImageUrl(publicUrl)
    } catch (err) {
      setUploadError('画像アップロードに失敗しました')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    // image_url は state から設定
    formData.set('image_url', imageUrl)
    startTransition(async () => {
      if (isEdit) {
        await inlineUpdateNotice(formData)
      } else {
        await inlineCreateNotice(formData)
      }
      onClose()
    })
  }

  function handleDelete() {
    if (!notice) return
    if (!confirm('このお知らせを削除しますか？')) return
    const formData = new FormData()
    formData.set('noticeId', String(notice.id))
    startTransition(async () => {
      await inlineDeleteNotice(formData)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="max-w-md w-full mx-3 p-5 bg-white border border-gray-300 overflow-y-auto" style={{ maxHeight: '90vh' }}>
        <h2 className="font-bold text-sm text-orange-800 mb-4">
          {isEdit ? '✏️ お知らせを編集' : '➕ お知らせを追加'} ({positionLabel[position]})
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {isEdit && notice && (
            <input type="hidden" name="noticeId" value={notice.id} />
          )}
          <input type="hidden" name="position" value={position} />

          {/* 画像 */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">画像アップロード</label>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="プレビュー" className="mb-2 max-h-32 object-contain border border-gray-200" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-xs text-gray-600 file:mr-3 file:py-1 file:px-2 file:border file:border-gray-300 file:text-xs file:bg-gray-50"
            />
            {uploading && <p className="text-xs text-orange-600 mt-1">アップロード中...</p>}
            {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
          </div>

          {/* リンクURL */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">リンクURL（任意）</label>
            <input
              type="text"
              name="link_url"
              defaultValue={notice?.link_url ?? ''}
              placeholder="画像・全体をクリックした時のURL（アフィリエイトリンク等）"
              className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* タイトル */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">タイトル（任意）</label>
            <input
              type="text"
              name="title"
              defaultValue={notice?.title ?? ''}
              className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* 本文 */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">本文（任意）</label>
            <textarea
              name="body"
              rows={3}
              defaultValue={notice?.body ?? ''}
              className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 resize-y"
            />
          </div>

          {/* 表示タイプ */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">表示タイプ</label>
            <select
              name="display_type"
              defaultValue={notice?.display_type ?? 'banner'}
              className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            >
              <option value="banner">横長バナー</option>
              <option value="text">テキスト</option>
              <option value="image">画像のみ</option>
              <option value="card">カード</option>
            </select>
          </div>

          {/* 並び順 */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">並び順</label>
            <input
              type="number"
              name="sort_order"
              defaultValue={notice?.sort_order ?? 0}
              className="w-24 border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button
              type="submit"
              disabled={isPending || uploading}
              className="px-4 py-1.5 text-white text-xs font-medium disabled:opacity-50"
              style={{ background: '#fd7e14' }}
            >
              {isPending ? '保存中...' : '保存'}
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-1.5 text-white text-xs font-medium disabled:opacity-50"
                style={{ background: '#dc3545' }}
              >
                削除
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function NoticeAdminBar({ position, notices }: Props) {
  const [modal, setModal] = useState<ModalState | null>(null)

  return (
    <>
      {/* 既存お知らせの編集ボタン */}
      {notices.map(n => (
        <div key={n.id} className="flex items-center gap-1 mb-1 px-2 py-1 text-xs" style={{ background: '#fff3cd', border: '1px dashed #fd7e14' }}>
          <span className="flex-1 text-gray-700 truncate">{n.title || '（タイトルなし）'} <span className="text-gray-400">({n.display_type})</span></span>
          <button
            type="button"
            onClick={() => setModal({ mode: 'edit', notice: n })}
            className="px-2 py-0.5 text-[10px] border border-orange-400 text-orange-700 hover:bg-orange-50"
          >
            ✏️ 編集
          </button>
        </div>
      ))}

      {/* 追加ボタン */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="w-full text-xs py-1.5 px-3 text-left font-medium hover:opacity-80 transition-opacity"
          style={{ background: '#ffe5cc', border: '1px dashed #fd7e14', color: '#c85a00' }}
        >
          ＋ お知らせを追加（{positionLabel[position]}）
        </button>
      </div>

      {/* モーダル */}
      {modal && (
        <NoticeModal
          position={position}
          modal={modal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
