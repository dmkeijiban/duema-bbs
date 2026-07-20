'use client'

import { useState } from 'react'
import {
  computeFeaturedCampaignImageStyle,
  DEFAULT_IMAGE_POSITION_X,
  DEFAULT_IMAGE_POSITION_Y,
  DEFAULT_IMAGE_SCALE,
  MAX_IMAGE_SCALE,
  MIN_IMAGE_SCALE,
  type TopFeaturedCampaignSettings,
} from '@/lib/top-featured-campaign'
import { updateTopFeaturedCampaignAction, uploadTopFeaturedCampaignImage } from '@/app/admin/actions'

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

  const imageStyle = computeFeaturedCampaignImageStyle(fields.imagePositionX, fields.imagePositionY, fields.imageScale)
  const previewImageUrl = fields.imageUrl || '/default-thumbnail.jpg'

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
        <span className="block font-bold">右側画像</span>
        <p className="mt-0.5 text-xs text-gray-500">未設定時は企画のサムネイル→既定画像の順で表示されます。</p>

        <div className="mt-2 flex items-center gap-3">
          {fields.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fields.imageUrl} alt="右側画像プレビュー" className="h-20 w-32 rounded border object-cover" />
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

        {imageError && <p className="mt-1 text-xs font-bold text-red-700">{imageError}</p>}
        {imageUploaded && !imageError && <p className="mt-1 text-xs font-bold text-green-700">アップロードしました（保存ボタンで確定します）</p>}

        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-gray-500">詳細設定（画像URLを直接指定）</summary>
          <input name="imageUrl" value={fields.imageUrl} onChange={e => set('imageUrl', e.target.value)} placeholder="https://..." className="mt-1 w-full rounded border p-2 text-xs" />
        </details>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-gray-600">PC表示プレビュー</p>
            <div className="relative mt-1 w-full overflow-hidden rounded-lg border bg-stone-900" style={{ aspectRatio: PC_PREVIEW_ASPECT_RATIO }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImageUrl} alt="PC表示プレビュー" className="absolute inset-0 h-full w-full object-cover" style={imageStyle} />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-600">スマホ表示プレビュー（画像帯のみ・横長バナー右側）</p>
            <div className="relative mt-1 h-28 w-24 overflow-hidden rounded-lg border bg-stone-900" style={{ aspectRatio: SP_PREVIEW_ASPECT_RATIO }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImageUrl} alt="スマホ表示プレビュー" className="absolute inset-0 h-full w-full object-cover" style={imageStyle} />
            </div>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">スマホもPCと同じ横長バナー構成です（左：文言＋ボタン、右：画像帯）。画像未設定時はプレビュー用に既定画像を表示しています（実際はサムネイル→既定画像の順で表示）。</p>

        <div className="mt-3 space-y-2">
          <label className="block text-xs">
            横位置：{fields.imagePositionX}%
            <input
              type="range"
              name="imagePositionX"
              min={0}
              max={100}
              step={1}
              value={fields.imagePositionX}
              onChange={e => set('imagePositionX', Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs">
            縦位置：{fields.imagePositionY}%
            <input
              type="range"
              name="imagePositionY"
              min={0}
              max={100}
              step={1}
              value={fields.imagePositionY}
              onChange={e => set('imagePositionY', Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs">
            拡大率：{fields.imageScale.toFixed(2)}倍
            <input
              type="range"
              name="imageScale"
              min={MIN_IMAGE_SCALE}
              max={MAX_IMAGE_SCALE}
              step={0.01}
              value={fields.imageScale}
              onChange={e => set('imageScale', Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <button type="button" onClick={resetImageTransform} className="rounded border border-gray-400 bg-white px-3 py-1.5 text-xs font-bold hover:bg-gray-50">
            位置を初期値に戻す
          </button>
        </div>
      </div>

      <button className="rounded bg-blue-800 px-4 py-2 text-xs font-bold text-white">保存</button>
    </form>
  )
}
