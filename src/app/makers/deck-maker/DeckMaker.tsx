'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DECK_STORAGE_KEY,
  DECK_STORAGE_VERSION,
  MAX_DECK_CARDS,
  MAX_SAME_CARD,
  deckSize,
  type DeckCard,
  type DeckEntry,
} from '@/lib/deck-maker'

const OFFICIAL_ORIGIN = 'https://dm.takaratomy.co.jp'
const proxy = (url: string) => `/api/card-image?url=${encodeURIComponent(url)}`

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
    name: typeof card.name === 'string' ? card.name.slice(0, 200) : '',
    nameKana: typeof card.nameKana === 'string' ? card.nameKana.slice(0, 200) : null,
    imageUrl: safeOfficialUrl(card.imageUrl, 'image'),
    officialPageUrl: safeOfficialUrl(card.officialPageUrl, 'page'),
  }
}

function CardArt({ card, className = '' }: { card: DeckCard; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`relative aspect-[5/7] overflow-hidden bg-slate-800 ${className}`}>
      {!card.imageUrl || failed ? (
        <div data-testid="card-placeholder" className="flex h-full items-center justify-center p-1 text-center text-[8px] font-bold leading-tight text-white sm:text-xs">
          {card.name}
        </div>
      ) : (
        <img
          src={proxy(card.imageUrl)}
          alt={card.name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

function Icon({ name }: { name: 'download' | 'trash' | 'filter' | 'close' | 'external' }) {
  const paths = {
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 15v4h14v-4"/></>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8l1-4Z"/><path d="m8 10 .5 9h7l.5-9"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></>,
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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeckCard[]>([])
  const [entries, setEntries] = useState<DeckEntry[]>([])
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const requestId = useRef(0)
  const searchInput = useRef<HTMLInputElement>(null)
  const total = deckSize(entries)
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])
  const selected = selectedId ? byId.get(selectedId) ?? null : null
  const deckCards = useMemo(() => entries.flatMap((entry) => Array.from({ length: entry.count }, (_, copy) => ({ entry, copy }))), [entries])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) ?? 'null') as { version?: number; entries?: DeckEntry[] } | null
      if (saved?.version === DECK_STORAGE_VERSION && Array.isArray(saved.entries)) {
        let remaining = MAX_DECK_CARDS
        const restored: DeckEntry[] = []
        for (const value of saved.entries) {
          if (!value || typeof value.id !== 'string' || value.id.length > 100 || !Number.isInteger(value.count) || remaining <= 0) continue
          const count = Math.min(MAX_SAME_CARD, Math.max(0, value.count), remaining)
          if (!count) continue
          restored.push({ ...safeCard(value), id: value.id, count })
          remaining -= count
        }
        setEntries(restored)
        const ids = restored.map((entry) => entry.id)
        if (ids.length) {
          fetch('/api/cards/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
            .then((response) => response.json())
            .then(({ cards }: { cards: DeckCard[] }) => {
              const latest = new Map(cards.map((card) => [card.id, safeCard(card)]))
              setEntries((current) => current.map((entry) => ({ ...entry, ...(latest.get(entry.id) ?? {}) })))
            })
        }
      }
    } catch {
      localStorage.removeItem(DECK_STORAGE_KEY)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({ version: DECK_STORAGE_VERSION, entries }))
  }, [entries, ready])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const id = ++requestId.current
    const timer = window.setTimeout(() => {
      fetch(`/api/cards/search?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) => {
          if (id === requestId.current) setResults(data.cards ?? [])
        })
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  function add(card: DeckCard) {
    const current = byId.get(card.id)
    if (total >= MAX_DECK_CARDS) return setNotice('メインデッキは40枚までです')
    if (current && current.count >= MAX_SAME_CARD) return setNotice('同名カードは4枚までです')
    setEntries((list) => current ? list.map((entry) => entry.id === card.id ? { ...entry, count: entry.count + 1 } : entry) : [...list, { ...card, count: 1 }])
  }

  function remove(id: string) {
    setEntries((list) => list.flatMap((entry) => entry.id !== id ? [entry] : entry.count > 1 ? [{ ...entry, count: entry.count - 1 }] : []))
  }

  function resetDeck() {
    setEntries([])
    setSelectedId(null)
    setResetConfirm(false)
    setNotice('デッキをリセットしました')
  }

  async function savePng() {
    const cards = entries.flatMap((entry) => Array.from({ length: entry.count }, () => entry))
    if (!cards.length) return setNotice('カードを追加してください')
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
    context.font = 'bold 36px sans-serif'
    context.fillText(`メインデッキ ${cards.length}枚`, padding, 58)
    const imageLoads = new Map<string, Promise<HTMLImageElement | null>>()
    const images = await Promise.all(cards.map((card) => {
      const key = card.imageUrl ?? `missing:${card.id}`
      if (!imageLoads.has(key)) imageLoads.set(key, loadImage(card))
      return imageLoads.get(key)!
    }))
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
    context.fillStyle = '#475569'
    context.font = '15px sans-serif'
    context.fillText('非公式ファンサービス / © TOMY', padding, canvas.height - 16)
    canvas.toBlob((blob) => {
      if (!blob) return setNotice('PNG生成に失敗しました')
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = 'duema-deck.png'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      window.setTimeout(() => {
        anchor.remove()
        URL.revokeObjectURL(href)
      }, 60_000)
      setNotice('PNGを保存しました')
    }, 'image/png')
  }

  if (!ready) {
    return <div className="min-h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-white" aria-label="デッキを復元中" />
  }

  return (
    <div className="mx-auto max-w-[1440px] overflow-x-hidden">
      <header className="mb-3 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:px-4">
        <div className="min-w-0">
          <h1 className="text-lg font-black text-slate-900 sm:text-xl">デッキ作成</h1>
          <p className="text-xs font-bold text-emerald-800">メイン <span data-testid="deck-count">{total}/40</span></p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={savePng} aria-label="デッキをPNGで保存" className="flex min-h-11 items-center gap-1 rounded-xl bg-blue-700 px-3 text-sm font-bold text-white hover:bg-blue-800">
            <Icon name="download" /><span>PNG保存</span>
          </button>
          <button onClick={() => entries.length ? setResetConfirm(true) : resetDeck()} aria-label="デッキをリセット" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-700">
            <Icon name="trash" />
          </button>
        </div>
      </header>

      {notice && <div role="status" className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-xl">{notice}</div>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)] lg:items-start">
        <section aria-labelledby="deck-heading" className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 id="deck-heading" className="text-sm font-black text-slate-800">メインデッキ</h2>
            <span className="text-xs text-slate-500">カードをタップして編集</span>
          </div>
          <div data-testid="deck-list" className={`rounded-xl bg-slate-100 ${deckCards.length ? 'grid grid-cols-8 gap-0.5 lg:grid-cols-10' : 'flex h-[220px] items-center justify-center'}`}>
            {deckCards.length ? deckCards.map(({ entry, copy }) => (
              <button
                key={`${entry.id}-${copy}`}
                type="button"
                aria-label={`${entry.name}を編集`}
                onClick={() => setSelectedId(entry.id)}
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
          <p className="mt-3 border-t pt-3 text-[11px] leading-relaxed text-slate-500">当サービスは権利者各社とは関係のない非公式ファンサービスです。カード画像・名称等の権利は各権利者に帰属します。© TOMY</p>
        </section>

        <section aria-labelledby="search-heading" className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-3">
          <div className="sticky top-0 z-20 rounded-t-2xl border-b border-slate-200 bg-white/95 p-2.5 backdrop-blur sm:p-3">
            <h2 id="search-heading" className="sr-only">カード検索</h2>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">⌕</span>
                <input
                  ref={searchInput}
                  id="card-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="カード名で検索"
                  aria-label="カード名検索"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-10 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
                {query && <button type="button" onClick={() => { setQuery(''); searchInput.current?.focus() }} aria-label="検索文字をクリア" className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-slate-500"><Icon name="close" /></button>}
              </div>
              <button type="button" aria-label="絞り込み（準備中）" title="絞り込みは今後対応予定" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-500"><Icon name="filter" /></button>
            </div>
          </div>
          <div data-testid="search-results" className="grid max-h-[48vh] min-h-24 grid-cols-4 gap-1.5 overflow-y-auto overscroll-contain p-2.5 sm:gap-2 sm:p-3 lg:max-h-[calc(100vh-230px)]">
            {!query.trim() && <p className="col-span-4 py-8 text-center text-sm text-slate-500">カード名を入力してください</p>}
            {query.trim() && results.length === 0 && <p className="col-span-4 py-8 text-center text-sm text-slate-500">検索中、または該当カードがありません</p>}
            {results.map((card) => {
              const count = byId.get(card.id)?.count ?? 0
              const disabled = count >= MAX_SAME_CARD || total >= MAX_DECK_CARDS
              return (
                <article key={card.id} className="group relative min-w-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200">
                  <button type="button" onClick={() => add(card)} disabled={disabled} aria-label={`${card.name}を1枚追加`} className="block w-full disabled:cursor-not-allowed disabled:opacity-60">
                    <CardArt card={card} />
                  </button>
                  <button type="button" onClick={() => add(card)} disabled={disabled} aria-label={`${card.name}を追加`} className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-emerald-700 text-2xl font-light text-white shadow-md disabled:bg-slate-500">
                    {count >= MAX_SAME_CARD ? '✓' : '+'}
                  </button>
                  {count > 0 && <span className="absolute left-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] font-black text-white">{count}/4</span>}
                </article>
              )
            })}
          </div>
        </section>
      </div>

      {selected && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedId(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="card-dialog-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button type="button" onClick={() => setSelectedId(null)} aria-label="カード操作を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow"><Icon name="close" /></button>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <h2 id="card-dialog-title" className="sr-only">{selected.name}</h2>
              <CardArt card={selected} className="mx-auto w-full max-w-[330px] rounded-xl shadow-lg" />
              <p className="mt-3 line-clamp-2 text-center text-sm font-bold text-slate-800">{selected.name}</p>
              <div className="mt-3 flex items-center justify-center gap-5">
                <button type="button" onClick={() => remove(selected.id)} aria-label={`${selected.name}を1枚減らす`} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 text-2xl font-bold">−</button>
                <div className="min-w-20 text-center"><span className="text-3xl font-black">{selected.count}</span><span className="ml-1 text-sm text-slate-500">/4枚</span></div>
                <button type="button" onClick={() => add(selected)} disabled={selected.count >= MAX_SAME_CARD || total >= MAX_DECK_CARDS} aria-label={`${selected.name}を1枚増やす`} className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-2xl font-bold text-white disabled:bg-slate-400">＋</button>
              </div>
              {selected.officialPageUrl && <a href={selected.officialPageUrl} target="_blank" rel="noreferrer" className="mx-auto mt-3 flex min-h-11 w-fit items-center gap-1 px-3 text-sm font-bold text-blue-700 underline">公式ページ <Icon name="external" /></a>}
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
    </div>
  )
}
