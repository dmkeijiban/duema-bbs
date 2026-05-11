'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { toggleFavorite } from '@/app/actions/thread'
import { subscribeToThread } from '@/app/actions/email-subscription'
import { getThreadViewerState } from '@/lib/thread-viewer-client'

interface Props {
  threadId: number
  initialFavorited?: boolean
}

export function FavoriteButton({ threadId, initialFavorited = false }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [isPending, startTransition] = useTransition()

  // メール入力 UI の状態
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [emailError, setEmailError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    getThreadViewerState(threadId)
      .then(data => {
        if (!cancelled) setFavorited(data.isFavorited)
      })
    return () => {
      cancelled = true
    }
  }, [threadId])

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleFavorite(threadId)
      setFavorited(result.favorited)
      if (result.favorited) {
        // お気に入り追加時だけメール入力欄を表示
        setShowEmailForm(true)
        setEmailStatus('idle')
        setEmail('')
        setEmailError('')
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        setShowEmailForm(false)
      }
    })
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setShowEmailForm(false)
      return
    }
    setEmailStatus('sending')
    const result = await subscribeToThread(threadId, email)
    if (result.error) {
      setEmailStatus('error')
      setEmailError(result.error)
    } else {
      setEmailStatus('done')
      setTimeout(() => setShowEmailForm(false), 1800)
    }
  }

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-2xl leading-none disabled:opacity-50 transition-colors"
        style={{ color: favorited ? '#f5a623' : '#aaa' }}
        title={favorited ? 'お気に入りを解除' : 'お気に入りに追加'}
      >
        {favorited ? '★' : '☆'}
      </button>

      {showEmailForm && (
        <span className="inline-flex items-center gap-1 flex-wrap text-xs">
          {emailStatus === 'done' ? (
            <span className="text-green-600 font-medium">📧 登録しました！</span>
          ) : (
            <form onSubmit={handleEmailSubmit} className="inline-flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 whitespace-nowrap">返信通知メール</span>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="メールアドレス（任意）"
                disabled={emailStatus === 'sending'}
                className="border border-gray-300 px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-400 disabled:opacity-50"
                style={{ width: 170 }}
              />
              <button
                type="submit"
                disabled={emailStatus === 'sending'}
                className="px-2 py-0.5 text-white text-xs disabled:opacity-50"
                style={{ background: '#0d6efd' }}
              >
                {emailStatus === 'sending' ? '…' : '登録'}
              </button>
              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="px-1.5 py-0.5 text-gray-500 text-xs border border-gray-300 hover:bg-gray-100"
              >
                スキップ
              </button>
              {emailStatus === 'error' && (
                <span className="text-red-500">{emailError}</span>
              )}
            </form>
          )}
        </span>
      )}
    </span>
  )
}
