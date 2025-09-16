# NFC Profile Card 🪪

物理的なNFCカードとデジタルプロフィールを統合した、次世代のネットワーキングツール。

## ✨ 特徴

- 🎯 **ワンタップでプロフィール共有** - NFCカードをスマホにタップするだけ
- 🔗 **リンク集約** - 複数のSNS・ポートフォリオリンクを一元管理
- 📱 **Litlink風プロフィールページ** - `/p/[username]`で個人ページを公開
- 🔒 **セキュリティ重視** - Firebase Authentication による安全な認証
- 📱 **完全レスポンシブ** - スマホ・タブレット・PCすべてに対応
- 🎨 **shadcn/ui** - モダンで美しいUIコンポーネント

## 🚀 現在実装済みの機能

### 🔐 認証システム
- ✅ Email/Password認証
- ✅ Google OAuth認証
- ✅ 自動ログイン状態管理
- ✅ セキュアなログアウト

### 📊 ダッシュボード
- ✅ ユーザー情報表示
- ✅ プロフィール編集へのナビゲーション
- ✅ 公開プロフィールページへのリンク
- ✅ ログアウト機能

### ✏️ プロフィール管理
- ✅ 基本情報の編集（名前、会社、役職、自己紹介）
- ✅ 連絡先情報の管理（メール、電話、ウェブサイト、住所）
- ✅ ソーシャルリンクの追加・編集・削除
- ✅ ユーザー名の設定

### 🌐 公開プロフィールページ
- ✅ `/p/[username]`でアクセス可能
- ✅ Litlink風のデザイン
- ✅ プロフィール情報の表示
- ✅ ソーシャルリンク一覧
- ✅ VCardダウンロード機能

## 🔮 今後実装予定の機能

- 📸 **名刺OCR機能** - カメラで撮影するだけで連絡先を自動保存
- 🏷️ **NFCカード管理** - 物理カードの登録・管理
- 📊 **アナリティクス** - プロフィール閲覧数やリンククリック数
- 💳 **決済機能** - NFCカード購入（Stripe連携）

## 🚀 クイックスタート

### 必要な環境
- Node.js 18.0以上
- npm または yarn
- Firebaseアカウント

### セットアップ

1. **リポジトリのクローン**
```bash
git clone https://github.com/your-username/nfc-profile-card.git
cd nfc-profile-card
```

2. **依存関係のインストール**
```bash
npm install
```

3. **環境変数の設定**
```bash
cp .env.example .env.local
# .env.localファイルを編集して必要な値を設定
```

4. **Firebaseプロジェクトの設定**
- Firebaseコンソールでプロジェクト作成
- Authentication（Email/Password, Google）を有効化
- Firestore Databaseを有効化
- 設定値を.env.localに追加

詳細な設定手順は [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) を参照してください。

5. **開発サーバーの起動**
```bash
npm run dev
```

http://localhost:3000 でアプリケーションが起動します。

## 📂 プロジェクト構造

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # ダッシュボード関連ページ
│   ├── p/[username]/      # 公開プロフィールページ
│   ├── signin/            # サインインページ
│   └── api/               # API ルート
├── components/            # Reactコンポーネント
│   └── ui/               # shadcn/ui コンポーネント
├── contexts/             # React Context (認証など)
├── lib/                  # ユーティリティ関数
└── types/                # TypeScript型定義
```

## 🛠️ 技術スタック

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Authentication**: Firebase Authentication
- **Backend**: Firebase (Firestore, Functions, Storage)
- **State Management**: React Context API
- **Form Handling**: React Hook Form
- **Hosting**: Vercel

## 📝 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プロダクション起動
npm run start

# 型チェック
npm run type-check

# リント
npm run lint

# フォーマット
npm run format
```

## 🧪 テスト

テスト用のアカウントが用意されています：

- **Email**: test@example.com
- **Password**: test123456
- **公開プロフィール**: http://localhost:3000/p/testuser

## 🌐 URL構成

- **ホーム**: `/`
- **サインイン**: `/signin`
- **ダッシュボード**: `/dashboard`
- **プロフィール編集**: `/dashboard/edit`
- **公開プロフィール**: `/p/[username]`

## 🤝 コントリビューション

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 ライセンス

MIT License

## 📞 サポート

- バグ報告: GitHub Issues
- 技術的な質問: GitHub Discussions

---

Made with ❤️ by Cor.Inc