'use client'

import { useEffect, useMemo, useState } from 'react'

type PredictionType = 'premium' | 'hall' | 'release'

export type PredictionCandidate = {
  id: string
  name: string
  imageUrl: string | null
  civilization: string[]
  cost: number | null
  cardType: string | null
  regulation: string
}
type Candidate = PredictionCandidate

type Picks = Record<PredictionType, string[]>

const TYPE_META: Record<PredictionType, { label: string; badge: string; button: string; drop: string }> = {
  premium: {
    label: 'プレミアム殿堂',
    badge: 'border-red-300 bg-red-50 text-red-700',
    button: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
    drop: 'border-red-200 bg-red-50/30',
  },
  hall: {
    label: '殿堂入り',
    badge: 'border-amber-300 bg-amber-50 text-amber-700',
    button: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100',
    drop: 'border-amber-200 bg-amber-50/30',
  },
  release: {
    label: '殿堂解除',
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    button: 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    drop: 'border-emerald-200 bg-emerald-50/30',
  },
}

const EMPTY_PICKS: Picks = { premium: [], hall: [], release: [] }
const STORAGE_KEY = 'admin-hall-of-fame-prediction-draft-v1'

function CardImage({ candidate }: { candidate: Candidate }) {
  if (candidate.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidate.imageUrl}
        alt={`${candidate.name} カード画像`}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-2 text-center text-[10px] font-bold leading-tight text-gray-500">
      {candidate.name}
    </div>
  )
}

