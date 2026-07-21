'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSavedDeckNames } from '@/lib/deck-maker-names'
import { renderResumeExportImage, resumePngFileName } from '@/lib/maker-resume-export'
import {
  RESUME_ACHIEVEMENT_PRESETS,
  RESUME_AGE_GROUPS,
  RESUME_DUEL_MASTERS_PLAY_OPTIONS,
  RESUME_FAVORITE_CIVILIZATIONS,
  RESUME_GENDERS,
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
import { ScaledResumePreview } from './ResumePreview'
import { RESUME_DRAFT_STORAGE_KEY, RESUME_STEPS, RESUME_SHARE_TEXT } from './constants'
import type { ResumeInitialState } from './types'
import { saveResumeSubmission, setResumeVisibility } from './actions'

type PngPreview = { src: string; fileName: string; file: File }
type SaveState = 'dirty' | 'saving' | 'saved' | 'error'

export default function ResumeMaker({ initial }: { initial: ResumeInitialState }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [data, setData] = useState<ResumeData>(emptyResumeData())
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [submissionId, setSubmissionId] = useState<string | null>(initial.submissionId)
  const [deckNameCandidates, setDeckNameCandidates] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [saveState, setSaveState] = useState<SaveState>(initial.data ? 'saved' : 'dirty')
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false)
  const [pngPreview, setPngPreview] = useState<PngPreview | null>(null)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const hydratedRef = useState({ done: false })[0]

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
        }
      }
    } catch {
      localStorage.removeItem(RESUME_DRAFT_STORAGE_KEY)
    }
    hydratedRef.done = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydratedRef.done) return
    try { localStorage.setItem(RESUME_DRAFT_STORAGE_KEY, JSON.stringify({ data, isPublic })) } catch { /* ignore quota errors */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isPublic])

  useEffect(() => {
    if (!mobilePreviewOpen && !pngPreview) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [mobilePreviewOpen, pngPreview])

  useEffect(() => {
    if (saveState !== 'dirty' || !initial.loggedIn) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveState, initial.loggedIn])

  const complete = isResumeComplete(data)
  const avatarUrl = initial.profileDefaults?.avatarUrl ?? null

  function update<K extends keyof ResumeData>(key: K, value: ResumeData[K]) {
    setData(current => ({ ...current, [key]: value }))
    setSaveState(current => (current === 'saving' ? current : 'dirty'))
  }

  function toggleAchievement(key: string) {
    update('achievements', data.achievements.includes(key) ? data.achievements.filter(item => item !== key) : [...data.achievements, key])
  }
  function toggleSocialTag(key: string) {
    update('socialTags', data.socialTags.includes(key) ? data.socialTags.filter(item => item !== key) : [...data.socialTags, key])
  }

  function appendDeckCandidate(name: string) {
    const current = data.currentDecksText
    const next = current ? `${current}、${name}` : name
    update('currentDecksText', clampCurrentDecksText(next))
  }

  async function persistToDb(nextIsPublic: boolean): Promise<string | null> {
    if (!initial.loggedIn) return null
    setSaveState('saving')
    const result = await saveResumeSubmission({ data, isPublic: nextIsPublic })
    setMessage(result.message)
    setSaveState(result.ok ? 'saved' : 'error')
    if (result.ok && result.submissionId) { setSubmissionId(result.submissionId); return result.submissionId }
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
    } finally {
      setIsTogglingVisibility(false)
    }
  }

  async function handleSaveImage() {
    if (isSavingImage || !complete) { if (!complete) setMessage('名前を入力してください'); return }
    setIsSavingImage(true)
    try {
      const blob = await renderResumeExportImage(data, { url: avatarUrl })
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
    if (isSharing || !complete) { if (!complete) setMessage('名前を入力してください'); return }
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

  const saveStatusLabel = saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '保存しました' : saveState === 'error' ? '保存に失敗しました' : '未保存の変更があります'
  const saveStatusClass = saveState === 'saving' ? 'text-slate-500' : saveState === 'saved' ? 'text-emerald-700' : saveState === 'error' ? 'text-red-600' : 'text-amber-600'

  return (
    <div className="pb-28">
      <header className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <h1 className="text-lg font-black text-slate-900">デュエマ履歴書メーカー</h1>
        <p className="mt-1 text-xs text-slate-500">あなたのデュエマ自己紹介を、本物の履歴書風にまとめよう。入力内容はこの端末に自動保存されます。</p>
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
                <label className="text-xs font-bold text-slate-700">名前（必須）
                  <input value={data.handleName} onChange={e => update('handleName', e.target.value.slice(0, 30))} maxLength={30} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="デュエマ太郎" />
                </label>
                <label className="text-xs font-bold text-slate-700">デュエマを始めた時期
                  <input value={data.startedAt} onChange={e => update('startedAt', e.target.value.slice(0, 20))} maxLength={20} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="例: 小学生の頃" />
                </label>
                <label className="text-xs font-bold text-slate-700">性別
                  <select value={data.gender} onChange={e => update('gender', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100">
                    {RESUME_GENDERS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">年齢
                  <select value={data.ageGroup} onChange={e => update('ageGroup', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100">
                    {RESUME_AGE_GROUPS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
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
                <label className="text-xs font-bold text-slate-700">デュエプレ
                  <select value={data.playsDuelMastersPlay} onChange={e => update('playsDuelMastersPlay', e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100">
                    {RESUME_DUEL_MASTERS_PLAY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white">
                  {avatarUrl ? <img src={avatarUrl} alt="プロフィールアイコン" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">未設定</div>}
                </div>
                <p className="min-w-0 flex-1 text-xs text-slate-600">
                  証明写真にはプロフィールアイコンが使われます。
                  {initial.loggedIn ? <Link href="/mypage/edit" className="ml-1 font-bold text-blue-700 hover:underline">アイコンを変更する</Link> : '登録するとアイコンを設定できます。'}
                </p>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
              <h2 className="font-black text-slate-900">使用デッキ</h2>
              <textarea value={data.currentDecksText} onChange={e => update('currentDecksText', clampCurrentDecksText(e.target.value))} maxLength={RESUME_MAX_CURRENT_DECKS_TEXT} rows={3} placeholder="例: 赤単我我我、青魔導具、昔は連ドラを使用" className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm outline-none focus:border-emerald-700" />
              <p className="mt-1 text-right text-[11px] text-slate-400">{data.currentDecksText.length} / {RESUME_MAX_CURRENT_DECKS_TEXT}</p>
              {deckNameCandidates.length > 0 && (
                <div className="mt-1">
                  <p className="text-[11px] text-slate-500">デッキ名候補（クリックで追加）</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {deckNameCandidates.map(name => (
                      <button key={name} type="button" onClick={() => appendDeckCandidate(name)} className="min-h-7 rounded-full border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">{name}</button>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="mt-5 font-black text-slate-900">好きなYouTuber</h2>
              <input value={data.favoriteYouTuber} onChange={e => update('favoriteYouTuber', e.target.value.slice(0, RESUME_MAX_FAVORITE_YOUTUBER))} maxLength={RESUME_MAX_FAVORITE_YOUTUBER} placeholder="自由記述（任意）" className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-700" />

              <h2 className="mt-4 font-black text-slate-900">デュエマ以外で好きな事</h2>
              <textarea value={data.otherInterests} onChange={e => update('otherInterests', clampOtherInterestsText(e.target.value))} maxLength={RESUME_MAX_OTHER_INTERESTS} rows={2} placeholder="自由記述（任意）" className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm outline-none focus:border-emerald-700" />
              <p className="mt-1 text-right text-[11px] text-slate-400">{data.otherInterests.length} / {RESUME_MAX_OTHER_INTERESTS}</p>
            </section>
          )}

          {step === 3 && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
                <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">最後に画面下部の「履歴書を完成する」から保存してください。</p>

                <h2 className="font-black text-slate-900">大会・デュエマ実績</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {RESUME_ACHIEVEMENT_PRESETS.map(preset => (
                    <button key={preset.key} type="button" onClick={() => toggleAchievement(preset.key)} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${data.achievements.includes(preset.key) ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}>{preset.label}</button>
                  ))}
                </div>
                <input value={data.achievementNote} onChange={e => update('achievementNote', e.target.value.slice(0, 40))} maxLength={40} placeholder="自由記述（任意）" className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm outline-none focus:border-emerald-700" />

                <h2 className="mt-5 font-black text-slate-900">フリースペース</h2>
                <textarea value={data.freeSpace} onChange={e => update('freeSpace', clampFreeSpaceText(e.target.value))} maxLength={RESUME_MAX_FREE_SPACE} rows={4} placeholder="自由に書いてみましょう" className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm outline-none focus:border-emerald-700" />
                <p className="mt-1 text-right text-[11px] text-slate-400">{data.freeSpace.length} / {RESUME_MAX_FREE_SPACE}</p>

                <h2 className="mt-4 font-black text-slate-900">対戦・交流について</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {RESUME_SOCIAL_TAG_PRESETS.map(preset => (
                    <button key={preset.key} type="button" onClick={() => toggleSocialTag(preset.key)} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${data.socialTags.includes(preset.key) ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}>{preset.label}</button>
                  ))}
                </div>
                <input value={data.socialNote} onChange={e => update('socialNote', e.target.value.slice(0, 40))} maxLength={40} placeholder="自由記述（任意）" className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm outline-none focus:border-emerald-700" />
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">本名、住所、学校名、勤務先など、個人を特定できる情報は入力しないでください。</p>
              </section>

              {initial.loggedIn && submissionId && (
                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-black text-slate-900">履歴書の公開設定</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isPublic ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{isPublic ? '公開中' : '非公開'}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">公開すると、あなたの投稿者ページにこの履歴書が表示されます。{!isPublic && '非公開中は、あなた以外の投稿者ページには表示されません。'}</p>
                  <button type="button" onClick={() => void handleToggleVisibility()} disabled={isTogglingVisibility} className={`mt-3 min-h-10 w-full rounded-lg px-4 text-sm font-bold text-white disabled:opacity-60 ${isPublic ? 'bg-slate-500' : 'bg-emerald-700'}`}>
                    {isTogglingVisibility ? '変更中…' : isPublic ? '非公開にする' : '公開する'}
                  </button>
                </section>
              )}

              <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-3 shadow-sm sm:p-5">
                <h2 className="font-black text-slate-900">履歴書を完成する</h2>
                <p className="mt-1 text-xs text-slate-600">入力内容を確認して、履歴書を保存・画像出力できます。</p>
                <button type="button" onClick={() => setMobilePreviewOpen(true)} className="mt-2 text-xs font-bold text-blue-700 hover:underline lg:hidden">完成プレビューを見る</button>

                {initial.loggedIn ? (
                  <>
                    <p className={`mt-3 text-xs font-bold ${saveStatusClass}`}>{saveStatusLabel}</p>
                    <button type="button" disabled={!complete || saveState === 'saving'} onClick={() => void handleSaveResume()} className="mt-2 min-h-12 w-full rounded-xl bg-emerald-700 text-base font-black text-white disabled:opacity-40">
                      {saveState === 'saving' ? '保存中…' : submissionId ? '変更を保存する' : '履歴書を保存する'}
                    </button>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" disabled={!complete || isSavingImage} onClick={() => void handleSaveImage()} className="min-h-10 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-40">{isSavingImage ? '生成中...' : '画像を保存'}</button>
                      <button type="button" disabled={!complete || isSharing} onClick={() => void handleShare()} className="min-h-10 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-40">{isSharing ? '共有準備中...' : 'Xで共有'}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={!complete || isSavingImage} onClick={() => void handleSaveImage()} className="mt-3 min-h-12 w-full rounded-xl bg-blue-700 text-base font-black text-white disabled:opacity-40">{isSavingImage ? '生成中...' : '画像を保存する'}</button>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" disabled={!complete || isSharing} onClick={() => void handleShare()} className="min-h-10 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-40">{isSharing ? '共有準備中...' : 'Xで共有'}</button>
                      <Link href="/login?mode=signup" className="flex min-h-10 items-center justify-center rounded-lg border border-emerald-700 text-sm font-bold text-emerald-800">無料登録して保存</Link>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">無料登録すると、後から編集したり、投稿者ページに公開できます。</p>
                  </>
                )}

                {initial.profileSlug && <Link href={`/u/${initial.profileSlug}`} className="mt-3 block text-center text-xs font-bold text-slate-500 hover:underline">投稿者ページを見る</Link>}
                <Link href="/makers/my-duema-9" className="mt-3 block rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center text-sm font-bold text-indigo-800 hover:bg-indigo-100">私を象徴するデュエマカード9選を作る</Link>
              </section>
            </>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(current => (current > 1 ? current - 1 : current) as 1 | 2 | 3)} disabled={step === 1} className="min-h-10 flex-1 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-30">戻る</button>
            <button type="button" onClick={() => setStep(current => (current < 3 ? current + 1 : current) as 1 | 2 | 3)} disabled={step === 3} className="min-h-10 flex-1 rounded-lg border border-slate-300 text-sm font-bold text-slate-500 disabled:opacity-30">スキップ</button>
            <button type="button" onClick={() => setStep(current => (current < 3 ? current + 1 : current) as 1 | 2 | 3)} disabled={step === 3} className="min-h-10 flex-1 rounded-lg bg-emerald-700 text-sm font-bold text-white disabled:opacity-40">次へ</button>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <ScaledResumePreview data={data} avatarUrl={avatarUrl} className="mx-auto" />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-2 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-2">
          {initial.loggedIn ? (
            <>
              <button type="button" disabled={!complete || saveState === 'saving'} onClick={() => void handleSaveResume()} className="min-h-11 flex-[2] rounded-lg bg-emerald-700 px-3 text-sm font-black text-white disabled:bg-slate-300">
                {saveState === 'saving' ? '保存中…' : submissionId ? '変更を保存する' : '履歴書を保存する'}
              </button>
              <button type="button" disabled={!complete || isSavingImage} onClick={() => void handleSaveImage()} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 disabled:opacity-40">{isSavingImage ? '生成中...' : '画像保存'}</button>
              <button type="button" disabled={!complete || isSharing} onClick={() => void handleShare()} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 disabled:opacity-40">{isSharing ? '共有中...' : 'X共有'}</button>
            </>
          ) : (
            <>
              <button type="button" disabled={!complete || isSavingImage} onClick={() => void handleSaveImage()} className="min-h-11 flex-[2] rounded-lg bg-blue-700 px-3 text-sm font-black text-white disabled:bg-slate-300">{isSavingImage ? '生成中...' : '画像を保存する'}</button>
              <button type="button" disabled={!complete || isSharing} onClick={() => void handleShare()} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 disabled:opacity-40">{isSharing ? '共有中...' : 'X共有'}</button>
              <Link href="/login?mode=signup" className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-emerald-700 px-2 text-center text-[11px] font-bold text-emerald-800">無料登録</Link>
            </>
          )}
        </div>
      </div>

      {mobilePreviewOpen && (
        <div role="presentation" className="fixed inset-0 z-50 overflow-auto bg-black/90 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setMobilePreviewOpen(false) }}>
          <div className="mx-auto max-w-xl"><div className="mb-2 flex justify-end"><button type="button" onClick={() => setMobilePreviewOpen(false)} aria-label="プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl">×</button></div>
            <ScaledResumePreview data={data} avatarUrl={avatarUrl} />
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
