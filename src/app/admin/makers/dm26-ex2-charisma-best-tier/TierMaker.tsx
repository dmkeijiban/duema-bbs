'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { emptyMakerDraft, type MakerCard, type MakerDraft, type MakerGroup } from '@/lib/maker'
import { saveTierSubmission } from './actions'

const STORAGE_KEY = 'maker-draft:dm26-ex2-charisma-best-tier:v1'

type TierMakerProps = {
  cards: MakerCard[]
  groups: MakerGroup[]
  initialDraft: MakerDraft
  unrated: boolean
  canSave: boolean
}

function CardImage({ card }: { card: MakerCard }) {
  if (card.imageUrl) {
    return <img src={card.imageUrl} alt={card.name} loading="lazy" className="h-full w-full object-cover" />
  }
  return <div className="flex h-full items-center justify-center bg-slate-200 p-1 text-center text-[9px] font-bold text-slate-500">{card.name}</div>
}

function restoreDraft(value: unknown, groups: MakerGroup[], validCardIds: Set<string>): MakerDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const restored = emptyMakerDraft(groups)
  const seen = new Set<string>()
  for (const group of groups) {
    const ids = source[group.key]
    if (!Array.isArray(ids)) continue
    for (const id of ids) {
      if (typeof id !== 'string' || !validCardIds.has(id) || seen.has(id)) continue
      seen.add(id)
      restored[group.key].push(id)
    }
  }
  return restored
}

