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

type RewrittenDraft = { title: string; body: string; comments: string[] }

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

function normalizeForComparison(value: string) {
  return value.replace(/\s+/g, '').replace(/[。．]/g, '').trim()
}

function hasMeaningfulRewrite(original: string, rewritten: string) {
  if (original.trim().length < 8) return true
  return normalizeForComparison(original) !== normalizeForComparison(rewritten)
}

function validateRewrittenDraft(value: unknown, comments: string[]): RewrittenDraft {
  if (!value || typeof value !== 'object') throw new Error('Invalid response')
  const draft = value as { title?: unknown; body?: unknown; comments?: unknown }
  if (typeof draft.title !== 'string' || typeof draft.body !== 'string' || !Array.isArray(draft.comments)) {
    throw new Error('Invalid response shape')
  }
  if (draft.comments.length !== comments.length || !draft.comments.every(comment => typeof comment === 'string')) {
    throw new Error('Comment count mismatch')
  }
  return { title: draft.title, body: draft.body, comments: draft.comments as string[] }
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

  const basePrompt = `次のスレッド原稿を、意味・ニュアンス・主張・事実関係を維持したまま、複数の匿名利用者が自然に会話している掲示板文体へ書き直してください。

これは単なる誤字修正ではありません。タイトルだけでなく、本文と各コメントの文章表現も必ず見直してください。
長さが8文字以上ある本文・コメントは、意味を保ったまま語順、語尾、接続、区切り方のいずれかを変え、原文の完全コピーを避けてください。
短いツッコミや固有の言い回しは無理に壊さなくて構いません。

必須ルール:
- 元文にない事実、数字、固有名詞、体験談、結論を追加しない
- コメント数と並び順は変えない
- 各投稿が担う意見や役割は変えない
- 本文も必ず整形対象にする。タイトルだけ変えて本文をそのまま返さない
- 長めのコメントも可能な範囲で自然に言い換える
- 同じ投稿内の自然な改行は残してよいが、1文ごとに空行を入れない
- 空行は投稿同士の区切りとして扱い、投稿内に無駄な空行を作らない
- すべての文末を「。」で統一しない
- 句点あり・なし、「？」「…」「w」「ww」などを内容に合う範囲で自然に混ぜる
- 語尾、口調、文の長さ、改行、一人称に適度なばらつきを持たせる
- ネットスラングや「w」を全投稿へ機械的に付けない
- 意味不明な脱線、無関係な話、過度な煽り、暴言の追加は禁止
- 元の荒さや温度感は消しすぎない
- タイトルも意味を変えず、自然な掲示板タイトルに整える

原稿:
${JSON.stringify({ title, body, comments })}`

  const requestRewrite = async (retry: boolean): Promise<RewrittenDraft> => {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
        input: `${basePrompt}${retry ? '\n\n前回は原文のコピーが多すぎました。本文と8文字以上の各コメントを、情報を増減せずにもっと明確に言い換えてください。' : ''}`,
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
      throw new Error(`OPENAI_${response.status}`)
    }

    const rawResponse: unknown = await response.json()
    return validateRewrittenDraft(JSON.parse(getResponseText(rawResponse)), comments)
  }

  try {
    let value = await requestRewrite(false)
    const unchangedLongComments = comments.filter((comment, index) => !hasMeaningfulRewrite(comment, value.comments[index] ?? ''))
    const bodyUnchanged = body.length >= 8 && !hasMeaningfulRewrite(body, value.body)

    if (bodyUnchanged || unchangedLongComments.length > Math.max(1, Math.floor(comments.filter(comment => comment.length >= 8).length / 3))) {
      value = await requestRewrite(true)
    }

    const finalBodyUnchanged = body.length >= 8 && !hasMeaningfulRewrite(body, value.body)
    const finalUnchangedLongComments = comments.filter((comment, index) => !hasMeaningfulRewrite(comment, value.comments[index] ?? ''))
    const longCommentCount = comments.filter(comment => comment.length >= 8).length
    if (finalBodyUnchanged || finalUnchangedLongComments.length > Math.max(1, Math.floor(longCommentCount / 2))) {
      return { ok: false, message: '文章の書き換え量が足りませんでした。もう一度「掲示板風に整形」を押してください。' }
    }

    return {
      ok: true,
      message: '本文とコメントを掲示板らしい文体に整形しました。公開前に内容を確認してください。',
      title: value.title.slice(0, BULK_THREAD_TITLE_MAX),
      body: value.body.slice(0, BULK_THREAD_BODY_MAX),
      comments: value.comments.map(comment => comment.slice(0, BULK_THREAD_COMMENT_MAX)),
    }
  } catch (error) {
    console.error('Bulk rewrite parse failed', error)
    const message = error instanceof Error && error.message.startsWith('OPENAI_')
      ? `AI整形に失敗しました（${error.message.replace('OPENAI_', '')}）。`
      : 'AIの返答を読み取れませんでした。もう一度お試しください。'
    return { ok: false, message }
  }
}

export async function createConsentedBulkThread(formData: FormData): Promise<BulkCreateResult> {
  await requireAdmin()
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const categoryId = Number(formData.get('category_id'))
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
  if (!Number.isInteger(categoryId) || categoryId <= 0) return { ok: false, message: 'カテゴリを選択してください。' }
  if (title.length > BULK_THREAD_TITLE_MAX || body.length > BULK_THREAD_BODY_MAX) return { ok: false, message: 'タイトルまたは本文が文字数上限を超えています。' }
  if (comments.some(item => item.body.trim().length > BULK_THREAD_COMMENT_MAX)) return { ok: false, message: '文字数上限を超えたコメントがあります。' }
  if (comments.some(item => !/^\d{4}-\d{2}-\d{2}$/.test(item.permissionConfirmedOn))) return { ok: false, message: '全コメントの許可確認日を入力してください。' }

  const supabase = createAdminClient()
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle()
  if (categoryError || !category) return { ok: false, message: '選択したカテゴリが見つかりません。' }

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
  const { error: categoryUpdateError } = await supabase
    .from('threads')
    .update({ category_id: categoryId })
    .eq('id', threadId)
  if (categoryUpdateError) {
    console.error('Bulk thread category update failed', threadId, categoryUpdateError)
    return { ok: false, message: `スレッドは作成されましたが、カテゴリ設定に失敗しました。スレッドID: ${threadId}`, threadId }
  }

  revalidateTag('threads', { expire: 0 }); revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath('/'); revalidatePath('/category', 'layout'); revalidatePath('/ranking'); revalidatePath(`/thread/${threadId}`); revalidatePath('/admin')
  return { ok: true, message: `スレッド1件とコメント${comments.length}件を登録しました。`, threadId }
}
