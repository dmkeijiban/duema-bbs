'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
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
  const [saved, setSaved] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl)
  const [deleteAvatar, setDeleteAvatar] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview)
      }
    }
  }, [avatarPreview])

  const handleSubmit = (formData: FormData) => {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {saved && (
        <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          プロフィールを更新しました。投稿者ページへの反映はキャッシュの都合で数分かかる場合があります。
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
            id="avatar_file"
            name="avatar_file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (!file) {
                setAvatarPreview(initialAvatarUrl)
                return
              }
              setDeleteAvatar(false)
              setAvatarPreview(URL.createObjectURL(file))
            }}
          />
          <p className="mt-1 text-xs text-gray-500">
            jpg / png / webp、500KB以内。表示は丸型に切り抜かれます。
          </p>
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
            <span className="font-bold">プロフィール非公開</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              ONにすると投稿者ページが非表示になります
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
            <span className="font-bold">ランキング参加</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              OFFにすると投稿者ランキングから外れます
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? '保存中…' : '保存する'}
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
