'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DeckCard } from '@/lib/deck-maker'
import { getSavedDeckNames } from '@/lib/deck-maker-names'
import { CardCatalogSearchPanel } from '@/components/CardCatalogSearchPanel'
import { useCardCatalogSearch } from '@/hooks/use-card-catalog-search'
import { cardPrintingKey, exactCardImageUrl } from '@/lib/card-catalog-shared'
import { renderResumeExportImage, resumePngFileName } from '@/lib/maker-resume-export'
import {
  RESUME_ACHIEVEMENT_PRESETS,
  RESUME_FAVORITE_CIVILIZATIONS,
  RESUME_HISTORY_PRESETS,
  RESUME_MAX_DECK_ROWS,
  RESUME_MAX_HISTORY_ROWS,
  RESUME_PHOTO_CAPTION_LABELS,
  RESUME_PLAY_STYLES,
  RESUME_REGIONS,
  RESUME_SOCIAL_TAG_PRESETS,
  clampAboutText,
  emptyResumeData,
  isResumeComplete,
  sanitizeResumeData,
  RESUME_MAKER_SLUG,
  type ResumeData,
  type ResumePhotoCard,
} from '@/lib/maker-resume'
import { ScaledResumePreview } from './ResumePreview'
import { RESUME_DRAFT_STORAGE_KEY, RESUME_STEPS, RESUME_SHARE_TEXT } from './constants'
import type { ResumeInitialState } from './types'
import { saveResumeSubmission, setResumeVisibility } from './actions'

type PngPreview = { src: string; fileName: string; file: File }

