'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEFAULT_PUBLIC_AUTHOR_NAME } from '@/lib/cached-queries'
import { uploadImage, validateImageFile } from '@/lib/upload'
import { BULK_THREAD_BODY_MAX, BULK_THREAD_COMMENT_LIMIT, BULK_THREAD_COMMENT_MAX, BULK_THREAD_TITLE_MAX } from '@/lib/thread-bulk-create'

type CommentInput = { body: string; internalMemo: string; permissionConfirmedOn: string; textState: 'original' | 'lightly_edited' }
export type BulkCreateResult = { ok: boolean; message: string; threadId?: number }
export type BulkRewriteResult = { ok: boolean; message: string; title?: string; body?: string; comments?: string[] }

async function requireAdmin() {
  const store = await cookies()
  if (!verifyAdminCookie(store.get('admin_auth')?.value)) throw new Error('Unauthorized')
}

function getResponseText(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  const response = value as { output_text?: unknown; output?: unknown }
  if (typeof response.output_text === 'string') return response.output_text
  if (!Array.isArray(response.output)) return ''
  for (const item of response.output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') return text
    }
  }
  return ''
}

export async function rewriteBulkThreadDraft(input: {
  title: string
  body: string
  comments: string[]
}): Promise<BulkRewriteResult> {
  await requireAdmin()

  const apiKey = process.env.OPENAI_THREAD_REWRITE_API_KEY
  if (!apiKey) return { ok: false, message: 'OPENAI_THREAD_REWRITE_API_KEY が設定されていません。' }

  const title = input.title.trim().slice(0, BULK_THREAD_TITLE_MAX)
  const body = input.body.trim().slice(0, BULK_THREAD_BODY_MAX)
  const comments = input.comments
    .filter((value): value is string => typeof value === 'string')
    .slice(0, BULK_THREAD_COMMENT_LIMIT)
    .map(value => value.trim().slice(0, BULK_THREAD_COMMENT_MAX))

  if (!title || (!body && !comments.some(Boolean))) {
    return { ok: false, message: '整形するタイトル・本文・コメントを入力してください。' }
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'body', 'comments'],
    properties: {
      title: { type: 'string', maxLength: BULK_THREAD_TITLE_MAX },
      body: { type: 'string', maxLength: BULK_THREAD_BODY_MAX },
      comments: {
        type: 'array',
        minItems: comments.length,
        maxItems: comments.length,
        items: { type: 'string', maxLength: BULK_THREAD_COMMENT_MAX },
      },
    },
  }

  const prompt = `次のスレッド原稿を、意味・ニュアンス・主張・事実関係を維持したまま、複数の匿名利用者が自然に会話している掲示板文体へ軽く整えてください。

必須ルール:
- 元文にない事実、数字、固有名詞、体験談、結論を追加しない
- コメント数と並び順は変えない
- 各投稿が担う意見や役割は変えない
- 同じ投稿内の自然な改行は残してよいが、1文ごとに空行を入れない
- 空行は投稿同士の区切りとして扱い、投稿内に無駄な空行を作らない
- すべての文末を「。」で統一しない
- 句点あり・なし、「？」「…」「w」「ww」などを内容に合う範囲で自然に混ぜる
- 語尾、口調、文の長さ、改行、一人称に適度なばらつきを持たせる
- ネットスラングや「w」を全投稿へ機械的に付けない
- 意味不明な脱線、無関係な話、過度な煽り、暴言の追加は禁止
- 元の荒さや温度感は消しすぎず、誤字・読みにくさだけを軽く直す
- タイトルも意味を変えず、自然な掲示板タイトルに軽く整える

原稿:
${JSON.stringify({ title, body, comments })}`

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'bulk_thread_rewrite',
            strict: true,
            schema,
          },
        },
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('OpenAI bulk rewrite failed', response.status, detail)
      return { ok: false, message: `AI整形に失敗しました（${response.status}）。` }
    }

    const rawResponse: unknown = await response.json()
    const outputText = getResponseText(rawResponse)
    const parsed: unknown = JSON.parse(outputText)
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid response')

    const value = parsed as { title?: unknown; body?: unknown; comments?: unknown }
    if (typeof value.title !== 'string' || typeof value.body !== 'string' || !Array.isArray(value.comments)) {
      throw new Error('Invalid response shape')
    }
    if (value.comments.length !== comments.length || !value.comments.every(comment => typeof comment === 'string')) {
      throw new Error('Comment count mismatch')
    }

    return {
      ok: true,
      message: '掲示板らしい文体に整形しました。公開前に内容を確認してください。',
      title: value.title.slice(0, BULK_THREAD_TITLE_MAX),
      body: value.body.slice(0, BULK_THREAD_BODY_MAX),
      comments: value.comments.map(comment => String(comment).slice(0, BULK_THREAD_COMMENT_MAX)),
    }
  } catch (error) {
    console.error('Bulk rewrite parse failed', error)
    return { ok: false, message: 'AIの返答を読み取れませんでした。もう一度お試しください。' }
  }
}

