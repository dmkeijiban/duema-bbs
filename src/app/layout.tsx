import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Header } from '@/components/Header'

export const metadata: Metadata = {
  title: 'デュエルBBS - デュエルマスターズ専門掲示板',
  description: 'デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased" style={{ background: 'var(--background)', color: 'var(--foreground)' }} suppressHydrationWarning>
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200" style={{ backgroundColor: '#fff' }}>
            © 2025 デュエルBBS — デュエルマスターズ専門掲示板
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
