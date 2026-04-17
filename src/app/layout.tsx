import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Header } from '@/components/Header'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '【デュエマ掲示板】デュエルマスターズ専門掲示板',
  description: 'デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。',
  metadataBase: new URL('https://duema-bbs.vercel.app'),
  openGraph: {
    siteName: 'デュエマ掲示板',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased" style={{ background: 'var(--background)', color: 'var(--foreground)' }} suppressHydrationWarning>
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="bg-white border-t border-gray-200 py-3 mt-6">
            <div className="max-w-screen-xl mx-auto px-3 text-center text-xs text-gray-500">
              ©<Link href="/">デュエマ掲示板</Link> — デュエル・マスターズ専門掲示板
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
