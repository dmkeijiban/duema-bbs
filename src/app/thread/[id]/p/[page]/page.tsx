import { notFound } from 'next/navigation'
import { renderThreadPage } from '../../page'
import { createPublicClient } from '@/lib/supabase-public'
import { THREAD_POSTS_PER_PAGE } from '@/lib/cached-queries'

interface Props {
  params: Promise<{ id: string; page: string }>
}

export const revalidate = 30

export { generateMetadata } from '../../page'

export async function generateStaticParams() {
  const supabase = createPublicClient()
  // Top 50 threads with enough posts to have at least 2 pages
  const { data } = await supabase
    .from('threads')
    .select('id, post_count')
    .eq('is_archived', false)
    .gt('post_count', THREAD_POSTS_PER_PAGE)
    .order('post_count', { ascending: false })
    .limit(50)

  const params: { id: string; page: string }[] = []
  for (const thread of data ?? []) {
    const totalPages = Math.ceil(thread.post_count / THREAD_POSTS_PER_PAGE)
    // Pre-render page 2 and page 3 (if exists) for the most-read threads
    for (let p = 2; p <= Math.min(totalPages, 3); p++) {
      params.push({ id: String(thread.id), page: String(p) })
    }
  }
  return params
}

export default async function ThreadPaginatedPage({ params }: Props) {
  const { id, page: pageParam } = await params
  const threadId = parseInt(id)
  const page = Math.max(1, parseInt(pageParam) || 1)

  if (Number.isNaN(threadId) || page <= 1) notFound()

  return renderThreadPage(threadId, page)
}
