#!/bin/bash

# Firebase Storage CORS設定スクリプト

echo "Firebase Storage CORS設定を開始します..."

# プロジェクトIDの確認
PROJECT_ID="nfc-profile-card"
echo "プロジェクトID: $PROJECT_ID"

# Google Cloud SDKがインストールされているか確認
if ! command -v gsutil &> /dev/null; then
    echo "Error: Google Cloud SDKがインストールされていません。"
    echo "インストール方法:"
    echo "  macOS: brew install --cask google-cloud-sdk"
    echo "  その他: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 認証状態の確認
echo "Google Cloudの認証状態を確認中..."
if ! gcloud auth list --format="value(account)" | grep -q .; then
    echo "Google Cloudにログインしてください:"
    gcloud auth login
fi

# プロジェクトの設定
echo "プロジェクトを設定中..."
gcloud config set project $PROJECT_ID

# バケット名の確認 (新しいFirebaseプロジェクトの形式)
BUCKET_NAME="${PROJECT_ID}.firebasestorage.app"
echo "バケット名: gs://$BUCKET_NAME"

# CORS設定の適用
echo "CORS設定を適用中..."
gsutil cors set cors.json gs://$BUCKET_NAME

if [ $? -eq 0 ]; then
    echo "✅ CORS設定が正常に適用されました！"

    # 現在のCORS設定を表示
    echo ""
    echo "現在のCORS設定:"
    gsutil cors get gs://$BUCKET_NAME
else
    echo "❌ CORS設定の適用に失敗しました。"
    echo ""
    echo "トラブルシューティング:"
    echo "1. プロジェクトIDが正しいか確認: gcloud config get-value project"
    echo "2. Storage バケットが存在するか確認: gsutil ls"
    echo "3. 権限があるか確認: Firebase ConsoleでStorage管理者権限を確認"
    exit 1
fi

echo ""
echo "セットアップが完了しました！"
echo "開発サーバーを再起動してください: npm run dev"