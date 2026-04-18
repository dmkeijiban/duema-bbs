import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Header } from '@/components/Header'
import Link from 'next/link'

const GA_ID = 'G-HDGDNYNMH4'

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
  verification: {
    google: '9MIQlFQWKdN5q04YxDYV3u5kj4uoiuNLA2DrjMCBuJU',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* Google Analytics (GA4) — lazyOnload でTBTへの影響を排除 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="lazyOnload"
        />
        <Script id="ga4-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>

        {/* Microsoft Clarity */}
        <Script id="clarity-init" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "wd3kzmwhnm");
          `}
        </Script>
      </head>
      <body className="min-h-screen flex flex-col antialiased" style={{ background: 'var(--background)', color: 'var(--foreground)' }} suppressHydrationWarning>
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="bg-white border-t border-gray-200 py-3 mt-6">
            <div className="max-w-screen-xl mx-auto px-3 text-center text-xs text-gray-600">
              ©<Link href="/">デュエマ掲示板</Link> — デュエル・マスターズ専門掲示板
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
