import Link from 'next/link'
import { ContactForm } from './ContactForm'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { SITE_URL } from '@/lib/site-config'

export const metadata = {
  title: 'お問い合わせ | デュエマ掲示板',
  description: 'デュエマ掲示板へのお問い合わせ・削除依頼・不具合報告はこちらから。',
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: 'お問い合わせ | デュエマ掲示板',
    description: 'デュエマ掲示板へのお問い合わせ・削除依頼・不具合報告はこちらから。',
    url: `${SITE_URL}/contact`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: 'お問い合わせ | デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: 'お問い合わせ | デュエマ掲示板',
    description: 'デュエマ掲示板へのお問い合わせ・削除依頼・不具合報告はこちらから。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}

export default function ContactPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      {/* SEO: BreadcrumbList + ContactPage 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "TOP", "item": SITE_URL },
                { "@type": "ListItem", "position": 2, "name": "お問い合わせ", "item": `${SITE_URL}/contact` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "ContactPage",
              "@id": `${SITE_URL}/contact#contactpage`,
              "name": "お問い合わせ | デュエマ掲示板",
              "description": "デュエマ掲示板へのお問い合わせ・削除依頼・不具合報告はこちらから。",
              "url": `${SITE_URL}/contact`,
              "inLanguage": "ja",
              "isPartOf": { "@id": `${SITE_URL}/#website` },
              "publisher": { "@id": `${SITE_URL}/#organization` },
            },
          ]),
        }}
      />
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>お問い合わせ</span>
      </nav>

      <h1 className="sr-only">お問い合わせ | デュエマ掲示板</h1>
      <ContactForm />
      <SnsCtaCard />
    </div>
  )
}
