import type { MakerGroup } from '@/lib/maker'
import type { PublicSubmission } from '@/lib/maker-submissions'

export default function MakerSubmissionBoard({ submission, groups, compact = false }: { submission: PublicSubmission; groups: MakerGroup[]; compact?: boolean }) {
  return <div className={`overflow-hidden rounded-lg border bg-slate-100 ${compact ? 'text-[9px]' : 'text-sm'}`}>
    {groups.map(group => {
      const items = submission.items.filter(item => item.group_key === group.key)
      return <div key={group.key} className={`grid border-b last:border-b-0 ${compact ? 'grid-cols-[28px_1fr]' : 'grid-cols-[54px_1fr]'}`}>
        <div className={`flex items-center justify-center font-black ${group.color}`}>{group.label}</div>
        <div className={`grid bg-white ${compact ? 'min-h-10 grid-cols-8 gap-0.5 p-1' : 'min-h-20 grid-cols-4 gap-2 p-2 sm:grid-cols-7'}`}>
          {items.map(item => <div key={item.card_id} className="aspect-[63/88] overflow-hidden rounded border bg-slate-200">
            {item.card.image_url ? <img src={item.card.image_url} alt={item.card.name} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-1 text-center">{item.card.name}</span>}
          </div>)}
        </div>
      </div>
    })}
  </div>
}
