'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ChangeEvent, CSSProperties } from 'react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { updateProfile } from './actions'

type ProfileEditFormProps = {
  initialDisplayName: string
  initialBio: string
  initialXUrl: string
  initialYoutubeUrl: string
  initialAvatarUrl: string | null
  initialProfileHidden: boolean
  initialRankingEnabled: boolean
}

type CropImageState = {
  url: string
  naturalWidth: number
  naturalHeight: number
  centerX: number
  centerY: number
  zoom: number
}

const CROP_SIZE = 220
const OUTPUT_SIZE = 512
const MAX_AVATAR_SIZE = 500 * 1024

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampCropCenter(image: CropImageState, centerX: number, centerY: number, zoom = image.zoom) {
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom
  const minX = sourceSize / 2 / image.naturalWidth
  const maxX = 1 - minX
  const minY = sourceSize / 2 / image.naturalHeight
  const maxY = 1 - minY

  return {
    centerX: clamp(centerX, minX, maxX),
    centerY: clamp(centerY, minY, maxY),
  }
}

function getCropImageStyle(image: CropImageState, size: number): CSSProperties {
  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight)
  const width = image.naturalWidth * baseScale * image.zoom
  const height = image.naturalHeight * baseScale * image.zoom

  return {
    position: 'absolute',
    left: size / 2 - image.centerX * width,
    top: size / 2 - image.centerY * height,
    width,
    height,
    maxWidth: 'none',
    userSelect: 'none',
    touchAction: 'none',
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image load failed'))
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, type, quality)
  })
}

