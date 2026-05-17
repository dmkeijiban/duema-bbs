import Link from 'next/link'
import { ContactForm } from './ContactForm'
import { SnsCtaCard } from '@/components/SnsCtaCard'

export default function ContactPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>お問い合わせ</span>
      </nav>

      <ContactForm />
      <SnsCtaCard />
    </div>
  )
}
