'use client'

import { useState, useTransition } from 'react'
import type { Block } from '@/types/fixed-pages'
import { savePage, type PageInput } from './actions'

interface Props {
  initial: PageInput
}

export function PageEditor({ initial }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [slug, setSlug] = useState(initial.slug)
  const [navLabel, setNavLabel] = useState(initial.nav_label)
  const [sortOrder, setSortOrder] = useState(initial.sort_order)
  const [isPublished, setIsPublished] = useState(initial.is_published)
  const [showInNav, setShowInNav] = useState(initial.show_in_nav)
  const [externalUrl, setExternalUrl] = useState(initial.external_url)
  const [blocks, setBlocks] = useState<Block[]>(initial.content)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const addBlock = (type: Block['type']) => {
    const block: Block =
      type === 'text' ? { type: 'text', content: '' }
      : type === 'image' ? { type: 'image', url: '', alt: '', link: '' }
      : { type: 'button', label: '', url: '' }
    const next = [...blocks, block]
    setBlocks(next)
    setExpandedIdx(next.length - 1)
  }

  const updateBlock = (i: number, patch: Partial<Block>) => {
    const next = [...blocks]
    next[i] = { ...next[i], ...patch } as Block
    setBlocks(next)
  }

  const moveBlock = (i: number, dir: 'up' | 'down') => {
    const next = [...blocks]
    const j = dir === 'up' ? i - 1 : i + 1
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next)
    setExpandedIdx(j)
  }

  const removeBlock = (i: number) => {
    if (!confirm('このブロックを削除しますか？')) return
    setBlocks(blocks.filter((_, idx) => idx !== i))
    if (expandedIdx === i) setExpandedIdx(null)
  }

  const handleSave = () => {
    startTransition(async () => {
      setStatus(null)
      const result = await savePage({
        id: initial.id,
        title, slug, nav_label: navLabel, content: blocks,
        is_published: isPublished, show_in_nav: showInNav,
        sort_order: sortOrder, external_url: externalUrl,
      })
      if (result.error) {
        setStatus(`エラー: ${result.error}`)
      } else {
        window.location.href = '/admin/pages'
      }
    })
  }

  const blockLabel = (b: Block) => {
    if (b.type === 'text') return b.content.slice(0, 50) || '(空)'
    if (b.type === 'image') return b.url || '(URLなし)'
    return b.label || '(ラベルなし)'
  }

  return (
    <div className="space-y-4">
      {/* ページ設定 */}
      <div className="bg-white border border-gray-200 p-4 space-y-3">
        <h2 className="font-bold text-gray-700 text-sm pb-2 border-b border-gray-100">ページ設定</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">ページタイトル <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">URLスラッグ <span className="text-red-500">*</span></label>
            <input type="text" value={slug} onChange={e => setSlug(e.target.value)}
              placeholder="about / faq など (英小文字・数字・ハイフン)"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            {slug && <p className="text-[10px] text-gray-400 mt-0.5">URL: /{slug}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">ナビ表示名（省略時はタイトル）</label>
            <input type="text" value={navLabel} onChange={e => setNavLabel(e.target.value)}
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">並び順</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 10)}
              className="w-24 border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">外部リンクURL（設定すると本文ではなくこのURLに直接リンク）</label>
          <input type="text" value={externalUrl} onChange={e => setExternalUrl(e.target.value)}
            placeholder="https://... (YouTube等の外部リンクの場合のみ)"
            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex gap-5 pt-1">
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="cursor-pointer" />
            公開する
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={showInNav} onChange={e => setShowInNav(e.target.checked)} className="cursor-pointer" />
            ナビに表示する
          </label>
        </div>
      </div>

      {/* 本文ブロック（外部URLがない場合のみ） */}
      {!externalUrl && (
        <div className="bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-gray-700 text-sm pb-2 border-b border-gray-100 mb-3">ページ本文</h2>

          {blocks.length === 0 && (
            <p className="text-xs text-gray-400 py-3 text-center">ブロックがありません。下のボタンから追加してください。</p>
          )}

          <div className="space-y-2">
            {blocks.map((block, i) => (
              <div key={i} className="border border-gray-200 rounded">
                {/* ブロックヘッダー */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded-t">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-white border border-gray-200 rounded shrink-0">
                    {block.type === 'text' ? '📝 テキスト' : block.type === 'image' ? '🖼 画像' : '🔘 ボタン'}
                  </span>
                  <span className="flex-1 text-xs text-gray-500 truncate min-w-0">{blockLabel(block)}</span>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => moveBlock(i, 'up')} disabled={i === 0}
                      className="text-[10px] px-1.5 py-0.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 rounded">▲</button>
                    <button type="button" onClick={() => moveBlock(i, 'down')} disabled={i === blocks.length - 1}
                      className="text-[10px] px-1.5 py-0.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 rounded">▼</button>
                    <button type="button" onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                      className="text-[10px] px-2 py-0.5 border border-gray-300 bg-white hover:bg-gray-50 rounded">
                      {expandedIdx === i ? '閉じる' : '編集'}
                    </button>
                    <button type="button" onClick={() => removeBlock(i)}
                      className="text-[10px] px-2 py-0.5 text-white rounded" style={{ background: '#dc3545' }}>削除</button>
                  </div>
                </div>

                {/* 編集エリア */}
                {expandedIdx === i && (
                  <div className="p-3 space-y-2 border-t border-gray-100">
                    {block.type === 'text' && (
                      <>
                        <textarea value={block.content} onChange={e => updateBlock(i, { content: e.target.value })}
                          rows={8} placeholder={'テキストを入力...\n\nインラインリンク記法: [リンクテキスト](https://...)'}
                          className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 font-mono" />
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">ブロック全体のリンクURL（省略可）</label>
                          <input type="text" value={block.link ?? ''} onChange={e => updateBlock(i, { link: e.target.value })}
                            placeholder="https://... （設定するとテキスト全体がリンクになります）"
                            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                      </>
                    )}
                    {block.type === 'image' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">画像URL <span className="text-red-500">*</span></label>
                          <input type="text" value={block.url} onChange={e => updateBlock(i, { url: e.target.value })}
                            placeholder="https://..."
                            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">クリック時リンクURL（省略可）</label>
                          <input type="text" value={block.link ?? ''} onChange={e => updateBlock(i, { link: e.target.value })}
                            placeholder="https://..."
                            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">代替テキスト（省略可）</label>
                          <input type="text" value={block.alt ?? ''} onChange={e => updateBlock(i, { alt: e.target.value })}
                            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        {block.url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={block.url} alt={block.alt ?? ''} style={{ maxWidth: 200, height: 'auto' }}
                            className="border border-gray-200 mt-1" />
                        )}
                      </>
                    )}
                    {block.type === 'button' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">ボタンラベル <span className="text-red-500">*</span></label>
                          <input type="text" value={block.label} onChange={e => updateBlock(i, { label: e.target.value })}
                            placeholder="ボタンのテキスト"
                            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">リンクURL <span className="text-red-500">*</span></label>
                          <input type="text" value={block.url} onChange={e => updateBlock(i, { url: e.target.value })}
                            placeholder="https://..."
                            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        {block.label && block.url && (
                          <div className="pt-1">
                            <span className="text-xs text-gray-500">プレビュー: </span>
                            <span className="inline-block px-4 py-1.5 text-xs font-medium text-white" style={{ background: '#0d6efd' }}>
                              {block.label}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">ブロック追加:</span>
            <button type="button" onClick={() => addBlock('text')}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">📝 テキスト</button>
            <button type="button" onClick={() => addBlock('image')}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">🖼 画像</button>
            <button type="button" onClick={() => addBlock('button')}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">🔘 ボタン</button>
          </div>
        </div>
      )}

      {/* 保存ボタン */}
      <div className="flex items-center gap-3 pb-4">
        <button type="button" onClick={handleSave} disabled={isPending}
          className="px-6 py-2 text-white text-sm font-medium disabled:opacity-50"
          style={{ background: isPending ? '#6c757d' : '#0d6efd' }}>
          {isPending ? '保存中...' : '保存する'}
        </button>
        <a href="/admin/pages" className="text-xs text-gray-500 hover:underline">← キャンセル</a>
        {status && <span className="text-xs text-red-600">{status}</span>}
      </div>
    </div>
  )
}