export default function ResumeMaker({ initial }: { initial: ResumeInitialState }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [data, setData] = useState<ResumeData>(emptyResumeData())
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [submissionId, setSubmissionId] = useState<string | null>(initial.submissionId)
  const [deckNameCandidates, setDeckNameCandidates] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [isSavingResume, setIsSavingResume] = useState(false)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false)
  const [pngPreview, setPngPreview] = useState<PngPreview | null>(null)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)
  const [versionCard, setVersionCard] = useState<DeckCard | null>(null)
  const [versionOptions, setVersionOptions] = useState<DeckCard[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const hydrated = useRef(false)
  const versionAbort = useRef<AbortController | null>(null)
  const { query, setQuery, cards: results, loading: resultsLoading, hasMore, loadMore } = useCardCatalogSearch()

  useEffect(() => {
    setDeckNameCandidates(getSavedDeckNames())
    try {
      if (initial.data) {
        setData(initial.data)
      } else {
        const raw = localStorage.getItem(RESUME_DRAFT_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as { data?: unknown; isPublic?: unknown }
          setData(sanitizeResumeData(parsed.data))
          if (typeof parsed.isPublic === 'boolean') setIsPublic(parsed.isPublic)
        } else if (initial.profileDefaults?.avatarUrl) {
          setData(current => ({ ...current, photo: { type: 'avatar' } }))
        }
      }
    } catch {
      localStorage.removeItem(RESUME_DRAFT_STORAGE_KEY)
    }
    hydrated.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    try { localStorage.setItem(RESUME_DRAFT_STORAGE_KEY, JSON.stringify({ data, isPublic })) } catch { /* ignore quota errors */ }
  }, [data, isPublic])

  useEffect(() => {
    if (!photoPickerOpen && !versionCard && !pngPreview && !mobilePreviewOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [photoPickerOpen, versionCard, pngPreview, mobilePreviewOpen])

  useEffect(() => () => versionAbort.current?.abort(), [])

  const complete = isResumeComplete(data)

  function update<K extends keyof ResumeData>(key: K, value: ResumeData[K]) {
    setData(current => ({ ...current, [key]: value }))
  }

  function addHistoryRow() {
    if (data.history.length >= RESUME_MAX_HISTORY_ROWS) return
    update('history', [...data.history, { id: crypto.randomUUID(), period: '', content: '' }])
  }
  function updateHistoryRow(id: string, patch: Partial<{ period: string; content: string }>) {
    update('history', data.history.map(row => row.id === id ? { ...row, ...patch } : row))
  }
  function removeHistoryRow(id: string) {
    update('history', data.history.filter(row => row.id !== id))
  }
  function moveHistoryRow(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= data.history.length) return
    const next = [...data.history]
    ;[next[index], next[target]] = [next[target], next[index]]
    update('history', next)
  }

  function addDeckRow() {
    if (data.deckHistory.length >= RESUME_MAX_DECK_ROWS) return
    update('deckHistory', [...data.deckHistory, { id: crypto.randomUUID(), period: '', deckName: '' }])
  }
  function updateDeckRow(id: string, patch: Partial<{ period: string; deckName: string }>) {
    update('deckHistory', data.deckHistory.map(row => row.id === id ? { ...row, ...patch } : row))
  }
  function removeDeckRow(id: string) {
    update('deckHistory', data.deckHistory.filter(row => row.id !== id))
  }

  function toggleAchievement(key: string) {
    update('achievements', data.achievements.includes(key) ? data.achievements.filter(item => item !== key) : [...data.achievements, key])
  }
  function toggleSocialTag(key: string) {
    update('socialTags', data.socialTags.includes(key) ? data.socialTags.filter(item => item !== key) : [...data.socialTags, key])
  }

  async function openVersionPicker(card: DeckCard) {
    versionAbort.current?.abort()
    const controller = new AbortController()
    versionAbort.current = controller
    setVersionCard(card)
    setVersionOptions([card])
    setVersionsLoading(true)
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(card.id)}/printings`, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new Error('収録版を取得できませんでした')
      const payload = await response.json() as { cards?: DeckCard[] }
      const options = payload.cards?.length ? payload.cards : [card]
      setVersionOptions([...new Map(options.map(option => [cardPrintingKey(option), option])).values()])
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('収録版の取得に失敗しました。表示中の版は選択できます')
    } finally {
      if (!controller.signal.aborted) setVersionsLoading(false)
    }
  }

  function selectPhotoCard(card: DeckCard) {
    const caption = data.photo?.type === 'card' ? data.photo.caption : 'favorite'
    const photo: ResumePhotoCard = { type: 'card', cardId: card.id, sourceKey: card.sourceKey ?? null, faceSideIndex: card.matchedFace?.sideIndex ?? null, name: card.name, imageUrl: card.imageUrl, caption }
    update('photo', photo)
    setVersionCard(null)
    setVersionOptions([])
    setPhotoPickerOpen(false)
  }

  function setPhotoCaption(caption: ResumePhotoCard['caption']) {
    if (data.photo?.type !== 'card') return
    update('photo', { ...data.photo, caption })
  }

  async function persistToDb(nextIsPublic: boolean): Promise<string | null> {
    if (!initial.loggedIn) return null
    const result = await saveResumeSubmission({ data, isPublic: nextIsPublic })
    setMessage(result.message)
    if (result.ok && result.submissionId) { setSubmissionId(result.submissionId); return result.submissionId }
    return null
  }

  async function handleSaveResume() {
    if (isSavingResume || !complete) { if (!complete) setMessage('ハンドルネームを入力してください'); return }
    setIsSavingResume(true)
    try { await persistToDb(isPublic) } finally { setIsSavingResume(false) }
  }

  async function handleToggleVisibility() {
    if (isTogglingVisibility || !submissionId) return
    setIsTogglingVisibility(true)
    const next = !isPublic
    try {
      const result = await setResumeVisibility(next)
      if (result.ok) setIsPublic(next)
      setMessage(result.message)
    } finally {
      setIsTogglingVisibility(false)
    }
  }

  async function handleSaveImage() {
    if (isSavingImage || !complete) { if (!complete) setMessage('ハンドルネームを入力してください'); return }
    setIsSavingImage(true)
    try {
      const photo = data.photo?.type === 'avatar'
        ? { kind: 'avatar' as const, url: initial.profileDefaults?.avatarUrl ?? null, caption: null }
        : data.photo?.type === 'card'
          ? { kind: 'card' as const, url: data.photo.imageUrl ? exactCardImageUrl({ id: data.photo.cardId, imageUrl: data.photo.imageUrl }, RESUME_MAKER_SLUG) : null, caption: RESUME_PHOTO_CAPTION_LABELS[data.photo.caption] }
          : null
      const blob = await renderResumeExportImage(data, photo)
      const fileName = resumePngFileName(data.handleName)
      const file = new File([blob], fileName, { type: blob.type || 'image/png' })
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      setPngPreview({ src, fileName, file })
      if (initial.loggedIn) void persistToDb(isPublic)
    } catch {
      setMessage('画像生成に失敗しました')
    } finally {
      setIsSavingImage(false)
    }
  }

  async function savePreviewImage() {
    if (!pngPreview) return
    const shareData: ShareData = { files: [pngPreview.file], title: 'デュエマ履歴書' }
    const canShareFile = typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare(shareData))
    if (canShareFile) {
      try { await navigator.share(shareData); return } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return }
    }
    const link = document.createElement('a')
    link.href = pngPreview.src
    link.download = pngPreview.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function handleShare() {
    if (isSharing || !complete) { if (!complete) setMessage('ハンドルネームを入力してください'); return }
    setIsSharing(true)
    const shareWindow = window.open('', '_blank')
    try {
      if (initial.loggedIn) await persistToDb(isPublic)
      const intent = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: RESUME_SHARE_TEXT, url: 'https://www.duema-bbs.com/makers/resume-maker' })}`
      if (shareWindow) shareWindow.location.href = intent
      else window.open(intent, '_blank', 'noopener,noreferrer')
    } catch {
      shareWindow?.close()
      setMessage('X共有の準備に失敗しました')
    } finally {
      setIsSharing(false)
    }
  }

  const photoImageUrl = useMemo(() => data.photo?.type === 'card' ? data.photo.imageUrl : null, [data.photo])
  const avatarUrl = initial.profileDefaults?.avatarUrl ?? null

  return (
    <div className="pb-24">
      <header className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <h1 className="text-lg font-black text-slate-900">デュエマ履歴書メーカー</h1>
        <p className="mt-1 text-xs text-slate-500">あなたのデュエマ歴を、本物の履歴書風にまとめよう。入力内容はこの端末に自動保存されます。</p>
        <nav className="mt-3 flex gap-2">
          {RESUME_STEPS.map(item => (
            <button key={item.id} type="button" onClick={() => setStep(item.id)} className={`min-h-9 flex-1 rounded-lg border px-2 text-sm font-bold transition-colors ${step === item.id ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
              STEP{item.id} {item.label}
            </button>
          ))}
        </nav>
        {message && <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
        <button type="button" onClick={() => setMobilePreviewOpen(true)} className="mt-3 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 lg:hidden">プレビューを見る</button>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-start">
        <div className="min-w-0 space-y-3">
          {step === 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
              <h2 className="font-black text-slate-900">基本情報</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700">ハンドルネーム（必須）
                  <input value={data.handleName} onChange={e => update('handleName', e.target.value.slice(0, 30))} maxLength={30} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="デュエマ太郎" />
                </label>
                <label className="text-xs font-bold text-slate-700">デュエマを始めた時期
                  <input value={data.startedAt} onChange={e => update('startedAt', e.target.value.slice(0, 20))} maxLength={20} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="例: 2023年" />
                </label>
                <label className="text-xs font-bold text-slate-700">活動地域
                  <select value={data.region} onChange={e => update('region', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100">
                    <option value="">選択しない</option>
                    {RESUME_REGIONS.map(region => <option key={region} value={region}>{region}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">好きな文明
                  <select value={data.favoriteCivilization} onChange={e => update('favoriteCivilization', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100">
                    <option value="">選択しない</option>
                    {RESUME_FAVORITE_CIVILIZATIONS.map(option => <option key={option.value} value={option.label}>{option.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">プレイスタイル
                  <select value={data.playStyle} onChange={e => update('playStyle', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100">
                    <option value="">選択しない</option>
                    {RESUME_PLAY_STYLES.map(option => <option key={option.value} value={option.label}>{option.label}</option>)}
                  </select>
                </label>
              </div>

              <h2 className="mt-5 font-black text-slate-900">証明写真</h2>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => update('photo', { type: 'avatar' })} className={`min-h-10 flex-1 rounded-lg border px-3 text-sm font-bold ${data.photo?.type === 'avatar' ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>プロフィールアイコンを使う</button>
                <button type="button" onClick={() => setPhotoPickerOpen(true)} className={`min-h-10 flex-1 rounded-lg border px-3 text-sm font-bold ${data.photo?.type === 'card' ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>カードを選ぶ</button>
              </div>
              {data.photo?.type === 'avatar' && <div className="mt-3 flex items-center gap-3"><div className="h-16 w-16 overflow-hidden rounded-full border border-slate-300 bg-slate-100">{avatarUrl ? <img src={avatarUrl} alt="プロフィールアイコン" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-slate-400">未設定</div>}</div><p className="text-xs text-slate-500">プロフィールのアイコンを証明写真として使います。</p></div>}
              {data.photo?.type === 'card' && (
                <div className="mt-3 flex items-start gap-3">
                  <div className="h-24 w-20 overflow-hidden rounded-lg border border-slate-300 bg-slate-100">{data.photo.imageUrl ? <img src={data.photo.imageUrl} alt={data.photo.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-[10px] text-slate-400">画像なし</div>}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{data.photo.name}</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {(Object.keys(RESUME_PHOTO_CAPTION_LABELS) as ResumePhotoCard['caption'][]).map(caption => (
                        <button key={caption} type="button" onClick={() => setPhotoCaption(caption)} className={`min-h-8 rounded-md border px-2 text-xs font-bold ${data.photo?.type === 'card' && data.photo.caption === caption ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}>{RESUME_PHOTO_CAPTION_LABELS[caption]}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
              <div className="flex items-center justify-between"><h2 className="font-black text-slate-900">デュエマ歴</h2><span className="text-xs text-slate-500">{data.history.length} / {RESUME_MAX_HISTORY_ROWS}行</span></div>
              <div className="mt-3 space-y-2">
                {data.history.map((row, index) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 p-2">
                    <div className="flex gap-2">
                      <input value={row.period} onChange={e => updateHistoryRow(row.id, { period: e.target.value.slice(0, 20) })} maxLength={20} placeholder="時期（例: 2023年4月）" className="h-9 w-32 shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm outline-none focus:border-emerald-700" />
                      <input value={row.content} onChange={e => updateHistoryRow(row.id, { content: e.target.value.slice(0, 40) })} maxLength={40} placeholder="内容" list="resume-history-presets" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm outline-none focus:border-emerald-700" />
                    </div>
                    <div className="mt-1.5 flex justify-end gap-1">
                      <button type="button" onClick={() => moveHistoryRow(index, -1)} disabled={index === 0} aria-label="上へ移動" className="min-h-7 rounded border border-slate-300 px-2 text-xs disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => moveHistoryRow(index, 1)} disabled={index === data.history.length - 1} aria-label="下へ移動" className="min-h-7 rounded border border-slate-300 px-2 text-xs disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => removeHistoryRow(row.id)} className="min-h-7 rounded border border-red-300 px-2 text-xs text-red-700">削除</button>
                    </div>
                  </div>
                ))}
                <datalist id="resume-history-presets">{RESUME_HISTORY_PRESETS.map(preset => <option key={preset.key} value={preset.label} />)}</datalist>
                <button type="button" onClick={addHistoryRow} disabled={data.history.length >= RESUME_MAX_HISTORY_ROWS} className="min-h-10 w-full rounded-lg border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">+ 行を追加</button>
              </div>

              <div className="mt-5 flex items-center justify-between"><h2 className="font-black text-slate-900">使用デッキ歴</h2><span className="text-xs text-slate-500">{data.deckHistory.length} / {RESUME_MAX_DECK_ROWS}行</span></div>
              <div className="mt-3 space-y-2">
                {data.deckHistory.map(row => (
                  <div key={row.id} className="flex gap-2">
                    <input value={row.period} onChange={e => updateDeckRow(row.id, { period: e.target.value.slice(0, 20) })} maxLength={20} placeholder="時期" className="h-9 w-24 shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm outline-none focus:border-emerald-700" />
                    <input value={row.deckName} onChange={e => updateDeckRow(row.id, { deckName: e.target.value.slice(0, 60) })} maxLength={60} placeholder="デッキ名（候補から選択・手入力可）" list="resume-deck-name-candidates" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm outline-none focus:border-emerald-700" />
                    <button type="button" onClick={() => removeDeckRow(row.id)} className="min-h-9 shrink-0 rounded-lg border border-red-300 px-2 text-xs text-red-700">削除</button>
                  </div>
                ))}
                <datalist id="resume-deck-name-candidates">{deckNameCandidates.map(name => <option key={name} value={name} />)}</datalist>
                {deckNameCandidates.length === 0 && <p className="text-xs text-slate-400">デッキメーカーで保存したデッキがあると、名前を候補から選べます。</p>}
                <button type="button" onClick={addDeckRow} disabled={data.deckHistory.length >= RESUME_MAX_DECK_ROWS} className="min-h-10 w-full rounded-lg border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">+ 行を追加</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
              <h2 className="font-black text-slate-900">大会・デュエマ実績</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {RESUME_ACHIEVEMENT_PRESETS.map(preset => (
                  <button key={preset.key} type="button" onClick={() => toggleAchievement(preset.key)} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${data.achievements.includes(preset.key) ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}>{preset.label}</button>
                ))}
              </div>
              <input value={data.achievementNote} onChange={e => update('achievementNote', e.target.value.slice(0, 40))} maxLength={40} placeholder="自由記述（任意）" className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm outline-none focus:border-emerald-700" />

              <h2 className="mt-5 font-black text-slate-900">私にとってデュエマとは</h2>
              <textarea value={data.aboutDuema} onChange={e => update('aboutDuema', clampAboutText(e.target.value))} maxLength={120} rows={4} placeholder="自由に書いてみましょう（最大120文字）" className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm outline-none focus:border-emerald-700" />
              <p className="mt-1 text-right text-[11px] text-slate-400">{data.aboutDuema.length} / 120</p>

              <h2 className="mt-4 font-black text-slate-900">対戦・交流について</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {RESUME_SOCIAL_TAG_PRESETS.map(preset => (
                  <button key={preset.key} type="button" onClick={() => toggleSocialTag(preset.key)} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${data.socialTags.includes(preset.key) ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}>{preset.label}</button>
                ))}
              </div>
              <input value={data.socialNote} onChange={e => update('socialNote', e.target.value.slice(0, 40))} maxLength={40} placeholder="自由記述（任意）" className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm outline-none focus:border-emerald-700" />
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">本名、住所、学校名、勤務先など、個人を特定できる情報は入力しないでください。</p>

              {initial.loggedIn && submissionId && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-sm font-bold text-slate-700">投稿者ページへの掲載</span>
                  <button type="button" onClick={() => void handleToggleVisibility()} disabled={isTogglingVisibility} className={`min-h-9 rounded-full px-4 text-xs font-bold text-white ${isPublic ? 'bg-emerald-700' : 'bg-slate-400'} disabled:opacity-60`}>{isTogglingVisibility ? '変更中...' : isPublic ? '公開中' : '非公開'}</button>
                </div>
              )}

              <Link href="/makers/my-duema-9" className="mt-4 block rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center text-sm font-bold text-indigo-800 hover:bg-indigo-100">私を象徴するデュエマカード9選を作る</Link>
            </section>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(current => (current > 1 ? current - 1 : current) as 1 | 2 | 3)} disabled={step === 1} className="min-h-10 flex-1 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-30">戻る</button>
            <button type="button" onClick={() => setStep(current => (current < 3 ? current + 1 : current) as 1 | 2 | 3)} disabled={step === 3} className="min-h-10 flex-1 rounded-lg border border-slate-300 text-sm font-bold text-slate-500 disabled:opacity-30">スキップ</button>
            <button type="button" onClick={() => setStep(current => (current < 3 ? current + 1 : current) as 1 | 2 | 3)} disabled={step === 3} className="min-h-10 flex-1 rounded-lg bg-emerald-700 text-sm font-bold text-white disabled:opacity-40">次へ</button>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <ScaledResumePreview data={data} avatarUrl={avatarUrl} photoImageUrl={photoImageUrl} className="mx-auto" />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-2 backdrop-blur">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-2 sm:grid-cols-4">
          <button type="button" disabled={!complete || isSavingImage} onClick={() => void handleSaveImage()} className="min-h-11 rounded-lg bg-blue-700 px-3 text-sm font-bold text-white disabled:bg-slate-300">{isSavingImage ? '生成中...' : '画像保存'}</button>
          <button type="button" disabled={!complete || isSharing} onClick={() => void handleShare()} className="min-h-11 rounded-lg bg-black px-3 text-sm font-bold text-white disabled:bg-slate-300">{isSharing ? '共有準備中...' : 'X共有'}</button>
          {initial.loggedIn ? (
            <button type="button" disabled={!complete || isSavingResume} onClick={() => void handleSaveResume()} className="min-h-11 rounded-lg border border-emerald-700 px-3 text-sm font-bold text-emerald-800 disabled:opacity-40">{isSavingResume ? '保存中...' : '履歴書を保存'}</button>
          ) : (
            <Link href="/login?mode=signup" className="flex min-h-11 items-center justify-center rounded-lg border border-emerald-700 px-3 text-center text-xs font-bold text-emerald-800">登録して保存する</Link>
          )}
          {initial.profileSlug ? <Link href={`/u/${initial.profileSlug}`} className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 text-center text-sm font-bold text-slate-700">投稿者ページを見る</Link> : <span />}
        </div>
        {!initial.loggedIn && <p className="mx-auto mt-2 max-w-[1200px] text-center text-[11px] text-slate-500">無料登録すると、この履歴書を後から編集し、投稿者ページに掲載できます。</p>}
      </div>

      {photoPickerOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setPhotoPickerOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-photo-picker-title" className="flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 id="resume-photo-picker-title" className="font-black">証明写真にするカードを選ぶ</h2><button type="button" onClick={() => setPhotoPickerOpen(false)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-slate-100">×</button></div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <CardCatalogSearchPanel cards={results} query={query} loading={resultsLoading} hasMore={hasMore} onLoadMore={loadMore} onSelect={card => void openVersionPicker(card)} onQueryChange={setQuery} />
            </div>
          </section>
        </div>
      )}

      {versionCard && (
        <div role="presentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setVersionCard(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-version-title" className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 id="resume-version-title" className="font-black">カードのバージョンを選択</h2><button type="button" onClick={() => setVersionCard(null)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-slate-100">×</button></div>
            <div className="max-h-[72dvh] overflow-auto p-3">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {versionOptions.map(option => (
                  <button key={cardPrintingKey(option)} type="button" onClick={() => selectPhotoCard(option)} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left hover:ring-2 hover:ring-emerald-600">
                    <div className="aspect-[5/7] bg-slate-800">{option.imageUrl ? <img src={option.imageUrl} alt={option.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center p-2 text-xs font-bold text-white">画像なし</div>}</div>
                  </button>
                ))}
              </div>
              {versionsLoading && <p className="py-4 text-center text-sm text-slate-500">読み込み中…</p>}
            </div>
          </section>
        </div>
      )}

      {mobilePreviewOpen && (
        <div role="presentation" className="fixed inset-0 z-50 overflow-auto bg-black/90 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setMobilePreviewOpen(false) }}>
          <div className="mx-auto max-w-xl"><div className="mb-2 flex justify-end"><button type="button" onClick={() => setMobilePreviewOpen(false)} aria-label="プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl">×</button></div>
            <ScaledResumePreview data={data} avatarUrl={avatarUrl} photoImageUrl={photoImageUrl} />
          </div>
        </div>
      )}

      {pngPreview && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setPngPreview(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-png-preview-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2"><div><h2 id="resume-png-preview-title" className="font-black text-slate-900">デュエマ履歴書</h2><p className="text-xs text-slate-500">iPhoneは下のボタンから「画像を保存」を選べます</p></div><button type="button" onClick={() => setPngPreview(null)} aria-label="画像プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-700 hover:bg-slate-100">×</button></div>
            <div className="min-h-0 overscroll-contain overflow-auto bg-slate-100 p-2 sm:p-4"><img src={pngPreview.src} alt="デュエマ履歴書の保存用画像" className="mx-auto h-auto max-w-full shadow" /></div>
            <div className="border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><button type="button" onClick={() => void savePreviewImage()} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-700 px-4 font-bold text-white">画像を保存</button></div>
          </section>
        </div>
      )}

    </div>
  )
}
