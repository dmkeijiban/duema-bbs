import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SEED_COMMENTS } from '@/lib/seed-data'

export const runtime = 'nodejs'
export const maxDuration = 30

const AUTHOR_NAME = '名無しのデュエリスト'

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAnonClient()
  const dayIndex = Math.floor(Date.now() / 86400000)

  const result: {
    commentsAdded: { threadId: number; postNumber: number }[]
    errors: string[]
  } = { commentsAdded: [], errors: [] }

  // 最後にコメントがついた時刻が最も古い上位6スレッドを取得
  const { data: oldThreads, error: fetchError } = await supabase
    .from('threads')
    .select('id, title, post_count')
    .eq('is_archived', false)
    .order('last_posted_at', { ascending: true })
    .limit(6)

  if (fetchError) {
    console.error('Seed/comment: fetch threads error:', fetchError)
    result.errors.push(`fetch: ${fetchError.message}`)
    return NextResponse.json({ ok: false, ...result })
  }

  if (!oldThreads || oldThreads.length === 0) {
    console.log('Seed/comment: no threads found')
    return NextResponse.json({ ok: true, ...result })
  }

  for (let i = 0; i < oldThreads.length; i++) {
    const thread = oldThreads[i]

    // 既存の最大post_numberを取得
    const { data: maxPost } = await supabase
      .from('posts')
      .select('post_number')
      .eq('thread_id', thread.id)
      .order('post_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextPostNumber = (maxPost?.post_number ?? 0) + 1

    // (日付インデックス + スレ番号×7) % 40 でローテーション
    const commentTemplate = SEED_COMMENTS[(dayIndex + i * 7) % SEED_COMMENTS.length]

    const { error: postError } = await supabase
      .from('posts')
      .insert({
        thread_id: thread.id,
        post_number: nextPostNumber,
        body: commentTemplate.body,
        author_name: AUTHOR_NAME,
      })

    if (postError) {
      console.error(`Seed/comment: post insert error for thread ${thread.id}:`, postError)
      result.errors.push(`post(thread=${thread.id}): ${postError.message}`)
    } else {
      // post_count と last_posted_at を更新（更新順ソートに反映させるため必須）
      await supabase.rpc('increment_post_count', { p_thread_id: thread.id })
      result.commentsAdded.push({ threadId: thread.id, postNumber: nextPostNumber })
      console.log(`Seed/comment: added comment to thread ${thread.id} (post #${nextPostNumber})`)
    }
  }

  console.log('Seed/comment complete:', JSON.stringify(result))
  return NextResponse.json({ ok: true, ...result })
}
