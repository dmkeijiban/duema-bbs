'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CardCatalogSearchPanel } from '@/components/CardCatalogSearchPanel'
import { useCardCatalogSearch } from '@/hooks/use-card-catalog-search'
import type { DeckCard } from '@/lib/deck-maker'
import { renderResumeExportImage, resumePngFileName } from '@/lib/maker-resume-export'
import {
  RESUME_ACHIEVEMENT_PRESETS,
  RESUME_AGE_GROUPS,
  RESUME_MAX_DUEL_MASTERS_PLAY_MAIN_DECK,
  RESUME_FAVORITE_CIVILIZATIONS,
  RESUME_GENDERS,
  RESUME_GENERATIONS,
  RESUME_DUEL_MASTERS_PLAY_STATUSES,
  RESUME_MAX_CURRENT_DECKS_TEXT,
  RESUME_MAX_FAVORITE_YOUTUBER,
  RESUME_MAX_FREE_SPACE,
  RESUME_MAX_OTHER_INTERESTS,
  RESUME_PLAY_STYLES,
  RESUME_REGIONS,
  RESUME_SOCIAL_TAG_PRESETS,
  clampCurrentDecksText,
  clampFreeSpaceText,
  clampOtherInterestsText,
  emptyResumeData,
  isResumeComplete,
  sanitizeResumeData,
  type ResumeData,
} from '@/lib/maker-resume'
import { ResumePreview, ScaledResumePreview } from './ResumePreview'
import { RESUME_STEPS, RESUME_SHARE_TEXT } from './constants'
import type { ResumeInitialState } from './types'
import { saveResumeSubmission, setResumeVisibility } from './actions'

type PngPreview = { src: string; fileName: string; file: File }
type SaveState = 'dirty' | 'saving' | 'saved' | 'error'
const ANONYMOUS_RESUME_STORAGE_KEY = 'duema-bbs:resume-maker:anonymous-draft:v1'

function favoritePhoto(card: DeckCard): ResumeData['photo'] {
  return {
    type: 'card',
    cardId: card.id,
    sourceKey: card.sourceKey ?? null,
    faceSideIndex: card.matchedFace?.sideIndex ?? null,
    name: card.matchedFace?.name ?? card.name,
    imageUrl: card.matchedFace?.imageUrl ?? card.imageUrl,
  }
}

