# 🚀 NFC Profile Card - 開発指示書

## プロジェクト概要
**製品名**: NFC Profile Card  
**バージョン**: 1.0.0 (MVP)  
**開発期間**: 2週間  
**対象ユーザー**: エンジニア、クリエイター、フリーランス全般  

### ミッションステートメント
物理的なNFCカードとデジタルプロフィールを統合し、「タップするだけ」で豊かなプロフィール交換と名刺管理を実現する革新的なネットワーキングツールを構築する。

---

## 📋 技術スタック

### フロントエンド
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand（必要に応じて）
- **PWA対応**: next-pwa

### バックエンド
- **認証**: Clerk（GitHub/Google/Email対応）
- **BaaS**: Firebase
  - Firestore（データベース）
  - Cloud Functions（サーバーレス処理）
  - Cloud Storage（画像保存）
- **OCR API**: Google Gemini API 1.5 Flash
- **決済**: Stripe

### インフラ
- **Hosting**: Vercel
- **Domain**: お客様準備
- **SSL**: Vercel提供

---

## 🏗️ プロジェクト構造

```
nfc-profile-card/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 認証が必要なページ
│   │   │   ├── dashboard/      # 管理ダッシュボード
│   │   │   ├── edit/           # プロフィール編集
│   │   │   └── contacts/       # 連絡先管理
│   │   ├── (public)/           # 公開ページ
│   │   │   ├── p/[username]/   # プロフィールページ
│   │   │   └── landing/        # ランディングページ
│   │   ├── api/                # API Routes
│   │   │   ├── clerk/webhook/  # Clerk Webhook
│   │   │   ├── ocr/            # OCR処理
│   │   │   ├── vcard/          # VCard生成
│   │   │   └── webhook/        # Stripe Webhook
│   │   └── layout.tsx          # ルートレイアウト
│   ├── components/             # UIコンポーネント
│   │   ├── profile/            # プロフィール関連
│   │   ├── dashboard/          # ダッシュボード関連
│   │   └── common/             # 共通コンポーネント
│   ├── lib/                    # ユーティリティ
│   │   ├── firebase/           # Firebase設定
│   │   ├── stripe/             # Stripe設定
│   │   └── utils/              # 汎用ユーティリティ
│   └── types/                  # TypeScript型定義
├── public/                     # 静的ファイル
├── firebase/                   # Firebase設定
│   ├── firestore.rules         # Firestoreルール
│   └── functions/              # Cloud Functions
└── tests/                      # テスト
```

---

## 💾 データベース設計（Firestore）

### コレクション構造

```typescript
// users コレクション
interface User {
  uid: string;                    // Clerk User ID
  username: string;                // ユニークなユーザー名
  email: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // プロフィール情報
  profile: {
    name: string;
    company?: string;
    title?: string;
    bio?: string;
    avatarUrl?: string;
    
    // リンク（最大10個）
    links: Array<{
      url: string;
      label?: string;              // カスタムラベル
      service?: string;             // 自動認識されたサービス名
      icon?: string;                // アイコン識別子
      order: number;                // 表示順
    }>;
  };
  
  // NFCカード情報
  cards: Array<{
    cardId: string;                // カードのユニークID
    isActive: boolean;
    createdAt: Timestamp;
    lastUsed?: Timestamp;
  }>;
  
  // サブスクリプション情報
  subscription: {
    plan: 'free' | 'premium';
    expiresAt?: Timestamp;
  };
  
  // セキュリティ
  security: {
    oneTimeToken?: string;          // ワンタイムURL用
    tokenExpiresAt?: Timestamp;
  };
}

// contacts コレクション (users/{uid}/contacts)
interface Contact {
  id: string;
  scannedAt: Timestamp;
  location?: string;               // 出会った場所
  event?: string;                  // イベント名
  notes?: string;                  // プライベートメモ
  
  // 相手の情報（スナップショット）
  contactInfo: {
    name: string;
    company?: string;
    title?: string;
    email?: string;
    phone?: string;
    profileUrl?: string;
  };
  
  // VCard形式データ
  vCardData?: string;
}

// analytics コレクション (users/{uid}/analytics)
interface Analytics {
  date: string;                    // YYYY-MM-DD
  views: number;
  uniqueVisitors: number;
  linkClicks: Map<string, number>;
  cardTaps: number;
}
```

