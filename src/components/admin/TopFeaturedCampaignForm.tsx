'use client'

import { useState } from 'react'
import {
  computeFeaturedCampaignImageStyle,
  DEFAULT_IMAGE_POSITION_X,
  DEFAULT_IMAGE_POSITION_Y,
  DEFAULT_IMAGE_SCALE,
  MAX_IMAGE_SCALE,
  MIN_IMAGE_SCALE,
  type FeaturedCampaignCardImage,
  type TopFeaturedCampaignSettings,
} from '@/lib/top-featured-campaign'
import {
  updateTopFeaturedCampaignAction,
  uploadTopFeaturedCampaignCardImage,
  uploadTopFeaturedCampaignImage,
} from '@/app/admin/actions'

// TOP側のレイアウトに合わせた比率（比率が命で絶対px幅は画面幅により変動する）
const PC_PREVIEW_ASPECT_RATIO = '556 / 144'
// スマホは横長バナー右側の画像帯（w-24 × h-28相当=96×112px）と同じ比率
const SP_PREVIEW_ASPECT_RATIO = '96 / 112'

export type SelectableProject = {
  slug: string
  title: string
  description: string
  mainHref: string
  subHref: string
  publicVisible: boolean
}

function emptyCardImage(): FeaturedCampaignCardImage {
  return { imageUrl: '', positionX: DEFAULT_IMAGE_POSITION_X, positionY: DEFAULT_IMAGE_POSITION_Y, scale: DEFAULT_IMAGE_SCALE }
}

function ImagePositionSliders({
  positionX,
  positionY,
  scale,
  positionXName,
  positionYName,
  scaleName,
  onChangePositionX,
  onChangePositionY,
  onChangeScale,
}: {
  positionX: number
  positionY: number
  scale: number
  positionXName: string
  positionYName: string
  scaleName: string
  onChangePositionX: (value: number) => void
  onChangePositionY: (value: number) => void
  onChangeScale: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px]">
        横位置：{positionX}%
        <input type="range" name={positionXName} min={0} max={100} step={1} value={positionX} onChange={e => onChangePositionX(Number(e.target.value))} className="mt-0.5 w-full" />
      </label>
      <label className="block text-[11px]">
        縦位置：{positionY}%
        <input type="range" name={positionYName} min={0} max={100} step={1} value={positionY} onChange={e => onChangePositionY(Number(e.target.value))} className="mt-0.5 w-full" />
      </label>
      <label className="block text-[11px]">
        拡大率：{scale.toFixed(2)}倍
        <input type="range" name={scaleName} min={MIN_IMAGE_SCALE} max={MAX_IMAGE_SCALE} step={0.01} value={scale} onChange={e => onChangeScale(Number(e.target.value))} className="mt-0.5 w-full" />
      </label>
    </div>
  )
}