export async function createConsentedBulkThread(formData: FormData): Promise<BulkCreateResult> {
  await requireAdmin()
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  let parsedComments: unknown
  try { parsedComments = JSON.parse(String(formData.get('comments') ?? '[]')) } catch { return { ok: false, message: 'コメント形式が不正です。' } }
  if (!Array.isArray(parsedComments)) return { ok: false, message: 'コメント形式が不正です。' }
  let comments = parsedComments.filter((item): item is CommentInput => {
    if (!item || typeof item !== 'object') return false
    const value = item as Partial<CommentInput>
    return typeof value.body === 'string' && typeof value.internalMemo === 'string'
      && typeof value.permissionConfirmedOn === 'string'
      && (value.textState === 'original' || value.textState === 'lightly_edited')
  })
  comments = comments.filter(item => item.body?.trim()).slice(0, BULK_THREAD_COMMENT_LIMIT)
  if (!title) return { ok: false, message: 'タイトルは必須です。' }
  if (title.length > BULK_THREAD_TITLE_MAX || body.length > BULK_THREAD_BODY_MAX) return { ok: false, message: 'タイトルまたは本文が文字数上限を超えています。' }
  if (comments.some(item => item.body.trim().length > BULK_THREAD_COMMENT_MAX)) return { ok: false, message: '文字数上限を超えたコメントがあります。' }
  if (comments.some(item => !/^\d{4}-\d{2}-\d{2}$/.test(item.permissionConfirmedOn))) return { ok: false, message: '全コメントの許可確認日を入力してください。' }

  const supabase = createAdminClient()
  const image = formData.get('image') as File | null
  let uploaded: { url: string; thumbnailUrl: string | null; width: number; height: number } | null = null
  if (image?.size) {
    const invalid = validateImageFile(image)
    if (invalid) return { ok: false, message: invalid }
    const result = await uploadImage(image, supabase, `threads/${uuidv4()}`, 'post', { createListThumbnail: true })
    if (!result.data) return { ok: false, message: result.error ?? '画像アップロードに失敗しました。' }
    uploaded = result.data
  }

  const { data, error } = await supabase.rpc('admin_create_consented_thread', {
    p_title: title, p_body: body || '', p_author_name: DEFAULT_PUBLIC_AUTHOR_NAME,
    p_image_url: uploaded?.url ?? null, p_thumbnail_url: uploaded?.thumbnailUrl ?? null,
    p_image_width: uploaded?.width ?? null, p_image_height: uploaded?.height ?? null,
    p_comments: comments.map(item => ({ body: item.body.trim(), internal_memo: item.internalMemo.trim(), permission_confirmed_on: item.permissionConfirmedOn, text_state: item.textState })),
    p_registered_by: 'admin-cookie',
  })
  if (error || !data) {
    const storagePaths = [uploaded?.url, uploaded?.thumbnailUrl]
      .flatMap(url => url?.match(/\/storage\/v1\/object\/public\/bbs-images\/(.+)$/)?.[1] ?? [])
    if (storagePaths.length) await supabase.storage.from('bbs-images').remove(storagePaths)
    return { ok: false, message: `登録に失敗しました: ${error?.message ?? 'unknown error'}` }
  }
  const threadId = Number(data)
  revalidateTag('threads', { expire: 0 }); revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath('/'); revalidatePath('/category', 'layout'); revalidatePath('/ranking'); revalidatePath(`/thread/${threadId}`); revalidatePath('/admin')
  return { ok: true, message: `スレッド1件とコメント${comments.length}件を登録しました。`, threadId }
}
