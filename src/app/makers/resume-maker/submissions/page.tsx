import Link from 'next/link'
import { getPublicResumeSubmissions, type ResumeListingSort } from '@/lib/maker-resume-queries'
import { ResumeSubmissionsList } from '@/components/ResumeSubmissionsList'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'みんなのデュエマ履歴書｜デュエマ掲示板',
  description: 'デュエマプレイヤーのみんなが作った履歴書を、一覧で見てみよう。',
}

const PAGE_SIZE = 24

function parseSort(value: string | undefined): ResumeListingSort {
  return value === 'updated' ? 'updated' : 'new'
}

export default async function ResumeSubmissionsPage({ searchParams }: { searchParams: Promise<{ page?: string; sort?: string }> }) {
  const { page: pageValue, sort: sortValue } = await searchParams
  const page = Math.max(1, Number.parseInt(pageValue ?? '1', 10) || 1)
  const sort = parseSort(sortValue)

  const { submissions, total } = await getPublicResumeSubmissions(page, PAGE_SIZE, sort)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageHref = (targetPage: number) => `?sort=${sort}&page=${targetPage}#submissions-list`

  return (
    <main className="min-h-screen bg-slate-50 px-3 pb-6 pt-1">
      <div className="mx-auto max-w-6xl">
        <Link href="/makers/resume-maker" className="inline-flex h-8 items-center text-sm font-bold text-blue-700">← 履歴書メーカーへ戻る</Link>
        <div className="mt-1 sm:flex sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black">みんなのデュエマ履歴書</h1>
            <p className="mt-1 text-sm text-gray-500">デュエマプレイヤーのみんなが作った履歴書を見てみよう。</p>
          </div>
          <div className="mt-3 flex gap-2 sm:mt-0">
            <Link href="?sort=new#submissions-list" className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${sort === 'new' ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500'}`}>新着順</Link>
            <Link href="?sort=updated#submissions-list" className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${sort === 'updated' ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500'}`}>更新順</Link>
          </div>
        </div>

        <div id="submissions-list" className="scroll-mt-4" />

        {submissions.length ? (
          <div className="mt-5"><ResumeSubmissionsList submissions={submissions} /></div>
        ) : (
          <div className="mt-6 rounded-xl border bg-white p-8 text-center">
            <p className="text-gray-500">まだ公開されている履歴書はありません。最初のデュエマ履歴書を作ってみよう。</p>
            <Link href="/makers/resume-maker" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-6 font-bold text-white">
              自分の履歴書を作る
            </Link>
          </div>
        )}

        {submissions.length > 0 && totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-3 text-sm font-bold">
            <Link aria-disabled={page <= 1} className={page <= 1 ? 'pointer-events-none text-gray-300' : 'text-blue-700'} href={pageHref(page - 1)}>← 前へ</Link>
            <span>{page} / {totalPages}</span>
            <Link aria-disabled={page >= totalPages} className={page >= totalPages ? 'pointer-events-none text-gray-300' : 'text-blue-700'} href={pageHref(page + 1)}>次へ →</Link>
          </nav>
        )}
      </div>
    </main>
  )
}
