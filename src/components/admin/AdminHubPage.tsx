import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'

type HubLink = { href: string; title: string; description: string; tone?: 'default' | 'warning' }
export type AdminHubSection = { title?: string; links: HubLink[] }

export async function AdminHubPage({ title, description, sections }: { title: string; description: string; sections: AdminHubSection[] }) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')

  return <main className="min-h-screen bg-gray-50 px-3 py-5 text-gray-800"><div className="mx-auto max-w-5xl">
    <nav className="mb-2 text-xs text-gray-500"><Link href="/admin" className="text-blue-700 hover:underline">管理TOP</Link><span className="mx-2">/</span><span>{title}</span></nav>
    <h1 className="text-2xl font-black">{title}</h1><p className="mt-1 text-sm text-gray-600">{description}</p>
    <div className="mt-5 space-y-5">{sections.map((section, index) => <section key={section.title ?? index}>
      {section.title && <h2 className="mb-2 text-sm font-bold text-gray-600">{section.title}</h2>}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{section.links.map(link => <Link key={link.href} href={link.href} className={`min-w-0 rounded-lg border bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40 ${link.tone === 'warning' ? 'border-orange-200' : 'border-gray-200'}`}>
        <span className="block font-bold text-gray-800">{link.title}</span><span className="mt-1 block text-xs leading-relaxed text-gray-500">{link.description}</span>
      </Link>)}</div>
    </section>)}</div>
  </div></main>
}
