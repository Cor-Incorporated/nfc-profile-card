# NFC Profile Card 🪪

物理的なNFCカードとデジタルプロフィールを統合した、次世代のネットワーキングツール。

## ✨ 特徴

- 🎯 **ワンタップでプロフィール共有** - NFCカードをスマホにタップするだけ
- 🔗 **リンク集約** - 最大10個のSNS・ポートフォリオリンクを一元管理
- 📸 **名刺OCR機能** - カメラで撮影するだけで連絡先を自動保存
- 🔒 **セキュリティ重視** - ワンタイムURL、データ暗号化対応
- 📱 **完全レスポンシブ** - スマホ・タブレット・PCすべてに対応

## 🚀 クイックスタート

### 必要な環境
- Node.js 18.0以上
- npm または yarn
- Clerkアカウント
- Firebaseアカウント
- Stripeアカウント（決済機能を使用する場合）

### セットアップ

1. **依存関係のインストール**
```bash
npm install
```

2. **環境変数の設定**
```bash
cp .env.example .env.local
# .env.localファイルを編集して必要な値を設定
```

3. **Clerkの設定**
- https://dashboard.clerk.com でアプリケーション作成
- GitHub/Google OAuth有効化
- APIキーを.env.localに設定

4. **Firebaseプロジェクトの設定**
- Firebaseコンソールでプロジェクト作成（プロジェクトID: nfc-profile-card）
- Firestore, Storageを有効化
- サービスアカウントキーを生成

5. **開発サーバーの起動**
```bash
npm run dev
```

http://localhost:3000 でアプリケーションが起動します。

## 📂 プロジェクト構造

```
src/
├── app/          # Next.js App Router
├── components/   # Reactコンポーネント
├── lib/          # ユーティリティ関数
└── types/        # TypeScript型定義
```

## 🛠️ 技術スタック

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Clerk
- **Backend**: Firebase (Firestore, Functions, Storage)
- **OCR**: Google Gemini API
- **Payment**: Stripe
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

## 🤝 コントリビューション

1. Forkする
2. Feature branchを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. Branchにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 📄 ライセンス

[ライセンスタイプを記載]

## 📞 サポート

- 技術的な質問: [開発チームSlack]
- バグ報告: [GitHubのIssues]
- その他: [メールアドレス]

---

Made with ❤️ by Cor.Inc
