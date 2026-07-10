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

          return (
            <button
              key={option.id}
              type="button"
              disabled={isPending}
              onClick={() => handleVote(option.id)}
              className={`relative min-h-11 overflow-hidden border bg-white text-left text-sm transition-colors ${
                selected
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : correct && viewerState?.hasVoted
                    ? 'border-green-500'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              } disabled:cursor-wait disabled:opacity-80`}
            >
              {option.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageUrl(option.imageUrl) ?? option.imageUrl}
                  alt={option.label}
                  className="block aspect-[4/3] w-full border-b border-gray-200 bg-gray-100 object-contain object-top"
                />
              )}
              {hasImages && !option.imageUrl && (
                <span className="flex aspect-[4/3] w-full items-center justify-center border-b border-gray-200 bg-gray-100 text-xs text-gray-400">
                  画像なし
                </span>
              )}
              {viewerState?.hasVoted && (
                <span
                  className="absolute bottom-0 left-0 top-auto h-10 bg-blue-100/70"
                  style={{ width: `${percentage}%` }}
                  aria-hidden="true"
                />
              )}
              <span className="relative flex min-h-10 items-center justify-between gap-2 px-3 py-2">
                <span className="break-words font-medium text-gray-800">{option.label}</span>
                {viewerState?.hasVoted && (
                  <span className="shrink-0 text-xs font-bold text-gray-600">
                    {percentage}%<span className="ml-1 font-normal text-gray-400">({resultOption?.voteCount ?? 0})</span>
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {isPending && <p className="mt-2 text-xs text-gray-500">送信中…</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