export default function ProfileEditForm({
  initialDisplayName,
  initialBio,
  initialXUrl,
  initialYoutubeUrl,
  initialAvatarUrl,
  initialProfileHidden,
  initialRankingEnabled,
}: ProfileEditFormProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl)
  const [cropImage, setCropImage] = useState<CropImageState | null>(null)
  const [deleteAvatar, setDeleteAvatar] = useState(false)
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cropBoxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    centerX: number
    centerY: number
  } | null>(null)

  const cropImageUrl = cropImage?.url

  useEffect(() => {
    return () => {
      if (cropImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(cropImageUrl)
      }
    }
  }, [cropImageUrl])

  const createCroppedAvatarFile = async () => {
    if (!cropImage) return null

    let image: HTMLImageElement
    try {
      image = await loadImage(cropImage.url)
    } catch {
      throw new Error('image_load_failed')
    }

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas_unavailable')

    // White fill prevents black background on PNG with transparency
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / cropImage.zoom
    const sx = clamp(cropImage.centerX * image.naturalWidth - sourceSize / 2, 0, image.naturalWidth - sourceSize)
    const sy = clamp(cropImage.centerY * image.naturalHeight - sourceSize / 2, 0, image.naturalHeight - sourceSize)
    context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    // Try WebP first; if canvas.toBlob returns null the browser doesn't support WebP output
    const QUALITIES = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26, 0.18]
    let webpSupported = false
    for (const quality of QUALITIES) {
      const blob = await canvasToBlob(canvas, 'image/webp', quality)
      if (blob === null) break  // browser returned null — WebP output unsupported
      webpSupported = true
      if (blob.size <= MAX_AVATAR_SIZE) {
        return new File([blob], 'avatar.webp', { type: 'image/webp' })
      }
    }

    // Fallback to JPEG — always try, regardless of whether WebP was supported
    for (const quality of QUALITIES) {
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
      if (blob === null) throw new Error('format_unsupported')
      if (blob.size <= MAX_AVATAR_SIZE) {
        return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      }
    }

    throw new Error('size_exceeded')
  }

  const handleSubmit = async (formData: FormData) => {
    setError('')
    let submitData = formData

    if (cropImage && !deleteAvatar) {
      setIsProcessingAvatar(true)
      try {
        const croppedFile = await createCroppedAvatarFile()
        if (croppedFile) {
          submitData = new FormData()
          formData.forEach((value, key) => {
            if (key !== 'avatar_file') submitData.append(key, value)
          })
          submitData.set('avatar_file', croppedFile)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg === 'image_load_failed') {
          setError('画像の読み込みに失敗しました。別の画像で試してください。')
        } else if (msg === 'canvas_unavailable' || msg === 'format_unsupported') {
          setError('対応していない画像形式です。jpg / png / webp をお試しください。')
        } else if (msg === 'size_exceeded') {
          setError('画像の容量を500KB以下にしてください。別の画像を選ぶか、拡大率を下げてお試しください。')
        } else {
          setError('画像の切り抜きに失敗しました。別の画像で試してください。')
        }
        setIsProcessingAvatar(false)
        return
      }
      setIsProcessingAvatar(false)
    }

    startTransition(async () => {
      const result = await updateProfile(submitData)
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result?.redirectTo) {
        window.location.assign(result.redirectTo)
      } else {
        router.refresh()
      }
    })
  }

  const updateCropCenter = (dx: number, dy: number) => {
    setCropImage(current => {
      if (!current || !dragRef.current) return current
      const boxSize = cropBoxRef.current?.getBoundingClientRect().width ?? CROP_SIZE
      const baseScale = Math.max(boxSize / current.naturalWidth, boxSize / current.naturalHeight)
      const renderedWidth = current.naturalWidth * baseScale * current.zoom
      const renderedHeight = current.naturalHeight * baseScale * current.zoom
      const next = clampCropCenter(
        current,
        dragRef.current.centerX - dx / renderedWidth,
        dragRef.current.centerY - dy / renderedHeight
      )
      return { ...current, ...next }
    })
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    setError('')
    if (!file) {
      setAvatarPreview(initialAvatarUrl)
      setCropImage(null)
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('アイコンは jpg / png / webp の画像を選んでください。')
      event.currentTarget.value = ''
      return
    }

    setDeleteAvatar(false)
    const nextUrl = URL.createObjectURL(file)
    if (cropImage?.url.startsWith('blob:')) {
      URL.revokeObjectURL(cropImage.url)
    }

    const image = new Image()
    image.onload = () => {
      const crop = {
        url: nextUrl,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        centerX: 0.5,
        centerY: 0.5,
        zoom: 1,
      }
      setCropImage({ ...crop, ...clampCropCenter(crop, 0.5, 0.5, 1) })
      setAvatarPreview(nextUrl)
      // Reset so the same file can be re-selected after cancellation
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    image.onerror = () => {
      URL.revokeObjectURL(nextUrl)
      setError('アイコン画像を読み込めませんでした。別の画像で試してください。')
    }
    image.src = nextUrl
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit(new FormData(e.currentTarget))
      }}
      className="space-y-4"
    >
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="avatar_file" className="mb-1 block text-sm font-bold text-gray-700">
          プロフィールアイコン
        </label>
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
          <div className="mb-3 flex items-center gap-3">
            <ProfileAvatar src={deleteAvatar ? null : avatarPreview} alt="現在のプロフィールアイコン" size="lg" />
            {!avatarPreview || deleteAvatar ? (
              <p className="text-xs text-gray-500">アイコン未設定</p>
            ) : (
              <p className="text-xs text-gray-500">現在のアイコン</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            id="avatar_file"
            name="avatar_file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700"
            onChange={handleAvatarChange}
          />
          <p className="mt-1 text-xs text-gray-500">
            jpg / png / webp、500KB以内。保存時に512px四方へ切り抜いてアップロードします。
          </p>

          {cropImage && !deleteAvatar && (
            <div className="mt-4 rounded border border-gray-200 bg-white p-3">
              <p className="mb-2 text-xs font-bold text-gray-700">正方形に切り抜き</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div
                  ref={cropBoxRef}
                  className="relative shrink-0 overflow-hidden border border-gray-300 bg-gray-100"
                  style={{ width: CROP_SIZE, height: CROP_SIZE, maxWidth: '100%', touchAction: 'none' }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId)
                    dragRef.current = {
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startY: event.clientY,
                      centerX: cropImage.centerX,
                      centerY: cropImage.centerY,
                    }
                  }}
                  onPointerMove={(event) => {
                    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
                    updateCropCenter(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY)
                  }}
                  onPointerUp={(event) => {
                    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cropImage.url}
                    alt="切り抜き範囲"
                    draggable={false}
                    style={getCropImageStyle(cropImage, CROP_SIZE)}
                  />
                  {/* circle guide overlay — shows the actual avatar boundary */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                      borderRadius: '50%',
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cropImage.url}
                        alt="丸型プレビュー"
                        draggable={false}
                        style={getCropImageStyle(cropImage, 64)}
                      />
                    </div>
                    <p className="text-xs text-gray-500">ドラッグで位置調整、スライダーで拡大できます。</p>
                  </div>
                  <label className="block text-xs font-bold text-gray-600" htmlFor="avatar_zoom">
                    拡大
                  </label>
                  <input
                    id="avatar_zoom"
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={cropImage.zoom}
                    onChange={(event) => {
                      const zoom = Number(event.currentTarget.value)
                      setCropImage(current => {
                        if (!current) return current
                        return { ...current, zoom, ...clampCropCenter(current, current.centerX, current.centerY, zoom) }
                      })
                    }}
                    className="mt-1 w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {initialAvatarUrl && (
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="delete_avatar"
                checked={deleteAvatar}
                onChange={(event) => setDeleteAvatar(event.currentTarget.checked)}
                className="h-4 w-4"
              />
              アイコンを削除する
            </label>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="display_name" className="mb-1 block text-sm font-bold text-gray-700">
          表示名
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          maxLength={20}
          defaultValue={initialDisplayName}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">1〜20文字で入力してください。</p>
      </div>

      <div>
        <label htmlFor="bio" className="mb-1 block text-sm font-bold text-gray-700">
          自己紹介
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={5}
          maxLength={300}
          defaultValue={initialBio}
          placeholder="デュエマ歴や好きなカードなど（任意）"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">300文字以内で入力してください。</p>
      </div>

      <div>
        <label htmlFor="x_url" className="mb-1 block text-sm font-bold text-gray-700">
          X（旧Twitter）のURL
        </label>
        <input
          id="x_url"
          name="x_url"
          type="url"
          defaultValue={initialXUrl}
          placeholder="https://x.com/..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          https://x.com/... または https://twitter.com/... の形式。空欄にすると削除されます。
        </p>
      </div>

      <div>
        <label htmlFor="youtube_url" className="mb-1 block text-sm font-bold text-gray-700">
          YouTubeのURL
        </label>
        <input
          id="youtube_url"
          name="youtube_url"
          type="url"
          defaultValue={initialYoutubeUrl}
          placeholder="https://youtube.com/..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          https://youtube.com/... / https://youtu.be/... の形式。空欄にすると削除されます。
        </p>
      </div>

      <div className="space-y-3 rounded border border-gray-200 bg-gray-50 px-3 py-3">
        <div className="flex items-start gap-2">
          <input
            id="profile_hidden"
            name="profile_hidden"
            type="checkbox"
            defaultChecked={initialProfileHidden}
            className="mt-0.5 h-4 w-4"
          />
          <label htmlFor="profile_hidden" className="text-sm text-gray-700">
            <span className="font-bold">プロフィールを非公開にする</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              公開投稿者ページを他の人から見えなくします。本人は引き続き投稿者ページとマイページを確認できます。
            </span>
          </label>
        </div>

        <div className="flex items-start gap-2">
          <input
            id="ranking_enabled"
            name="ranking_enabled"
            type="checkbox"
            defaultChecked={initialRankingEnabled}
            className="mt-0.5 h-4 w-4"
          />
          <label htmlFor="ranking_enabled" className="text-sm text-gray-700">
            <span className="font-bold">投稿者ランキングに参加する</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              OFFにすると、投稿者ページは公開したままランキングには表示されません。
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isPending || isProcessingAvatar}
          className="rounded bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending || isProcessingAvatar ? '保存中…' : '保存する'}
        </button>
        <Link
          href="/mypage"
          className="rounded border border-gray-300 px-5 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50"
        >
          マイページへ戻る
        </Link>
      </div>
    </form>
  )
}
