'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import {
  DECK_STORAGE_KEY,
  DECK_STORAGE_VERSION,
  MAX_DECK_CARDS,
  MAX_SAME_CARD,
  deckSize,
  type DeckCard,
  type DeckEntry,
} from '@/lib/deck-maker'
import { CardCatalogSearchPanel } from '@/components/CardCatalogSearchPanel'
import { useCardCatalogSearch } from '@/hooks/use-card-catalog-search'
import { publishDeck } from './actions'

const OFFICIAL_ORIGIN = 'https://dm.takaratomy.co.jp'
const DEFAULT_DECK_NAME = 'メインデッキ'
const MAX_DECK_NAME_LENGTH = 60
const SAVED_DECKS_STORAGE_KEY = 'duema-bbs:deck-maker:saved-decks'
const proxy = (url: string) => `/api/card-image?url=${encodeURIComponent(url)}`
const loadedImageUrls = new Set<string>()
const prefetchedImageUrls = new Set<string>()

function thumbnailUrl(card: DeckCard) {
  const sourceKey = card.sourceKey?.trim()
  if (sourceKey && /^[a-zA-Z0-9_-]+$/.test(sourceKey)) {
    return `${OFFICIAL_ORIGIN}/wp-content/card/cardthumb/${sourceKey}.jpg`
  }
  return card.imageUrl
}

type SavedDeck = {
  id: string
  name: string
  entries: DeckEntry[]
  createdAt: string
  updatedAt: string
}

function pngFileName(deckName: string) {
  const safeName = deckName.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_').trim().slice(0, MAX_DECK_NAME_LENGTH)
  return `${safeName || DEFAULT_DECK_NAME}.png`
}

function safeOfficialUrl(value: unknown, kind: 'image' | 'page') {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.origin !== OFFICIAL_ORIGIN || url.hash) return null
    if (kind === 'page' && (url.pathname !== '/card/detail/' || !url.searchParams.get('id') || [...url.searchParams.keys()].some((key) => key !== 'id'))) return null
    if (kind === 'image' && (url.search || !['/wp-content/card/cardimage/', '/wp-content/card/cardthumb/', '/wp-content/themes/dm2019/img/product/'].some((prefix) => url.pathname.startsWith(prefix)))) return null
    return url.href
  } catch {
    return null
  }
}

function safeCard(card: DeckCard): DeckCard {
  return {
    ...card,
    sourceKey: typeof card.sourceKey === 'string' ? card.sourceKey.slice(0, 100) : null,
    name: typeof card.name === 'string' ? card.name.slice(0, 200) : '',
    nameKana: typeof card.nameKana === 'string' ? card.nameKana.slice(0, 200) : null,
    imageUrl: safeOfficialUrl(card.imageUrl, 'image'),
    officialPageUrl: safeOfficialUrl(card.officialPageUrl, 'page'),
    matchedFace: card.matchedFace && typeof card.matchedFace.name === 'string' && Number.isInteger(card.matchedFace.sideIndex) ? {
      name: card.matchedFace.name.slice(0, 200),
      imageUrl: safeOfficialUrl(card.matchedFace.imageUrl, 'image'),
      sideIndex: card.matchedFace.sideIndex,
      sideKind: typeof card.matchedFace.sideKind === 'string' ? card.matchedFace.sideKind.slice(0, 50) : null,
    } : null,
  }
}

function printingKey(card: DeckCard) {
  return `${card.id}:${card.sourceKey ?? 'representative'}:${card.matchedFace?.sideIndex ?? 'front'}`
}

function safeEntries(values: unknown): DeckEntry[] {
  if (!Array.isArray(values)) return []
  let remaining = MAX_DECK_CARDS
  const countsByCard = new Map<string, number>()
  const restored: DeckEntry[] = []
  for (const value of values as DeckEntry[]) {
    if (!value || typeof value.id !== 'string' || value.id.length > 100 || !Number.isInteger(value.count) || remaining <= 0) continue
    const sameNameRemaining = MAX_SAME_CARD - (countsByCard.get(value.id) ?? 0)
    const count = Math.min(sameNameRemaining, Math.max(0, value.count), remaining)
    if (!count) continue
    restored.push({ ...safeCard(value), id: value.id, count })
    countsByCard.set(value.id, (countsByCard.get(value.id) ?? 0) + count)
    remaining -= count
  }
  return restored
}

