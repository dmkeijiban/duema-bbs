'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { SelectMakerConfig } from '@/lib/maker'
import type { DeckCard } from '@/lib/deck-maker'
import { CardCatalogGrid } from '@/components/CardCatalogGrid'
import { useCardCatalogSearch } from '@/hooks/use-card-catalog-search'
import { getMakerAnonymousId } from '@/lib/maker-events-shared'
import { recordMakerEvent, recordMakerPageView } from '@/lib/maker-events'
import { saveSelectSubmission } from './actions'

type Draft = { cards: DeckCard[]; title: string; comment: string; listPublic: boolean; sessionId: string; submissionId: string | null; completedEventSent: boolean }

export default function SelectMaker({ slug, config, initialDraft }: { slug: string; title: string; config: SelectMakerConfig; initialDraft?: Draft }) {
  const storageKey = `select-maker:${slug}:v1`
  const [selected, setSelected] = useState<DeckCard[]>([])
  const { query, setQuery, cards: results, total: resultTotal, loading: resultsLoading, hasMore, loadMore } = useCardCatalogSearch({ makerSlug: slug })
  const [title, setTitle] = useState(config.defaultTitle)
  const [comment, setComment] = useState(config.defaultComment)
  const [listPublic, setListPublic] = useState(config.defaultListPublic)
  const [sessionId, setSessionId] = useState('')
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [completedEventSent, setCompletedEventSent] = useState(false)
  const [message, setMessage] = useState('')
  const [zoom, setZoom] = useState<DeckCard | null>(null)
  const [busy, setBusy] = useState(false)
  const hydrated = useRef(false)

  useEffect(() => {
    const viewId = crypto.randomUUID()
    void recordMakerPageView({ slug, viewId, anonymousId: getMakerAnonymousId() })
    try {
      const raw = localStorage.getItem(storageKey)
      if (initialDraft || raw) {
        const draft = initialDraft ?? JSON.parse(raw!) as Draft
        setSelected(Array.isArray(draft.cards) ? draft.cards.slice(0, config.maxChoices) : [])
        setTitle(draft.title ?? config.defaultTitle); setComment(draft.comment ?? config.defaultComment)
        setListPublic(draft.listPublic ?? config.defaultListPublic); setSessionId(draft.sessionId || crypto.randomUUID())
        setSubmissionId(draft.submissionId ?? null); setCompletedEventSent(Boolean(draft.completedEventSent))
        void recordMakerEvent({ slug, eventType: 'draft_restored', anonymousId: getMakerAnonymousId() })
      } else setSessionId(crypto.randomUUID())
    } catch { setSessionId(crypto.randomUUID()) }
    hydrated.current = true
  }, [config, initialDraft, slug, storageKey])

  useEffect(() => {
    if (!hydrated.current || !sessionId) return
    localStorage.setItem(storageKey, JSON.stringify({ cards: selected, title, comment, listPublic, sessionId, submissionId, completedEventSent }))
  }, [selected, title, comment, listPublic, sessionId, submissionId, completedEventSent, storageKey])

  useEffect(() => {
    if (!query.trim()) return
    const timer = setTimeout(() => void recordMakerEvent({ slug, eventType: 'card_searched', anonymousId: getMakerAnonymousId() }), 300)
    return () => clearTimeout(timer)
  }, [query, slug])

  function add(card: DeckCard) {
    if (selected.length >= config.maxChoices) return setMessage(`選べるのは最大${config.maxChoices}枚です`)
    if (selected.some(item => config.duplicateRule === 'card_name' ? item.name === card.name : item.id === card.id)) return setMessage('同じカード名は重複して選べません')
    const next = [...selected, card]; setSelected(next); setMessage('')
    void recordMakerEvent({ slug, eventType: selected.length ? 'card_added' : 'creation_started', anonymousId: getMakerAnonymousId() })
    if (next.length === config.maxChoices && !completedEventSent) { setCompletedEventSent(true); void recordMakerEvent({ slug, eventType: 'selection_completed', anonymousId: getMakerAnonymousId() }) }
  }
  function remove(index: number) { setSelected(items => items.filter((_, i) => i !== index)); void recordMakerEvent({ slug, eventType: 'card_removed', anonymousId: getMakerAnonymousId() }) }
  function move(index: number, delta: number) { const target = index + delta; if (target < 0 || target >= selected.length) return; const next = [...selected]; [next[index], next[target]] = [next[target], next[index]]; setSelected(next); void recordMakerEvent({ slug, eventType: 'card_reordered', anonymousId: getMakerAnonymousId() }) }
  const complete = config.exactChoices ? selected.length === config.maxChoices : selected.length >= config.minChoices

  async function drawImage() {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1500
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'; ctx.font = 'bold 52px sans-serif'; ctx.fillText(config.resultTitle.slice(0, 28), 600, 82)
    const columns = selected.length <= 3 ? selected.length : selected.length <= 9 ? 3 : 4
    const rows = Math.ceil(selected.length / columns); const gap = 18; const areaW = 1040; const areaH = 1150
    const cellW = (areaW - gap * (columns - 1)) / columns; const cellH = (areaH - gap * (rows - 1)) / rows
    const images = await Promise.all(selected.map(card => new Promise<HTMLImageElement | null>(resolve => { if (!card.imageUrl) return resolve(null); const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = `/api/makers/${slug}/card-image?id=${card.id}` })))
    images.forEach((image, index) => { const col = index % columns; const row = Math.floor(index / columns); const x = 80 + col * (cellW + gap); const y = 135 + row * (cellH + gap); ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x, y, cellW, cellH); if (image) { const scale = Math.min(cellW / image.width, cellH / image.height); const w = image.width * scale; const h = image.height * scale; ctx.drawImage(image, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h) } else { ctx.fillStyle = '#64748b'; ctx.font = '24px sans-serif'; ctx.fillText('画像なし', x + cellW / 2, y + cellH / 2) } })
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 42px sans-serif'; ctx.fillText(title.slice(0, 24), 600, 1350); ctx.font = '28px sans-serif'; ctx.fillText('デュエマ掲示板', 600, 1435)
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG生成に失敗しました')), 'image/png'))
  }
  async function register(): Promise<string | null> { if (!listPublic) return submissionId; const result = await saveSelectSubmission({ slug, cardIds: selected.map(card => card.id), title, comment, sessionId, submissionId }); setMessage(result.message); if (result.ok && result.submissionId) { setSubmissionId(result.submissionId); void recordMakerEvent({ slug, eventType: submissionId ? 'submission_updated' : 'submission_registered', anonymousId: getMakerAnonymousId() }); return result.submissionId } return null }
  async function saveImage() { if (!complete || busy) return; setBusy(true); void recordMakerEvent({ slug, eventType: 'image_save_started', anonymousId: getMakerAnonymousId() }); try { const blob = await drawImage(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${slug}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); void recordMakerEvent({ slug, eventType: 'image_saved', anonymousId: getMakerAnonymousId() }); await register() } catch { setMessage('画像保存に失敗しました') } finally { setBusy(false) } }
  async function share() { if (!complete) return; const registeredId = await register(); void recordMakerEvent({ slug, eventType: 'x_shared', anonymousId: getMakerAnonymousId() }); const detail = registeredId ? `https://www.duema-bbs.com/makers/${slug}/submissions/${registeredId}` : `https://www.duema-bbs.com/makers/${slug}`; window.open(`https://twitter.com/intent/tweet?${new URLSearchParams({ text: `${config.shareText}${config.hashtag ? `\n${config.hashtag}` : ''}`, url: detail })}`, '_blank', 'noopener,noreferrer') }
  function reset() { setSelected([]); setTitle(config.defaultTitle); setComment(config.defaultComment); setListPublic(config.defaultListPublic); setSessionId(crypto.randomUUID()); setSubmissionId(null); setCompletedEventSent(false); setMessage('新しい作品を始めました'); void recordMakerEvent({ slug, eventType: 'new_draft_started', anonymousId: getMakerAnonymousId() }) }

  return <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
    <section className="rounded-2xl border bg-white p-3 sm:p-5"><div className="flex items-center justify-between"><h2 className="font-black">選択済みカード</h2><strong>{selected.length} / {config.maxChoices}枚</strong></div>
      <div className="mt-3 grid grid-cols-3 gap-2">{Array.from({ length: config.maxChoices }, (_, index) => { const card = selected[index]; return <div key={card?.id ?? index} className="relative aspect-[5/7] overflow-hidden rounded-lg border bg-slate-100">{card ? <><button type="button" onClick={() => setZoom(card)} className="h-full w-full"><img src={card.imageUrl ?? '/images/card-placeholder.svg'} alt={card.name} className="h-full w-full object-contain" /></button><button type="button" onClick={() => remove(index)} className="absolute right-1 top-1 rounded-full bg-black/75 px-2 py-1 text-xs text-white">×</button>{config.reorderable && <div className="absolute bottom-1 left-1 flex gap-1"><button type="button" onClick={() => move(index,-1)} className="rounded bg-white/90 px-2">←</button><button type="button" onClick={() => move(index,1)} className="rounded bg-white/90 px-2">→</button></div>}</> : <span className="flex h-full items-center justify-center text-sm text-slate-400">{index + 1}</span>}</div> })}</div>
      {!complete && <p className="mt-3 text-sm font-bold text-amber-700">あと{config.maxChoices - selected.length}枚選んでください</p>}
      {config.showTitle && <label className="mt-4 block text-sm font-bold">投稿タイトル<input value={title} maxLength={40} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>}
      {config.showComment && <label className="mt-3 block text-sm font-bold">一言コメント<textarea value={comment} maxLength={200} onChange={e => setComment(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>}
      <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={listPublic} onChange={e => { setListPublic(e.target.checked); void recordMakerEvent({ slug, eventType: e.target.checked ? 'listing_enabled' : 'listing_disabled', anonymousId: getMakerAnonymousId() }) }} /><span>画像保存時に、みんなの{config.maxChoices}選にも掲載する<br/><small className="text-gray-500">掲載後も同じブラウザから編集・削除できます</small></span></label>
      {message && <p role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={!complete || busy} onClick={() => void saveImage()} className="rounded-xl bg-blue-700 px-3 py-3 font-bold text-white disabled:bg-gray-300">画像保存</button><button disabled={!complete} onClick={() => void share()} className="rounded-xl bg-black px-3 py-3 font-bold text-white disabled:bg-gray-300">X共有</button><button onClick={reset} className="rounded-xl border px-3 py-3 font-bold">新しく作る</button><Link href={`/makers/${slug}/submissions`} className="rounded-xl border px-3 py-3 text-center font-bold">みんなの{config.maxChoices}選を見る</Link></div>
    </section>
    <aside className="min-w-0 overflow-hidden rounded-2xl border bg-white lg:sticky lg:top-3"><div className="border-b border-slate-200 p-3"><h2 className="sr-only">カード検索</h2><div className="flex gap-2"><div className="relative min-w-0 flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="カード名で検索" aria-label="カード名検索" className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-10 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="検索文字をクリア" className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-slate-500">×</button>}</div><button type="button" aria-label="絞り込み（準備中）" title="絞り込みは今後対応予定" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-500">☷</button></div></div><CardCatalogGrid cards={results} total={resultTotal} query={query} loading={resultsLoading} hasMore={hasMore} onLoadMore={loadMore} onSelect={add} selectedCount={card => selected.filter(item => item.id === card.id).length}/></aside>
    {zoom && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(null)}><img src={zoom.imageUrl ?? '/images/card-placeholder.svg'} alt={zoom.name} className="max-h-[90vh] max-w-[90vw] object-contain"/></div>}
  </div>
}
