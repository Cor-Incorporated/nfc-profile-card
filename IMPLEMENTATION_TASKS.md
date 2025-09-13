# 🚀 開発チーム実装指示書

**日付**: 2025年1月  
**プロジェクト**: NFC Profile Card  
**ステータス**: 環境構築完了・実装開始可能

---

## ✅ 準備完了項目

以下はすでに設定済みです：

### 環境変数（.env.local）
- ✅ Clerk認証キー設定済み
- ✅ Gemini API キー設定済み  
- ✅ Stripe決済キー設定済み
- ✅ Firebase Admin SDK配置済み（`nfc-profile-card-firebase-adminsdk-fbsvc-832eaa1a80.json`）

### インフラ
- ✅ Firebaseプロジェクト作成済み（ID: `nfc-profile-card`）
- ✅ プロジェクトフォルダ構築済み

---

## 🎯 実装タスク割り当て

### 【最優先】フロントエンド担当：田中さん

#### Day 1-2: 基礎構築とClerk認証
```bash
cd /Users/teradakousuke/Developer/nfc-profile-card
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
npm install @clerk/nextjs svix firebase firebase-admin @stripe/stripe-js stripe @google/generative-ai react-icons zustand axios date-fns react-hook-form zod @hookform/resolvers sonner vcard-creator qrcode react-webcam
```

**実装タスク：**
1. `src/app/layout.tsx`にClerkProvider実装
```tsx
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="ja">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

2. `middleware.ts`作成（ルート直下）
```tsx
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/p/(.*)",  // プロフィールページは公開
    "/api/clerk/webhook",
    "/sign-in",
    "/sign-up",
  ],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

3. サインイン/アップページ作成
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/sign-up/[[...sign-up]]/page.tsx`

#### Day 3-4: プロフィールページ（最重要）

**ファイルパス**: `src/app/(public)/p/[username]/page.tsx`

```tsx
// 基本構造の実装
export default async function ProfilePage({ 
  params 
}: { 
  params: { username: string } 
}) {
  // Firestoreからユーザー情報取得
  // プロフィール表示
  // VCardダウンロード機能
}
```

**必須機能：**
- 30種類以上のSNSアイコン自動認識
- モバイルファーストのレスポンシブデザイン
- VCard生成・ダウンロード
- ワンタイムURL対応

---

### 【優先度高】バックエンド担当：佐藤さん

#### Day 1: Firebase Admin SDK設定

1. `src/lib/firebase/admin.ts`作成
```typescript
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = require('../../../nfc-profile-card-firebase-adminsdk-fbsvc-832eaa1a80.json');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: 'nfc-profile-card',
  });
}

export const adminDb = getFirestore();
```

2. `src/lib/firebase/client.ts`作成
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "nfc-profile-card.firebaseapp.com",
  projectId: "nfc-profile-card",
  storageBucket: "nfc-profile-card.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

#### Day 2: Clerk Webhook実装

**ファイルパス**: `src/app/api/clerk/webhook/route.ts`

```typescript
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(req: Request) {
  // CLERK_INTEGRATION.mdのコードを実装
  // ユーザー作成/更新時にFirestoreに同期
}
```

**Clerkダッシュボードでの設定：**
1. Webhooks追加
2. エンドポイント: `https://[your-domain]/api/clerk/webhook`
3. イベント選択: `user.created`, `user.updated`, `user.deleted`

#### Day 3-4: OCR API実装

**ファイルパス**: `src/app/api/ocr/route.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  const { image } = await req.json();
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `この名刺画像から以下の情報を抽出してJSON形式で返してください：
  - name（名前）
  - company（会社名）
  - title（役職）
  - email（メールアドレス）
  - phone（電話番号）
  - address（住所）`;
  
  const result = await model.generateContent([prompt, image]);
  const response = await result.response;
  
  // VCard形式に変換
  // 即座にレスポンスを返す（データは保存しない）
  
  return NextResponse.json({ vcard: vCardData });
}
```

---

### 【通常優先度】UI/UX担当：鈴木さん

#### Day 2-3: コンポーネント作成

1. **プロフィールコンポーネント**
   - `src/components/profile/ProfileCard.tsx`
   - `src/components/profile/LinkGrid.tsx`
   - `src/components/profile/VCardButton.tsx`

2. **ダッシュボードコンポーネント**
   - `src/components/dashboard/ProfileEditor.tsx`
   - `src/components/dashboard/LinkManager.tsx`
   - `src/components/dashboard/Analytics.tsx`

3. **共通コンポーネント**
   - `src/components/common/ServiceIcon.tsx` (30種類のアイコン対応)

```tsx
// ServiceIcon.tsx の実装例
import { 
  FaTwitter, FaGithub, FaLinkedin, FaInstagram,
  FaYoutube, FaTiktok, FaFacebook, FaDiscord
} from 'react-icons/fa';

const SERVICE_ICONS = {
  'twitter.com': FaTwitter,
  'x.com': FaTwitter,
  'github.com': FaGithub,
  'linkedin.com': FaLinkedin,
  // ... 30種類以上
};

export function getServiceIcon(url: string) {
  const domain = new URL(url).hostname;
  return SERVICE_ICONS[domain] || FaLink;
}
```

---

## 📋 本日のタスク（即座に開始）

### 全員共通
1. プロジェクトフォルダで`npm install`実行
2. `npm run dev`で開発サーバー起動
3. http://localhost:3000 で動作確認

### 各担当者
- **田中さん**: Clerk認証の実装開始
- **佐藤さん**: Firebase Admin SDK設定
- **鈴木さん**: アイコンコンポーネント作成

---

## 🔥 重要な注意事項

### データフロー
```
[Clerk認証] → [Webhook] → [Firestore] → [アプリ]
```
- Clerkがマスターデータ
- Firestoreは同期されたレプリカ
- ユーザーの直接更新は不可（Webhook経由のみ）

### セキュリティ
- プロフィールページは公開（認証不要）
- ダッシュボードは認証必須
- 名刺OCRデータは即削除（保存しない）

### パフォーマンス
- 初回読み込み2秒以内
- モバイルファースト設計
- Lighthouse Score 90以上

---

## 📞 連絡体制

### 質問・相談
- **技術的な質問**: Slackの#nfc-card-devチャンネル
- **仕様確認**: PdM（寺田）に直接連絡
- **緊急時**: 電話連絡

### 進捗報告
- 毎日17:00にSlackで進捗共有
- ブロッカーがあれば即座に報告

---

## 🎯 Day 1-2の完了条件

1. ✅ Clerk認証が動作する
2. ✅ ユーザーがサインアップできる
3. ✅ ClerkのユーザーがFirestoreに同期される
4. ✅ /p/[username]でプロフィールページが表示される

これらが完了したら、Phase 2に進みます。

---

**開発開始**: 即座に着手してください
**Day 1-2完了期限**: 48時間以内

頑張りましょう！💪