---

## 🎯 Phase 1: MVP機能実装（Week 1）

### 1. 初期設定とセットアップ
- [ ] Next.jsプロジェクトの初期化
- [ ] Clerk設定
- [ ] Firebase設定
- [ ] Tailwind CSS + shadcn/ui設定
- [ ] 環境変数の設定

### 2. 認証システム（Clerk）
- [ ] Clerkダッシュボード設定
- [ ] GitHub/Google OAuth有効化
- [ ] Webhook設定（Firestore同期）
- [ ] 認証ミドルウェア

### 3. プロフィールページ（最重要）
- [ ] 動的ルーティング `/p/[username]`
- [ ] レスポンシブデザイン（モバイルファースト）
- [ ] URL自動認識とアイコン表示
- [ ] VCardダウンロード機能
- [ ] ワンタイムURL対応（セキュリティ）

#### サポートするサービスアイコン（30種類以上）
```typescript
const SUPPORTED_SERVICES = {
  // SNS
  'twitter.com': { icon: 'FaTwitter', color: '#1DA1F2' },
  'x.com': { icon: 'FaXTwitter', color: '#000000' },
  'instagram.com': { icon: 'FaInstagram', color: '#E4405F' },
  'facebook.com': { icon: 'FaFacebook', color: '#1877F2' },
  'linkedin.com': { icon: 'FaLinkedin', color: '#0077B5' },
  'tiktok.com': { icon: 'FaTiktok', color: '#000000' },
  'youtube.com': { icon: 'FaYoutube', color: '#FF0000' },
  
  // 開発者向け
  'github.com': { icon: 'FaGithub', color: '#333333' },
  'gitlab.com': { icon: 'FaGitlab', color: '#FC6D26' },
  'bitbucket.org': { icon: 'FaBitbucket', color: '#0052CC' },
  'stackoverflow.com': { icon: 'FaStackOverflow', color: '#F58025' },
  
  // 日本のサービス
  'zenn.dev': { icon: 'SiZenn', color: '#3EA8FF' },
  'qiita.com': { icon: 'SiQiita', color: '#55C500' },
  'note.com': { icon: 'SiNote', color: '#41C9B4' },
  'connpass.com': { icon: 'Calendar', color: '#E53935' },
  
  // クリエイター向け
  'behance.net': { icon: 'FaBehance', color: '#1769FF' },
  'dribbble.com': { icon: 'FaDribbble', color: '#EA4C89' },
  'pinterest.com': { icon: 'FaPinterest', color: '#E60023' },
  'deviantart.com': { icon: 'FaDeviantart', color: '#05CC47' },
  
  // その他
  'medium.com': { icon: 'FaMedium', color: '#000000' },
  'reddit.com': { icon: 'FaReddit', color: '#FF4500' },
  'discord.com': { icon: 'FaDiscord', color: '#5865F2' },
  'slack.com': { icon: 'FaSlack', color: '#4A154B' },
  'twitch.tv': { icon: 'FaTwitch', color: '#9146FF' },
  
  // デフォルト
  'default': { icon: 'FaLink', color: '#718096' }
};
```

### 4. 管理ダッシュボード
- [ ] プロフィール編集機能
- [ ] リンク管理（追加/編集/削除/並び替え）
- [ ] NFCカード管理
- [ ] 基本的なアナリティクス表示

---

## 🔒 Phase 2: セキュリティと拡張機能（Week 2）

### 5. セキュリティ強化
- [ ] HTTPS強制
- [ ] ワンタイムURL実装
- [ ] レート制限
- [ ] アクセスログ記録
- [ ] データエクスポート機能（CSV/JSON）

### 6. 名刺OCR機能
- [ ] カメラ撮影UI
- [ ] Gemini API統合
- [ ] VCard変換
- [ ] 即時データ削除
- [ ] 連絡先アプリへの保存

