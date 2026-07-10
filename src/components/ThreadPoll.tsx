'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { getThreadPollViewerState, voteThreadPoll } from '@/app/actions/thread-poll'
import { capturePostHogEvent } from '@/lib/posthog-events'
import { resolveImageUrl } from '@/lib/utils'
import type { ThreadPoll as ThreadPollData, ThreadPollViewerState } from '@/lib/thread-poll'

interface Props {
  threadId: number
  poll: ThreadPollData
  onWriteReason: (label: string, kind: ThreadPollData['kind']) => void
}

export function ThreadPoll({ threadId, poll, onWriteReason }: Props) {
  const [viewerState, setViewerState] = useState<ThreadPollViewerState | null>(null)
  const [error, setError] = useState('')
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const voteInFlightRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    getThreadPollViewerState(threadId).then(result => {
      if (cancelled || voteInFlightRef.current) return
      if (result.state) setViewerState(result.state)
    })
    return () => {
      cancelled = true
    }
  }, [threadId])

  useEffect(() => {
    if (!expandedImage) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedImage(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedImage])

  const hasImages = poll.options.some(option => option.imageUrl)
  const resultOptions = viewerState?.options
  const correctOption = resultOptions?.find(option => option.isCorrect)
  const desktopGridClass = poll.options.length === 4
    ? 'md:grid-cols-4'
    : poll.options.length === 3
      ? 'md:grid-cols-3'
      : 'md:grid-cols-2'

  const handleVote = (optionId: number) => {
    if (isPending) return

    const previousState = viewerState
    const chosen = poll.options.find(option => option.id === optionId)
    const previouslySelectedId = previousState?.selectedOptionId ?? null
    const hadVoted = previousState?.hasVoted === true

    setError('')
    voteInFlightRef.current = true

    // 保存完了を待たず、選択結果とコメント導線を先に反映する
    setViewerState(current => {
      const currentHadVoted = current?.hasVoted === true
      const currentSelectedId = current?.selectedOptionId ?? null
      const options = (current?.options ?? poll.options.map(option => ({
        ...option,
        voteCount: 0,
        isCorrect: false,
      }))).map(option => {
        let voteCount = option.voteCount
        if (currentHadVoted && currentSelectedId !== optionId && option.id === currentSelectedId) {
          voteCount = Math.max(0, voteCount - 1)
        }
        if ((!currentHadVoted || currentSelectedId !== optionId) && option.id === optionId) {
          voteCount += 1
        }
        return { ...option, voteCount }
      })

      return {
        hasVoted: true,
        selectedOptionId: optionId,
        totalVotes: (current?.totalVotes ?? 0) + (currentHadVoted ? 0 : 1),
        options,
      }
    })
    if (chosen) onWriteReason(chosen.label, poll.kind)

    startTransition(async () => {
      try {
        const result = await voteThreadPoll(threadId, optionId)
        if (result.error) {
          setViewerState(previousState)
          setError(result.error)
          return
        }
        if (result.state) {
          setViewerState(result.state)
          capturePostHogEvent('thread_poll_vote', {
            thread_id: threadId,
            poll_kind: poll.kind,
            option_id: optionId,
            changed: hadVoted && previouslySelectedId !== optionId,
          })
        }
      } finally {
        voteInFlightRef.current = false
      }
    })
  }

  return (
    <div className="mx-3 mb-3 border border-gray-300 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
          {poll.kind === 'quiz' ? 'クイズ' : '投票'}
        </span>
        <span className="text-xs font-medium text-gray-600">総投票数 {viewerState?.totalVotes ?? 0}票</span>
      </div>

      {poll.kind === 'quiz' && viewerState?.hasVoted && correctOption && (
        <div
          className={`mb-3 border px-3 py-2 text-sm font-bold ${
            viewerState.selectedOptionId === correctOption.id
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-700'
          }`}
        >
          {viewerState.selectedOptionId === correctOption.id
            ? '正解！'
            : `不正解。正解は「${correctOption.label}」です。`}
        </div>
      )}

      <div className={hasImages ? `grid grid-cols-2 gap-2 ${desktopGridClass}` : 'space-y-2'}>
        {poll.options.map(option => {
          const resultOption = resultOptions?.find(item => item.id === option.id)
          const percentage = viewerState?.totalVotes
            ? Math.round(((resultOption?.voteCount ?? 0) / viewerState.totalVotes) * 100)
            : 0
          const selected = viewerState?.selectedOptionId === option.id
          const correct = poll.kind === 'quiz' && resultOption?.isCorrect

          const imageSrc = option.imageUrl
            ? (resolveImageUrl(option.imageUrl) ?? option.imageUrl)
            : null
          const voteButtonLabel = selected
            ? (poll.kind === 'quiz' ? '回答済み' : '選択中')
            : viewerState?.hasVoted
              ? (poll.kind === 'quiz' ? 'この回答に変更' : 'こちらに変更')
              : poll.kind === 'quiz'
                ? 'この回答を選ぶ'
                : hasImages
                  ? 'このカードに投票'
                  : 'この選択肢に投票'

          return (
            <div
              key={option.id}
              className={`relative flex h-full min-h-11 flex-col overflow-hidden border bg-white text-left text-sm ${
                selected
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : correct && viewerState?.hasVoted
                    ? 'border-green-500'
                    : 'border-gray-300'
              }`}
            >
              {imageSrc && (
                <button
                  type="button"
                  onClick={() => setExpandedImage({ src: imageSrc, alt: option.label })}
                  className="group relative block aspect-[4/3] w-full shrink-0 cursor-zoom-in border-b border-gray-200 bg-gray-100"
                  aria-label={`${option.label}の画像を拡大表示`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt={option.label}
                    className="block h-full w-full object-contain object-center group-hover:opacity-90"
                  />
                </button>
              )}
              {hasImages && !imageSrc && (
                <span className="flex aspect-[4/3] w-full shrink-0 items-center justify-center border-b border-gray-200 bg-gray-100 text-xs text-gray-400">
                  画像なし
                </span>
              )}
              <div className="relative flex min-h-[4.75rem] flex-1 flex-col items-start gap-1 overflow-hidden px-3 py-2 md:min-h-10 md:flex-row md:items-center md:justify-between md:gap-2">
                {viewerState?.hasVoted && (
                  <span
                    className="absolute inset-y-0 left-0 bg-blue-100/70"
                    style={{ width: `${percentage}%` }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative break-words font-medium text-gray-800">{option.label}</span>
                {viewerState?.hasVoted && (
                  <span className="relative block shrink-0 text-xs font-bold text-gray-600 md:inline">
                    {percentage}%<span className="ml-1 font-normal text-gray-400">({resultOption?.voteCount ?? 0})</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={isPending || selected}
                onClick={() => handleVote(option.id)}
                className={`relative mx-2 mb-2 min-h-9 border px-2 py-1.5 text-center text-xs font-bold transition-colors ${
                  selected
                    ? 'cursor-default border-blue-500 bg-blue-600 text-white'
                    : 'border-blue-500 bg-white text-blue-700 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-70'
                }`}
              >
                {voteButtonLabel}
              </button>
            </div>
          )
        })}
      </div>

      {isPending && <p className="mt-2 text-xs text-gray-500">送信中…</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {expandedImage && (
        <div
          className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/85"
          onClick={() => setExpandedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${expandedImage.alt}の拡大画像`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedImage.src}
            alt={expandedImage.alt}
            onClick={event => event.stopPropagation()}
            className="block h-[95vh] w-[95vw] cursor-default object-contain"
          />
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute right-4 top-3 text-3xl leading-none text-white/80"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
