'use client'

import { useState, useTransition } from 'react'
import { sendContact } from '@/app/actions/contact'
import Link from 'next/link'

export default function ContactPage() {
  const [subject, setSubject] = useState('')
  const [email, setEmail] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const fd = new FormData()
    fd.set('subject', subject)
    fd.set('email', email)
    fd.set('body', body)
    startTransition(async () => {
      const res = await sendContact(fd)
      if (res.error) {
        setError(res.error)
      } else {
        setSent(true)
      }
    })
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>お問い合わせ</span>
      </nav>

      <div className="bg-white border border-gray-300 max-w-2xl">
        {/* ヘッダー */}
        <div className="px-4 py-3 text-center font-bold text-white" style={{ background: '#888' }}>
          デュエマ掲示板お問い合わせ
        </div>

        {sent ? (
          <div className="px-6 py-8 text-center">
            <p className="text-green-700 font-medium mb-4">お問い合わせを送信しました。</p>
            <Link href="/" className="text-blue-600 hover:underline">トップへ戻る</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-3 px-4 whitespace-nowrap align-middle" style={{ background: '#f5f5f5', width: 130 }}>
                    件名 <span className="text-red-500 text-xs font-bold">必須</span>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      required
                      className="border border-gray-300 px-2 py-1.5 text-sm bg-white"
                      style={{ minWidth: 200 }}
                    >
                      <option value=""></option>
                      <option value="スレ・レスの削除依頼">スレ・レスの削除依頼</option>
                      <option value="規約違反の報告">規約違反の報告</option>
                      <option value="不具合・バグ報告">不具合・バグ報告</option>
                      <option value="ご意見・ご要望">ご意見・ご要望</option>
                      <option value="その他">その他</option>
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 px-4 align-middle" style={{ background: '#f5f5f5' }}>
                    メールアドレス
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="border border-gray-300 px-2 py-1.5 text-sm"
                      style={{ width: 260 }}
                      placeholder="返信が必要な場合は入力"
                    />
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 px-4 align-top pt-3" style={{ background: '#f5f5f5' }}>
                    本文 <span className="text-red-500 text-xs font-bold">必須</span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-xs mb-1" style={{ color: '#dc3545' }}>（削除依頼の場合URLを必ず明記）</p>
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      required
                      rows={6}
                      className="w-full border border-gray-300 px-2 py-1.5 text-sm resize-y focus:outline-none focus:border-blue-400"
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {error && (
              <div className="mx-4 my-2 px-3 py-2 text-sm" style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }}>
                {error}
              </div>
            )}

            <div className="px-4 py-4 flex items-center gap-3">
              <Link
                href="/"
                className="px-4 py-2 border border-gray-400 text-sm text-gray-700 hover:bg-gray-50"
              >
                トップへ戻る
              </Link>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-2 text-sm text-white disabled:opacity-60"
                style={{ background: '#aaa' }}
              >
                {isPending ? '送信中...' : '送信する'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
