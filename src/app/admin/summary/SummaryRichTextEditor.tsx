'use client'

import { useEditor, EditorContent, mergeAttributes, Node } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import { useRef, useState, useEffect, type CSSProperties } from 'react'
import { uploadPageImage } from '../pages/actions'

// ── ヘルパー関数 ────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function extractTweetId(input: string): string | null {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  const m1 = trimmed.match(/\/status\/(\d+)/)
  if (m1) return m1[1]
  const m2 = trimmed.match(/twterm%5E(\d+)/i)
  if (m2) return m2[1]
  return null
}

// ── 画像にhrefを追加したカスタム拡張（RichTextEditorと同じ） ──────
const ImageWithLink = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: { default: null },
    }
  },
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
  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ({ node }: { node: any }) => {
      const img = document.createElement('img')
      img.src = node.attrs.src || ''
      if (node.attrs.alt) img.alt = node.attrs.alt
      if (node.attrs.title) img.title = node.attrs.title
      img.className = 'rich-img'
      if (node.attrs.href) img.dataset.href = node.attrs.href
      return { dom: img }
    }
  },
})

// ── YouTube埋め込みブロックノード ───────────────────────────────────
const YouTubeEmbed = Node.create({
  name: 'youtubeEmbed',
  group: 'block',
  atom: true,
  addAttributes() {
    return { videoId: { default: '' } }
  },
  parseHTML() {
    return [{
      tag: 'div[data-youtube]',
      getAttrs: (node) => {
        if (typeof node === 'string') return {}
        return { videoId: (node as HTMLElement).getAttribute('data-youtube') ?? '' }
      },
    }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-youtube': node.attrs.videoId }]
  },
  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ({ node }: { node: any }) => {
      const dom = document.createElement('div')
      dom.style.cssText =
        'background:#111;color:#fff;padding:10px 14px;margin:8px 0;max-width:480px;font-size:13px;display:flex;align-items:center;gap:8px;border-radius:4px;cursor:default;user-select:none;'
      dom.innerHTML = `<span style="font-size:20px">▶</span><div><div style="font-weight:bold;margin-bottom:2px">YouTube動画</div><code style="font-size:11px;opacity:0.7">${node.attrs.videoId}</code></div>`
      return { dom }
    }
  },
})

// ── Twitter/X埋め込みブロックノード ────────────────────────────────
const TwitterEmbed = Node.create({
  name: 'twitterEmbed',
  group: 'block',
  atom: true,
  addAttributes() {
    return { tweetId: { default: '' } }
  },
  parseHTML() {
    return [{
      tag: 'div[data-tweet]',
      getAttrs: (node) => {
        if (typeof node === 'string') return {}
        return { tweetId: (node as HTMLElement).getAttribute('data-tweet') ?? '' }
      },
    }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-tweet': node.attrs.tweetId }]
  },
  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ({ node }: { node: any }) => {
      const dom = document.createElement('div')
      dom.style.cssText =
        'background:#1da1f2;color:#fff;padding:10px 14px;margin:8px 0;max-width:480px;font-size:13px;display:flex;align-items:center;gap:8px;border-radius:4px;cursor:default;user-select:none;'
      dom.innerHTML = `<span style="font-size:18px;font-weight:bold;">𝕏</span><div><div style="font-weight:bold;margin-bottom:2px">ツイート埋め込み</div><code style="font-size:11px;opacity:0.85">${node.attrs.tweetId}</code></div>`
      return { dom }
    }
  },
})

