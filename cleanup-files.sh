#!/bin/bash
# ファイルクリーンアップスクリプト
# 実行前に必ずバックアップを取ること！

echo "🧹 プロジェクトクリーンアップを開始します..."
echo "⚠️  この操作は取り消せません。続行しますか？ (y/n)"
read -r response

if [[ "$response" != "y" ]]; then
    echo "キャンセルしました。"
    exit 0
fi

# カウンター
deleted_count=0

# Phase1関連ファイル削除
echo "📝 Phase1関連ファイルを削除中..."
rm -f PHASE1_CHECKLIST.md && ((deleted_count++))
rm -f PHASE1_COMPLETION_REPORT.md && ((deleted_count++))
rm -f URGENT_FIX_COMPLETION.md && ((deleted_count++))

# 一時的な報告書削除
echo "📊 一時的な報告書を削除中..."
rm -f ISSUE_REPORT.md && ((deleted_count++))
rm -f SLACK_MESSAGES.md && ((deleted_count++))
rm -f BUSINESS_CARD_SCANNER_INTEGRATION.md && ((deleted_count++))
rm -f IMPLEMENTATION_GUIDE_BUSINESS_CARD.md && ((deleted_count++))

# Firebase設定ガイド削除
echo "🔥 Firebase設定ガイドを削除中..."
rm -f FIREBASE_AUTH_BEST_PRACTICES.md && ((deleted_count++))
rm -f FIREBASE_AUTH_SETUP.md && ((deleted_count++))
rm -f FIREBASE_SETUP.md && ((deleted_count++))
rm -f FIREBASE_STORAGE_SETUP.md && ((deleted_count++))
rm -f FIREBASE_VERCEL_SETUP.md && ((deleted_count++))

# 開発関連ファイル削除
echo "🛠️ 開発関連ファイルを削除中..."
rm -f DEVELOPMENT_CHECKLIST.md && ((deleted_count++))
rm -f dev-server.log && ((deleted_count++))
rm -f setup.sh && ((deleted_count++))
rm -f setup-cors.sh && ((deleted_count++))

# テスト関連ディレクトリ削除
echo "🧪 テスト関連ファイルを削除中..."
rm -rf coverage/ && ((deleted_count++))
rm -rf test-results/ && ((deleted_count++))
rm -rf playwright-report/ && ((deleted_count++))

# セキュリティリスクファイル削除
echo "🔐 セキュリティリスクファイルを削除中..."
rm -f nfc-profile-card-firebase-adminsdk-*.json && ((deleted_count++))

# 重複ファイル削除
echo "📁 重複ファイルを削除中..."
rm -f storage.rules && ((deleted_count++))

# researchディレクトリ削除
echo "🔍 researchディレクトリを削除中..."
rm -rf research/ && ((deleted_count++))

echo ""
echo "✅ クリーンアップ完了！"
echo "📊 削除されたアイテム数: $deleted_count"
echo ""
echo "📋 保持されたファイル:"
echo "  - README.md"
echo "  - CLAUDE.md"
echo "  - CONTRIBUTING.md"
echo "  - PRODUCT_ROADMAP.md"
echo "  - docs/"
echo "  - logo.png"
echo "  - .env.example"
echo ""
echo "🎉 プロジェクトがクリーンになりました！"

# Gitステータス確認
echo ""
echo "📊 Gitステータス:"
git status --short
