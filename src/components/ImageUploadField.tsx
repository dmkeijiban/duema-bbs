'use client'

import { useRef, useState } from 'react'
import { ImagePlus, X } from '@/components/Icons'

interface Props {
  name?: string
}

export function ImageUploadField({ name = 'image' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clear = () => {
    setPreview(null)
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleChange}
        className="hidden"
        id={`file-${name}`}
      />
      {!preview ? (
        <label
          htmlFor={`file-${name}`}
          className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors text-sm text-gray-500 dark:text-gray-400 w-fit"
        >
          <ImagePlus className="w-4 h-4" />
          画像を添付（5MB以下・JPEG/PNG/GIF/WebP）
        </label>
      ) : (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="プレビュー"
            className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
          />
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{fileName}</p>
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
