'use client'

import { useState, useTransition, useRef } from 'react'
import type { Block } from '@/types/fixed-pages'
import { savePage, uploadPageImage, type PageInput } from './actions'
import { RichTextEditor } from './RichTextEditor'

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
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const addBlock = (type: Block['type']) => {
    const block: Block =
      type === 'text' ? { type: 'text', content: '' }
      : type === 'image' ? { type: 'image', url: '', alt: '', link: '' }
      : type === 'links' ? { type: 'links', items: [] }
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

  const handleImageUpload = async (file: File, i: number) => {
    setUploadingIdx(i)
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadPageImage(fd)
    setUploadingIdx(null)
    if (result.error) { setStatus(`画像エラー: ${result.error}`); return }
    if (result.url) updateBlock(i, { url: result.url })
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
    if (b.type === 'text') {
      const text = b.content.replace(/<[^>]+>/g, '').slice(0, 50)
      return text || '(空)'
    }
    if (b.type === 'image') return b.url || '(URLなし)'
    if (b.type === 'links') return `ショップリンク: ${b.items.map(it => it.label).filter(Boolean).join('・') || '(なし)'}`
    return `ボタン: ${b.label || '(ラベルなし)'}`
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
          <label className="block text-xs text-gray-600 mb-1">外部リンクURL（設定するとこのURLへ直接リンク）</label>
          <input type="text" value={externalUrl} onChange={e => setExternalUrl(e.target.value)}
            placeholder="https://..."
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

      {/* 本文ブロック */}
      {!externalUrl && (
        <div className="bg-white border border-gray-200 p-4">
          <h2 className="font-bold text-gray-700 text-sm pb-2 border-b border-gray-100 mb-3">ページ本文</h2>

          {/* ブロック種類の説明 */}
          <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-3 py-2 mb-3 space-y-0.5">
            <p>📝 <strong>テキスト</strong>：本文を書くエリア。画像もここに差し込めます。テキスト選択→🔗リンクで青文字リンク設定。</p>
            <p>🖼 <strong>画像</strong>：クリックで別URLへ飛ぶバナー画像専用（テキストとは独立した配置）。</p>
            <p>🔘 <strong>ボタン</strong>：「お問い合わせはこちら」などのリンクボタン。クリックすると指定URLへ移動。</p>
          </div>

          {/* ブロック追加（上部） */}
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
            <span className="text-xs text-gray-500">ブロック追加:</span>
            <button type="button" onClick={() => addBlock('text')}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">📝 テキスト</button>
            <button type="button" onClick={() => addBlock('image')}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">🖼 画像</button>
            <button type="button" onClick={() => addBlock('links')}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">🛒 ショップリンク</button>
            <button type="button" onClick={() => addBlock('button')}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">🔘 ボタン</button>
          </div>

          {blocks.length === 0 && (
            <p className="text-xs text-gray-400 py-3 text-center">ブロックがありません。上のボタンから追加してください。</p>
          )}

          <div className="space-y-2">
            {blocks.map((block, i) => (
              <div key={i} className="border border-gray-200 rounded">
                {/* ブロックヘッダー */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded-t">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-white border border-gray-200 rounded shrink-0">
                    {block.type === 'text' ? '📝 テキスト' : block.type === 'image' ? '🖼 画像' : block.type === 'links' ? '🛒 ショップリンク' : '🔘 ボタン'}
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
                      <RichTextEditor
                        content={block.content}
                        onChange={html => updateBlock(i, { content: html })}
                      />
                    )}

                    {block.type === 'image' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">画像をアップロード</label>
                          <input type="file" accept="image/*"
                            ref={el => { fileInputRefs.current[i] = el }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, i) }}
                            className="hidden" />
                          <button type="button"
                            onClick={() => fileInputRefs.current[i]?.click()}
                            disabled={uploadingIdx === i}
                            className="text-xs px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50">
                            {uploadingIdx === i ? 'アップロード中...' : '📁 ファイルを選択'}
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">または画像URL</label>
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

                    {block.type === 'links' && (
                      <div className="space-y-3">
                        <p className="text-[11px] text-gray-500">Amazon・駿河屋などのショップリンクをボタンとして並べます。</p>
                        {block.items.length === 0 && (
                          <p className="text-xs text-gray-400 py-1">リンクがありません。下のボタンから追加してください。</p>
                        )}
                        <div className="space-y-2">
                          {block.items.map((item, j) => {
                            const updateItem = (patch: Partial<typeof item>) => {
                              const items = block.items.map((it, k) => k === j ? { ...it, ...patch } : it)
                              updateBlock(i, { items } as Partial<Block>)
                            }
                            const removeItem = () => {
                              const items = block.items.filter((_, k) => k !== j)
                              updateBlock(i, { items } as Partial<Block>)
                            }
                            const COLOR_PRESETS = [
                              { label: 'Amazon', color: '#FF9900' },
                              { label: '駿河屋', color: '#9b59b6' },
                              { label: '青', color: '#0d6efd' },
                              { label: '緑', color: '#28a745' },
                              { label: '赤', color: '#dc3545' },
                              { label: '黒', color: '#333333' },
                            ]
                            return (
                              <div key={j} className="flex gap-2 items-start p-2 border border-gray-200 rounded bg-gray-50">
                                <div className="flex-1 space-y-1.5 min-w-0">
                                  <input type="text" value={item.label}
                                    onChange={e => updateItem({ label: e.target.value })}
                                    placeholder="ショップ名（例: Amazon）"
                                    className="w-full border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                                  <input type="text" value={item.url}
                                    onChange={e => updateItem({ url: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-gray-500">色:</span>
                                    {COLOR_PRESETS.map(preset => (
                                      <button key={preset.color} type="button" title={preset.label}
                                        onClick={() => updateItem({ color: preset.color })}
                                        className={`w-5 h-5 rounded-full border-2 transition-transform ${item.color === preset.color ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: preset.color }} />
                                    ))}
                                    <input type="color" value={item.color || '#0d6efd'}
                                      onChange={e => updateItem({ color: e.target.value })}
                                      title="カスタムカラー"
                                      className="w-6 h-5 cursor-pointer border border-gray-300 rounded" />
                                    {item.label && (
                                      <span className="ml-1 inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold text-white rounded-full"
                                        style={{ backgroundColor: item.color || '#0d6efd' }}>
                                        🛒 {item.label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button type="button" onClick={removeItem}
                                  className="text-[10px] px-1.5 py-0.5 text-white rounded shrink-0 mt-0.5" style={{ background: '#dc3545' }}>
                                  削除
                                </button>
                              </div>
                            )
                          })}
                        </div>
                        <button type="button"
                          onClick={() => {
                            const items = [...block.items, { label: '', url: '', color: '#0d6efd' }]
                            updateBlock(i, { items } as Partial<Block>)
                          }}
                          className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">
                          + リンクを追加
                        </button>
                      </div>
                    )}

                    {block.type === 'button' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">ボタンのテキスト <span className="text-red-500">*</span></label>
                          <input type="text" value={block.label} onChange={e => updateBlock(i, { label: e.target.value })}
                            placeholder="例：お問い合わせはこちら"
                            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-0.5">リンク先URL <span className="text-red-500">*</span></label>
                          <input type="text" value={block.url} onChange={e => updateBlock(i, { url: e.target.value })}
                            placeholder="https://..."
                            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        {block.label && block.url && (
                          <div className="pt-1">
                            <p className="text-[10px] text-gray-400 mb-1">プレビュー（クリックするとURLへ移動するボタン）：</p>
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
            <button type="button" onClick={() => addBlock('links')}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 rounded">🛒 ショップリンク</button>
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
