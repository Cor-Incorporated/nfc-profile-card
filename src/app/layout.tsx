import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import './globals.css'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NFC Profile Card | デジタル名刺ソリューション',
  description: '物理的なNFCカードとデジタルプロフィールを統合した、次世代のネットワーキングツール',
  keywords: 'NFC, デジタル名刺, プロフィール, ネットワーキング',
  openGraph: {
    title: 'NFC Profile Card',
    description: 'タップするだけでプロフィールを共有',
    type: 'website',
    locale: 'ja_JP',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="ja">
        <body className={inter.className}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}