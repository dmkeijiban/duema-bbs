'use client'

import { useTransition, useState } from 'react'
import { createThread } from '@/app/actions/thread'
import { Category } from '@/types'

interface Props {
  categories: Category[]
}

export function InlineNewThread({ categories }: Props) {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createThread(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div id="resform" className="mt-3 border border-gray-300 bg-white">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
        <span style={{ color: '#0d6efd', fontSize: 14 }}>🚩</span>
        <span className="font-medium text-sm" style={{ color: '#212529' }}>新規スレッド作成</span>
      </div>

      <>
          {/* ルール */}
          <div className="px-4 py-3 text-xs border-b border-gray-200 leading-relaxed"
            style={{ background: '#d1ecf1', color: '#0c5460' }}>
            1.<span className="font-medium" style={{ color: '#721c24' }}>重複や似たスレッドがないか必ず確認してください。</span><br />
            2.単発スレは最終更新から一定時間で落ちます。<br />
            &nbsp;&nbsp;&nbsp;通常スレも一定日数更新がない時は落ちます。<br />
            3.フライング(早バレ)・リーク情報の話題は禁止です。<br />
            4.タイトルでのネタバレを避けてください。<br />
            5.画像は権利を侵害しない物を添付してください。<br />
            6.ミスで立てたスレは必ずスレ削除を押してください。<br />
            7.他人が不快になるようなタイトルは避けてください。ニッチな内容の場合タイトルに注意書きを入れてください。<br />
            8.スレッド作成は承認制とする場合があります。<br />
            9.スレッドやレスの削除は落ちてから10日間経つと操作できなくなります。
          </div>

          {/* フォーム */}
          <form onSubmit={handleSubmit}>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr>
                  <td className="py-2 pr-3 pl-4 text-right whitespace-nowrap text-gray-600 align-middle"
                    style={{ width: 80 }}>タイトル</td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      name="title"
                      required
                      maxLength={100}
                      placeholder="スレッドタイトルを入力(64文字以内)"
                      className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 pl-4 text-right text-gray-600 align-middle">カテゴリ</td>
                  <td className="py-2 pr-4">
                    <select
                      name="category_id"
                      className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      style={{ minWidth: 200 }}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 pl-4 text-right text-gray-600 align-middle">名前</td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      name="author_name"
                      maxLength={15}
                      placeholder="名前を入力(15文字以内・空欄可)"
                      className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      style={{ width: 200 }}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 pl-4 text-right text-gray-600 align-top pt-3">本文</td>
                  <td className="py-2 pr-4">
                    <textarea
                      name="body"
                      required
                      rows={10}
                      placeholder="本文を入力 (最大30行/1000文字まで)"
                      className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 resize-y"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 pl-4 text-right text-gray-600 align-middle">画像</td>
                  <td className="py-2 pr-4">
                    <input
                      type="file"
                      name="image"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="text-sm cursor-pointer file:mr-2 file:px-3 file:py-1 file:border file:border-gray-400 file:bg-gray-200 file:text-gray-700 file:text-sm file:cursor-pointer hover:file:bg-gray-300"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 pl-4 text-right text-gray-600"></td>
                  <td className="py-3 pr-4">
                    {error && (
                      <div className="mb-2 px-3 py-2 text-sm" style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }}>
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isPending}
                      id="respost"
                      className="px-12 py-2 text-white text-sm font-medium disabled:opacity-60"
                      style={{ backgroundColor: '#0d6efd' }}
                    >
                      {isPending ? '投稿中...' : '投稿する'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </form>
        </>
    </div>
  )
}
