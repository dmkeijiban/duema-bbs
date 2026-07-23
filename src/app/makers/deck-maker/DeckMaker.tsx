'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  DECK_STORAGE_KEY,
  DECK_STORAGE_VERSION,
  MAX_DECK_CARDS,
  DECK_ZONE_LIMITS,
  MAX_SAME_CARD,
  entryZone,
  zoneDeckSize,
  printingKey,
  type DeckCard,
  type DeckEntry,
  type DeckFormat,
  type DeckZone,
} from '@/lib/deck-maker'
import { CardCatalogSearchPanel } from '@/components/CardCatalogSearchPanel'
import { CardDetailModal } from '@/components/CardDetailModal'
import { useCardCatalogSearch } from '@/hooks/use-card-catalog-search'
import { useCardPrintingSelector } from '@/hooks/use-card-printing-selector'
import { deleteMyDeck, savePublishedDeck } from './actions'

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
  submissionId?: string
  keyCardId?: string | null
  keyCardPrintingId?: string | null
  format?: DeckFormat
}

const ZONE_LABELS: Record<DeckZone, string> = { main: 'メインデッキ', gr: 'GRゾーン', hyperspatial: '超次元ゾーン', special: '特殊カード' }
const zonedPrintingKey = (card: DeckCard, zone: DeckZone) => `${printingKey(card)}:${zone}`
function cardZone(card: DeckCard, fallback: DeckZone): DeckZone {
  const zone = (card as Partial<DeckEntry>).zone
  return zone && zone in DECK_ZONE_LIMITS ? zone : fallback
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
    printingId: typeof card.printingId === 'string' && /^[0-9a-f-]{36}$/i.test(card.printingId) ? card.printingId : null,
    sourceKey: typeof card.sourceKey === 'string' ? card.sourceKey.slice(0, 100) : null,
    name: typeof card.name === 'string' ? card.name.slice(0, 200) : '',
    nameKana: typeof card.nameKana === 'string' ? card.nameKana.slice(0, 200) : null,
    cost: Number.isInteger(card.cost) && Number(card.cost) >= 0 ? Number(card.cost) : null,
    civilization: Array.isArray(card.civilization) ? card.civilization.filter(value => typeof value === 'string').slice(0, 5) : [],
    cardType: typeof card.cardType === 'string' ? card.cardType.slice(0, 100) : null,
    race: typeof card.race === 'string' ? card.race.slice(0, 200) : null,
    abilityText: typeof card.abilityText === 'string' ? card.abilityText.slice(0, 5000) : null,
    setName: typeof card.setName === 'string' ? card.setName.slice(0, 200) : null,
    cardNumber: typeof card.cardNumber === 'string' ? card.cardNumber.slice(0, 100) : null,
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

function safeEntries(values: unknown): DeckEntry[] {
  if (!Array.isArray(values)) return []
  const remainingByZone = new Map<DeckZone, number>(Object.entries(DECK_ZONE_LIMITS) as [DeckZone, number][])
  const countsByCard = new Map<string, number>()
  const restored: DeckEntry[] = []
  for (const value of values as DeckEntry[]) {
    if (!value || typeof value.id !== 'string' || value.id.length > 100 || !Number.isInteger(value.count)) continue
    const zone: DeckZone = ['main', 'gr', 'hyperspatial', 'special'].includes(value.zone ?? '') ? value.zone! : 'main'
    const remaining = remainingByZone.get(zone) ?? 0
    if (remaining <= 0) continue
    const sameNameRemaining = MAX_SAME_CARD - (countsByCard.get(value.id) ?? 0)
    const count = Math.min(sameNameRemaining, Math.max(0, value.count), remaining)
    if (!count) continue
    restored.push({ ...safeCard(value), id: value.id, count, zone })
    countsByCard.set(value.id, (countsByCard.get(value.id) ?? 0) + count)
    remainingByZone.set(zone, remaining - count)
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

export default function DeckMaker({ initialDeck, dbDecks = [] }: {
  initialDeck?: { name: string; entries: DeckEntry[]; submissionId?: string; format?: DeckFormat }
  dbDecks?: SavedDeck[]
}) {
  const { query, setQuery, cards: results, loading: resultsLoading, hasMore: hasMoreResults, loadMore, filters, addFilter, removeFilter, clearFilters } = useCardCatalogSearch()
  const [entries, setEntries] = useState<DeckEntry[]>([])
  const [format, setFormat] = useState<DeckFormat>('original')
  const [activeZone, setActiveZone] = useState<DeckZone>('main')
  const [deckName, setDeckName] = useState(DEFAULT_DECK_NAME)
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([])
  const [activeSavedDeckId, setActiveSavedDeckId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [deleteDeckId, setDeleteDeckId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)
  const [pngPreview, setPngPreview] = useState<{ src: string; title: string; fileName: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const { selectedCard, printingOptions, loading: printingsLoading, openCard, closeCard, selectPrinting } = useCardPrintingSelector({
    normalizeCard: safeCard,
    onLoadError: () => setNotice('別イラストを読み込めませんでした'),
    onOptionsLoaded: prefetchCardImages,
  })
  const mainTotal = zoneDeckSize(entries, 'main')
  const activeTotal = zoneDeckSize(entries, activeZone)
  const effectiveDeckName = deckName.trim() || DEFAULT_DECK_NAME
  const byPrinting = useMemo(() => new Map(entries.map((entry) => [zonedPrintingKey(entry, entryZone(entry)), entry])), [entries])
  const countsByCard = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) counts.set(entry.id, (counts.get(entry.id) ?? 0) + entry.count)
    return counts
  }, [entries])
  const selected = selectedCard ? byPrinting.get(zonedPrintingKey(selectedCard, cardZone(selectedCard, activeZone))) ?? selectedCard : null
  const selectedZone = selected ? cardZone(selected, activeZone) : activeZone
  const selectedCount = selected ? byPrinting.get(zonedPrintingKey(selected, selectedZone))?.count ?? 0 : 0
  const selectedNameCount = selected ? countsByCard.get(selected.id) ?? 0 : 0
  const deckCards = useMemo(() => entries.filter(entry => entryZone(entry) === activeZone).flatMap((entry) => Array.from({ length: entry.count }, (_, copy) => ({ entry, copy }))), [activeZone, entries])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) ?? 'null') as { version?: number; entries?: DeckEntry[]; deckName?: string; savedDeckId?: string | null; format?: DeckFormat } | null
      if (saved && saved.version === DECK_STORAGE_VERSION && Array.isArray(saved.entries)) {
        if (typeof saved.deckName === 'string') setDeckName(saved.deckName.trim().slice(0, MAX_DECK_NAME_LENGTH) || DEFAULT_DECK_NAME)
        if (typeof saved.savedDeckId === 'string' && saved.savedDeckId.length <= 100) setActiveSavedDeckId(saved.savedDeckId)
        if (saved.format === 'advance') setFormat('advance')
        const restored = safeEntries(saved.entries)
        setEntries(restored)
        resolveStoredEntries(restored).then(setEntries).catch(() => {})
      }
      const storedDecks = JSON.parse(localStorage.getItem(SAVED_DECKS_STORAGE_KEY) ?? '[]') as unknown
      let localDecks: SavedDeck[] = []
      if (Array.isArray(storedDecks)) {
        const now = new Date().toISOString()
        localDecks = storedDecks.flatMap((value): SavedDeck[] => {
          if (!value || typeof value !== 'object') return []
          const deck = value as Partial<SavedDeck>
          if (typeof deck.id !== 'string' || deck.id.length > 100) return []
          const name = typeof deck.name === 'string' ? deck.name.trim().slice(0, MAX_DECK_NAME_LENGTH) || DEFAULT_DECK_NAME : DEFAULT_DECK_NAME
          return [{ id: deck.id, name, entries: safeEntries(deck.entries), createdAt: typeof deck.createdAt === 'string' ? deck.createdAt : now, updatedAt: typeof deck.updatedAt === 'string' ? deck.updatedAt : now, ...(typeof deck.submissionId === 'string' && /^[0-9a-f-]{36}$/i.test(deck.submissionId) ? { submissionId: deck.submissionId } : {}), keyCardId: deck.keyCardId, keyCardPrintingId: deck.keyCardPrintingId, format: deck.format === 'advance' ? 'advance' : 'original' }]
        })
      }
      setSavedDecks([...dbDecks.map(deck => ({ ...deck, entries: safeEntries(deck.entries) })), ...localDecks.filter(deck => !deck.submissionId)])
      if (initialDeck) {
        const restored = safeEntries(initialDeck.entries)
        const now = new Date().toISOString()
        const id = initialDeck.submissionId ?? crypto.randomUUID()
        setEntries(restored)
        setDeckName(initialDeck.name.trim().slice(0, MAX_DECK_NAME_LENGTH) || DEFAULT_DECK_NAME)
        setFormat(initialDeck.format === 'advance' ? 'advance' : 'original')
        setActiveSavedDeckId(id)
        setSavedDecks(current => [{ id, name: initialDeck.name, entries: restored, createdAt: now, updatedAt: now, format: initialDeck.format === 'advance' ? 'advance' : 'original', ...(initialDeck.submissionId ? { submissionId: initialDeck.submissionId } : {}) }, ...current.filter(deck => deck.id !== id)])
        resolveStoredEntries(restored).then(setEntries).catch(() => {})
      }
    } catch {
      localStorage.removeItem(DECK_STORAGE_KEY)
      localStorage.removeItem(SAVED_DECKS_STORAGE_KEY)
    }
    setReady(true)
  }, [dbDecks, initialDeck])

  useEffect(() => {
    if (ready) localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({ version: DECK_STORAGE_VERSION, entries, deckName, savedDeckId: activeSavedDeckId, format }))
  }, [activeSavedDeckId, deckName, entries, format, ready])

  useEffect(() => {
    if (ready) localStorage.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(savedDecks))
  }, [ready, savedDecks])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  function add(card: DeckCard) {
    const key = zonedPrintingKey(card, activeZone)
    const current = byPrinting.get(key)
    if (activeTotal >= DECK_ZONE_LIMITS[activeZone]) return setNotice(`${ZONE_LABELS[activeZone]}は${DECK_ZONE_LIMITS[activeZone]}枚までです`)
    if ((countsByCard.get(card.id) ?? 0) >= MAX_SAME_CARD) return setNotice('同名カードは合計4枚までです')
    setEntries((list) => current
      ? list.map((entry) => zonedPrintingKey(entry, entryZone(entry)) === key ? { ...entry, count: entry.count + 1 } : entry)
      : [...list, { ...card, count: 1, zone: activeZone }])
  }

  function remove(card: DeckCard) {
    const key = zonedPrintingKey(card, cardZone(card, activeZone))
    setEntries((list) => list.flatMap((entry) => zonedPrintingKey(entry, entryZone(entry)) !== key ? [entry] : entry.count > 1 ? [{ ...entry, count: entry.count - 1 }] : []))
  }

  function resetDeck() {
    setEntries([])
    setFormat('original')
    setActiveZone('main')
    setDeckName(DEFAULT_DECK_NAME)
    setActiveSavedDeckId(null)
    closeCard()
    setResetConfirm(false)
    setNotice('デッキをリセットしました')
  }

  function sortDeckByCost() {
    setEntries(list => list.map((entry, index) => ({ entry, index })).sort((a, b) => {
      const costA = a.entry.cost ?? Number.MAX_SAFE_INTEGER
      const costB = b.entry.cost ?? Number.MAX_SAFE_INTEGER
      return costA - costB || a.entry.name.localeCompare(b.entry.name, 'ja') || a.index - b.index
    }).map(item => item.entry))
    setNotice('コストが小さい順に並べ替えました')
  }

  function moveSelectedEntry(offset: -1 | 1) {
    if (!selected) return
    setEntries(list => {
      const index = list.findIndex(entry => zonedPrintingKey(entry, entryZone(entry)) === zonedPrintingKey(selected, selectedZone))
      const target = index + offset
      if (index < 0 || target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function saveCurrentDeck() {
    if (!entries.length) return setNotice('カードを追加してください')
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setNotice('保存中…')
    const now = new Date().toISOString()
    const existing = activeSavedDeckId ? savedDecks.find((deck) => deck.id === activeSavedDeckId) : undefined
    const id = existing?.id ?? crypto.randomUUID()
    const savedDeck: SavedDeck = {
      id,
      name: effectiveDeckName,
      entries: entries.map((entry) => ({ ...entry })),
      format,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(existing?.submissionId ? { submissionId: existing.submissionId } : {}),
    }
    let nextSavedDecks = existing
      ? savedDecks.map((deck) => deck.id === id ? savedDeck : deck)
      : [savedDeck, ...savedDecks]

    try {
      localStorage.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(nextSavedDecks))
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({ version: DECK_STORAGE_VERSION, entries, deckName, savedDeckId: id, format }))
      setSavedDecks(nextSavedDecks)
      setActiveSavedDeckId(id)
    } catch {
      setNotice('マイデッキへの保存に失敗しました')
      savingRef.current = false
      setSaving(false)
      return
    }

    if (mainTotal !== MAX_DECK_CARDS) {
      setNotice('マイデッキに保存しました')
      savingRef.current = false
      setSaving(false)
      return
    }

    try {
      const result = await savePublishedDeck({
        submissionId: existing?.submissionId,
        title: effectiveDeckName,
        format,
        keyCardId: existing?.keyCardId,
        keyCardPrintingId: existing?.keyCardPrintingId,
        entries: entries.filter(entry => format === 'advance' || entryZone(entry) === 'main').map(entry => ({
          id: entry.id,
          printingId: entry.printingId,
          sourceKey: entry.sourceKey,
          faceSideIndex: entry.matchedFace?.sideIndex ?? 0,
          count: entry.count,
          zone: format === 'advance' ? entryZone(entry) : 'main',
        })),
      })
      if (!result.ok || !result.submissionId) {
        setNotice('マイデッキには保存しましたが、みんなのデッキへの登録に失敗しました')
        return
      }
      const publishedAt = new Date().toISOString()
      nextSavedDecks = nextSavedDecks.map((deck) => deck.id === id ? { ...deck, submissionId: result.submissionId, updatedAt: publishedAt } : deck)
      localStorage.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(nextSavedDecks))
      setSavedDecks(nextSavedDecks)
      setNotice('マイデッキに保存し、みんなのデッキに登録しました')
    } catch {
      setNotice('マイデッキには保存しましたが、みんなのデッキへの登録に失敗しました')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function openSavedDeck(deck: SavedDeck) {
    const restored = deck.entries.map((entry) => ({ ...entry }))
    setEntries(restored)
    resolveStoredEntries(restored).then(setEntries).catch(() => {})
    setDeckName(deck.name)
    setFormat(deck.format === 'advance' ? 'advance' : 'original')
    setActiveZone('main')
    setActiveSavedDeckId(deck.id)
    setLibraryOpen(false)
    setNotice('デッキを開きました')
  }

  function copySavedDeck(deck: SavedDeck) {
    const now = new Date().toISOString()
    const copy: SavedDeck = { id: crypto.randomUUID(), name: `${deck.name} コピー`.slice(0, MAX_DECK_NAME_LENGTH), entries: deck.entries.map((entry) => ({ ...entry })), createdAt: now, updatedAt: now, keyCardId: deck.keyCardId, keyCardPrintingId: deck.keyCardPrintingId, format: deck.format }
    setSavedDecks((decks) => [copy, ...decks])
    setNotice('デッキをコピーしました')
  }

  function changeKeyCard(deckId: string, value: string) {
    const [cardId, printingId = ''] = value.split(':')
    setSavedDecks(decks => decks.map(deck => deck.id === deckId ? { ...deck, keyCardId: cardId, keyCardPrintingId: printingId || null, updatedAt: new Date().toISOString() } : deck))
    if (activeSavedDeckId === deckId) setNotice('キーカードを変更しました。保存すると公開デッキにも反映されます')
  }

  async function deleteSavedDeck() {
    if (!deleteDeckId) return
    const target = savedDecks.find(deck => deck.id === deleteDeckId)
    if (target?.submissionId) {
      const result = await deleteMyDeck(target.submissionId)
      if (!result.ok) return setNotice('DB保存デッキを削除できませんでした')
    }
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
        <div className="flex w-full flex-wrap items-center justify-start gap-1 sm:ml-auto sm:w-auto sm:flex-nowrap sm:justify-end">
          <button onClick={saveCurrentDeck} disabled={saving} aria-label="デッキをマイデッキに保存" aria-busy={saving} className="flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-blue-700 px-2.5 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-wait disabled:bg-blue-500 disabled:opacity-75 [&>svg]:h-4 [&>svg]:w-4">
            <Icon name="save" /><span>{saving ? '保存中…' : '保存'}</span>
          </button>
          <button onClick={() => setLibraryOpen(true)} aria-label="マイデッキを開く" className="flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 hover:bg-slate-50 [&>svg]:h-4 [&>svg]:w-4">
            <Icon name="folder" /><span>マイデッキ</span>
          </button>
          <Link href="/makers/deck-maker/submissions" className="flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-blue-300 px-2 text-xs font-bold text-blue-700 hover:bg-blue-50">
            みんなのデッキを見る
          </Link>
          <button onClick={savePng} aria-label="デッキ画像を出力" className="flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 hover:bg-slate-50 [&>svg]:h-4 [&>svg]:w-4">
            <Icon name="download" /><span>画像出力</span>
          </button>
          <button onClick={() => entries.length ? setResetConfirm(true) : resetDeck()} aria-label="デッキをリセット" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700 [&>svg]:h-4 [&>svg]:w-4">
            <Icon name="trash" />
          </button>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <span className="px-1 text-xs font-bold text-slate-600">フォーマット</span>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold">
          {(['original', 'advance'] as const).map(value => <button key={value} type="button" onClick={() => { setFormat(value); setActiveZone('main') }} className={`min-h-10 rounded-lg px-4 ${format === value ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-700 active:bg-slate-200'}`}>{value === 'original' ? 'オリジナル' : 'アドバンス'}</button>)}
        </div>
        <button onClick={sortDeckByCost} disabled={entries.length < 2} aria-label="コストが小さい順に並べ替え" className="min-h-10 shrink-0 whitespace-nowrap rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">コスト順</button>
        {format === 'advance' && <div className="flex min-w-0 flex-1 flex-wrap gap-1 sm:justify-end">
          {(['main', 'gr', 'hyperspatial'] as DeckZone[]).map(zone => <button key={zone} type="button" onClick={() => setActiveZone(zone)} className={`min-h-10 rounded-lg border px-3 text-xs font-bold ${activeZone === zone ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 active:bg-slate-100'}`}>{ZONE_LABELS[zone]} {zoneDeckSize(entries, zone)} / {DECK_ZONE_LIMITS[zone]}</button>)}
        </div>}
      </div>

      {notice && <div role="status" className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-xl">{notice}</div>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)] lg:items-start">
        <section aria-labelledby="deck-heading" className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:p-3">
          <div className="mb-2 px-1">
            <h2 id="deck-heading" className="text-sm font-black text-slate-800">{ZONE_LABELS[activeZone]} <span data-testid="deck-count">{activeTotal}/{DECK_ZONE_LIMITS[activeZone]}</span></h2>
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

        <CardCatalogSearchPanel cards={results} query={query} loading={resultsLoading} hasMore={hasMoreResults} onLoadMore={loadMore} onSelect={openCard} onQueryChange={setQuery} onClear={() => { setQuery(''); searchInput.current?.focus() }} inputRef={searchInput} clearIcon={<Icon name="close" />} filterIcon={<Icon name="filter" />} selectedCount={card => countsByCard.get(card.id) ?? 0} selectedBadge={count => `${count}/4`} renderCardArt={(card, index) => <CardArt card={card} eager={index < 4} />} filters={filters} onRemoveFilter={removeFilter} onClearFilters={clearFilters} />
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
                    const cover = deck.entries.find(entry => entry.id === deck.keyCardId && (!deck.keyCardPrintingId || entry.printingId === deck.keyCardPrintingId)) ?? deck.entries[0]
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
                            {deck.submissionId && <p className="mt-1 text-[10px] font-bold text-emerald-700">DB保存済み</p>}
                            {deck.entries.length > 0 && <label className="mt-2 block text-xs font-bold text-slate-600">キーカード
                              <select value={`${cover?.id ?? ''}:${cover?.printingId ?? ''}`} onChange={event => changeKeyCard(deck.id, event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-800">
                                {deck.entries.map(entry => <option key={printingKey(entry)} value={`${entry.id}:${entry.printingId ?? ''}`}>{entry.name}</option>)}
                              </select>
                            </label>}
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

      <CardDetailModal
        card={selected}
        versions={printingOptions}
        loading={printingsLoading}
        count={selectedCount}
        maxReached={selectedNameCount >= MAX_SAME_CARD}
        onClose={closeCard}
        onSelectVersion={selectPrinting}
        onAdd={add}
        onRemove={remove}
        onMove={moveSelectedEntry}
        onAddFilter={(filter) => { addFilter(filter); closeCard() }}
        renderCardArt={(card, full) => <CardArt key={printingKey(card)} card={card} full={full} eager className="w-full rounded-xl shadow-lg" />}
      />

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