async function resolveStoredEntries(entries: DeckEntry[]) {
  if (!entries.length) return entries
  const response = await fetch('/api/cards/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: entries.map((entry) => entry.id), sourceKeys: entries.flatMap((entry) => entry.sourceKey ? [entry.sourceKey] : []) }),
  })
  const payload = await response.json() as { cards?: DeckCard[]; aliases?: { oldSourceKey: string; card: DeckCard }[] }
  const latest = new Map((payload.cards ?? []).map((card) => [card.id, safeCard(card)]))
  const aliases = new Map((payload.aliases ?? []).map((alias) => [alias.oldSourceKey, safeCard(alias.card)]))
  return entries.map((entry) => {
    const resolved = entry.sourceKey ? aliases.get(entry.sourceKey) : null
    const fallback = latest.get(entry.id)
    return { ...entry, ...(resolved ?? (!entry.sourceKey || !entry.imageUrl ? fallback : null) ?? {}) }
  })
}

function CardArt({ card, className = '', full = false, eager = false }: { card: DeckCard; className?: string; full?: boolean; eager?: boolean }) {
  const [useOriginal, setUseOriginal] = useState(full)
  const source = useOriginal ? card.imageUrl : thumbnailUrl(card)

  return <CardArtImage key={source ?? `missing:${card.id}`} card={card} className={className} eager={eager} source={source} onThumbnailError={() => {
    if (!useOriginal && card.imageUrl && source !== card.imageUrl) setUseOriginal(true)
  }} canFallback={!useOriginal && Boolean(card.imageUrl && source !== card.imageUrl)} />
}

