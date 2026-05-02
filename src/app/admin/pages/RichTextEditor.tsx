'use client'

import { useEditor, EditorContent, mergeAttributes, Node } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import { useRef, useState, useEffect, type CSSProperties } from 'react'
import { uploadPageImage } from './actions'

// 画像にhref属性を追加したカスタム拡張
const ImageWithLink = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: { default: null },
    }
  },
  // <a href="..."><img></a> のHTMLを読み込んだとき href を復元する
  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (node) => {
          if (typeof node === 'string') return {}
          const el = node as HTMLElement
          const parent = el.parentElement
          const href = parent?.tagName.toLowerCase() === 'a' ? parent.getAttribute('href') : null
          return {
            src: el.getAttribute('src'),
            alt: el.getAttribute('alt') ?? undefined,
            title: el.getAttribute('title') ?? undefined,
            href,
          }
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const { href, ...imgAttrs } = HTMLAttributes
    const imgNode = ['img', mergeAttributes({ class: 'rich-img' }, imgAttrs)] as [string, Record<string, unknown>]
    if (href) {
      return ['a', { href, target: '_blank', rel: 'noopener noreferrer' }, imgNode] as [string, Record<string, unknown>, [string, Record<string, unknown>]]
    }
    return imgNode
  },
})

// インラインボタンノード（テキスト内に埋め込むリンクボタン）
const PageButton = Node.create({
  name: 'pageButton',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      href: { default: '' },
      label: { default: 'ボタン' },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'a[data-btn]',
        getAttrs: (node) => {
          if (typeof node === 'string') return {}
          const el = node as HTMLElement
          return {
            href: el.getAttribute('href') || '',
            label: el.textContent || 'ボタン',
          }
        },
      },
    ]
  },
  renderHTML({ node }) {
    return [
      'a',
      {
        'data-btn': '',
        href: node.attrs.href,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'page-btn',
      },
      node.attrs.label,
    ]
  },
})

// インラインショップリンクノード（テキスト内に埋め込む色付きバッジリンク）
const ShopLink = Node.create({
  name: 'shopLink',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      href: { default: '' },
      label: { default: 'ショップ' },
      color: { default: '#0d6efd' },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'a[data-shop]',
        getAttrs: (node) => {
          if (typeof node === 'string') return {}
          const el = node as HTMLElement
          const style = el.getAttribute('style') || ''
          const colorMatch = style.match(/background-color:\s*([^;]+)/)
          return {
            href: el.getAttribute('href') || '',
            label: (el.textContent || 'ショップ').replace(/^🛒\s*/, ''),
            color: colorMatch?.[1]?.trim() || '#0d6efd',
          }
        },
      },
    ]
  },
  renderHTML({ node }) {
    return [
      'a',
      {
        'data-shop': '',
        href: node.attrs.href,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'shop-link',
        style: `background-color:${node.attrs.color}`,
      },
      `🛒 ${node.attrs.label}`,
    ]
  },
})

const COLOR_PRESETS = [
  { label: 'Amazon', color: '#FF9900' },
  { label: '駿河屋', color: '#00b3ff' },
  { label: '青', color: '#0d6efd' },
  { label: '緑', color: '#28a745' },
  { label: '赤', color: '#dc3545' },
  { label: '黒', color: '#333333' },
]

interface ShopLinkDialog {
  label: string
  url: string
  color: string
}

interface LinkPopupState {
  x: number
  y: number
  from: number
  href: string
  type: 'shopLink' | 'pageButton' | 'link'
  label?: string
  color?: string
}

interface Props {
  content: string
  onChange: (html: string) => void
}

// エディタ読み込み前処理：旧形式 ●<a>ショップ名</a> → ShopLinkノード形式に変換
const SHOP_COLOR_MAP_FOR_EDITOR: Record<string, string> = {
  'Amazon': '#FF9900',
  '駿河屋': '#00b3ff',
}
const SURUGAYA_SHORTURL = 'https://x.gd/P6Gmd'

