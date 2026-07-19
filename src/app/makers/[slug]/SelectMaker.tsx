'use client'

import { useEffect, useRef, useState } from 'react'
import type { SelectMakerConfig } from '@/lib/maker'
import type { DeckCard } from '@/lib/deck-maker'
import { CardCatalogSearchPanel } from '@/components/CardCatalogSearchPanel'
import { useCardCatalogSearch } from '@/hooks/use-card-catalog-search'
import { getMakerAnonymousId } from '@/lib/maker-events-shared'
import { recordMakerEvent, recordMakerPageView } from '@/lib/maker-events'
import { saveSelectSubmission } from './actions'
import { SelectMakerToolbar } from '@/components/SelectMakerToolbar'
import { renderSelectExportImage } from '@/lib/maker-select-export'

type Draft = { cards: DeckCard[]; title: string; comment: string; listPublic?: boolean; sessionId: string; submissionId: string | null; completedEventSent: boolean }

export default function SelectMaker({ slug, config, initialDraft }: { slug: string; config: SelectMakerConfig; initialDraft?: Draft }) {
  const storageKey = `select-maker:${slug}:v1`
  const [selected, setSelected] = useState<DeckCard[]>([])
  const { query, setQuery, cards: results, loading: resultsLoading, hasMore, loadMore } = useCardCatalogSearch({ makerSlug: slug })
  const [title, setTitle] = useState(config.defaultTitle)
  const [comment, setComment] = useState(config.defaultComment)
  const [sessionId, setSessionId] = useState('')
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [completedEventSent, setCompletedEventSent] = useState(false)
  const [message, setMessage] = useState('')
  const [zoom, setZoom] = useState<DeckCard | null>(null)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [pngPreview, setPngPreview] = useState<{ src: string; title: string; fileName: string } | null>(null)
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
        setSessionId(draft.sessionId || crypto.randomUUID())
        setSubmissionId(draft.submissionId ?? null); setCompletedEventSent(Boolean(draft.completedEventSent))
        void recordMakerEvent({ slug, eventType: 'draft_restored', anonymousId: getMakerAnonymousId() })
      } else setSessionId(crypto.randomUUID())
    } catch { setSessionId(crypto.randomUUID()) }
    hydrated.current = true
  }, [config, initialDraft, slug, storageKey])

  useEffect(() => {
    if (!hydrated.current || !sessionId) return
    localStorage.setItem(storageKey, JSON.stringify({ cards: selected, title, comment, sessionId, submissionId, completedEventSent }))
  }, [selected, title, comment, sessionId, submissionId, completedEventSent, storageKey])

  useEffect(() => {
    if (!pngPreview) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [pngPreview])

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
    return renderSelectExportImage({
      title: config.resultTitle,
      cards: selected,
      hasImage: card => Boolean(card.imageUrl),
      loadImage: card => new Promise<HTMLImageElement | null>(resolve => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => resolve(null)
        image.src = `/api/makers/${slug}/card-image?id=${card.id}`
      }),
    })
  }
  async function register(): Promise<string | null> { const activeSessionId = /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : crypto.randomUUID(); if (activeSessionId !== sessionId) setSessionId(activeSessionId); const result = await saveSelectSubmission({ slug, cardIds: selected.map(card => card.id), title, comment, sessionId: activeSessionId, submissionId }); setMessage(result.message); if (result.ok && result.submissionId) { setSubmissionId(result.submissionId); void recordMakerEvent({ slug, eventType: submissionId ? 'submission_updated' : 'submission_registered', anonymousId: getMakerAnonymousId() }); return result.submissionId } return null }
  async function saveImage() { if (!complete || isSavingImage) return; setIsSavingImage(true); void recordMakerEvent({ slug, eventType: 'image_save_started', anonymousId: getMakerAnonymousId() }); try { const blob = await drawImage(); const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob) }); setPngPreview({ src, title: title.trim() || config.resultTitle, fileName: `${slug}.png` }); void recordMakerEvent({ slug, eventType: 'image_saved', anonymousId: getMakerAnonymousId() }) } catch { setMessage('画像保存に失敗しました'); setIsSavingImage(false); return } try { await register() } catch { setMessage('一覧登録に失敗しました。画像は保存できます') } finally { setIsSavingImage(false) } }
  async function share() { if (!complete || isSharing) return; setIsSharing(true); const shareWindow = window.open('', '_blank'); try { const registeredId = await register(); void recordMakerEvent({ slug, eventType: 'x_shared', anonymousId: getMakerAnonymousId() }); const detail = registeredId ? `https://www.duema-bbs.com/makers/${slug}/submissions/${registeredId}` : `https://www.duema-bbs.com/makers/${slug}`; const intent = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: `${config.shareText}${config.hashtag ? `\n${config.hashtag}` : ''}`, url: detail })}`; if (shareWindow) shareWindow.location.href = intent; else window.open(intent, '_blank', 'noopener,noreferrer') } catch { shareWindow?.close(); setMessage('X共有の準備に失敗しました') } finally { setIsSharing(false) } }
  function reset() { setSelected([]); setTitle(config.defaultTitle); setComment(config.defaultComment); setSessionId(crypto.randomUUID()); setSubmissionId(null); setCompletedEventSent(false); setMessage('新しい作品を始めました'); void recordMakerEvent({ slug, eventType: 'new_draft_started', anonymousId: getMakerAnonymousId() }) }

  const submissionsUrl = config.submissionsUrl || `/makers/${slug}/submissions`
  const submissionsLabel = config.submissionsLabel || `みんなの${config.maxChoices}選を見る`

  return <>
    <SelectMakerToolbar
      title={title}
      comment={comment}
      showTitle={config.showTitle}
      showComment={config.showComment}
      listLabel={submissionsLabel}
      listUrl={submissionsUrl}
      complete={complete}
      isSavingImage={isSavingImage}
      isSharing={isSharing}
      message={message}
      onTitleChange={setTitle}
      onCommentChange={setComment}
      onSaveImage={() => void saveImage()}
      onShare={() => void share()}
      onReset={reset}
    />
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)] lg:items-start">
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><div className="flex items-center justify-between"><h2 className="font-black">選択済みカード <span className="sr-only">枚数</span></h2><strong>{selected.length} / {config.maxChoices}枚</strong></div>
      {selected.length === 0 ? <div className="mt-3 flex min-h-[150px] items-center justify-center rounded-xl bg-slate-100 px-5 text-center text-sm text-slate-500"><div><p className="font-bold text-slate-700">カードが選択されていません</p><p className="mt-1">右のカード検索から追加してください</p></div></div> : <div data-testid="selected-card-list" className="mt-3 grid grid-cols-3 gap-2">{selected.map((card, index) => <div key={`${card.id}-${index}`} className="relative aspect-[5/7] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"><button type="button" onClick={() => setZoom(card)} className="h-full w-full"><img src={card.imageUrl ?? '/images/card-placeholder.svg'} alt={card.name} className="h-full w-full object-contain" /></button><button type="button" onClick={() => remove(index)} aria-label={`${card.name}を削除`} className="absolute right-1 top-1 rounded-full bg-black/75 px-2 py-1 text-xs text-white">×</button>{config.reorderable && selected.length > 1 && <div className="absolute bottom-1 left-1 flex gap-1"><button type="button" onClick={() => move(index,-1)} disabled={index === 0} aria-label={`${card.name}を前へ移動`} className="rounded bg-white/90 px-2 disabled:opacity-40">←</button><button type="button" onClick={() => move(index,1)} disabled={index === selected.length - 1} aria-label={`${card.name}を後ろへ移動`} className="rounded bg-white/90 px-2 disabled:opacity-40">→</button></div>}</div>)}</div>}
      {!complete && <p className="mt-3 text-sm font-bold text-amber-700">あと{config.maxChoices - selected.length}枚選んでください</p>}
    </section>
    <CardCatalogSearchPanel cards={results} query={query} loading={resultsLoading} hasMore={hasMore} onLoadMore={loadMore} onSelect={add} onQueryChange={setQuery} selectedCount={card => selected.filter(item => item.id === card.id).length}/>
    {zoom && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(null)}><img src={zoom.imageUrl ?? '/images/card-placeholder.svg'} alt={zoom.name} className="max-h-[90vh] max-w-[90vw] object-contain"/></div>}
    {pngPreview && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/75 p-3" onMouseDown={(event) => { if (event.currentTarget === event.target) setPngPreview(null) }}><section role="dialog" aria-modal="true" aria-labelledby="select-png-preview-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-4 py-2"><div><h2 id="select-png-preview-title" className="font-black text-slate-900">{pngPreview.title}</h2><p className="text-xs text-slate-500">iPhoneでは画像を長押しして保存できます</p></div><button type="button" onClick={() => setPngPreview(null)} aria-label="画像プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-700 hover:bg-slate-100">×</button></div><div className="min-h-0 overscroll-contain overflow-auto bg-slate-100 p-2 sm:p-4"><img src={pngPreview.src} alt={`${pngPreview.title}の保存用画像`} className="mx-auto h-auto max-w-full shadow" /></div><div className="border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><a href={pngPreview.src} download={pngPreview.fileName} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-700 px-4 font-bold text-white">画像を保存</a></div></section></div>}
    </div>
  </>
}
