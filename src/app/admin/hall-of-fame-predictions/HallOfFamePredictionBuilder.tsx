'use client'

import { useEffect, useMemo, useState } from 'react'

type PredictionType = 'premium' | 'hall' | 'release'

type Candidate = {
  name: string
  imageUrl: string | null
}

type Picks = Record<PredictionType, string[]>

const TYPE_META: Record<PredictionType, { label: string; badge: string; border: string }> = {
  premium: { label: 'プレミアム殿堂', badge: 'bg-red-50 text-red-700 border-red-300', border: 'border-red-200' },
  hall: { label: '殿堂入り', badge: 'bg-amber-50 text-amber-700 border-amber-300', border: 'border-amber-200' },
  release: { label: '殿堂解除', badge: 'bg-emerald-50 text-emerald-700 border-emerald-300', border: 'border-emerald-200' },
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

export function HallOfFamePredictionBuilder({ candidates }: { candidates: Candidate[] }) {
  const [query, setQuery] = useState('')
  const [picks, setPicks] = useState<Picks>(EMPTY_PICKS)
  const [activeType, setActiveType] = useState<PredictionType>('hall')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) setPicks(JSON.parse(saved) as Picks)
    } catch {
      // 壊れた端末保存値は無視する。
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(picks))
  }, [picks])

  const selectedNames = useMemo(() => new Set(Object.values(picks).flat()), [picks])
  const visibleCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return candidates
    return candidates.filter(candidate => candidate.name.toLowerCase().includes(normalized))
  }, [candidates, query])

  const candidateByName = useMemo(
    () => new Map(candidates.map(candidate => [candidate.name, candidate])),
    [candidates],
  )

  function addCard(name: string) {
    setPicks(current => {
      const next: Picks = {
        premium: current.premium.filter(card => card !== name),
        hall: current.hall.filter(card => card !== name),
        release: current.release.filter(card => card !== name),
      }
      next[activeType] = [...next[activeType], name]
      return next
    })
  }

  function removeCard(type: PredictionType, name: string) {
    setPicks(current => ({ ...current, [type]: current[type].filter(card => card !== name) }))
  }

  function reset() {
    if (!window.confirm('選択中の予想をすべて消しますか？')) return
    setPicks(EMPTY_PICKS)
    setShowPreview(false)
  }

  return (
    <div className="space-y-5">
      <section className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-bold">非公開の試作ページです</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-800">
          候補カードを1つのプールから検索し、選択中の区分へ追加します。選択内容はこの端末だけに保存され、まだDB送信や公開はされません。
        </p>
      </section>

      <section className="rounded border border-gray-300 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <label htmlFor="candidate-search" className="text-xs font-bold text-gray-700">候補カードを検索</label>
            <input
              id="candidate-search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="カード名を入力"
              className="mt-1 h-11 w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-gray-700">追加先</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_META) as PredictionType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveType(type)}
                  className={`rounded border px-3 py-2 text-xs font-bold ${activeType === type ? TYPE_META[type].badge : 'border-gray-300 bg-white text-gray-600'}`}
                >
                  {TYPE_META[type].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">{visibleCandidates.length}件表示 / 候補全{candidates.length}件</p>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {visibleCandidates.map(candidate => {
            const selected = selectedNames.has(candidate.name)
            return (
              <button
                key={candidate.name}
                type="button"
                onClick={() => addCard(candidate.name)}
                className={`overflow-hidden rounded border bg-white text-left transition ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-400'}`}
              >
                <div className="aspect-[63/88] bg-gray-100"><CardImage candidate={candidate} /></div>
                <div className="min-h-12 px-1.5 py-1.5 text-[10px] font-bold leading-tight text-gray-800">
                  {candidate.name}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(TYPE_META) as PredictionType[]).map(type => (
          <section key={type} className={`rounded border bg-white ${TYPE_META[type].border}`}>
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
              <span className={`rounded border px-2 py-1 text-xs font-bold ${TYPE_META[type].badge}`}>{TYPE_META[type].label}</span>
              <span className="text-xs font-bold tabular-nums text-gray-500">{picks[type].length}枚</span>
            </div>
            {picks[type].length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-gray-400">まだ選択されていません</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 p-3">
                {picks[type].map(name => {
                  const candidate = candidateByName.get(name) ?? { name, imageUrl: null }
                  return (
                    <div key={name} className="relative overflow-hidden rounded border border-gray-200 bg-white">
                      <button
                        type="button"
                        onClick={() => removeCard(type, name)}
                        aria-label={`${name}を外す`}
                        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm font-bold text-white"
                      >
                        ×
                      </button>
                      <div className="aspect-[63/88]"><CardImage candidate={candidate} /></div>
                      <p className="min-h-10 px-1 py-1 text-[9px] font-bold leading-tight text-gray-700">{name}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={reset} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">
          リセット
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={selectedNames.size === 0}
          className="rounded bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          予想を完成させる
        </button>
      </div>

      {showPreview && (
        <section className="rounded border-2 border-gray-800 bg-white p-5 shadow-sm">
          <div className="border-b-2 border-gray-900 pb-3">
            <p className="text-xs font-bold tracking-widest text-gray-500">デュエマ掲示板</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">殿堂・プレ殿予想</h2>
          </div>
          <div className="mt-5 space-y-5">
            {(Object.keys(TYPE_META) as PredictionType[]).map(type => (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded border px-2 py-1 text-xs font-bold ${TYPE_META[type].badge}`}>{TYPE_META[type].label}</span>
                  <span className="text-xs font-bold text-gray-500">{picks[type].length}枚</span>
                </div>
                {picks[type].length === 0 ? (
                  <p className="text-xs text-gray-400">選択なし</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {picks[type].map(name => {
                      const candidate = candidateByName.get(name) ?? { name, imageUrl: null }
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
    </div>
  )
}
