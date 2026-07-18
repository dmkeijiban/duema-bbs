import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'カードメーカー・参加型企画｜デュエマ掲示板',
  description: 'デッキメーカー、Tier表、カード選択などのデュエマ参加型企画一覧です。',
}

type MakerProject = {
  slug: string
  title: string
  type: string
  config: Record<string, unknown> | null
}

function description(project: MakerProject) {
  const value = project.config?.description
  return typeof value === 'string' ? value : ''
}

export default async function MakersPage() {
  const { data } = await createAdminClient()
    .from('maker_projects')
    .select('slug,title,type,config')
    .eq('status', 'published')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  const projects = (data ?? []) as MakerProject[]
  const selectProjects = projects.filter(project => project.type === 'select')
  const otherProjects = projects.filter(project => project.type !== 'select')

  const ProjectCard = ({ project }: { project: MakerProject }) => (
    <Link href={`/makers/${project.slug}`} className="block rounded-xl border bg-white p-4 transition hover:border-blue-400 hover:shadow-sm">
      <h3 className="font-black text-blue-800">{project.title}</h3>
      {description(project) && <p className="mt-1 text-sm leading-6 text-gray-600">{description(project)}</p>}
    </Link>
  )

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-black sm:text-3xl">カードメーカー・参加型企画</h1>
        <p className="mt-2 text-sm text-gray-600">カードを選んで画像を作り、みんなの結果も見られます。</p>

        <section className="mt-6">
          <h2 className="text-lg font-black">カードメーカー</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Link href="/makers/deck-maker" className="block rounded-xl border bg-white p-4 transition hover:border-emerald-500 hover:shadow-sm">
              <h3 className="font-black text-emerald-800">デッキメーカー</h3>
              <p className="mt-1 text-sm text-gray-600">カードを検索してデッキ画像を作成できます。</p>
            </Link>
          </div>
        </section>

        {selectProjects.length > 0 && <section className="mt-7">
          <h2 className="text-lg font-black">参加型カード選択企画</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{selectProjects.map(project => <ProjectCard key={project.slug} project={project} />)}</div>
        </section>}

        {otherProjects.length > 0 && <section className="mt-7">
          <h2 className="text-lg font-black">その他の参加型企画</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{otherProjects.map(project => <ProjectCard key={project.slug} project={project} />)}</div>
        </section>}
      </div>
    </main>
  )
}
