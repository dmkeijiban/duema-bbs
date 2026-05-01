'use client'

import { useEditor, EditorContent, mergeAttributes } from '@tiptap/react'
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

interface Props {
  content: string
  onChange: (html: string) => void
  onAddLinks?: () => void
  onAddButton?: () => void
}

function toHtml(content: string): string {
  if (!content) return '<p></p>'
  if (content.trimStart().startsWith('<')) return content
  return content
    .split('\n')
    .map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`)
    .join('')
}

export function RichTextEditor({ content, onChange, onAddLinks, onAddButton }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  // undefined = 画像未選択, string = 選択中の画像のhref（空文字含む）
  const [selectedImageHref, setSelectedImageHref] = useState<string | undefined>(undefined)
  const [toolbarFixed, setToolbarFixed] = useState(false)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [toolbarFixedStyle, setToolbarFixedStyle] = useState<CSSProperties>({})

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
    ],
    content: toHtml(content),
    onUpdate: ({ editor }) => { onChange(editor.getHTML()); syncImageState(editor) },
    onSelectionUpdate: ({ editor }) => syncImageState(editor),
    editorProps: {
      attributes: { class: 'rich-editor-content', spellCheck: 'false' },
      handleDOMEvents: {
        // エディタ内のリンク（画像リンク含む）クリックで外部遷移しないよう防ぐ
        click: (_view, event) => {
          const anchor = (event.target as HTMLElement).closest('a[href]')
          if (anchor) event.preventDefault()
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

        {/* ブロック追加ショートカット */}
        {(onAddLinks || onAddButton) && (
          <>
            <div className="w-px bg-gray-300 mx-0.5" />
            {onAddLinks && (
              <button type="button" onClick={onAddLinks}
                className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                🛒 ショップリンク
              </button>
            )}
            {onAddButton && (
              <button type="button" onClick={onAddButton}
                className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                🔘 ボタン
              </button>
            )}
          </>
        )}

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
      `}</style>
    </div>
  )
}
