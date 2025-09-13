import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const { userId } = await auth()
  
  if (userId) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            NFC Profile Card
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            物理的なNFCカードとデジタルプロフィールを統合した
            <br />
            次世代のネットワーキングツール
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link
              href="/sign-up"
              className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              無料で始める
            </Link>
            <Link
              href="/sign-in"
              className="px-8 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors"
            >
              ログイン
            </Link>
          </div>
        </div>
        
        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">ワンタップ共有</h3>
            <p className="text-gray-600">
              NFCカードをスマホにタップするだけで、瞬時にプロフィールを共有
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold mb-2">リンク集約</h3>
            <p className="text-gray-600">
              最大10個のSNS・ポートフォリオリンクを一元管理
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-xl font-semibold mb-2">名刺OCR</h3>
            <p className="text-gray-600">
              カメラで撮影するだけで連絡先を自動保存
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}