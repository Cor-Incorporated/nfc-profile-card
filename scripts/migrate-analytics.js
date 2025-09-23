#!/usr/bin/env node

/**
 * アナリティクスデータマイグレーションスクリプト
 * 既存のrecentViewsから日別カウンター(dailyViews)を生成
 */

// 環境変数をロード
require("dotenv").config({ path: ".env.local" });

const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// マイグレーション関数をインポート
async function runMigration() {
  const { migrateAnalyticsData, verifyMigration } = await import(
    "../src/lib/migration/fixAnalytics.ts"
  );

  console.log("🚀 Starting analytics migration...\n");

  // マイグレーション実行
  const result = await migrateAnalyticsData();

  console.log("\n📊 Verifying migration...\n");

  // 検証
  const verification = await verifyMigration();

  console.log("\n✅ Migration process completed!");
  process.exit(0);
}

// エラーハンドリング
runMigration().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