function CardImageSlot({
  index,
  card,
  uploading,
  error,
  uploaded,
  onUpload,
  onRemove,
}: {
  index: number
  card: FeaturedCampaignCardImage
  uploading: boolean
  error: string
  uploaded: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded border bg-gray-50 p-3">
      <p className="text-xs font-bold text-gray-700">カード{index + 1}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {card.imageUrl ? (
          // 一覧サムネイルは形状確認用。実際のTOP表示は縦横比を保ったまま自動配置される（下のプレビュー参照）
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={`カード${index + 1}プレビュー`} className="h-16 w-16 rounded border object-contain" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed text-[10px] text-gray-400">未設定</div>
        )}
        <div className="flex flex-col gap-1">
          <label className="inline-flex w-fit cursor-pointer items-center rounded border border-gray-400 bg-white px-2 py-1 text-[11px] font-bold hover:bg-gray-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50" aria-disabled={uploading}>
            {uploading ? 'アップロード中…' : '📁 選択'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
                e.target.value = ''
              }}
            />
          </label>
          {card.imageUrl && (
            <button type="button" onClick={onRemove} disabled={uploading} className="w-fit rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
              削除
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-1 text-[11px] font-bold text-red-700">{error}</p>}
      {uploaded && !error && <p className="mt-1 text-[11px] font-bold text-green-700">アップロードしました</p>}

      <p className="mt-2 text-[10px] text-gray-400">カード3枚表示では位置・拡大率は使用されません（縦横比を保ったまま高さ基準で自動配置されます）。</p>
      <input type="hidden" name={`card${index}_imageUrl`} value={card.imageUrl} readOnly />
      <input type="hidden" name={`card${index}_positionX`} value={card.positionX} readOnly />
      <input type="hidden" name={`card${index}_positionY`} value={card.positionY} readOnly />
      <input type="hidden" name={`card${index}_scale`} value={card.scale} readOnly />
    </div>
  )
}

export function TopFeaturedCampaignForm({
  initial,
  projects,
}: {
  initial: TopFeaturedCampaignSettings
  projects: SelectableProject[]
}) {
  const [fields, setFields] = useState(initial)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [imageUploaded, setImageUploaded] = useState(false)

  const [cardImages, setCardImages] = useState<FeaturedCampaignCardImage[]>(
    initial.cardImages.length > 0 ? initial.cardImages : [emptyCardImage(), emptyCardImage(), emptyCardImage()]
  )
  const [cardUploading, setCardUploading] = useState([false, false, false])
  const [cardError, setCardError] = useState(['', '', ''])
  const [cardUploaded, setCardUploaded] = useState([false, false, false])

  const currentSlugKnown = projects.some(p => p.slug === fields.projectSlug)
  const selectableProjects = currentSlugKnown || !fields.projectSlug
    ? projects
    : [...projects, { slug: fields.projectSlug, title: `${fields.projectSlug}（非公開/未検出）`, description: '', mainHref: '', subHref: '', publicVisible: false }]

  const set = (key: keyof TopFeaturedCampaignSettings, value: string | boolean | number) =>
    setFields(prev => ({ ...prev, [key]: value }))

  function resetImageTransform() {
    setFields(prev => ({ ...prev, imagePositionX: DEFAULT_IMAGE_POSITION_X, imagePositionY: DEFAULT_IMAGE_POSITION_Y, imageScale: DEFAULT_IMAGE_SCALE }))
  }

  async function handleImageUpload(file: File) {
    setImageUploading(true)
    setImageError('')
    setImageUploaded(false)
    const fd = new FormData()
    fd.append('image', file)
    const result = await uploadTopFeaturedCampaignImage(fd)
    if (result.url) {
      set('imageUrl', result.url)
      // 新しい画像に差し替わるため、前の画像に合わせていた位置・拡大率は初期値へ戻す
      resetImageTransform()
      setImageUploaded(true)
    } else {
      setImageError(result.error ?? '画像のアップロードに失敗しました')
    }
    setImageUploading(false)
  }

  function handleImageRemove() {
    set('imageUrl', '')
    resetImageTransform()
    setImageError('')
    setImageUploaded(false)
  }

  function updateCard(i: number, patch: Partial<FeaturedCampaignCardImage>) {
    setCardImages(prev => prev.map((card, idx) => (idx === i ? { ...card, ...patch } : card)))
  }

  function setCardFlag(setter: typeof setCardUploading, i: number, value: boolean) {
    setter(prev => prev.map((v, idx) => (idx === i ? value : v)))
  }

  async function handleCardUpload(i: number, file: File) {
    setCardFlag(setCardUploading, i, true)
    setCardError(prev => prev.map((v, idx) => (idx === i ? '' : v)))
    setCardUploaded(prev => prev.map((v, idx) => (idx === i ? false : v)))
    const fd = new FormData()
    fd.append('image', file)
    fd.append('slot', String(i))
    const result = await uploadTopFeaturedCampaignCardImage(fd)
    if (result.url) {
      updateCard(i, { imageUrl: result.url, positionX: DEFAULT_IMAGE_POSITION_X, positionY: DEFAULT_IMAGE_POSITION_Y, scale: DEFAULT_IMAGE_SCALE })
      setCardUploaded(prev => prev.map((v, idx) => (idx === i ? true : v)))
    } else {
      setCardError(prev => prev.map((v, idx) => (idx === i ? result.error ?? '画像のアップロードに失敗しました' : v)))
    }
    setCardFlag(setCardUploading, i, false)
  }

  function handleCardRemove(i: number) {
    updateCard(i, { imageUrl: '', positionX: DEFAULT_IMAGE_POSITION_X, positionY: DEFAULT_IMAGE_POSITION_Y, scale: DEFAULT_IMAGE_SCALE })
    setCardError(prev => prev.map((v, idx) => (idx === i ? '' : v)))
    setCardUploaded(prev => prev.map((v, idx) => (idx === i ? false : v)))
  }

  const imageStyle = computeFeaturedCampaignImageStyle(fields.imagePositionX, fields.imagePositionY, fields.imageScale)
  const previewImageUrl = fields.imageUrl || '/default-thumbnail.jpg'

  // カード画像に有効な枠が1つ以上あれば「3枚（1〜2枚でも）並び」を優先し、なければ旧1枚画像設定にフォールバックする
  const validCards = cardImages.filter(card => card.imageUrl)
  const previewMode: 'cards' | 'single' = validCards.length > 0 ? 'cards' : 'single'

  function handleProjectChange(slug: string) {
    const project = projects.find(p => p.slug === slug)
    setFields(prev => ({
      ...prev,
      projectSlug: slug,
      // 手入力済みの項目は上書きしない（空欄の項目だけ自動入力）
      title: prev.title || project?.title || '',
      description: prev.description || project?.description || '',
      mainButtonLink: prev.mainButtonLink || project?.mainHref || '',
      subButtonLink: prev.subButtonLink || project?.subHref || '',
    }))
  }

  return (
    <form action={updateTopFeaturedCampaignAction} className="space-y-3 rounded-lg border bg-white p-4">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="enabled" checked={fields.enabled} onChange={e => set('enabled', e.target.checked)} />
        表示ON
      </label>

      <label className="block text-sm">対象企画
        <select
          name="projectSlug"
          value={fields.projectSlug}
          onChange={e => handleProjectChange(e.target.value)}
          className="mt-1 w-full rounded border p-2"
        >
          <option value="">選択してください</option>
          {selectableProjects.map(p => (
            <option key={p.slug} value={p.slug}>{p.title}（{p.slug}）{p.publicVisible ? '' : ' ※非公開'}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">ラベル<input name="label" value={fields.label} onChange={e => set('label', e.target.value)} maxLength={20} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-sm">サブテキスト<input name="subText" value={fields.subText} onChange={e => set('subText', e.target.value)} maxLength={40} className="mt-1 w-full rounded border p-2" /></label>
      </div>

      <label className="block text-sm">タイトル
        <input name="title" value={fields.title} onChange={e => set('title', e.target.value)} maxLength={40} required className="mt-1 w-full rounded border p-2" />
      </label>

      <label className="block text-sm">説明文
        <textarea name="description" value={fields.description} onChange={e => set('description', e.target.value)} maxLength={120} rows={2} className="mt-1 w-full rounded border p-2" />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">メインボタン名<input name="mainButtonLabel" value={fields.mainButtonLabel} onChange={e => set('mainButtonLabel', e.target.value)} maxLength={20} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-sm">メインボタンリンク<input name="mainButtonLink" value={fields.mainButtonLink} onChange={e => set('mainButtonLink', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-sm">サブボタン名<input name="subButtonLabel" value={fields.subButtonLabel} onChange={e => set('subButtonLabel', e.target.value)} maxLength={20} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-sm">サブボタンリンク<input name="subButtonLink" value={fields.subButtonLink} onChange={e => set('subButtonLink', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      </div>
      <p className="text-xs text-gray-500">サブボタン名・リンクのどちらかが空の場合、サブボタンは表示されません。</p>

      <div className="block text-sm">
        <span className="block font-bold">右側画像（カード画像3枚）</span>
        <p className="mt-0.5 text-xs text-gray-500">
          カード画像1〜3枚を優先表示します（1〜2枚だけでも登録した枚数で均等表示）。3枚とも未設定の場合は下の「詳細設定・旧1枚画像」→企画のサムネイル→既定画像の順で表示されます。
        </p>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {cardImages.map((card, i) => (
            <CardImageSlot
              key={i}
              index={i}
              card={card}
              uploading={cardUploading[i]}
              error={cardError[i]}
              uploaded={cardUploaded[i]}
              onUpload={file => handleCardUpload(i, file)}
              onRemove={() => handleCardRemove(i)}
            />
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-gray-600">PC表示プレビュー</p>
            <div className="relative mt-1 w-full overflow-hidden rounded-lg border bg-stone-900" style={{ aspectRatio: PC_PREVIEW_ASPECT_RATIO }}>
              {previewMode === 'cards' ? (
                <div className="absolute inset-0 flex items-stretch justify-center overflow-hidden">
                  {validCards.map((card, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={card.imageUrl} alt={`カード${i + 1}プレビュー`} className="h-full w-auto min-w-0 shrink object-contain" />
                  ))}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewImageUrl} alt="PC表示プレビュー" className="absolute inset-0 h-full w-full object-cover" style={imageStyle} />
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-600">スマホ表示プレビュー（画像帯のみ・横長バナー右側）</p>
            <div className="relative mt-1 h-28 w-24 overflow-hidden rounded-lg border bg-stone-900" style={{ aspectRatio: SP_PREVIEW_ASPECT_RATIO }}>
              {previewMode === 'cards' ? (
                <div className="absolute inset-0 flex items-stretch justify-center overflow-hidden">
                  {validCards.map((card, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={card.imageUrl} alt={`カード${i + 1}プレビュー（スマホ）`} className="h-full w-auto min-w-0 shrink object-contain" />
                  ))}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewImageUrl} alt="スマホ表示プレビュー" className="absolute inset-0 h-full w-full object-cover" style={imageStyle} />
              )}
            </div>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">スマホもPCと同じ横長バナー構成です（左：文言＋ボタン、右：画像帯）。画像未設定時はプレビュー用に既定画像を表示しています。</p>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-gray-500">詳細設定・旧1枚画像（カード画像が1枚も未設定のときだけ使われます）</summary>
          <div className="mt-2 space-y-3 rounded border bg-white p-3">
            <div className="flex items-center gap-3">
              {fields.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fields.imageUrl} alt="旧1枚画像プレビュー" className="h-20 w-32 rounded border object-cover" />
              ) : (
                <div className="flex h-20 w-32 items-center justify-center rounded border border-dashed text-[11px] text-gray-400">
                  未設定
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="inline-flex w-fit cursor-pointer items-center rounded border border-gray-400 bg-white px-3 py-1.5 text-xs font-bold hover:bg-gray-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50" aria-disabled={imageUploading}>
                  {imageUploading ? 'アップロード中…' : '📁 画像を選択'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={imageUploading}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file)
                      e.target.value = ''
                    }}
                  />
                </label>
                {fields.imageUrl && (
                  <button type="button" onClick={handleImageRemove} disabled={imageUploading} className="w-fit rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                    画像を削除
                  </button>
                )}
              </div>
            </div>

            {imageError && <p className="text-xs font-bold text-red-700">{imageError}</p>}
            {imageUploaded && !imageError && <p className="text-xs font-bold text-green-700">アップロードしました（保存ボタンで確定します）</p>}

            <label className="block text-xs text-gray-500">画像URLを直接指定
              <input name="imageUrl" value={fields.imageUrl} onChange={e => set('imageUrl', e.target.value)} placeholder="https://..." className="mt-1 w-full rounded border p-2 text-xs" />
            </label>

            <ImagePositionSliders
              positionX={fields.imagePositionX}
              positionY={fields.imagePositionY}
              scale={fields.imageScale}
              positionXName="imagePositionX"
              positionYName="imagePositionY"
              scaleName="imageScale"
              onChangePositionX={value => set('imagePositionX', value)}
              onChangePositionY={value => set('imagePositionY', value)}
              onChangeScale={value => set('imageScale', value)}
            />
            <button type="button" onClick={resetImageTransform} className="rounded border border-gray-400 bg-white px-3 py-1.5 text-xs font-bold hover:bg-gray-50">
              位置を初期値に戻す
            </button>
          </div>
        </details>
      </div>

      <button className="rounded bg-blue-800 px-4 py-2 text-xs font-bold text-white">保存</button>
    </form>
  )
}