### 7. 決済システム
- [ ] Stripe統合
- [ ] NFCカード購入フロー
- [ ] 注文管理
- [ ] 領収書発行

### 8. PWA対応
- [ ] Service Worker設定
- [ ] オフライン対応
- [ ] インストール促進UI
- [ ] プッシュ通知準備

---

## 🚦 品質基準とテスト

### パフォーマンス目標
- **初回読み込み**: < 2秒
- **ページ遷移**: < 500ms
- **Lighthouse Score**: > 90

### 対応環境
- **ブラウザ**: Chrome, Safari, Firefox, Edge（最新2バージョン）
- **デバイス**: iPhone 12以降, Android 10以降
- **画面サイズ**: 320px〜

### テスト項目
- [ ] ユニットテスト（主要関数）
- [ ] E2Eテスト（主要フロー）
- [ ] セキュリティテスト
- [ ] 負荷テスト

---

## 🎨 UI/UXガイドライン

### デザイン原則
1. **シンプル**: 情報過多を避ける
2. **高速**: 即座に反応する
3. **直感的**: 説明不要な操作
4. **信頼性**: エラーを適切に処理

### カラーパレット
```css
:root {
  --primary: #3B82F6;      /* Blue-500 */
  --secondary: #10B981;    /* Emerald-500 */
  --accent: #F59E0B;       /* Amber-500 */
  --danger: #EF4444;       /* Red-500 */
  --background: #FFFFFF;
  --foreground: #111827;   /* Gray-900 */
}
```

---

## 📝 開発ルール

### コーディング規約
- **TypeScript**: strictモード有効
- **ESLint**: Next.js推奨設定
- **Prettier**: 自動フォーマット
- **コミット**: Conventional Commits

### Gitブランチ戦略
```
main
├── develop
│   ├── feature/auth
│   ├── feature/profile
│   └── feature/ocr
└── hotfix/xxx
```

### 環境変数
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
CLERK_WEBHOOK_SECRET=

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Private
FIREBASE_ADMIN_PRIVATE_KEY=
GEMINI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 🚀 開始手順

1. **リポジトリのクローン**
```bash
git clone [repository-url]
cd nfc-profile-card
```

2. **依存関係のインストール**
```bash
npm install
```

3. **環境変数の設定**
```bash
cp .env.example .env.local
# 必要な値を設定
```

4. **開発サーバーの起動**
```bash
npm run dev
```

5. **Firebase初期化**
```bash
firebase init
firebase deploy --only firestore:rules
```

---

## 📅 マイルストーン

### Week 1 (〜Day 7)
- [ ] Day 1-2: 環境構築、Clerk認証システム
- [ ] Day 3-4: プロフィールページ完成
- [ ] Day 5-6: ダッシュボード基本機能
- [ ] Day 7: 中間レビュー、調整

### Week 2 (Day 8-14)
- [ ] Day 8-9: セキュリティ実装
- [ ] Day 10-11: OCR機能
- [ ] Day 12: 決済システム
- [ ] Day 13: テスト、バグ修正
- [ ] Day 14: 最終調整、デプロイ準備

---

## 🆘 サポート

### 質問・相談先
- **技術的な質問**: 開発チームSlackチャンネル
- **仕様の確認**: PdM（私）に直接連絡
- **緊急時**: 電話連絡

### 参考資料
- [Next.js Documentation](https://nextjs.org/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## ✅ 完了条件

MVPは以下の条件を満たした時点で完了とする：

1. ユーザーがサインアップし、プロフィールを作成できる
2. NFCカードタップでプロフィールページが表示される
3. 訪問者がVCard形式で連絡先を保存できる
4. 名刺をOCRでスキャンし、連絡先を保存できる
5. すべての主要ブラウザ・デバイスで動作する
6. セキュリティ要件を満たしている

---

**開発開始日**: 2025年1月__日
**MVP完成予定日**: 2025年1月__日

頑張りましょう！🚀
