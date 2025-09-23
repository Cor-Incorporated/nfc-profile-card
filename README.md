# TapForge 🪪

物理的なNFCカードとデジタルプロフィールを統合した、次世代のネットワーキングツール。

## ✨ 特徴

- 🎯 **ワンタップでプロフィール共有** - NFCカードをスマホにタップするだけ
- 🔗 **リンク集約** - 複数のSNS・ポートフォリオリンクを一元管理
- 📱 **Litlink風プロフィールページ** - `/p/[username]`で個人ページを公開
- 🔒 **セキュリティ重視** - Firebase Authentication による安全な認証
- 📱 **完全レスポンシブ** - スマホ・タブレット・PCすべてに対応
- 🎨 **shadcn/ui** - モダンで美しいUIコンポーネント

## 🚀 現在実装済みの機能

### 🔐 認証システム（Firebase Authentication）

- ✅ Email/Password認証
- ✅ Google OAuth認証（ポップアップ/リダイレクト対応）
- ✅ メールアドレス確認機能
- ✅ パスワードリセット機能
- ✅ 認証の永続性（ブラウザを閉じても維持）
- ✅ 自動ログイン状態管理
- ✅ セキュアなログアウト
- ✅ エラーメッセージの日本語化

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
- ✅ **ビジュアルエディター** - ドラッグ&ドロップでページをカスタマイズ
- ✅ **背景カスタマイズ** - 色・グラデーション・画像・パターンの設定
- ✅ **画像アップロード** - Firebase Storage連携による画像管理
- ✅ **コンポーネント編集** - テキスト、画像、リンクボタン、登録情報の追加・編集・削除
- ✅ **VCardダウンロード** - iPhone対応のVCard生成（VERSION:3.0準拠）
- ✅ **モバイルファーストUI** - スマホ中心のエディターデザイン
- ✅ **キャンバス内コンポーネント追加** - 編集エリア内でのドラッグ&ドロップ操作
- ✅ **データ永続化** - 編集内容の自動保存と復元機能
- ✅ **読み取り専用レンダラー** - 公開ページでのCraft.jsコンテンツ表示

### 🌐 公開プロフィールページ

- ✅ `/p/[username]`でアクセス可能
- ✅ Litlink風のデザイン
- ✅ プロフィール情報の表示
- ✅ ソーシャルリンク一覧
- ✅ VCardダウンロード機能
- ✅ **QRコード生成** - プロフィールURLのQRコードを生成・ダウンロード
- ✅ **Craft.jsコンテンツ表示** - エディターで作成したカスタムレイアウトの表示
- ✅ **フォールバック機能** - 従来の静的テンプレートとの互換性

## 🔮 今後実装予定の機能

- 📸 **名刺OCR機能** - カメラで撮影するだけで連絡先を自動保存
  - ⚠️ アプリ内カメラ方式で実装予定（特許リスク回避のため）
- 🏷️ **NFCカード管理** - 物理カードの登録・管理
  - ⚠️ 静的URL方式で実装予定（動的データ連携は特許リスクあり）
- 📊 **アナリティクス** - プロフィール閲覧数やリンククリック数
- 💳 **決済機能** - NFCカード購入（Stripe連携）

## ⚖️ 特許リスク管理

本プロジェクトは日本国内の特許リスクを慎重に評価し、安全な開発を行っています。

### 📋 関連ドキュメント

- [特許リスク評価レポート](./特許リスク評価レポート_TapForge_20250921.md) - 詳細な特許リスク分析
- [特許リスク回避開発ガイドライン](./特許リスク回避開発ガイドライン.md) - 開発者向け実装指針
- [特許リスクアクションプラン](./特許リスク_アクションプラン.md) - 対策と期限

### 🚨 実装を避けるべき機能

- ❌ NFCカードとクラウドの動的データ連携
- ❌ カメラロールの自動監視によるOCR
- ❌ メール転送による自動データ取り込み
- ❌ 企業向けB2B機能（Sansan社の市場領域）

詳細は[CLAUDE.md](./CLAUDE.md#patent-risk-information-updated-sep-21-2025)の特許リスク情報セクションを参照してください。

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
- Storage（us-central1）を有効化
- 設定値を.env.localに追加

詳細な設定手順は以下のドキュメントを参照：

- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) - Firebase初期設定
- [FIREBASE_AUTH_SETUP.md](./FIREBASE_AUTH_SETUP.md) - 認証設定ガイド
- [FIREBASE_AUTH_BEST_PRACTICES.md](./FIREBASE_AUTH_BEST_PRACTICES.md) - 認証実装のベストプラクティス
- [FIREBASE_STORAGE_SETUP.md](./FIREBASE_STORAGE_SETUP.md) - Storage設定ガイド

5. **Firebase Storage CORS設定（重要）**

```bash
# CORS設定を適用（画像アップロードに必要）
./setup-cors.sh
```

6. **開発サーバーの起動**

```bash
npm run dev
```

http://localhost:3000 でアプリケーションが起動します。

## 📂 プロジェクト構造

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # ダッシュボード関連ページ
│   │   └── edit/         # プロフィール編集
│   │       └── design/   # デザインエディター
│   ├── p/[username]/      # 公開プロフィールページ
│   ├── signin/            # サインインページ
│   └── api/               # API ルート
├── components/            # Reactコンポーネント
│   ├── ui/               # shadcn/ui コンポーネント
│   ├── editor/           # エディター関連コンポーネント
│   └── profile/          # プロフィール関連コンポーネント
├── contexts/             # React Context (認証など)
├── lib/                  # ユーティリティ関数
├── styles/               # グローバルスタイル、テーマ
└── types/                # TypeScript型定義
```

## 🛠️ 技術スタック

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui, vanilla-extract
- **Authentication**: Firebase Authentication
- **Backend**: Firebase (Firestore, Functions, Storage)
- **State Management**: React Context API
- **Form Handling**: React Hook Form
- **Editor**: Craft.js (ドラッグ&ドロップエディター)
- **DnD**: @dnd-kit (ドラッグ&ドロップライブラリ)
- **QRCode**: qr-code-styling (QRコード生成)
- **Color Picker**: react-colorful
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