// ── リンクカード埋め込みブロックノード ─────────────────────────────
const LinkCardEmbed = Node.create({
  name: 'linkCardEmbed',
  group: 'block',
  atom: true,
  addAttributes() {
    return { url: { default: '' } }
  },
  parseHTML() {
    return [{
      tag: 'div[data-link-card]',
      getAttrs: (node) => {
        if (typeof node === 'string') return {}
        return { url: (node as HTMLElement).getAttribute('data-link-card') ?? '' }
      },
    }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-link-card': node.attrs.url }]
  },
  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ({ node }: { node: any }) => {
      const dom = document.createElement('div')
      dom.style.cssText =
        'background:#f8fafc;border:1px solid #e2e8f0;padding:10px 14px;margin:8px 0;max-width:480px;font-size:12px;color:#334155;border-radius:4px;cursor:default;user-select:none;'
      dom.innerHTML = `<span style="opacity:0.5;font-size:14px">🔗</span> <span style="font-weight:bold;margin-bottom:2px;display:inline-block">リンクカード</span><div style="color:#2563eb;word-break:break-all;font-size:11px;margin-top:4px">${node.attrs.url}</div>`
      return { dom }
    }
  },
})

function toHtml(content: string): string {
  if (!content) return '<p></p>'
  if (content.trimStart().startsWith('<')) return content
  return content
    .split('\n')
    .map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`)
    .join('')
}

interface Props {
  content: string
  onChange: (html: string) => void
}

export function SummaryRichTextEditor({ content, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedImageHref, setSelectedImageHref] = useState<string | undefined>(undefined)
  const [toolbarFixed, setToolbarFixed] = useState(false)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [toolbarFixedStyle, setToolbarFixedStyle] = useState<CSSProperties>({})
  const lastLoadedContentRef = useRef<string | null>(null)

  // YouTube埋め込みダイアログ
  const [ytDialog, setYtDialog] = useState(false)
  const [ytUrl, setYtUrl] = useState('')
  const [ytError, setYtError] = useState('')

  // Twitter埋め込みダイアログ
  const [twDialog, setTwDialog] = useState(false)
  const [twUrl, setTwUrl] = useState('')
  const [twError, setTwError] = useState('')

  // リンクカードダイアログ
  const [lcDialog, setLcDialog] = useState(false)
  const [lcUrl, setLcUrl] = useState('')
  const [lcError, setLcError] = useState('')

  // スクロール時ツールバー固定
  useEffect(() => {
    const HEADER_H = 46
    const onScroll = () => {
      const wrapper = wrapperRef.current
      const toolbar = toolbarRef.current
      if (!wrapper || !toolbar) return
      const wRect = wrapper.getBoundingClientRect()
      const tHeight = toolbar.offsetHeight
      if (wRect.top < HEADER_H) {
        setToolbarFixed(true)
        setToolbarHeight(tHeight)
        setToolbarFixedStyle({ position: 'fixed', top: HEADER_H, left: wRect.left, width: wRect.width, zIndex: 40 })
      } else {
        setToolbarFixed(false)
        setToolbarHeight(0)
        setToolbarFixedStyle({})
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // エディタ内のリンクナビゲーションをブロック
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const blockAnchorNav = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a')) e.preventDefault()
    }
    el.addEventListener('click', blockAnchorNav, true)
    return () => el.removeEventListener('click', blockAnchorNav, true)
  }, [])

  const syncImageState = (ed: ReturnType<typeof useEditor>) => {
    if (!ed) return
    if (ed.isActive('image')) setSelectedImageHref(ed.getAttributes('image').href ?? '')
    else setSelectedImageHref(undefined)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'rich-link', target: '_blank', rel: 'noopener noreferrer' },
      }),
      ImageWithLink.configure({ HTMLAttributes: { class: 'rich-img' } }),
      YouTubeEmbed,
      TwitterEmbed,
      LinkCardEmbed,
    ],
    content: toHtml(content),
    onUpdate: ({ editor }) => { onChange(editor.getHTML()); syncImageState(editor) },
    onSelectionUpdate: ({ editor }) => { syncImageState(editor) },
    editorProps: {
      attributes: { class: 'summary-editor-content', spellCheck: 'false' },
    },
  })

  useEffect(() => {
    if (!editor || lastLoadedContentRef.current === content) return

    const nextHtml = toHtml(content)
    if (editor.getHTML() !== nextHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false })
    }
    lastLoadedContentRef.current = content
  }, [content, editor])

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

  const insertYouTube = () => {
    if (!editor) return
    const id = extractYouTubeId(ytUrl.trim())
    if (!id) { setYtError('YouTubeのURLを正しく入力してください'); return }
    editor.chain().focus().insertContent({ type: 'youtubeEmbed', attrs: { videoId: id } }).run()
    setYtDialog(false); setYtUrl(''); setYtError('')
  }

  const insertTwitter = () => {
    if (!editor) return
    const id = extractTweetId(twUrl.trim())
    if (!id) { setTwError('X(Twitter)のURLまたはツイートIDを入力してください'); return }
    editor.chain().focus().insertContent({ type: 'twitterEmbed', attrs: { tweetId: id } }).run()
    setTwDialog(false); setTwUrl(''); setTwError('')
  }

  const insertLinkCard = () => {
    if (!editor) return
    const url = lcUrl.trim()
    if (!url.startsWith('http')) { setLcError('https://... 形式でURLを入力してください'); return }
    editor.chain().focus().insertContent({ type: 'linkCardEmbed', attrs: { url } }).run()
    setLcDialog(false); setLcUrl(''); setLcError('')
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
      {toolbarFixed && <div style={{ height: toolbarHeight }} />}
      <div
        ref={toolbarRef}
        style={toolbarFixed ? toolbarFixedStyle : undefined}
        className={`flex flex-wrap gap-1 p-1.5 bg-gray-50 border-b border-gray-200 ${toolbarFixed ? 'shadow-md' : 'rounded-t'}`}
      >
        {/* 見出し */}
        {btn(editor.isActive('heading', { level: 2 }), 'H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), '見出し2')}
        {btn(editor.isActive('heading', { level: 3 }), 'H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), '見出し3')}
        <div className="w-px bg-gray-300 mx-0.5" />

        {/* 文字スタイル */}
        {btn(editor.isActive('bold'), 'B', () => editor.chain().focus().toggleBold().run(), '太字')}
        {btn(editor.isActive('italic'), 'I', () => editor.chain().focus().toggleItalic().run(), '斜体')}
        <div className="w-px bg-gray-300 mx-0.5" />

        {/* リンク */}
        {btn(editor.isActive('link'), '🔗 リンク', setLink, 'テキストを選択してクリック')}
        <div className="w-px bg-gray-300 mx-0.5" />

        {/* リスト */}
        {btn(editor.isActive('bulletList'), '• リスト', () => editor.chain().focus().toggleBulletList().run())}
        {btn(editor.isActive('orderedList'), '1. リスト', () => editor.chain().focus().toggleOrderedList().run())}
        <div className="w-px bg-gray-300 mx-0.5" />

        {/* 画像 */}
        <button type="button" disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50">
          {uploading ? '⏳ アップロード中...' : '🖼 画像'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { insertImage(f); e.target.value = '' } }} />

        {/* 画像リンク（画像選択中のみ） */}
        {selectedImageHref !== undefined && (
          <button type="button" onClick={setImageLink}
            className={`px-2 py-1 text-xs border rounded ${selectedImageHref ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {selectedImageHref ? '🔗 画像リンク変更' : '🔗 画像にリンク'}
          </button>
        )}

        <div className="w-px bg-gray-300 mx-0.5" />

        {/* 埋め込み */}
        <button type="button" onClick={() => { setYtUrl(''); setYtError(''); setYtDialog(true) }}
          className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
          ▶ YouTube
        </button>
        <button type="button" onClick={() => { setTwUrl(''); setTwError(''); setTwDialog(true) }}
          className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
          𝕏 ツイート
        </button>
        <button type="button" onClick={() => { setLcUrl(''); setLcError(''); setLcDialog(true) }}
          className="px-2 py-1 text-xs border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
          🔗 リンクカード
        </button>
      </div>

      <EditorContent editor={editor} />

      {/* ── YouTube埋め込みダイアログ ──────────────────────────── */}
      {ytDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setYtDialog(false) }}>
          <div className="bg-white rounded-lg shadow-xl w-80 p-4 space-y-3">
            <p className="font-bold text-sm text-gray-800">▶ YouTube動画を挿入</p>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">YouTubeのURL</label>
              <input type="text" value={ytUrl} onChange={e => { setYtUrl(e.target.value); setYtError('') }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full border border-gray-300 px-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-400"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') insertYouTube() }}
              />
              {ytError && <p className="text-xs text-red-600 mt-0.5">{ytError}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setYtDialog(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">
                キャンセル
              </button>
              <button type="button" onClick={insertYouTube}
                className="px-4 py-1.5 text-xs text-white rounded" style={{ background: '#dc2626' }}>
                挿入する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Twitter/X埋め込みダイアログ ────────────────────────── */}
      {twDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setTwDialog(false) }}>
          <div className="bg-white rounded-lg shadow-xl w-80 p-4 space-y-3">
            <p className="font-bold text-sm text-gray-800">𝕏 ツイートを挿入</p>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">X(Twitter)のURL またはツイートID</label>
              <input type="text" value={twUrl} onChange={e => { setTwUrl(e.target.value); setTwError('') }}
                placeholder="https://x.com/.../status/... または数字のID"
                className="w-full border border-gray-300 px-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-400"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') insertTwitter() }}
              />
              {twError && <p className="text-xs text-red-600 mt-0.5">{twError}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTwDialog(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">
                キャンセル
              </button>
              <button type="button" onClick={insertTwitter}
                className="px-4 py-1.5 text-xs text-white rounded" style={{ background: '#1da1f2' }}>
                挿入する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── リンクカードダイアログ ──────────────────────────────── */}
      {lcDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setLcDialog(false) }}>
          <div className="bg-white rounded-lg shadow-xl w-80 p-4 space-y-3">
            <p className="font-bold text-sm text-gray-800">🔗 リンクカードを挿入</p>
            <p className="text-xs text-gray-400">URLを貼ると、タイトル・説明・画像付きのリンクカードになります</p>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">URL</label>
              <input type="text" value={lcUrl} onChange={e => { setLcUrl(e.target.value); setLcError('') }}
                placeholder="https://..."
                className="w-full border border-gray-300 px-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-400"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') insertLinkCard() }}
              />
              {lcError && <p className="text-xs text-red-600 mt-0.5">{lcError}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLcDialog(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">
                キャンセル
              </button>
              <button type="button" onClick={insertLinkCard}
                className="px-4 py-1.5 text-xs text-white rounded" style={{ background: '#0d6efd' }}>
                挿入する
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .summary-editor-content {
          min-height: 300px;
          padding: 12px 14px;
          font-size: 14px;
          line-height: 1.75;
          outline: none;
        }
        .summary-editor-content p { margin-bottom: 0.75em; }
        .summary-editor-content p:last-child { margin-bottom: 0; }
        .summary-editor-content h2 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 1.4em;
          margin-bottom: 0.5em;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.25em;
        }
        .summary-editor-content h3 {
          font-size: 1.1em;
          font-weight: bold;
          margin-top: 1.2em;
          margin-bottom: 0.4em;
        }
        .summary-editor-content a, .rich-link { color: #2563eb; text-decoration: underline; }
        .summary-editor-content ul { list-style: disc; padding-left: 1.5em; margin-bottom: 0.75em; }
        .summary-editor-content ol { list-style: decimal; padding-left: 1.5em; margin-bottom: 0.75em; }
        .summary-editor-content li { margin-bottom: 0.25em; }
        .summary-editor-content strong { font-weight: bold; }
        .summary-editor-content em { font-style: italic; }
        .rich-img, .summary-editor-content img {
          max-width: 100%; height: auto; display: block; margin: 0.5em 0;
        }
        .summary-editor-content .ProseMirror-selectednode {
          outline: 3px solid #3b82f6;
          outline-offset: 2px;
        }
        .summary-editor-content img.ProseMirror-selectednode,
        .summary-editor-content .ProseMirror-selectednode img {
          box-shadow: 0 0 0 3px #3b82f6;
          outline: none;
        }
      `}</style>
    </div>
  )
}
