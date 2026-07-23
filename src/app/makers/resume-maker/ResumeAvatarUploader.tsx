'use client'

import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'

const OUTPUT_SIZE = 512
const MAX_AVATAR_SIZE = 500 * 1024
const QUALITIES = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26, 0.18]

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image_load_failed'))
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
}

async function createAvatarDataUrl(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas_unavailable')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
    const sx = (image.naturalWidth - sourceSize) / 2
    const sy = (image.naturalHeight - sourceSize) / 2
    context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    for (const type of ['image/webp', 'image/jpeg']) {
      for (const quality of QUALITIES) {
        const blob = await canvasToBlob(canvas, type, quality)
        if (!blob) break
        if (blob.size <= MAX_AVATAR_SIZE) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          })
        }
      }
    }
    throw new Error('size_exceeded')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function ResumeAvatarUploader({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('jpg / png / webp の画像を選んでください。')
      return
    }

    setProcessing(true)
    try {
      onChange(await createAvatarDataUrl(file))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      setError(message === 'size_exceeded' ? '画像の容量を500KB以下にできませんでした。別の画像を選んでください。' : '画像の読み込みに失敗しました。別の画像で試してください。')
    } finally {
      setProcessing(false)
    }
  }

  return <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white">
        {value ? <img src={value} alt="履歴書の証明写真" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">未設定</div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-700">証明写真</p>
        <p className="mt-1 text-[11px] text-slate-500">jpg / png / webp。中央を正方形に切り抜き、512px・500KB以内に調整します。</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={processing} onClick={() => inputRef.current?.click()} className="min-h-10 rounded-lg bg-blue-700 px-4 text-xs font-bold text-white disabled:opacity-50">{processing ? '処理中…' : value ? '画像を変更' : '画像を選ぶ'}</button>
      {value && <button type="button" onClick={() => onChange(null)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700">画像を削除</button>}
    </div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => void handleChange(event)} />
    {error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{error}</p>}
  </div>
}
