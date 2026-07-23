import Link from 'next/link'
import { ResumeMypagePanel } from '@/components/ResumeMypagePanel'
import type { ResumeData } from '@/lib/maker-resume'
import type { PublicSubmission } from '@/lib/maker-submissions'
import type { PublicDeckCardData } from '@/components/deck/PublicDeckCard'

type Resume = { data: ResumeData; isPublic: boolean; updatedAt: string } | null

const actionClass = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-300 px-3 text-sm font-bold text-blue-700 transition active:scale-[0.98]'

export function CreatedContentSection({ resume, avatarUrl, resumeUpdatedAtLabel, nine, deck }: {
  resume: Resume
  avatarUrl: string | null
  resumeUpdatedAtLabel: string
  nine: { representative: PublicSubmission | null; count: number }
  deck: { representative: PublicDeckCardData | null; items: PublicDeckCardData[]; count: number }
}) {
  return <section className="rounded border border-gray-200 bg-white">
    <div className="border-b border-blue-100 bg-blue-50 px-4 py-3"><h2 className="text-sm font-bold text-blue-900">作成したコンテンツ</h2></div>
    <div className="grid gap-3 p-3 md:grid-cols-3">
      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="font-bold text-slate-900">デュエマ履歴書</h3>
        {resume ? <ResumeMypagePanel data={resume.data} avatarUrl={avatarUrl} isPublic={resume.isPublic} updatedAtLabel={resumeUpdatedAtLabel} resumeDate={resume.updatedAt} /> : <div className="py-5 text-center"><p className="text-sm text-slate-500">まだ作成していません</p><Link href="/makers/resume-maker" className={`${actionClass} mt-3`}>作成する</Link></div>}
      </article>

      <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900">あなたの9選</h3><span className="text-xs text-slate-500">{nine.count}件</span></div>
        {nine.representative ? <div className="flex flex-1 flex-col">
          <Link href={`/makers/my-duema-9/submissions/${nine.representative.id}`} className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 transition active:scale-[0.99]">
            {nine.representative.items.slice(0, 9).map(item => item.card.image_url ? <img key={`${item.card_id}:${item.position}`} src={item.card.image_url} alt={item.card.name} className="aspect-[63/88] h-full w-full object-cover" /> : <span key={`${item.card_id}:${item.position}`} className="flex aspect-[63/88] items-center justify-center bg-slate-100 p-1 text-center text-[9px]">{item.card.name}</span>)}
          </Link>
          <Link href="/makers/my-duema-9/submissions?tab=mine" className={`${actionClass} mt-auto pt-3 w-full`}>すべて見る</Link>
        </div> : <div className="py-5 text-center"><p className="text-sm text-slate-500">まだ作成していません</p><Link href="/makers/my-duema-9" className={`${actionClass} mt-3`}>作成する</Link></div>}
      </article>

      <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900">マイデッキ</h3><span className="text-xs text-slate-500">{deck.count}件</span></div>
        {deck.items.length > 0 ? <div className="flex flex-1 flex-col">
          <div className="mt-3 grid flex-1 grid-rows-4 gap-2">
            {deck.items.map((item) => {
              const keyCard = item.deck_data[0]
              return <Link key={item.id} href={`/makers/deck-maker/submissions/${item.id}`} className="grid min-h-0 grid-cols-[72px_1fr] overflow-hidden rounded-lg border border-slate-200 transition active:scale-[0.99]">
                <div className="min-h-0 bg-slate-800">{keyCard?.imageUrl ? <img src={keyCard.imageUrl} alt={keyCard.name} className="h-full w-full object-cover object-top" /> : null}</div>
                <div className="flex min-w-0 items-center p-3"><p className="line-clamp-2 font-bold text-slate-900">{item.title}</p></div>
              </Link>
            })}
          </div>
          <Link href="/makers/deck-maker/submissions?tab=mine" className={`${actionClass} mt-3 w-full`}>すべて見る</Link>
        </div> : <div className="py-5 text-center"><p className="text-sm text-slate-500">まだ作成していません</p><Link href="/makers/deck-maker" className={`${actionClass} mt-3`}>作成する</Link></div>}
      </article>
    </div>
  </section>
}
