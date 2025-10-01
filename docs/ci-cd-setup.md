# CI/CD Setup Guide

## Current Setup (2025-01)

このプロジェクトはシンプルなCI/CDパイプラインを採用しています。

### ✅ アクティブなCI/CDプロセス

#### 1. GitHub Actions CI (`ci.yml`)

- **Lint & Type Check**: コード品質の基本チェック
  - ESLint (警告は許可)
  - TypeScript型チェック
  - Prettierフォーマットチェック (警告は許可)
- **Build Check**: ビルドが成功することを確認

#### 2. Vercel自動デプロイ

- **本番環境**: `main`ブランチへのプッシュで自動デプロイ
- **プレビュー環境**: PRで自動的にプレビューURLを生成
- **設定**: Vercelダッシュボードで設定済み

### 🚫 無効化されたテスト

以下のテストは現在メンテナンスされていないため無効化されています：

1. **Jestユニットテスト**
   - 多くのテストが古い実装に基づいている
   - 必要に応じて将来的に再有効化

2. **Playwright E2Eテスト**
   - webServer設定の問題
   - 認証フローのテストが複雑

3. **Lighthouseパフォーマンステスト**
   - Vercelのプレビューで十分

4. **GitHub Actions Deploy**
   - Vercelの自動デプロイで置き換え

### 🔧 テストの実行方法（ローカル）

```bash
# リントとタイプチェック
npm run lint
npm run type-check

# フォーマット
npm run format

# ビルドテスト
npm run build
```

### 📝 今後の改善点

1. **Jestテストの修正と再有効化**
   - Firebase Authのモック改善
   - 古いテストの更新

2. **E2Eテストの簡素化**
   - 重要なユーザーフローのみをテスト
   - 認証不要なテストから開始

3. **段階的な品質向上**
   - まず基本的なテストを安定化
   - 徐々にカバレッジを拡大

### 🚀 デプロイプロセス

1. **開発**

   ```bash
   git checkout -b feature/your-feature
   # 開発作業
   git push origin feature/your-feature
   # PRを作成 → Vercelプレビューが自動生成
   ```

2. **本番リリース**
   ```bash
   # PRがマージされると自動的に本番デプロイ
   ```

### ⚙️ 環境変数

Vercelダッシュボードで以下の環境変数を設定：

- `NEXT_PUBLIC_FIREBASE_*`: Firebase設定
- `FIREBASE_SERVICE_ACCOUNT`: サーバーサイド認証用
- `NEXT_PUBLIC_APP_URL`: アプリケーションURL
- `GEMINI_API_KEY`: Google Gemini API

### 📚 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
