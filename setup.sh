#!/bin/bash

# NFC Profile Card - 開発環境セットアップスクリプト
# このスクリプトを実行して開発環境をセットアップしてください

echo "🚀 NFC Profile Card 開発環境セットアップを開始します..."

# Next.jsプロジェクトの初期化
echo "📦 Next.jsプロジェクトを初期化中..."
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"

# 追加パッケージのインストール
echo "📚 追加パッケージをインストール中..."
npm install @clerk/nextjs svix firebase firebase-admin @stripe/stripe-js stripe @google/generative-ai
npm install react-icons zustand axios date-fns react-hook-form zod @hookform/resolvers
npm install sonner vcard-creator qrcode react-webcam
npm install -D @types/qrcode

# shadcn/uiのセットアップ
echo "🎨 shadcn/uiをセットアップ中..."
npx shadcn-ui@latest init -y

# 基本的なディレクトリ構造の作成
echo "📁 ディレクトリ構造を作成中..."
mkdir -p src/app/\(auth\)/dashboard
mkdir -p src/app/\(auth\)/edit
mkdir -p src/app/\(auth\)/contacts
mkdir -p src/app/\(public\)/p/\[username\]
mkdir -p src/app/\(public\)/landing
mkdir -p src/app/api/clerk/webhook
mkdir -p src/app/api/ocr
mkdir -p src/app/api/vcard
mkdir -p src/app/api/webhook
mkdir -p src/components/profile
mkdir -p src/components/dashboard
mkdir -p src/components/common
mkdir -p src/lib/firebase
mkdir -p src/lib/stripe
mkdir -p src/lib/utils
mkdir -p src/types

# 環境変数ファイルのコピー
echo "🔐 環境変数ファイルを準備中..."
cp .env.example .env.local

echo "✅ セットアップが完了しました！"
echo ""
echo "次のステップ:"
echo "1. .env.local ファイルを編集してClerk、Firebase、Stripeの認証情報を設定"
echo "2. Clerkダッシュボードでアプリケーションを作成"
echo "3. Firebaseコンソールでプロジェクトを作成"
echo "4. npm run dev で開発サーバーを起動"
echo ""
echo "詳細は DEVELOPMENT_GUIDE.md を参照してください。"
