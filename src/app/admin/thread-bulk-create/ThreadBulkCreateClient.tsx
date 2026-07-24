'use client'

import { useMemo, useState, type ClipboardEvent, type ChangeEvent } from 'react'
import { DEFAULT_PUBLIC_AUTHOR_NAME } from '@/lib/cached-queries'
import { parseBulkThreadDraft, BULK_THREAD_COMMENT_LIMIT } from '@/lib/thread-bulk-create'
import { createConsentedBulkThread, rewriteBulkThreadDraft } from './actions'

type Item = {
  id: string
  body: string
  internalMemo: string
  permissionConfirmedOn: string
  textState: 'original' | 'lightly_edited'
}

const today = () => new Date().toISOString().slice(0, 10)
const makeItem = (body = ''): Item => ({
  id: crypto.randomUUID(),
  body,
  internalMemo: '',
  permissionConfirmedOn: today(),
  textState: 'original',
})

export function ThreadBulkCreateClient() {
  const [raw, setRaw] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [parsed, setParsed] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [message, setMessage] = useState('')

  const imageUrl = useMemo(() => image ? URL.createObjectURL(image) : '', [image])
  const choose = (file?: File) => { if (file?.type.startsWith('image/')) setImage(file) }
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const file = [...event.clipboardData.items].find(item => item.type.startsWith('image/'))?.getAsFile()
    if (file) {
      event.preventDefault()
      choose(file)
    }
  }
  const update = (id: string, patch: Partial<Item>) => {
    setItems(all => all.map(item => item.id === id ? { ...item, ...patch } : item))
  }
  const move = (index: number, offset: number) => {
    setItems(all => {
      const next = [...all]
      const target = index + offset
      if (target < 0 || target >= next.length) return all
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  const analyze = () => {
    const value = parseBulkThreadDraft(raw)
    if (!value) {
      setParsed(false)
      setMessage('先頭タイトルと、日時・「報告」を含む投稿番号1以降の生ログを確認してください。')
      return
    }
    setTitle(value.title)
    setBody(value.body)
    setItems(value.comments.map(makeItem))
    setParsed(true)
    setMessage('')
  }
  const rewrite = async () => {
    if (!parsed || rewriting || !title.trim()) return
    setRewriting(true)
    setMessage('')
    const result = await rewriteBulkThreadDraft({
      title,
      body,
      comments: items.map(item => item.body),
    })
    setRewriting(false)
    setMessage(result.message)
    if (!result.ok || result.title === undefined || result.body === undefined || !result.comments) return

    setTitle(result.title)
    setBody(result.body)
    setItems(all => all.map((item, index) => ({
      ...item,
      body: result.comments?.[index] ?? item.body,
      textState: 'lightly_edited',
    })))
  }
  const submit = async () => {
    if (!parsed || busy || !title.trim()) return
    if (!confirm(`スレッド1件とコメント${items.filter(item => item.body.trim()).length}件を登録します。`)) return
    setBusy(true)
    setMessage('')
    const fd = new FormData()
    fd.set('title', title)
    fd.set('body', body)
    fd.set('comments', JSON.stringify(items))
    if (image) fd.set('image', image)
    const result = await createConsentedBulkThread(fd)
    setBusy(false)
    setMessage(result.message)
    if (result.threadId) location.href = `/thread/${result.threadId}`
  }

  return <div onPaste={onPaste} className="space-y-4">
    <section className="rounded border bg-white p-3">
      <div className="mb-1 font-bold">スレ画（1枚・ファイル選択またはCtrl+V）</div>
      <p className="mb-2 text-xs text-gray-500">解析前でも選択・貼り付けできます。</p>
      <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0])}/>
      {image && <div className="mt-2">
        <img src={imageUrl} alt="スレ画プレビュー" className="max-h-64 rounded object-contain"/>
        <button onClick={() => setImage(null)} className="mt-1 text-red-600">削除</button>
      </div>}
    </section>

    <section className="rounded border bg-white p-3">
      <label className="mb-2 block font-bold">掲示板の生ログを貼り付け</label>
      <p className="mb-2 text-xs text-gray-500">先頭行をタイトル、投稿1を本文、投稿2以降をコメントとして解析します。</p>
      <textarea
        value={raw}
        onChange={event => setRaw(event.target.value)}
        rows={14}
        className="w-full rounded border p-2 font-mono text-sm"
        placeholder="スレッドタイトル&#10;1二次元好きの匿名さん26/07/11(土) 22:27:49報告&#10;投稿本文&#10;&#10;2二次元好きの匿名さん26/07/11(土) 22:29:24報告&#10;コメント本文"
      />
      <button onClick={analyze} className="mt-2 rounded bg-blue-600 px-4 py-2 font-bold text-white">原稿を解析</button>
    </section>

    {parsed && <>
      <section className="rounded border border-violet-200 bg-violet-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-violet-950">AIで掲示板らしく軽く整える</h2>
            <p className="mt-1 text-xs leading-relaxed text-violet-800">
              意味や主張は変えず、投稿ごとの語尾・句読点・文の長さ・口調にばらつきを付けます。投稿内の無駄な空行や、全レスが「。」で終わる不自然さも直します。
            </p>
          </div>
          <button
            disabled={rewriting || busy || !title.trim()}
            onClick={rewrite}
            className="shrink-0 rounded bg-violet-700 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {rewriting ? '整形中…' : '掲示板風に整形'}
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded border bg-white p-3">
        <label className="block font-bold">タイトル
          <input value={title} maxLength={100} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded border p-2 font-normal"/>
        </label>
        <label className="block font-bold">本文
          <textarea value={body} maxLength={5000} onChange={event => setBody(event.target.value)} rows={5} className="mt-1 w-full rounded border p-2 font-normal"/>
        </label>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">コメント（{items.length}/{BULK_THREAD_COMMENT_LIMIT}）</h2>
          <button disabled={items.length >= BULK_THREAD_COMMENT_LIMIT} onClick={() => setItems(value => [...value, makeItem()])} className="rounded border bg-white px-3 py-1">＋追加</button>
        </div>
        {items.map((item, index) => <article key={item.id} className="rounded border bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <b>#{index + 2}</b>
            <div className="space-x-2">
              <button onClick={() => move(index, -1)} disabled={!index}>↑</button>
              <button onClick={() => move(index, 1)} disabled={index === items.length - 1}>↓</button>
              <button onClick={() => setItems(value => value.filter(current => current.id !== item.id))} className="text-red-600">削除</button>
            </div>
          </div>
          <textarea value={item.body} maxLength={5000} onChange={event => update(item.id, { body: event.target.value })} rows={4} className="w-full rounded border p-2"/>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label>許可確認日
              <input type="date" value={item.permissionConfirmedOn} onChange={event => update(item.id, { permissionConfirmedOn: event.target.value })} className="block w-full rounded border p-2"/>
            </label>
            <label>文面
              <select value={item.textState} onChange={event => update(item.id, { textState: event.target.value as Item['textState'] })} className="block w-full rounded border p-2">
                <option value="original">元文のまま</option>
                <option value="lightly_edited">軽微な整文済み</option>
              </select>
            </label>
            <label>内部メモ
              <input value={item.internalMemo} onChange={event => update(item.id, { internalMemo: event.target.value })} className="block w-full rounded border p-2"/>
            </label>
          </div>
        </article>)}
      </section>

      <section className="rounded border-2 border-blue-200 bg-white p-3">
        <h2 className="mb-3 text-lg font-bold">公開プレビュー</h2>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="mt-2 whitespace-pre-wrap">{body}</p>
        {image && <img src={imageUrl} alt="" className="mt-3 max-h-80 object-contain"/>}
        <p className="my-3 font-bold">コメント {items.filter(item => item.body.trim()).length}件</p>
        {items.filter(item => item.body.trim()).map((item, index) => <div key={item.id} className="border-t py-3">
          <div className="text-xs text-gray-500">{index + 2} {DEFAULT_PUBLIC_AUTHOR_NAME}</div>
          <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
        </div>)}
      </section>

      <button disabled={busy || rewriting || !title.trim()} onClick={submit} className="w-full rounded bg-green-700 px-4 py-3 font-bold text-white disabled:opacity-50">
        {busy ? '登録中…' : '登録する'}
      </button>
    </>}
    {message && <p role="alert" className="rounded bg-yellow-50 p-3">{message}</p>}
  </div>
}