function CardArtImage({ card, className, eager, source, canFallback, onThumbnailError }: { card: DeckCard; className: string; eager: boolean; source: string | null; canFallback: boolean; onThumbnailError: () => void }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>(() => source && loadedImageUrls.has(source) ? 'loaded' : 'loading')

  return (
    <div className={`relative aspect-[5/7] overflow-hidden bg-slate-800 ${className}`}>
      {!source || status === 'failed' ? (
        <div data-testid="card-placeholder" className="flex h-full items-center justify-center p-1 text-center text-[8px] font-bold leading-tight text-white sm:text-xs">
          {card.name}
        </div>
      ) : (
        <>
          {status === 'loading' && <div data-testid="card-image-skeleton" className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700" />}
          <img
            key={source}
            src={source}
            alt={card.name}
            className={`relative h-full w-full object-contain transition-opacity duration-200 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'auto'}
            decoding="async"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onLoad={() => { loadedImageUrls.add(source); setStatus('loaded') }}
            onError={() => {
              if (canFallback) onThumbnailError()
              else setStatus('failed')
            }}
          />
        </>
      )}
    </div>
  )
}

function prefetchCardImages(cards: DeckCard[]) {
  for (const card of cards.slice(0, 4)) {
    const source = thumbnailUrl(card)
    if (!source) continue
    if (loadedImageUrls.has(source) || prefetchedImageUrls.has(source)) continue
    prefetchedImageUrls.add(source)
    const image = new Image()
    image.onload = () => loadedImageUrls.add(source)
    image.src = source
  }
}

function Icon({ name }: { name: 'download' | 'save' | 'folder' | 'copy' | 'edit' | 'trash' | 'filter' | 'close' }) {
  const paths = {
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 15v4h14v-4"/></>,
    save: <><path d="M5 4h12l2 2v14H5V4Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></>,
    folder: <path d="M3 7h7l2 2h9v10H3V7Z"/>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13 7 4 4"/></>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8l1-4Z"/><path d="m8 10 .5 9h7l.5-9"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

async function loadImage(card: DeckCard) {
  if (!card.imageUrl) return null
  const imageUrl = card.imageUrl
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    const finish = (value: HTMLImageElement | null) => {
      clearTimeout(timer)
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), 10_000)
    image.onload = () => finish(image)
    image.onerror = () => finish(null)
    image.src = proxy(imageUrl)
  })
}

export default function DeckMaker() {
  const { query, setQuery, cards: results, loading: resultsLoading, hasMore: hasMoreResults, loadMore } = useCardCatalogSearch()
  const [entries, setEntries] = useState<DeckEntry[]>([])
  const [deckName, setDeckName] = useState(DEFAULT_DECK_NAME)
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([])
  const [activeSavedDeckId, setActiveSavedDeckId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [deleteDeckId, setDeleteDeckId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null)
  const [printingOptions, setPrintingOptions] = useState<DeckCard[]>([])
  const [printingsLoading, setPrintingsLoading] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [pngPreview, setPngPreview] = useState<{ src: string; title: string; fileName: string } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const printingsAbort = useRef<AbortController | null>(null)
  const printingsCache = useRef(new Map<string, DeckCard[]>())
  const searchInput = useRef<HTMLInputElement>(null)
  const printingsScroller = useRef<HTMLDivElement>(null)
  const printingDrag = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 })
  const total = deckSize(entries)
  const effectiveDeckName = deckName.trim() || DEFAULT_DECK_NAME
  const byPrinting = useMemo(() => new Map(entries.map((entry) => [printingKey(entry), entry])), [entries])
  const countsByCard = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) counts.set(entry.id, (counts.get(entry.id) ?? 0) + entry.count)
    return counts
  }, [entries])
  const selected = selectedCard ? byPrinting.get(printingKey(selectedCard)) ?? selectedCard : null
  const selectedCount = selected ? byPrinting.get(printingKey(selected))?.count ?? 0 : 0
  const selectedNameCount = selected ? countsByCard.get(selected.id) ?? 0 : 0
  const deckCards = useMemo(() => entries.flatMap((entry) => Array.from({ length: entry.count }, (_, copy) => ({ entry, copy }))), [entries])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) ?? 'null') as { version?: number; entries?: DeckEntry[]; deckName?: string; savedDeckId?: string | null } | null
      if (saved && saved.version === DECK_STORAGE_VERSION && Array.isArray(saved.entries)) {
        if (typeof saved.deckName === 'string') setDeckName(saved.deckName.trim().slice(0, MAX_DECK_NAME_LENGTH) || DEFAULT_DECK_NAME)
        if (typeof saved.savedDeckId === 'string' && saved.savedDeckId.length <= 100) setActiveSavedDeckId(saved.savedDeckId)
        const restored = safeEntries(saved.entries)
        setEntries(restored)
        resolveStoredEntries(restored).then(setEntries).catch(() => {})
      }
      const storedDecks = JSON.parse(localStorage.getItem(SAVED_DECKS_STORAGE_KEY) ?? '[]') as unknown
      if (Array.isArray(storedDecks)) {
        const now = new Date().toISOString()
        setSavedDecks(storedDecks.flatMap((value): SavedDeck[] => {
          if (!value || typeof value !== 'object') return []
          const deck = value as Partial<SavedDeck>
          if (typeof deck.id !== 'string' || deck.id.length > 100) return []
          const name = typeof deck.name === 'string' ? deck.name.trim().slice(0, MAX_DECK_NAME_LENGTH) || DEFAULT_DECK_NAME : DEFAULT_DECK_NAME
          return [{ id: deck.id, name, entries: safeEntries(deck.entries), createdAt: typeof deck.createdAt === 'string' ? deck.createdAt : now, updatedAt: typeof deck.updatedAt === 'string' ? deck.updatedAt : now }]
        }))
      }
    } catch {
      localStorage.removeItem(DECK_STORAGE_KEY)
      localStorage.removeItem(SAVED_DECKS_STORAGE_KEY)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({ version: DECK_STORAGE_VERSION, entries, deckName, savedDeckId: activeSavedDeckId }))
  }, [activeSavedDeckId, deckName, entries, ready])

  useEffect(() => {
    if (ready) localStorage.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(savedDecks))
  }, [ready, savedDecks])

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCard(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  function openCard(card: DeckCard) {
    printingsAbort.current?.abort()
    const cached = printingsCache.current.get(card.id)
    const controller = new AbortController()
    printingsAbort.current = controller
    setSelectedCard(card)
    setPrintingOptions(cached ?? [card])
    setPrintingsLoading(!cached)
    if (cached) {
      prefetchCardImages(cached)
      return
    }
    fetch(`/api/cards/${encodeURIComponent(card.id)}/printings`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const cards = Array.isArray(data.cards) ? (data.cards as DeckCard[]).map(safeCard) : []
        if (cards.length) {
          const unique = new Map<string, DeckCard>()
          for (const printing of cards) unique.set(printingKey(printing), printing)
          if (!unique.has(printingKey(card))) unique.set(printingKey(card), card)
          const options = [...unique.values()]
          printingsCache.current.set(card.id, options)
          prefetchCardImages(options)
          setPrintingOptions(options)
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice('別イラストを読み込めませんでした')
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrintingsLoading(false)
      })
  }

  function closeCard() {
    printingsAbort.current?.abort()
    setSelectedCard(null)
    setPrintingOptions([])
    setPrintingsLoading(false)
  }

  function startPrintingDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const scroller = printingsScroller.current
    if (!scroller) return
    printingDrag.current = { active: true, moved: false, startX: event.clientX, scrollLeft: scroller.scrollLeft }
  }

  function movePrintingDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = printingDrag.current
    const scroller = printingsScroller.current
    if (!drag.active || !scroller) return
    const distance = event.clientX - drag.startX
    if (Math.abs(distance) > 5 && !drag.moved) {
      drag.moved = true
      scroller.setPointerCapture(event.pointerId)
    }
    if (drag.moved) {
      event.preventDefault()
      scroller.scrollLeft = drag.scrollLeft - distance
    }
  }

  function endPrintingDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!printingDrag.current.active) return
    printingDrag.current.active = false
    if (printingsScroller.current?.hasPointerCapture(event.pointerId)) {
      printingsScroller.current.releasePointerCapture(event.pointerId)
    }
  }

  function selectPrinting(printing: DeckCard) {
    if (printingDrag.current.moved) {
      printingDrag.current.moved = false
      return
    }
    setSelectedCard(printing)
  }

  function add(card: DeckCard) {
    const key = printingKey(card)
    const current = byPrinting.get(key)
    if (total >= MAX_DECK_CARDS) return setNotice('メインデッキは40枚までです')
    if ((countsByCard.get(card.id) ?? 0) >= MAX_SAME_CARD) return setNotice('同名カードは合計4枚までです')
    setEntries((list) => current
      ? list.map((entry) => printingKey(entry) === key ? { ...entry, count: entry.count + 1 } : entry)
      : [...list, { ...card, count: 1 }])
  }

  function remove(card: DeckCard) {
    const key = printingKey(card)
    setEntries((list) => list.flatMap((entry) => printingKey(entry) !== key ? [entry] : entry.count > 1 ? [{ ...entry, count: entry.count - 1 }] : []))
  }

  function resetDeck() {
    printingsAbort.current?.abort()
    setEntries([])
    setDeckName(DEFAULT_DECK_NAME)
    setActiveSavedDeckId(null)
    setSelectedCard(null)
    setPrintingOptions([])
    setResetConfirm(false)
    setNotice('デッキをリセットしました')
  }

  function saveCurrentDeck() {
    if (!entries.length) return setNotice('カードを追加してください')
    const now = new Date().toISOString()
    if (activeSavedDeckId && savedDecks.some((deck) => deck.id === activeSavedDeckId)) {
      setSavedDecks((decks) => decks.map((deck) => deck.id === activeSavedDeckId ? { ...deck, name: effectiveDeckName, entries: entries.map((entry) => ({ ...entry })), updatedAt: now } : deck))
    } else {
      const id = crypto.randomUUID()
      setSavedDecks((decks) => [{ id, name: effectiveDeckName, entries: entries.map((entry) => ({ ...entry })), createdAt: now, updatedAt: now }, ...decks])
      setActiveSavedDeckId(id)
    }
    setNotice('マイデッキに保存しました')
  }

  async function publishCurrentDeck() {
    if (total !== MAX_DECK_CARDS) return setNotice('40枚そろったデッキを登録してください')
    if (publishing) return
    setPublishing(true)
    setNotice('みんなのデッキリストに登録中…')
    const result = await publishDeck({
      title: effectiveDeckName,
      entries: entries.map(entry => ({ id: entry.id, sourceKey: entry.sourceKey, count: entry.count })),
    })
    setPublishing(false)
    setNotice(result.message)
    if (result.ok && result.submissionId) {
      window.location.assign(`/makers/deck-maker/submissions/${result.submissionId}`)
    }
  }

  function openSavedDeck(deck: SavedDeck) {
    const restored = deck.entries.map((entry) => ({ ...entry }))
    setEntries(restored)
    resolveStoredEntries(restored).then(setEntries).catch(() => {})
    setDeckName(deck.name)
    setActiveSavedDeckId(deck.id)
    setLibraryOpen(false)
    setNotice('デッキを開きました')
  }

  function copySavedDeck(deck: SavedDeck) {
    const now = new Date().toISOString()
    const copy: SavedDeck = { id: crypto.randomUUID(), name: `${deck.name} コピー`.slice(0, MAX_DECK_NAME_LENGTH), entries: deck.entries.map((entry) => ({ ...entry })), createdAt: now, updatedAt: now }
    setSavedDecks((decks) => [copy, ...decks])
    setNotice('デッキをコピーしました')
  }

  function deleteSavedDeck() {
    if (!deleteDeckId) return
    setSavedDecks((decks) => decks.filter((deck) => deck.id !== deleteDeckId))
    if (activeSavedDeckId === deleteDeckId) setActiveSavedDeckId(null)
    setDeleteDeckId(null)
    setNotice('保存デッキを削除しました')
  }

  async function savePng() {
    const cards = entries.flatMap((entry) => Array.from({ length: entry.count }, () => entry))
    if (!cards.length) return setNotice('カードを追加してください')
    setNotice('PNGを生成中…')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    const cardWidth = 130
    const cardHeight = 182
    const gap = 8
    const columns = 8
    const padding = 44
    canvas.width = 1200
    canvas.height = 166 + Math.ceil(cards.length / columns) * (cardHeight + gap)
    if (!context) return
    context.fillStyle = '#f8fafc'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#0f172a'
    let titleFontSize = 36
    context.font = `bold ${titleFontSize}px sans-serif`
    while (titleFontSize > 18 && context.measureText(effectiveDeckName).width > canvas.width - padding * 2) {
      titleFontSize -= 2
      context.font = `bold ${titleFontSize}px sans-serif`
    }
    context.fillText(effectiveDeckName, padding, 58)
    const imageLoads = new Map<string, Promise<HTMLImageElement | null>>()
    const pendingImages = Promise.all(cards.map((card) => {
      const key = card.imageUrl ?? `missing:${card.id}`
      if (!imageLoads.has(key)) imageLoads.set(key, loadImage(card))
      return imageLoads.get(key)!
    }))
    const images = await Promise.race([
      pendingImages,
      new Promise<null[]>((resolve) => window.setTimeout(() => resolve(cards.map(() => null)), 12_000)),
    ])
    cards.forEach((card, index) => {
      const x = padding + (index % columns) * (cardWidth + gap)
      const y = 86 + Math.floor(index / columns) * (cardHeight + gap)
      if (images[index]) {
        context.drawImage(images[index]!, x, y, cardWidth, cardHeight)
      } else {
        context.fillStyle = '#1e293b'
        context.fillRect(x, y, cardWidth, cardHeight)
        context.fillStyle = '#fff'
        context.font = 'bold 13px sans-serif'
        context.fillText(card.name.slice(0, 12), x + 6, y + cardHeight / 2)
      }
    })
    const preview = canvas.toDataURL('image/png')
    const fileName = pngFileName(effectiveDeckName)
    setPngPreview({ src: preview, title: effectiveDeckName, fileName })
    setNotice('画像を生成しました')
  }

  if (!ready) {
    return <div className="min-h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-white" aria-label="デッキを復元中" />
  }

  return (
    <div className="mx-auto max-w-[1440px] overflow-x-hidden">
      <header className="mb-3 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex-nowrap sm:px-4">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <div className="flex max-w-xl items-center gap-2">
            <label htmlFor="deck-name" className="shrink-0 text-sm font-bold text-slate-700">デッキ名</label>
            <input id="deck-name" value={deckName} onChange={(event) => setDeckName(event.target.value.slice(0, MAX_DECK_NAME_LENGTH))} onBlur={() => { if (!deckName.trim()) setDeckName(DEFAULT_DECK_NAME) }} maxLength={MAX_DECK_NAME_LENGTH} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder={DEFAULT_DECK_NAME} />
          </div>
        </div>
        <div className="ml-auto flex w-full items-center justify-end gap-1 sm:w-auto">
          <button onClick={saveCurrentDeck} aria-label="デッキをマイデッキに保存" className="flex min-h-9 items-center gap-1 rounded-lg bg-blue-700 px-2.5 text-xs font-bold text-white hover:bg-blue-800 [&>svg]:h-4 [&>svg]:w-4">
            <Icon name="save" /><span>保存</span>
          </button>
          <button onClick={() => setLibraryOpen(true)} aria-label="マイデッキを開く" className="flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 hover:bg-slate-50 [&>svg]:h-4 [&>svg]:w-4">
            <Icon name="folder" /><span>マイデッキ</span>
          </button>
          <button onClick={savePng} aria-label="デッキ画像を出力" className="flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 hover:bg-slate-50 [&>svg]:h-4 [&>svg]:w-4">
            <Icon name="download" /><span>画像出力</span>
          </button>
          <button onClick={() => entries.length ? setResetConfirm(true) : resetDeck()} aria-label="デッキをリセット" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700 [&>svg]:h-4 [&>svg]:w-4">
            <Icon name="trash" />
          </button>
        </div>
      </header>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <Link
          href="/makers/deck-maker/submissions"
          className="flex min-h-11 items-center justify-center rounded-xl border border-blue-700 bg-white px-4 text-sm font-black text-blue-700 transition active:scale-[0.99] active:bg-blue-50"
        >
          みんなのデッキリストを見る
        </Link>
        <button
          type="button"
          onClick={publishCurrentDeck}
          disabled={publishing || total !== MAX_DECK_CARDS}
          className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition active:scale-[0.99] active:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {publishing ? '登録中…' : 'みんなのデッキリストに登録'}
        </button>
      </div>

      {notice && <div role="status" className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-xl">{notice}</div>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)] lg:items-start">
        <section aria-labelledby="deck-heading" className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:p-3">
          <div className="mb-2 px-1">
            <h2 id="deck-heading" className="text-sm font-black text-slate-800">メインデッキ <span data-testid="deck-count">{total}/40</span></h2>
          </div>
          <div data-testid="deck-list" className={`rounded-xl bg-slate-100 ${deckCards.length ? 'grid grid-cols-8 gap-0.5' : 'flex h-[220px] items-center justify-center'}`}>
            {deckCards.length ? deckCards.map(({ entry, copy }) => (
              <button
                key={`${printingKey(entry)}-${copy}`}
                type="button"
                aria-label={`${entry.name}を編集`}
                onClick={() => openCard(entry)}
                className="min-w-0 rounded-[3px] outline-none ring-emerald-600 focus-visible:ring-2"
              >
                <CardArt card={entry} className="rounded-[3px]" />
              </button>
            )) : (
              <div className="px-5 text-center text-sm text-slate-500">
                <p className="font-bold text-slate-700">カードがありません</p>
                <p className="mt-1">カード検索から追加してください</p>
              </div>
            )}
          </div>
        </section>

        <CardCatalogSearchPanel cards={results} query={query} loading={resultsLoading} hasMore={hasMoreResults} onLoadMore={loadMore} onSelect={openCard} onQueryChange={setQuery} onClear={() => { setQuery(''); searchInput.current?.focus() }} inputRef={searchInput} clearIcon={<Icon name="close" />} filterIcon={<Icon name="filter" />} selectedCount={card => countsByCard.get(card.id) ?? 0} selectedBadge={count => `${count}/4`} renderCardArt={(card, index) => <CardArt card={card} eager={index < 4} />} />
      </div>

      {libraryOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onMouseDown={(event) => { if (event.currentTarget === event.target) setLibraryOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="saved-decks-title" className="flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b bg-white px-4 py-3">
              <div>
                <h2 id="saved-decks-title" className="text-xl font-black text-slate-900">マイデッキ</h2>
                <p className="text-xs text-slate-500">この端末に保存したデッキを管理・編集</p>
              </div>
              <button type="button" onClick={() => setLibraryOpen(false)} aria-label="マイデッキを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"><Icon name="close" /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
              {savedDecks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center text-sm text-slate-500">
                  <p className="font-bold text-slate-700">保存したデッキはありません</p>
                  <p className="mt-1">デッキ作成画面の「保存」から追加できます</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {[...savedDecks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((deck) => {
                    const cover = deck.entries[0]
                    return (
                      <article key={deck.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex gap-3 p-3">
                          <div className="w-24 shrink-0 sm:w-28">
                            {cover ? <CardArt card={cover} className="rounded-lg" /> : <div className="aspect-[5/7] rounded-lg bg-slate-200" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="line-clamp-2 font-black text-slate-900">{deck.name}</h3>
                              {deck.id === activeSavedDeckId && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">編集中</span>}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">更新 {new Date(deck.updatedAt).toLocaleDateString('ja-JP')}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 border-t border-slate-200">
                          <button type="button" onClick={() => openSavedDeck(deck)} className="flex min-h-11 items-center justify-center gap-1 text-sm font-bold text-blue-700 hover:bg-blue-50"><Icon name="edit" />編集</button>
                          <button type="button" onClick={() => copySavedDeck(deck)} className="flex min-h-11 items-center justify-center gap-1 border-x border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"><Icon name="copy" />コピー</button>
                          <button type="button" onClick={() => setDeleteDeckId(deck.id)} className="flex min-h-11 items-center justify-center gap-1 text-sm font-bold text-red-700 hover:bg-red-50"><Icon name="trash" />削除</button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {deleteDeckId && (
        <div role="presentation" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setDeleteDeckId(null) }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-deck-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="delete-deck-title" className="text-lg font-black text-slate-900">保存デッキを削除しますか？</h2>
            <p className="mt-2 text-sm text-slate-600">マイデッキから削除します。この操作は取り消せません。</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDeleteDeckId(null)} className="min-h-11 rounded-xl border border-slate-300 font-bold text-slate-700">キャンセル</button>
              <button type="button" onClick={deleteSavedDeck} className="min-h-11 rounded-xl bg-red-700 font-bold text-white">削除</button>
            </div>
          </section>
        </div>
      )}

      {selected && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onMouseDown={(event) => { if (event.currentTarget === event.target) closeCard() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="card-dialog-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button type="button" onClick={closeCard} aria-label="カード操作を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow"><Icon name="close" /></button>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <h2 id="card-dialog-title" className="mb-3 pr-12 text-center text-base font-black text-slate-900">{selected.name}</h2>
              <CardArt key={printingKey(selected)} card={selected} full eager className="mx-auto w-full max-w-[min(330px,calc((100dvh-310px)*5/7))] rounded-xl shadow-lg" />
              <div className="mt-3 flex items-center justify-center gap-5">
                <button type="button" onClick={() => remove(selected)} disabled={selectedCount === 0} aria-label={`${selected.name}を1枚減らす`} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 text-2xl font-bold disabled:text-slate-300">−</button>
                <div className="min-w-20 text-center"><span className="text-3xl font-black">{selectedCount}</span></div>
                <button type="button" onClick={() => add(selected)} disabled={selectedNameCount >= MAX_SAME_CARD} aria-label={`${selected.name}を1枚増やす`} className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-2xl font-bold text-white disabled:bg-slate-400">＋</button>
              </div>
              <div className="mt-5">
                <p className="mb-2 text-center text-xs font-bold text-slate-600">表裏面・収録版</p>
                {printingsLoading && <p className="mb-2 text-center text-xs font-bold text-slate-500">表裏面と収録版を読み込み中…</p>}
                <div
                  ref={printingsScroller}
                  className="flex cursor-grab select-none gap-3 overflow-x-auto overscroll-x-contain pb-2 active:cursor-grabbing"
                  onPointerDown={startPrintingDrag}
                  onPointerMove={movePrintingDrag}
                  onPointerUp={endPrintingDrag}
                  onPointerCancel={endPrintingDrag}
                >
                  {printingOptions.map((printing) => {
                    const active = printingKey(printing) === printingKey(selected)
                    return (
                      <button
                        key={printingKey(printing)}
                        type="button"
                        onClick={() => selectPrinting(printing)}
                        aria-label={`${printing.name}の面または収録版を選択`}
                        aria-pressed={active}
                        className={`w-24 shrink-0 overflow-hidden rounded-lg transition ${active ? 'ring-2 ring-blue-600' : 'opacity-55 ring-1 ring-slate-300 hover:opacity-100'}`}
                      >
                        <CardArt card={printing} />
                        <span className="block min-h-8 bg-white px-1 py-1 text-[9px] font-bold leading-tight text-slate-800">{printing.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {resetConfirm && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setResetConfirm(false) }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="reset-dialog-title" aria-describedby="reset-dialog-description" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="reset-dialog-title" className="text-lg font-black text-slate-900">デッキをリセットしますか？</h2>
            <p id="reset-dialog-description" className="mt-2 text-sm leading-relaxed text-slate-600">現在の40枚をすべて削除します。この操作は取り消せません。</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setResetConfirm(false)} className="min-h-11 rounded-xl border border-slate-300 font-bold text-slate-700">キャンセル</button>
              <button type="button" onClick={resetDeck} aria-label="デッキをすべて削除" className="min-h-11 rounded-xl bg-red-700 font-bold text-white">すべて削除</button>
            </div>
          </section>
        </div>
      )}

      {pngPreview && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onMouseDown={(event) => { if (event.currentTarget === event.target) setPngPreview(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="png-preview-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div>
                <h2 id="png-preview-title" className="font-black text-slate-900">{pngPreview.title}</h2>
                <p className="text-xs text-slate-500">iPhoneでは画像を長押しして保存できます</p>
              </div>
              <button type="button" onClick={() => setPngPreview(null)} aria-label="PNGプレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"><Icon name="close" /></button>
            </div>
            <div className="min-h-0 overflow-auto bg-slate-100 p-2 sm:p-4">
              <img src={pngPreview.src} alt={`${pngPreview.title}のデッキ画像`} className="mx-auto h-auto max-w-full shadow" />
            </div>
            <div className="border-t bg-white p-3">
              <a href={pngPreview.src} download={pngPreview.fileName} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-bold text-white"><Icon name="download" />画像を保存</a>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
