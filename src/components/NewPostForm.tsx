'use client'

import { useRef, useState, useTransition } from 'react'
import { createPost } from '@/app/actions/thread'
import { ImageUploadField } from './ImageUploadField'
import { Send, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  threadId: number
}

export function NewPostForm({ threadId }: Props) {
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const formData = new FormData(e.currentTarget)
    formData.set('thread_id', String(threadId))

    startTransition(async () => {
      const result = await createPost(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        formRef.current?.reset()
        setIsOpen(false)
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      }
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <span className="font-semibold text-gray-800 dark:text-gray-200">レスを書く</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {isOpen && (
        <form ref={formRef} onSubmit={handleSubmit} className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">名前（省略可）</label>
              <input
                type="text"
                name="author_name"
                placeholder="名無しのデュエリスト"
                maxLength={30}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">本文 *</label>
            <textarea
              name="body"
              required
              rows={5}
              maxLength={3000}
              placeholder="レスを入力してください..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 resize-y"
            />
          </div>

          <ImageUploadField name="image" />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Send className="w-4 h-4" />
            {isPending ? '送信中...' : 'レスする'}
          </button>
        </form>
      )}
    </div>
  )
}
