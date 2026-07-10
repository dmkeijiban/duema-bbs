const INTERACTIVE_THREAD_MAX_UPLOAD_BYTES = 9 * 1024 * 1024

export function validateInteractiveThreadUploadSize(formData: FormData): string | null {
  const kind = String(formData.get('thread_kind') ?? 'normal')
  if (kind !== 'poll' && kind !== 'quiz') return null

  let totalBytes = 0
  for (const value of formData.values()) {
    if (value instanceof File) totalBytes += value.size
  }

  if (totalBytes > INTERACTIVE_THREAD_MAX_UPLOAD_BYTES) {
    return '投票・クイズに添付する画像は、合計9MB以下にしてください'
  }
  return null
}