export function HallOfFamePredictionBuilder({ candidates, totalCandidates }: { candidates: Candidate[]; totalCandidates: number }) {
  const [query, setQuery] = useState('')
  const [civilization, setCivilization] = useState('')
  const [cardType, setCardType] = useState('')
  const [cost, setCost] = useState('')
  const [regulation, setRegulation] = useState('')
  const [picks, setPicks] = useState<Picks>(EMPTY_PICKS)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) queueMicrotask(() => setPicks(JSON.parse(saved) as Picks))
    } catch {
      // 壊れた端末保存値は無視する。
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(picks))
  }, [picks])

  useEffect(() => {
    if (!selectedCandidate) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCandidate(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCandidate])

  const selectedNames = useMemo(() => new Set(Object.values(picks).flat()), [picks])
  const visibleCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return candidates.filter(candidate => (!normalized || candidate.name.toLowerCase().includes(normalized)) && (!civilization || candidate.civilization.includes(civilization)) && (!cardType || candidate.cardType === cardType) && (!cost || candidate.cost === Number(cost)) && (!regulation || candidate.regulation === regulation))
  }, [candidates, query, civilization, cardType, cost, regulation])

  const candidateByName = useMemo(
    () => new Map(candidates.map(candidate => [candidate.name, candidate])),
    [candidates],
  )

  function placeCard(type: PredictionType, name: string) {
    setPicks(current => {
      const next: Picks = {
        premium: current.premium.filter(card => card !== name),
        hall: current.hall.filter(card => card !== name),
        release: current.release.filter(card => card !== name),
      }
      next[type] = [...next[type], name]
      return next
    })
    setSelectedCandidate(null)
    setShowPreview(false)
  }

  function removeCard(type: PredictionType, name: string) {
    setPicks(current => ({ ...current, [type]: current[type].filter(card => card !== name) }))
    setShowPreview(false)
  }

  function reset() {
    if (!window.confirm('選択中の予想をすべて消しますか？')) return
    setPicks(EMPTY_PICKS)
    setShowPreview(false)
  }

  return (
    <div className="space-y-4">
      <section className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-bold">非公開の試作ページです</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-800">
          右側の候補からカードを選び、追加先を決めて予想を作ります。内容はこの端末だけに保存され、まだ公開されません。
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-950 sm:text-2xl">殿堂・プレ殿予想を作る</h1>
          <p className="mt-1 text-xs text-gray-500">カードを選ぶと追加先を指定できます</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="rounded border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">
            クリア
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={selectedNames.size === 0}
            className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            完成イメージを見る
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-4">
          {(Object.keys(TYPE_META) as PredictionType[]).map(type => (
            <section key={type}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${TYPE_META[type].badge}`}>{TYPE_META[type].label}</span>
                <span className="text-xs font-bold tabular-nums text-gray-500">{picks[type].length}枚</span>
              </div>

              <div className={`min-h-32 rounded-xl border border-dashed p-3 ${TYPE_META[type].drop}`}>
                {picks[type].length === 0 ? (
                  <div className="flex min-h-24 items-center justify-center text-xs font-bold text-gray-400">候補からカードを追加してください</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                    {picks[type].map(name => {
                      const candidate = candidateByName.get(name) ?? { id: `missing:${name}`, name, imageUrl: null, civilization: [], cost: null, cardType: null, regulation: 'unknown' }
                      return (
                        <div key={name} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => removeCard(type, name)}
                            aria-label={`${name}を外す`}
                            className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm font-bold text-white opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                          >
                            ×
                          </button>
                          <div className="aspect-[63/88]"><CardImage candidate={candidate} /></div>
                          <p className="min-h-9 px-1 py-1 text-[9px] font-bold leading-tight text-gray-700">{name}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          ))}
        </main>

        <aside className="overflow-hidden rounded-xl border border-gray-300 bg-white xl:sticky xl:top-4 xl:self-start">
          <div className="border-b border-gray-200 p-3">
            <label htmlFor="candidate-search" className="sr-only">候補カードを検索</label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <span aria-hidden="true" className="text-gray-400">⌕</span>
              <input
                id="candidate-search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="カード名を検索"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-xs font-bold text-gray-400 hover:text-gray-700">消去</button>
              )}
            </div>
            <p className="mt-2 text-right text-[11px] text-gray-500">{visibleCandidates.length} / {candidates.length}件表示</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select aria-label="文明" value={civilization} onChange={e => setCivilization(e.target.value)} className="rounded border px-2 py-2 text-xs"><option value="">文明: すべて</option>{[...new Set(candidates.flatMap(c => c.civilization))].map(v => <option key={v}>{v}</option>)}</select>
              <select aria-label="カードタイプ" value={cardType} onChange={e => setCardType(e.target.value)} className="rounded border px-2 py-2 text-xs"><option value="">種類: すべて</option>{[...new Set(candidates.map(c => c.cardType).filter(Boolean))].map(v => <option key={v!}>{v}</option>)}</select>
              <select aria-label="コスト" value={cost} onChange={e => setCost(e.target.value)} className="rounded border px-2 py-2 text-xs"><option value="">コスト: すべて</option>{[...new Set(candidates.map(c => c.cost).filter(v => v !== null))].sort((a,b) => a!-b!).map(v => <option key={v!}>{v}</option>)}</select>
              <select aria-label="regulation" value={regulation} onChange={e => setRegulation(e.target.value)} className="rounded border px-2 py-2 text-xs"><option value="">regulation: すべて</option>{[...new Set(candidates.map(c => c.regulation))].map(v => <option key={v}>{v}</option>)}</select>
            </div>
            {totalCandidates > candidates.length && <p className="mt-2 text-[10px] text-gray-500">全{totalCandidates}件中、このページの{candidates.length}件を絞り込みます。</p>}
          </div>

          <div className="max-h-[68vh] overflow-y-auto p-3">
            {visibleCandidates.length === 0 ? (
              <p className="py-12 text-center text-xs text-gray-400">該当する候補がありません</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {visibleCandidates.map(candidate => {
                  const selected = selectedNames.has(candidate.name)
                  return (
                    <button
                      key={candidate.name}
                      type="button"
                      onClick={() => setSelectedCandidate(candidate)}
                      className={`overflow-hidden rounded-lg border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}`}
                    >
                      <div className="aspect-[63/88] bg-gray-100"><CardImage candidate={candidate} /></div>
                      <div className="min-h-10 px-1 py-1 text-[9px] font-bold leading-tight text-gray-800">{candidate.name}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {showPreview && (
        <section className="rounded-xl border-2 border-gray-900 bg-white p-5 shadow-sm">
          <div className="border-b-2 border-gray-900 pb-3">
            <p className="text-xs font-bold tracking-widest text-gray-500">デュエマ掲示板</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">殿堂・プレ殿予想</h2>
          </div>
          <div className="mt-5 space-y-5">
            {(Object.keys(TYPE_META) as PredictionType[]).map(type => (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${TYPE_META[type].badge}`}>{TYPE_META[type].label}</span>
                  <span className="text-xs font-bold text-gray-500">{picks[type].length}枚</span>
                </div>
                {picks[type].length === 0 ? (
                  <p className="text-xs text-gray-400">選択なし</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {picks[type].map(name => {
                      const candidate = candidateByName.get(name) ?? { id: `missing:${name}`, name, imageUrl: null, civilization: [], cost: null, cardType: null, regulation: 'unknown' }
                      return (
                        <div key={name}>
                          <div className="aspect-[63/88] overflow-hidden rounded border border-gray-200"><CardImage candidate={candidate} /></div>
                          <p className="mt-1 text-[9px] font-bold leading-tight text-gray-700">{name}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedCandidate && (
        <div
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSelectedCandidate(null)
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
        >
          <section role="dialog" aria-modal="true" aria-labelledby="prediction-card-dialog-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="prediction-card-dialog-title" className="text-sm font-black leading-snug text-gray-900">{selectedCandidate.name}</h2>
              <button type="button" onClick={() => setSelectedCandidate(null)} aria-label="閉じる" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-gray-500 hover:bg-gray-100">×</button>
            </div>

            <div className="mx-auto mt-4 aspect-[63/88] w-36 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm">
              <CardImage candidate={selectedCandidate} />
            </div>

            <p className="mt-4 text-center text-xs font-bold text-gray-500">このカードをどこに入れますか？</p>
            <div className="mt-3 space-y-2">
              {(Object.keys(TYPE_META) as PredictionType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => placeCard(type, selectedCandidate.name)}
                  className={`w-full rounded-xl border px-4 py-3 text-sm font-black transition ${TYPE_META[type].button}`}
                >
                  {TYPE_META[type].label}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
