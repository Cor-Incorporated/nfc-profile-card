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
- `NFC_GEMINI_API_KEY`: 名刺OCR用のGoogle Gemini APIキー（サーバー側のみ）
- `GEMINI_API_KEY`: 既存環境向けの互換名。`NFC_GEMINI_API_KEY` が定義されている場合は使用しない
- `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`: OCRモデル名（未設定ならコードの既定値）

Vercelの環境変数変更は既存のデプロイへ遡及しない。キーを変更した場合は対象環境へ設定し、
[新しいデプロイを作成する](https://vercel.com/docs/environment-variables)。
現行実装の名刺OCRはVercel上のNext.js API RouteからGeminiを呼び出すため、
GCP Secret ManagerやCloudflareの環境変数を直接参照しない。
既定の`gemini-3.5-flash-lite`は[Google公式モデル仕様](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)にある画像入力対応モデル。
環境変数の値やその一部をログ・PR本文・検証結果へ出力しない。

### 📚 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