export default function ResumeMaker({ initial, loggedIn }: { initial: ResumeInitialState; loggedIn: boolean }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [data, setData] = useState<ResumeData>(emptyResumeData())
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [submissionId, setSubmissionId] = useState<string | null>(initial.submissionId)
  const [message, setMessage] = useState('')
  const [saveState, setSaveState] = useState<SaveState>(initial.data ? 'saved' : 'dirty')
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false)
  const [pngPreview, setPngPreview] = useState<PngPreview | null>(null)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [resumeDate, setResumeDate] = useState<string | null>(initial.resumeDate)
  const exportPreviewRef = useRef<HTMLDivElement | null>(null)
  const cardSearch = useCardCatalogSearch({ makerSlug: 'resume-maker' })

  useEffect(() => {
    if (initial.data) setData(initial.data)
    else if (!loggedIn) {
      try {
        const stored = localStorage.getItem(ANONYMOUS_RESUME_STORAGE_KEY)
        if (stored) { setData(sanitizeResumeData(JSON.parse(stored))); setSaveState('saved') }
      } catch { localStorage.removeItem(ANONYMOUS_RESUME_STORAGE_KEY) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [step])

  useEffect(() => {
    if (!mobilePreviewOpen && !pngPreview) return
    const previous = document.body.style.overflow
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobilePreviewOpen(false); setPngPreview(null) } }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close) }
  }, [mobilePreviewOpen, pngPreview])

  useEffect(() => {
    if (saveState !== 'dirty') return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveState])

  const complete = isResumeComplete(data)
  const avatarUrl = initial.profileDefaults?.avatarUrl ?? null
  const favoriteCard = data.photo?.type === 'card' ? data.photo : null

  function update<K extends keyof ResumeData>(key: K, value: ResumeData[K]) {
    setData(current => ({ ...current, [key]: value }))
    setSaveState(current => current === 'saving' ? current : 'dirty')
  }

  function toggleAchievement(key: string) {
    update('achievements', data.achievements.includes(key) ? data.achievements.filter(item => item !== key) : [...data.achievements, key])
  }

  function toggleSocialTag(key: string) {
    update('socialTags', data.socialTags.includes(key) ? data.socialTags.filter(item => item !== key) : [...data.socialTags, key])
  }

  async function persistToDb(nextIsPublic: boolean): Promise<string | null> {
    setSaveState('saving')
    if (!loggedIn) {
      try {
        localStorage.setItem(ANONYMOUS_RESUME_STORAGE_KEY, JSON.stringify(data))
        setMessage('この端末に履歴書を保存しました')
        setSaveState('saved')
      } catch {
        setMessage('端末への保存に失敗しました')
        setSaveState('error')
      }
      return null
    }
    const result = await saveResumeSubmission({ data, isPublic: nextIsPublic })
    setMessage(result.message)
    setSaveState(result.ok ? 'saved' : 'error')
    if (result.ok && result.submissionId) { setSubmissionId(result.submissionId); setResumeDate(new Date().toISOString()); return result.submissionId }
    return null
  }

  async function handleSaveResume() {
    if (saveState === 'saving' || !complete) { if (!complete) setMessage('名前を入力してください'); return }
    await persistToDb(isPublic)
  }

  async function handleToggleVisibility() {
    if (isTogglingVisibility || !submissionId) return
    setIsTogglingVisibility(true)
    const next = !isPublic
    try {
      const result = await setResumeVisibility(next)
      if (result.ok) setIsPublic(next)
      setMessage(result.message)
    } finally { setIsTogglingVisibility(false) }
  }

  async function handleSaveImage() {
    if (isSavingImage || !complete) { if (!complete) setMessage('名前を入力してください'); return }
    setIsSavingImage(true)
    try {
      const blob = await renderResumeExportImage(exportPreviewRef.current)
      const fileName = resumePngFileName(data.handleName)
      const file = new File([blob], fileName, { type: blob.type || 'image/png' })
      const usesMobileSaveFlow = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (usesMobileSaveFlow) {
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })
        setPngPreview({ src, fileName, file })
      } else {
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(objectUrl)
      }
      void persistToDb(isPublic)
    } catch { setMessage('画像生成に失敗しました') }
    finally { setIsSavingImage(false) }
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
    if (isSharing || !complete) { if (!complete) setMessage('名前を入力してください'); return }
    setIsSharing(true)
    const shareWindow = window.open('', '_blank')
    try {
      await persistToDb(isPublic)
      const intent = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: RESUME_SHARE_TEXT, url: 'https://www.duema-bbs.com/makers/resume-maker' })}`
      if (shareWindow) shareWindow.location.href = intent
      else window.open(intent, '_blank', 'noopener,noreferrer')
    } catch {
      shareWindow?.close()
      setMessage('X共有の準備に失敗しました')
    } finally { setIsSharing(false) }
  }

  return <div className="pb-28">
    <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0"><ResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} exportRef={exportPreviewRef} /></div>

    <header className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <h1 className="text-lg font-black text-slate-900">デュエマ履歴書メーカー</h1>
      <p className="mt-1 text-xs text-slate-500">あなたのデュエマ自己紹介を、本物の履歴書風にまとめよう。</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-blue-700">
        {loggedIn ? <Link href="/mypage" className="hover:underline">マイページに戻る</Link> : <Link href="/login?mode=signup&next=/makers/resume-maker" className="hover:underline">登録すると履歴書を公開・管理できます</Link>}
        <Link href="/makers/resume-maker/submissions" className="hover:underline">みんなの履歴書を見る</Link>
        {initial.profileSlug && <Link href={`/u/${initial.profileSlug}`} className="hover:underline">公開プロフィールを見る</Link>}
      </div>
      <nav className="mt-3 flex gap-2">{RESUME_STEPS.map(item => <button key={item.id} type="button" onClick={() => setStep(item.id)} className={`min-h-9 flex-1 rounded-lg border px-2 text-sm font-bold transition-colors ${step === item.id ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>STEP{item.id} {item.label}</button>)}</nav>
      {message && <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
      <button type="button" onClick={() => setMobilePreviewOpen(true)} className="mt-3 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 lg:hidden">プレビューを見る</button>
    </header>

    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-start">
      <div className="min-w-0 space-y-3">
        {step === 1 && <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <h2 className="font-black text-slate-900">基本情報</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700 sm:col-span-2">名前（必須）<input value={data.handleName} onChange={e => update('handleName', e.target.value.slice(0, 30))} maxLength={30} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="デュエマ太郎" /></label>
            <label className="text-xs font-bold text-slate-700">デュエマを始めた時期<input value={data.startedAt} onChange={e => update('startedAt', e.target.value.slice(0, 20))} maxLength={20} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="例: 小学生の頃" /></label>
            <label className="text-xs font-bold text-slate-700">世代<select value={data.generation} onChange={e => update('generation', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900"><option value="">選択しない</option>{RESUME_GENERATIONS.map(option => <option key={option.value} value={option.label}>{option.label}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">性別<select value={data.gender} onChange={e => update('gender', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900">{RESUME_GENDERS.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">年齢<select value={data.ageGroup} onChange={e => update('ageGroup', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900">{RESUME_AGE_GROUPS.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">好きな文明<select value={data.favoriteCivilization} onChange={e => update('favoriteCivilization', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900"><option value="">選択しない</option>{RESUME_FAVORITE_CIVILIZATIONS.map(option => <option key={option.value} value={option.label}>{option.label}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">プレイスタイル<select value={data.playStyle} onChange={e => update('playStyle', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900"><option value="">選択しない</option>{RESUME_PLAY_STYLES.map(option => <option key={option.value} value={option.label}>{option.label}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">活動地域<select value={data.region} onChange={e => update('region', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900"><option value="">選択しない</option>{RESUME_REGIONS.map(region => <option key={region} value={region}>{region}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">デュエプレ<select value={data.duelMastersPlayStatus} onChange={e => update('duelMastersPlayStatus', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900"><option value="">選択しない</option>{RESUME_DUEL_MASTERS_PLAY_STATUSES.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white">{avatarUrl ? <img src={avatarUrl} alt="プロフィールアイコン" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">未設定</div>}</div><p className="min-w-0 flex-1 text-xs text-slate-600">{loggedIn ? '証明写真にはプロフィールアイコンが使われます。' : 'アカウント登録後はプロフィールアイコンを証明写真に使えます。'}{loggedIn && <Link href="/mypage/edit" className="ml-1 font-bold text-blue-700 hover:underline">アイコンを変更する</Link>}</p></div>
        </section>}

        {step === 2 && <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <h2 className="font-black text-slate-900">使用デッキ</h2><textarea value={data.currentDecksText} onChange={e => update('currentDecksText', clampCurrentDecksText(e.target.value))} maxLength={RESUME_MAX_CURRENT_DECKS_TEXT} rows={3} placeholder="例: 赤単我我我、青魔導具、昔は連ドラを使用" className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm" /><p className="mt-1 text-right text-[11px] text-slate-400">{data.currentDecksText.length} / {RESUME_MAX_CURRENT_DECKS_TEXT}</p>
          <h2 className="mt-4 font-black text-slate-900">デュエプレの使用デッキ</h2><input value={data.duelMastersPlayMainDeck} onChange={e => update('duelMastersPlayMainDeck', e.target.value.slice(0, RESUME_MAX_DUEL_MASTERS_PLAY_MAIN_DECK))} maxLength={RESUME_MAX_DUEL_MASTERS_PLAY_MAIN_DECK} placeholder="自由記述（任意）" className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm" />
          <h2 className="mt-5 font-black text-slate-900">好きなYouTuber</h2><input value={data.favoriteYouTuber} onChange={e => update('favoriteYouTuber', e.target.value.slice(0, RESUME_MAX_FAVORITE_YOUTUBER))} maxLength={RESUME_MAX_FAVORITE_YOUTUBER} placeholder="自由記述（任意）" className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm" />
          <h2 className="mt-4 font-black text-slate-900">デュエマ以外で好きな事</h2><textarea value={data.otherInterests} onChange={e => update('otherInterests', clampOtherInterestsText(e.target.value))} maxLength={RESUME_MAX_OTHER_INTERESTS} rows={2} placeholder="自由記述（任意）" className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm" /><p className="mt-1 text-right text-[11px] text-slate-400">{data.otherInterests.length} / {RESUME_MAX_OTHER_INTERESTS}</p>
        </section>}

        {step === 3 && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
            <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">最後に画面下部の保存ボタンから履歴書を保存してください。</p>
            <h2 className="font-black text-slate-900">対戦・交流について</h2><input value={data.socialNote} onChange={e => update('socialNote', e.target.value.slice(0, 40))} maxLength={40} placeholder="自由記述（任意）" className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm" /><div className="mt-2 flex flex-wrap gap-2">{RESUME_SOCIAL_TAG_PRESETS.map(preset => <button key={preset.key} type="button" onClick={() => toggleSocialTag(preset.key)} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${data.socialTags.includes(preset.key) ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}>{preset.label}</button>)}</div>
            <h2 className="mt-5 font-black text-slate-900">大会・デュエマ実績</h2><input value={data.achievementNote} onChange={e => update('achievementNote', e.target.value.slice(0, 40))} maxLength={40} placeholder="自由記述（任意）" className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm" /><div className="mt-2 flex flex-wrap gap-2">{RESUME_ACHIEVEMENT_PRESETS.map(preset => <button key={preset.key} type="button" onClick={() => toggleAchievement(preset.key)} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${data.achievements.includes(preset.key) ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}>{preset.label}</button>)}</div>
            <h2 className="mt-5 font-black text-slate-900">フリースペース</h2><textarea value={data.freeSpace} onChange={e => update('freeSpace', clampFreeSpaceText(e.target.value))} maxLength={RESUME_MAX_FREE_SPACE} rows={4} placeholder="自由に書いてみましょう" className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm" /><p className="mt-1 text-right text-[11px] text-slate-400">{data.freeSpace.length} / {RESUME_MAX_FREE_SPACE}</p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">本名、住所、学校名、勤務先など、個人を特定できる情報は入力しないでください。</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">好きなカード</h2><p className="mt-1 text-xs text-slate-500">選んだカードをフリースペースの右側に表示します。</p></div>{favoriteCard && <button type="button" onClick={() => update('photo', null)} className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-bold text-red-700">選択を解除</button>}</div>
            {favoriteCard && <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><img src={favoriteCard.imageUrl ?? ''} alt={favoriteCard.name} className="h-28 w-20 object-contain" /><p className="font-bold text-slate-900">{favoriteCard.name}</p></div>}
            <div className="mt-4"><CardCatalogSearchPanel cards={cardSearch.cards} query={cardSearch.query} loading={cardSearch.loading} hasMore={cardSearch.hasMore} onLoadMore={cardSearch.loadMore} onSelect={card => update('photo', favoritePhoto(card))} onQueryChange={cardSearch.setQuery} onClear={() => cardSearch.setQuery('')} selectedCount={card => favoriteCard?.cardId === card.id ? 1 : 0} selectedBadge={() => '選択中'} renderCardArt={card => <img src={card.matchedFace?.imageUrl ?? card.imageUrl ?? ''} alt={card.matchedFace?.name ?? card.name} className="aspect-[5/7] w-full object-cover" />} /></div>
          </section>

          {submissionId && <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><div className="flex items-center justify-between"><h2 className="font-black text-slate-900">履歴書の公開設定</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isPublic ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{isPublic ? '公開中' : '非公開'}</span></div><p className="mt-2 text-xs text-slate-600">{isPublic ? 'あなたの公開プロフィールと「みんなの履歴書」に表示されています。' : 'あなた以外には表示されません。'}</p><button type="button" onClick={() => void handleToggleVisibility()} disabled={isTogglingVisibility} className={`mt-3 min-h-10 w-full rounded-lg px-4 text-sm font-bold text-white disabled:opacity-60 ${isPublic ? 'bg-slate-500' : 'bg-emerald-700'}`}>{isTogglingVisibility ? '変更中…' : isPublic ? '非公開にする' : '公開する'}</button></section>}
        </>}

        {step < 3 ? <div className="flex gap-2"><button type="button" onClick={() => setStep(current => (current > 1 ? current - 1 : current) as 1 | 2 | 3)} disabled={step === 1} className="min-h-10 flex-1 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-30">戻る</button><button type="button" onClick={() => setStep(current => (current + 1) as 2 | 3)} className="min-h-10 flex-1 rounded-lg border border-slate-300 text-sm font-bold text-slate-500">スキップ</button><button type="button" onClick={() => setStep(current => (current + 1) as 2 | 3)} className="min-h-10 flex-1 rounded-lg bg-emerald-700 text-sm font-bold text-white">次へ</button></div> : <div className="flex gap-2"><button type="button" onClick={() => setStep(2)} className="min-h-10 flex-1 rounded-lg border border-slate-300 text-sm font-bold text-slate-700">戻る</button></div>}
      </div>

      <div className="hidden lg:block"><div className="sticky top-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><ScaledResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className="mx-auto" /></div></div>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-2 backdrop-blur"><div className="mx-auto flex max-w-[1200px] items-center gap-2"><button type="button" disabled={!complete || saveState === 'saving'} onClick={() => void handleSaveResume()} className="min-h-11 flex-[2] rounded-lg bg-emerald-700 px-3 text-sm font-black text-white disabled:bg-slate-300">{saveState === 'saving' ? '保存中…' : submissionId ? '変更を保存する' : loggedIn ? '履歴書を保存する' : 'この端末に保存する'}</button><button type="button" disabled={!complete || isSavingImage} onClick={() => void handleSaveImage()} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 disabled:opacity-40">{isSavingImage ? '生成中…' : '画像保存'}</button><button type="button" disabled={!complete || isSharing} onClick={() => void handleShare()} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 disabled:opacity-40">{isSharing ? '共有中…' : 'X共有'}</button></div></div>

    {mobilePreviewOpen && <div role="presentation" className="fixed inset-0 z-50 overflow-auto bg-black/90 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setMobilePreviewOpen(false) }}><div className="mx-auto max-w-xl"><div className="mb-2 flex justify-end"><button type="button" onClick={() => setMobilePreviewOpen(false)} aria-label="プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl">×</button></div><ScaledResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} /></div></div>}

    {pngPreview && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setPngPreview(null) }}><section role="dialog" aria-modal="true" aria-labelledby="resume-png-preview-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-4 py-2"><div><h2 id="resume-png-preview-title" className="font-black text-slate-900">デュエマ履歴書</h2><p className="text-xs text-slate-500">iPhoneは下のボタンから「画像を保存」を選べます</p></div><button type="button" onClick={() => setPngPreview(null)} aria-label="画像プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-700 hover:bg-slate-100">×</button></div><div className="min-h-0 overscroll-contain overflow-auto bg-slate-100 p-2 sm:p-4"><img src={pngPreview.src} alt="デュエマ履歴書の保存用画像" className="mx-auto h-auto max-w-full shadow" /></div><div className="border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><button type="button" onClick={() => void savePreviewImage()} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-700 px-4 font-bold text-white">画像を保存</button></div></section></div>}
  </div>
}