function preprocessForEditor(html: string): string {
  // ① ●<a href="...">ショップ名</a> → <a data-shop="" ...>
  let result = html.replace(
    /●\s*<a\s([^>]*)>([\s\S]*?)<\/a>/gi,
    (_match, attrs, label) => {
      const trimmed = label.trim()
      const color = SHOP_COLOR_MAP_FOR_EDITOR[trimmed] ?? '#0d6efd'
      const hrefMatch = attrs.match(/href=["']([^"']*)["']/i)
      const href = hrefMatch?.[1] ?? ''
      return `<a data-shop="" href="${href}" style="background-color:${color};">${trimmed}</a>`
    }
  )
  // ② ●駿河屋 プレーンテキスト → ShopLinkノード
  result = result.replace(
    /●駿河屋/g,
    `<a data-shop="" href="${SURUGAYA_SHORTURL}" style="background-color:#00b3ff;">駿河屋</a>`
  )
  return result
}

function toHtml(content: string): string {
  if (!content) return '<p></p>'
  if (content.trimStart().startsWith('<')) return preprocessForEditor(content)
  return content
    .split('\n')
    .map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`)
    .join('')
}

export function RichTextEditor({ content, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  // undefined = 画像未選択, string = 選択中の画像のhref（空文字含む）
  const [selectedImageHref, setSelectedImageHref] = useState<string | undefined>(undefined)
  const [toolbarFixed, setToolbarFixed] = useState(false)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [toolbarFixedStyle, setToolbarFixedStyle] = useState<CSSProperties>({})

  // ショップリンクダイアログ
  const [shopDialog, setShopDialog] = useState<ShopLinkDialog | null>(null)
  const [isEditingShopLink, setIsEditingShopLink] = useState(false)

  // ボタンダイアログ
  const [btnDialog, setBtnDialog] = useState<{ label: string; url: string } | null>(null)
  const [isEditingBtn, setIsEditingBtn] = useState(false)

  // クリックしたリンクのURL確認ポップアップ
  const [linkPopup, setLinkPopup] = useState<LinkPopupState | null>(null)
  const showPopupOnNextSelectionRef = useRef(false)

  useEffect(() => {
    const HEADER_H = 46
    const onScroll = () => {
      const wrapper = wrapperRef.current
      const toolbar = toolbarRef.current
      if (!wrapper || !toolbar) return
      const wRect = wrapper.getBoundingClientRect()
      const tHeight = toolbar.offsetHeight
      if (wRect.top < HEADER_H) {
        // ツールバーが画面外に出そう → fixed で追従
        setToolbarFixed(true)
        setToolbarHeight(tHeight)
        setToolbarFixedStyle({
          position: 'fixed',
          top: HEADER_H,
          left: wRect.left,
          width: wRect.width,
          zIndex: 40,
        })
      } else {
        setToolbarFixed(false)
        setToolbarHeight(0)
        setToolbarFixedStyle({})
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const syncImageState = (ed: ReturnType<typeof useEditor>) => {
    if (!ed) return
    if (ed.isActive('image')) {
      setSelectedImageHref(ed.getAttributes('image').href ?? '')
    } else {
      setSelectedImageHref(undefined)
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'rich-link', target: '_blank', rel: 'noopener noreferrer' },
      }),
      ImageWithLink.configure({ HTMLAttributes: { class: 'rich-img' } }),
      PageButton,
      ShopLink,
    ],
    content: toHtml(content),
    onUpdate: ({ editor }) => { onChange(editor.getHTML()); syncImageState(editor); setLinkPopup(null) },
    onSelectionUpdate: ({ editor }) => {
      syncImageState(editor)
      if (showPopupOnNextSelectionRef.current) {
        showPopupOnNextSelectionRef.current = false
        const { from } = editor.state.selection
        const coords = editor.view.coordsAtPos(from)
        const px = coords.left
        const py = coords.bottom + 6
        if (editor.isActive('shopLink')) {
          const attrs = editor.getAttributes('shopLink')
          setLinkPopup({ x: px, y: py, from, href: attrs.href, type: 'shopLink', label: attrs.label, color: attrs.color })
        } else if (editor.isActive('pageButton')) {
          const attrs = editor.getAttributes('pageButton')
          setLinkPopup({ x: px, y: py, from, href: attrs.href, type: 'pageButton', label: attrs.label })
        } else if (editor.isActive('link')) {
          const attrs = editor.getAttributes('link')
          setLinkPopup({ x: px, y: py, from, href: attrs.href, type: 'link' })
        } else {
          setLinkPopup(null)
        }
      } else {
        setLinkPopup(null)
      }
    },
    editorProps: {
      attributes: { class: 'rich-editor-content', spellCheck: 'false' },
      handleDOMEvents: {
        // エディタ内のリンクをクリック：外部遷移を防ぎ、URLポップアップを表示
        click: (_view, event) => {
          const target = event.target as HTMLElement
          if (target.tagName === 'IMG') return false  // 画像クリックは別ハンドラで処理
          const anchor = target.closest('a[href]')
          if (anchor) {
            event.preventDefault()
            showPopupOnNextSelectionRef.current = true
          }
          return false
        },
      },
    },
  })

  const setLink = () => {
    if (!editor) return
    const prev = editor.getAttributes('link').href ?? ''
    const url = window.prompt('リンクURL（空欄でリンク解除）:', prev)
    if (url === null) return
    if (!url.trim()) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: url.trim() }).run()
  }

  const setImageLink = () => {
    if (!editor) return
    const prev = selectedImageHref ?? ''
    const url = window.prompt('画像クリック時のリンクURL（空欄で解除）:', prev)
    if (url === null) return
    editor.chain().focus().updateAttributes('image', { href: url.trim() || null }).run()
    setSelectedImageHref(url.trim() || '')
  }

  const insertImage = async (file: File) => {
    if (!editor) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadPageImage(fd)
    setUploading(false)
    if (result.url) editor.chain().focus().setImage({ src: result.url }).run()
  }

  const submitShopLink = () => {
    if (!editor || !shopDialog) return
    if (!shopDialog.label.trim() || !shopDialog.url.trim()) return
    if (isEditingShopLink && linkPopup) {
      // 既存ノードを置き換え
      editor.chain().focus()
        .setNodeSelection(linkPopup.from)
        .insertContent({
          type: 'shopLink',
          attrs: { href: shopDialog.url.trim(), label: shopDialog.label.trim(), color: shopDialog.color },
        })
        .run()
      setIsEditingShopLink(false)
    } else {
      editor.chain().focus().insertContent({
        type: 'shopLink',
        attrs: { href: shopDialog.url.trim(), label: shopDialog.label.trim(), color: shopDialog.color },
      }).run()
    }
    setShopDialog(null)
    setLinkPopup(null)
  }

  const submitButton = () => {
    if (!editor || !btnDialog) return
    if (!btnDialog.label.trim() || !btnDialog.url.trim()) return
    if (isEditingBtn && linkPopup) {
      // 既存ノードを置き換え
      editor.chain().focus()
        .setNodeSelection(linkPopup.from)
        .insertContent({
          type: 'pageButton',
          attrs: { href: btnDialog.url.trim(), label: btnDialog.label.trim() },
        })
        .run()
      setIsEditingBtn(false)
    } else {
      editor.chain().focus().insertContent({
        type: 'pageButton',
        attrs: { href: btnDialog.url.trim(), label: btnDialog.label.trim() },
      }).run()
    }
    setBtnDialog(null)
    setLinkPopup(null)
  }

  const btn = (active: boolean, label: string, onClick: () => void, title?: string) => (
    <button type="button" onClick={onClick} title={title}
      className={`px-2 py-1 text-xs border rounded ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
      {label}
    </button>
  )

  if (!editor) return null

  return (
    <div ref={wrapperRef} className="border border-gray-300 rounded">
      {/* ツールバー固定時のスペーサー（レイアウトずれ防止） */}
      {toolbarFixed && <div style={{ height: toolbarHeight }} />}
      {/* ツールバー：スクロール中も追従 */}
      <div ref={toolbarRef}
        style={toolbarFixed ? toolbarFixedStyle : undefined}
        className={`flex flex-wrap gap-1 p-1.5 bg-gray-50 border-b border-gray-200 ${toolbarFixed ? 'shadow-md' : 'rounded-t'}`}>
        {btn(editor.isActive('bold'), 'B', () => editor.chain().focus().toggleBold().run(), '太字')}
        {btn(editor.isActive('italic'), 'I', () => editor.chain().focus().toggleItalic().run(), '斜体')}
        <div className="w-px bg-gray-300 mx-0.5" />
        {btn(editor.isActive('link'), '🔗 テキストリンク', setLink, 'テキストを選択してクリック')}
        <div className="w-px bg-gray-300 mx-0.5" />
        {btn(editor.isActive('bulletList'), '• リスト', () => editor.chain().focus().toggleBulletList().run())}
        {btn(editor.isActive('orderedList'), '1. リスト', () => editor.chain().focus().toggleOrderedList().run())}
        <div className="w-px bg-gray-300 mx-0.5" />
        <button type="button" disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50">
          {uploading ? '⏳ アップロード中...' : '🖼 画像を挿入'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { insertImage(f); e.target.value = '' } }} />
        <div className="w-px bg-gray-300 mx-0.5" />
        <button type="button" onClick={() => setShopDialog({ label: '', url: '', color: '#FF9900' })}
          className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
          🛒 ショップリンク
        </button>
        <button type="button" onClick={() => setBtnDialog({ label: '', url: '' })}
          className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
          🔘 ボタン
        </button>

        {/* 画像選択中のみ表示 */}
        {selectedImageHref !== undefined && (
          <>
            <div className="w-px bg-gray-300 mx-0.5" />
            <button type="button" onClick={setImageLink}
              className={`px-2 py-1 text-xs border rounded ${selectedImageHref ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              {selectedImageHref ? '🔗 画像リンク変更' : '🔗 画像にリンク設定'}
            </button>
            {selectedImageHref && (
              <span className="text-[10px] text-gray-400 self-center truncate max-w-[160px]">{selectedImageHref}</span>
            )}
          </>
        )}
      </div>

      <EditorContent editor={editor} />

      {/* リンククリック時のURL確認ポップアップ */}
      {linkPopup && (
        <div
          style={{ position: 'fixed', left: Math.min(linkPopup.x, window.innerWidth - 320), top: linkPopup.y, zIndex: 200 }}
          className="bg-white border border-gray-300 rounded-lg shadow-lg p-2.5 w-72 text-xs"
        >
          {/* URL表示（外部リンク） */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-gray-400 shrink-0">🔗</span>
            <a
              href={linkPopup.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline truncate flex-1"
              title={linkPopup.href}
              onMouseDown={e => e.stopPropagation()}
            >
              {linkPopup.href}
            </a>
          </div>
          {/* 操作ボタン */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                if (linkPopup.type === 'shopLink') {
                  setIsEditingShopLink(true)
                  setShopDialog({ label: linkPopup.label ?? '', url: linkPopup.href, color: linkPopup.color ?? '#FF9900' })
                } else if (linkPopup.type === 'pageButton') {
                  setIsEditingBtn(true)
                  setBtnDialog({ label: linkPopup.label ?? '', url: linkPopup.href })
                } else {
                  // テキストリンクは setLink ダイアログで編集
                  const url = window.prompt('リンクURLを変更:', linkPopup.href)
                  if (url === null) return
                  if (!url.trim()) editor.chain().focus().unsetLink().run()
                  else editor.chain().focus().setLink({ href: url.trim() }).run()
                  setLinkPopup(null)
                }
              }}
              className="flex-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            >
              ✏️ 編集
            </button>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                if (linkPopup.type === 'shopLink' || linkPopup.type === 'pageButton') {
                  editor.chain().focus().setNodeSelection(linkPopup.from).deleteSelection().run()
                } else {
                  editor.chain().focus().unsetLink().run()
                }
                setLinkPopup(null)
              }}
              className="flex-1 px-2 py-1 border border-red-200 rounded hover:bg-red-50 text-red-600"
            >
              🗑 削除
            </button>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setLinkPopup(null)}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-400"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ショップリンクダイアログ */}
      {shopDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) { setShopDialog(null); setIsEditingShopLink(false); setLinkPopup(null) } }}>
          <div className="bg-white rounded-lg shadow-xl w-80 p-4 space-y-3">
            <p className="font-bold text-sm text-gray-800">
              {isEditingShopLink ? '🛒 ショップリンクを編集' : '🛒 ショップリンクを挿入'}
            </p>

            <div>
              <label className="block text-xs text-gray-600 mb-0.5">ショップ名 <span className="text-red-500">*</span></label>
              <input type="text" value={shopDialog.label}
                onChange={e => setShopDialog(d => d && ({ ...d, label: e.target.value }))}
                placeholder="例: Amazon"
                className="w-full border border-gray-300 px-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-0.5">URL <span className="text-red-500">*</span></label>
              <input type="text" value={shopDialog.url}
                onChange={e => setShopDialog(d => d && ({ ...d, url: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-gray-300 px-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">ボタンの色</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {COLOR_PRESETS.map(preset => (
                  <button key={preset.color} type="button"
                    onClick={() => setShopDialog(d => d && ({ ...d, color: preset.color }))}
                    title={preset.label}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-white font-bold transition-transform"
                    style={{
                      backgroundColor: preset.color,
                      outline: shopDialog.color === preset.color ? '2px solid #333' : 'none',
                      outlineOffset: 2,
                      transform: shopDialog.color === preset.color ? 'scale(1.1)' : 'scale(1)',
                    }}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={shopDialog.color}
                  onChange={e => setShopDialog(d => d && ({ ...d, color: e.target.value }))}
                  className="w-8 h-8 cursor-pointer rounded border border-gray-300"
                  title="カスタムカラー" />
                <span className="text-xs text-gray-500">カスタム色</span>
                <span className="ml-auto inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white rounded-full"
                  style={{ backgroundColor: shopDialog.color }}>
                  🛒 {shopDialog.label || 'プレビュー'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setShopDialog(null); setIsEditingShopLink(false) }}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">
                キャンセル
              </button>
              <button type="button" onClick={submitShopLink}
                disabled={!shopDialog.label.trim() || !shopDialog.url.trim()}
                className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-40"
                style={{ background: '#0d6efd' }}>
                {isEditingShopLink ? '更新する' : '挿入する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ボタンダイアログ */}
      {btnDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) { setBtnDialog(null); setIsEditingBtn(false); setLinkPopup(null) } }}>
          <div className="bg-white rounded-lg shadow-xl w-72 p-4 space-y-3">
            <p className="font-bold text-sm text-gray-800">
              {isEditingBtn ? '🔘 ボタンを編集' : '🔘 ボタンを挿入'}
            </p>

            <div>
              <label className="block text-xs text-gray-600 mb-0.5">ボタンのテキスト <span className="text-red-500">*</span></label>
              <input type="text" value={btnDialog.label}
                onChange={e => setBtnDialog(d => d && ({ ...d, label: e.target.value }))}
                placeholder="例: 詳細はこちら"
                className="w-full border border-gray-300 px-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-0.5">URL <span className="text-red-500">*</span></label>
              <input type="text" value={btnDialog.url}
                onChange={e => setBtnDialog(d => d && ({ ...d, url: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-gray-300 px-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-400"
              />
            </div>

            {btnDialog.label && (
              <div>
                <p className="text-[10px] text-gray-400 mb-1">プレビュー：</p>
                <span className="inline-block px-4 py-1.5 text-xs font-medium text-white rounded"
                  style={{ background: '#0d6efd' }}>
                  {btnDialog.label}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setBtnDialog(null); setIsEditingBtn(false); setLinkPopup(null) }}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">
                キャンセル
              </button>
              <button type="button" onClick={submitButton}
                disabled={!btnDialog.label.trim() || !btnDialog.url.trim()}
                className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-40"
                style={{ background: '#0d6efd' }}>
                {isEditingBtn ? '更新する' : '挿入する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rich-editor-content {
          min-height: 200px;
          padding: 10px 12px;
          font-size: 14px;
          line-height: 1.7;
          outline: none;
        }
        .rich-editor-content p { margin-bottom: 0.75em; }
        .rich-editor-content p:last-child { margin-bottom: 0; }
        .rich-editor-content a, .rich-link { color: #2563eb; text-decoration: underline; cursor: pointer; }
        .rich-editor-content ul { list-style: disc; padding-left: 1.5em; margin-bottom: 0.75em; }
        .rich-editor-content ol { list-style: decimal; padding-left: 1.5em; margin-bottom: 0.75em; }
        .rich-editor-content li { margin-bottom: 0.25em; }
        .rich-editor-content strong { font-weight: bold; }
        .rich-editor-content em { font-style: italic; }
        .rich-img, .rich-editor-content img {
          max-width: 100%; height: auto; display: block; margin: 0.5em 0;
          cursor: pointer;
        }
        /* インラインボタン・ショップリンクのエディタ内プレビュー */
        .rich-editor-content a.page-btn {
          display: inline-block;
          padding: 4px 16px;
          background: #0d6efd;
          color: white !important;
          text-decoration: none !important;
          font-weight: 500;
          border-radius: 2px;
          cursor: default;
          user-select: none;
        }
        .rich-editor-content a.shop-link {
          display: inline-flex;
          align-items: center;
          padding: 3px 12px;
          color: white !important;
          text-decoration: none !important;
          font-weight: bold;
          border-radius: 9999px;
          cursor: default;
          user-select: none;
        }
      `}</style>
    </div>
  )
}