export default function TierMaker({ cards, groups, initialDraft, unrated, canSave }: TierMakerProps) {
  const [draft, setDraft] = useState(initialDraft)
  const [selected, setSelected] = useState<MakerCard | null>(null)
  const [query, setQuery] = useState('')
  const [civilization, setCivilization] = useState('')
  const [cost, setCost] = useState('')
  const [cardType, setCardType] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  const cardsById = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards])
  const validCardIds = useMemo(() => new Set(cards.map(card => card.id)), [cards])
  const usedCardIds = useMemo(() => new Set(Object.values(draft).flat()), [draft])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const restored = restoreDraft(JSON.parse(stored), groups, validCardIds)
      if (restored) queueMicrotask(() => setDraft(restored))
    } catch (error) {
      console.warn('Tier表の下書きを復元できませんでした', error)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [groups, validCardIds])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch (error) {
      console.warn('Tier表の下書きを保存できませんでした', error)
    }
  }, [draft])

  useEffect(() => {
    if (!selected) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [selected])

  const visibleCards = cards.filter(card => {
    if (usedCardIds.has(card.id)) return false
    if (query && !card.name.toLowerCase().includes(query.toLowerCase())) return false
    if (civilization && !card.civilization.includes(civilization)) return false
    if (cost && card.cost !== Number(cost)) return false
    if (cardType && card.cardType !== cardType) return false
    return true
  })

  const civilizationOptions = [...new Set(cards.flatMap(card => card.civilization))]
  const costOptions = [...new Set(cards.map(card => card.cost).filter((value): value is number => value !== null))].sort((a, b) => a - b)
  const cardTypeOptions = [...new Set(cards.map(card => card.cardType).filter((value): value is string => Boolean(value)))]

  function moveCard(cardId: string, groupKey: string | null) {
    setDraft(current => {
      const next = Object.fromEntries(Object.entries(current).map(([key, ids]) => [key, ids.filter(id => id !== cardId)])) as MakerDraft
      if (groupKey && next[groupKey]) next[groupKey] = [...next[groupKey], cardId]
      return next
    })
    setSelected(null)
  }

  function reorderCard(groupKey: string, cardId: string, delta: number) {
    setDraft(current => {
      const ids = current[groupKey]
      if (!ids) return current
      const nextIds = [...ids]
      const currentIndex = nextIds.indexOf(cardId)
      const nextIndex = currentIndex + delta
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= nextIds.length) return current
      ;[nextIds[currentIndex], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[currentIndex]]
      return { ...current, [groupKey]: nextIds }
    })
  }

  function save() {
    if (!canSave) {
      setMessage('確認用モードではDB保存できません。操作内容はこの端末の下書きに保存されます。')
      return
    }
    setMessage('')
    startTransition(async () => {
      try {
        const result = await saveTierSubmission(draft)
        setMessage(result.message)
      } catch (error) {
        console.error('Tier表の保存に失敗しました', error)
        setMessage('保存に失敗しました。時間をおいて再度お試しください。')
      }
    })
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-3">
        {groups.map(group => (
          <div key={group.key} className={`grid min-h-28 grid-cols-[52px_1fr] rounded-xl border ${group.color}`}>
            <div className="flex items-center justify-center text-2xl font-black">{group.label}</div>
            <div className="grid grid-cols-4 gap-2 bg-white/80 p-2 sm:grid-cols-7">
              {draft[group.key]?.map(cardId => {
                const card = cardsById.get(cardId)
                if (!card) return null
                return (
                  <div key={cardId} className="group relative">
                    <button type="button" onClick={() => setSelected(card)} aria-label={card.name} className="w-full overflow-hidden rounded border bg-white">
                      <div className="aspect-[63/88]"><CardImage card={card} /></div>
                    </button>
                    <div className="mt-1 flex justify-center gap-1">
                      <button type="button" aria-label="左へ" onClick={() => reorderCard(group.key, cardId, -1)} className="rounded border px-2">←</button>
                      <button type="button" aria-label="右へ" onClick={() => reorderCard(group.key, cardId, 1)} className="rounded border px-2">→</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { if (confirm('全てリセットしますか？')) setDraft(emptyMakerDraft(groups)) }} className="rounded border bg-white px-3 py-2 text-sm font-bold">リセット</button>
          <button type="button" disabled={pending || !canSave} onClick={save} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? '保存中...' : canSave ? '上書き保存' : '確認用（保存不可）'}
          </button>
          {message && <span className="self-center text-sm">{message}</span>}
        </div>

        <div className="rounded-xl border-2 border-slate-900 bg-white p-4">
          <p className="text-xs font-bold">デュエマ掲示板</p>
          <h2 className="text-xl font-black">DM26-EX2 Tier表</h2>
          <p className="mt-1 text-xs text-gray-500">完成画像用プレビュー（1200×1200 / 1080×1350対応予定）</p>
        </div>
      </section>

      <aside className="h-fit rounded-xl border bg-white p-3 lg:sticky lg:top-3">
        <h2 className="font-black">{unrated ? `未評価 ${visibleCards.length}枚` : `候補 ${visibleCards.length}枚`}</h2>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="カード名検索" className="mt-2 w-full rounded border p-2 text-sm" />
        <div className="mt-2 grid grid-cols-3 gap-1">
          <select aria-label="文明" value={civilization} onChange={event => setCivilization(event.target.value)} className="rounded border p-1 text-xs">
            <option value="">文明</option>{civilizationOptions.map(value => <option key={value}>{value}</option>)}
          </select>
          <select aria-label="コスト" value={cost} onChange={event => setCost(event.target.value)} className="rounded border p-1 text-xs">
            <option value="">コスト</option>{costOptions.map(value => <option key={value}>{value}</option>)}
          </select>
          <select aria-label="種類" value={cardType} onChange={event => setCardType(event.target.value)} className="rounded border p-1 text-xs">
            <option value="">種類</option>{cardTypeOptions.map(value => <option key={value}>{value}</option>)}
          </select>
        </div>
        <div className="mt-3 grid max-h-[70vh] grid-cols-3 gap-2 overflow-auto">
          {visibleCards.map(card => (
            <button type="button" key={card.id} onClick={() => setSelected(card)} aria-label={card.name} className="overflow-hidden rounded border">
              <div className="aspect-[63/88]"><CardImage card={card} /></div>
            </button>
          ))}
        </div>
        {cards.length === 0 && <p className="py-10 text-center text-xs text-gray-400">企画カードは未登録です</p>}
      </aside>

      {selected && (
        <div onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h3 className="font-black">{selected.name}</h3>
            <div className="mx-auto mt-3 aspect-[63/88] w-40 overflow-hidden rounded border bg-white sm:w-48">
              <CardImage card={selected} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {groups.map(group => (
                <button type="button" key={group.key} onClick={() => moveCard(selected.id, group.key)} className={`rounded border p-3 font-black ${group.color}`}>{group.label}</button>
              ))}
              {unrated && <button type="button" onClick={() => moveCard(selected.id, null)} className="rounded border p-3 font-bold">未評価へ戻す</button>}
            </div>
            <button type="button" onClick={() => setSelected(null)} className="mt-3 w-full text-sm">閉じる</button>
          </div>
        </div>
      )}
    </div>
  )
}
