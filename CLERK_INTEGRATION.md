# Clerk + Firebase 統合アーキテクチャ

## 概要
認証にClerkを使用し、データ管理にFirestoreを使用するハイブリッドアーキテクチャです。

## なぜClerkを選ぶのか？

### 開発工数削減（約1週間→2日）
- 認証UI不要（Clerk提供のコンポーネント使用）
- パスワードリセット、メール確認など全て組み込み済み
- ユーザー管理画面も提供

### エンジニアに最適な認証
- GitHub/Google認証が数分で実装可能
- セキュリティが堅牢（SOC 2 Type II認証済み）
- Webhookで柔軟な連携

## アーキテクチャ

```
[ユーザー] 
    ↓
[Clerk認証]
    ↓ Webhook
[Cloud Functions] ← ユーザー作成/更新を検知
    ↓
[Firestore] ← ユーザープロフィール保存
    ↓
[アプリケーション]
```

## 実装手順

### 1. Clerk設定

```bash
npm install @clerk/nextjs svix
```

### 2. 環境変数追加（.env.local）

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Clerk Webhook Secret (Firestore同期用)
CLERK_WEBHOOK_SECRET=whsec_xxx
```

### 3. Clerkプロバイダー設定（app/layout.tsx）

```tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="ja">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

### 4. Webhook実装（app/api/clerk/webhook/route.ts）

```typescript
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/lib/firebase/admin'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET')
  }

  // Get the headers
  const headerPayload = headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400
    })
  }

  // Handle the webhook
  const eventType = evt.type

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, username, first_name, last_name, image_url } = evt.data

    // Firestoreにユーザー情報を保存/更新
    await db.collection('users').doc(id).set({
      uid: id,
      email: email_addresses[0]?.email_address,
      username: username || email_addresses[0]?.email_address?.split('@')[0],
      profile: {
        name: `${first_name || ''} ${last_name || ''}`.trim(),
        avatarUrl: image_url,
        links: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      subscription: {
        plan: 'free'
      }
    }, { merge: true })
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data
    // ユーザーデータを削除または無効化
    await db.collection('users').doc(id).update({
      deleted: true,
      deletedAt: new Date()
    })
  }

  return new Response('', { status: 200 })
}
```

### 5. 認証ガード実装（middleware.ts）

```typescript
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/p/(.*)",  // プロフィールページは公開
    "/api/webhook/clerk",  // Webhook受信用
    "/sign-in",
    "/sign-up",
  ],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### 6. Firestoreセキュリティルール更新

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ClerkのユーザーIDとFirestoreのドキュメントIDが一致するかチェック
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    // Clerkトークンの検証（カスタムクレーム使用）
    function hasValidClerkToken() {
      return request.auth != null && 
             request.auth.token.clerk != null;
    }
    
    match /users/{userId} {
      // プロフィールは公開
      allow read: if true;
      
      // Webhook経由の更新のみ許可（通常のユーザーは直接更新不可）
      allow write: if false;
      
      // プロフィール編集はCloud Functions経由
      match /contacts/{contactId} {
        allow read, write: if hasValidClerkToken() && 
                              request.auth.uid == userId;
      }
    }
  }
}
```

## 実装の流れ

### Phase 1: 基本認証（Day 1）
1. Clerkダッシュボードでアプリケーション作成
2. GitHub/Google OAuth設定
3. Next.jsにClerk統合
4. サインイン/アップページ実装

### Phase 2: Firestore同期（Day 2）
1. Webhook設定
2. Cloud Functionsでユーザー同期
3. Firestoreルール設定
4. プロフィール編集機能

## メリット

### 開発速度
- **Before（Firebase Auth）**: 認証UI実装に3-4日
- **After（Clerk）**: 30分で完全な認証システム

### 運用
- ユーザー管理画面で即座に対応可能
- セッション管理自動
- 不正アクセス検知機能付き

### UX
- Magic Link認証対応
- ソーシャルログインスムーズ
- プロフィール画像自動取得

## 料金

### Clerk料金（月額）
- **Free**: 5,000 MAU（月間アクティブユーザー）まで無料
- **Pro**: $25/月 + $0.02/MAU（5,000以上）

MVP段階では無料枠で十分運用可能です。

## 注意事項

1. **Webhookセキュリティ**: 必ずWebhook Secretを検証
2. **データ同期**: Clerkがマスター、Firestoreはレプリカとして扱う
3. **セッション管理**: Clerkのセッションを信頼、Firebaseトークンは使用しない

## まとめ

Clerkを採用することで：
- ✅ 開発期間を1週間短縮
- ✅ セキュアな認証を即座に実装
- ✅ 運用負荷を大幅削減

Firebaseとの併用で：
- ✅ 柔軟なデータ管理
- ✅ リアルタイム同期
- ✅ 低コスト運用

この構成が最適です！
