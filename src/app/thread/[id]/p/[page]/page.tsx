import { notFound } from 'next/navigation'
import { renderThreadPage } from '../../page'

interface Props {
  params: Promise<{ id: string; page: string }>
}

export const revalidate = 30

export { generateMetadata } from '../../page'

export default async function ThreadPaginatedPage({ params }: Props) {
  const { id, page: pageParam } = await params
  const threadId = parseInt(id)
  const page = Math.max(1, parseInt(pageParam) || 1)

  if (Number.isNaN(threadId) || page <= 1) notFound()

  return renderThreadPage(threadId, page)
}
