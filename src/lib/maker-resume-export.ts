import { toBlob } from 'html-to-image'
import { RESUME_LAYOUT as L } from '@/lib/maker-resume-layout'

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

async function waitForPreviewImages(previewElement: HTMLElement) {
  const images = Array.from(previewElement.querySelectorAll('img'))
  await Promise.all(images.map(async image => {
    if (!image.complete) {
      await new Promise<void>(resolve => {
        const finish = () => resolve()
        image.addEventListener('load', finish, { once: true })
        image.addEventListener('error', finish, { once: true })
      })
    }
    if (typeof image.decode === 'function') await image.decode().catch(() => undefined)
  }))
}

/**
 * 画面表示と同じ ResumePreview のDOMを、そのままPNGへ変換する。
 * 履歴書のレイアウトをここで再実装しないこと。
 */
export async function renderResumeExportImage(previewElement: HTMLElement | null): Promise<Blob> {
  if (!previewElement) throw new Error('履歴書のプレビューを取得できません')

  await document.fonts.ready
  await waitForPreviewImages(previewElement)

  const baseOptions = {
    width: L.width,
    height: L.height,
    canvasWidth: L.width,
    canvasHeight: L.height,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: L.colors.paper,
  }

  let blob: Blob | null = null
  try {
    blob = await toBlob(previewElement, baseOptions)
  } catch (error) {
    console.warn('Resume PNG export retrying with image fallback', error)
  }

  if (!blob) {
    blob = await toBlob(previewElement, {
      ...baseOptions,
      cacheBust: false,
      imagePlaceholder: TRANSPARENT_PIXEL,
    })
  }

  if (!blob) throw new Error('PNGの生成に失敗しました')
  return blob
}

export function resumePngFileName(handleName: string) {
  const safe = (handleName || 'デュエマ履歴書').replace(/[\\/:*?"<>| -]/g, '_').trim().slice(0, 40)
  return `${safe || 'デュエマ履歴書'}.png`
}
