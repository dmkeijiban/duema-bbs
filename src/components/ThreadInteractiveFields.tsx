'use client'

import { Fragment, useState } from 'react'
import type { ThreadPollKind } from '@/lib/thread-poll'

type ThreadKind = 'normal' | ThreadPollKind

export function ThreadInteractiveFields({ enabled }: { enabled: boolean }) {
  const [kind, setKind] = useState<ThreadKind>('normal')
  const [optionCount, setOptionCount] = useState(2)
  const [correctIndex, setCorrectIndex] = useState(0)

  const changeKind = (nextKind: ThreadKind) => {
    setKind(nextKind)
    setOptionCount(2)
    setCorrectIndex(0)
  }

  if (!enabled) return null

  return (
    <>
      <tr className="border-b border-gray-200">
        <td className="py-2 px-2 align-top text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5', paddingTop: 10 }}>
          形式
        </td>
        <td className="py-2 px-2 min-w-0 sm:px-3">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {([
              ['normal', '通常'],
              ['poll', '投票'],
              ['quiz', 'クイズ'],
            ] as const).map(([value, label]) => (
              <label key={value} className="inline-flex min-h-7 cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="thread_kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => changeKind(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </td>
      </tr>

      {kind !== 'normal' && (
        <>
          <input type="hidden" name="poll_option_count" value={optionCount} />
          {kind === 'quiz' && (
            <tr className="border-b border-gray-200">
              <td className="py-2 px-2 align-top text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5', paddingTop: 10 }}>
                問題画像
              </td>
              <td className="py-2 px-2 text-xs leading-relaxed text-gray-600 sm:px-3">
                下の「画像」に添付した画像が、そのままクイズの問題画像になります。
              </td>
            </tr>
          )}

          {Array.from({ length: optionCount }, (_, index) => (
            <Fragment key={index}>
              <tr className="border-b border-gray-200">
                <td className="py-2 px-2 align-top text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5', paddingTop: 10 }}>
                  選択肢{index + 1}
                </td>
                <td className="space-y-2 py-2 px-2 min-w-0 sm:px-3">
                  <div className="flex items-center gap-2">
                    {kind === 'quiz' && (
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-medium text-green-700">
                        <input
                          type="radio"
                          name="quiz_correct_index"
                          value={index}
                          checked={correctIndex === index}
                          onChange={() => setCorrectIndex(index)}
                        />
                        正解
                      </label>
                    )}
                    <input
                      type="text"
                      name={`poll_option_label_${index}`}
                      required
                      maxLength={60}
                      placeholder={`選択肢${index + 1}`}
                      className="w-full min-w-0 border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  {kind === 'poll' && (
                    <div>
                      <span className="mb-1 block text-[11px] text-gray-500">選択肢の画像（任意）</span>
                      <input
                        type="file"
                        name={`poll_option_image_${index}`}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="block w-full max-w-full min-w-0 text-xs cursor-pointer file:mr-2 file:px-2 file:py-1 file:border file:border-gray-400 file:bg-gray-200 file:text-gray-700 file:text-xs file:cursor-pointer hover:file:bg-gray-300"
                      />
                    </div>
                  )}
                </td>
              </tr>
            </Fragment>
          ))}

          <tr className="border-b border-gray-200">
            <td className="py-2 px-2 text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5' }}>
              選択肢数
            </td>
            <td className="flex gap-2 py-2 px-2 sm:px-3">
              <button
                type="button"
                disabled={optionCount <= 2}
                onClick={() => {
                  const nextCount = Math.max(2, optionCount - 1)
                  setOptionCount(nextCount)
                  if (correctIndex >= nextCount) setCorrectIndex(nextCount - 1)
                }}
                className="min-h-8 border border-gray-300 bg-white px-3 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                − 減らす
              </button>
              <button
                type="button"
                disabled={optionCount >= 4}
                onClick={() => setOptionCount(Math.min(4, optionCount + 1))}
                className="min-h-8 border border-gray-300 bg-white px-3 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ＋ 増やす
              </button>
              <span className="self-center text-xs text-gray-500">2〜4択</span>
            </td>
          </tr>
        </>
      )}
    </>
  )
}
