'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'

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
  minHeight?: number
}

export function SettingRichEditor({ content, onChange, minHeight = 80 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
    ],
    content: toHtml(content),
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'setting-rich-editor', spellCheck: 'false' },
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

  if (!editor) return null

  return (
    <div className="border border-gray-300 rounded overflow-hidden">
      <div className="flex flex-wrap gap-1 p-1.5 bg-gray-50 border-b border-gray-200">
        <button type="button" onClick={setLink}
          className={`px-2 py-1 text-xs border rounded ${editor.isActive('link') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          title="テキストを選択してクリック">
          🔗 テキストリンク
        </button>
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .setting-rich-editor {
          min-height: ${minHeight}px;
          padding: 8px 10px;
          font-size: 12px;
          line-height: 1.6;
          outline: none;
        }
        .setting-rich-editor p { margin-bottom: 0.4em; }
        .setting-rich-editor p:last-child { margin-bottom: 0; }
        .setting-rich-editor a { color: #2563eb; text-decoration: underline; cursor: pointer; }
      `}</style>
    </div>
  )
}
