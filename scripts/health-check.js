const admin = require("firebase-admin");

// サービスアカウント認証
// 注意: 実際のサービスアカウントキーファイルが必要です
// const serviceAccount = require('../nfc-profile-card-firebase-adminsdk.json');

// 環境変数から設定を読み込む（開発環境用）
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || "nfc-profile-card",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

// Firebase Admin初期化
if (!admin.apps.length) {
  try {
    if (firebaseConfig.clientEmail && firebaseConfig.privateKey) {
      // サービスアカウント認証
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        projectId: firebaseConfig.projectId,
      });
    } else {
      // エミュレータまたはデフォルト認証
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function healthCheck() {
  console.log("🏥 Health Check Starting...\n");
  console.log(`Project: ${firebaseConfig.projectId}\n`);

  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  // テスト1: ユーザーコレクションの確認
  console.log("📋 Checking user collection...");
  try {
    const usersSnapshot = await db.collection("users").limit(5).get();
    console.log(`✓ Found ${usersSnapshot.size} users`);
    results.passed.push("User collection accessible");

    // 各ユーザーのプロファイル構造を確認
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;

      console.log(`\n👤 Analyzing user: ${userId.substring(0, 8)}...`);

      // 旧構造（profile）の確認
      if (userData.profile) {
        console.log(`  - Has legacy profile structure`);

        // editorContentの形式確認
        if (userData.profile.editorContent) {
          const contentType = typeof userData.profile.editorContent;
          console.log(`    - editorContent type: ${contentType}`);

          if (contentType !== "string" && contentType !== "object") {
            results.warnings.push(
              `User ${userId}: Invalid editorContent type (${contentType})`,
            );
          }

          // Craft.js構造の検証
          try {
            let content = userData.profile.editorContent;
            if (typeof content === "string") {
              content = JSON.parse(content);
            }
            if (content.ROOT) {
              console.log(`    - Valid Craft.js ROOT structure found`);
            } else {
              results.warnings.push(
                `User ${userId}: No ROOT node in editorContent`,
              );
            }
          } catch (e) {
            results.warnings.push(
              `User ${userId}: Invalid JSON in editorContent`,
            );
          }
        }

        // socialLinksの確認
        if (userData.profile.socialLinks) {
          console.log(
            `    - Has ${userData.profile.socialLinks.length} social links`,
          );
        }

        // backgroundの確認
        if (userData.profile.background) {
          console.log(`    - Has background settings`);
        }
      }

      // 新構造（profiles サブコレクション）の確認
      try {
        const profilesSnapshot = await db
          .collection("users")
          .doc(userId)
          .collection("profiles")
          .limit(5)
          .get();

        if (!profilesSnapshot.empty) {
          console.log(
            `  - Has new profiles structure (${profilesSnapshot.size} profiles)`,
          );

          // 各プロファイルの詳細を確認
          for (const profileDoc of profilesSnapshot.docs) {
            const profileData = profileDoc.data();
            console.log(`    - Profile: ${profileDoc.id}`);
            console.log(`      - Name: ${profileData.name || "unnamed"}`);
            console.log(`      - Active: ${profileData.isActive || false}`);
            console.log(`      - Has content: ${!!profileData.editorContent}`);
          }
        } else {
          console.log(`  - No profiles in new structure`);
        }
      } catch (error) {
        console.log(`  - Error checking profiles: ${error.message}`);
      }

      // profile サブコレクション（中間構造）の確認
      try {
        const profileDoc = await db
          .collection("users")
          .doc(userId)
          .collection("profile")
          .doc("data")
          .get();

        if (profileDoc.exists) {
          console.log(`  - Has intermediate profile/data structure`);
          const profileData = profileDoc.data();
          if (profileData.editorContent) {
            console.log(`    - Has editorContent in subcollection`);
          }
        }
      } catch (error) {
        // Silent fail - this structure might not exist
      }

      // migration statusの確認
      if (userData.profileMigrated) {
        console.log(`  - Migration status: completed`);
        console.log(
          `  - Migration date: ${userData.migrationDate?.toDate?.() || "unknown"}`,
        );
      } else {
        console.log(`  - Migration status: pending`);
      }
    }
  } catch (error) {
    console.error(`❌ User collection check failed: ${error.message}`);
    results.failed.push(`User collection check: ${error.message}`);
  }

  // テスト2: 必須フィールドの確認
  console.log("\n📋 Checking required fields...");
  try {
    const usersSnapshot = await db.collection("users").limit(1).get();

    if (!usersSnapshot.empty) {
      const userData = usersSnapshot.docs[0].data();
      const requiredFields = ["email", "createdAt"];
      const optionalFields = ["username", "name", "displayName"];

      console.log("  Required fields:");
      for (const field of requiredFields) {
        if (!userData[field]) {
          results.warnings.push(`User missing required field: ${field}`);
          console.log(`    ❌ ${field}: missing`);
        } else {
          console.log(`    ✓ ${field}: present`);
        }
      }

      console.log("  Optional fields:");
      for (const field of optionalFields) {
        if (userData[field]) {
          console.log(`    ✓ ${field}: ${userData[field]}`);
        } else {
          console.log(`    - ${field}: not set`);
        }
      }

      results.passed.push("Field validation complete");
    }
  } catch (error) {
    results.failed.push(`Field validation check: ${error.message}`);
  }

  // テスト3: データ整合性チェック
  console.log("\n📋 Checking data consistency...");
  try {
    const usersSnapshot = await db.collection("users").limit(10).get();
    let inconsistentUsers = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;

      // プロファイルデータの一貫性確認
      let hasLegacyProfile = !!userData.profile;
      let hasNewProfiles = false;
      let hasIntermediateProfile = false;

      try {
        const profilesSnapshot = await db
          .collection("users")
          .doc(userId)
          .collection("profiles")
          .limit(1)
          .get();
        hasNewProfiles = !profilesSnapshot.empty;
      } catch (e) {}

      try {
        const profileDoc = await db
          .collection("users")
          .doc(userId)
          .collection("profile")
          .doc("data")
          .get();
        hasIntermediateProfile = profileDoc.exists;
      } catch (e) {}

      // 複数の構造を持つ場合は警告
      const structureCount = [
        hasLegacyProfile,
        hasNewProfiles,
        hasIntermediateProfile,
      ].filter(Boolean).length;

      if (structureCount > 1) {
        inconsistentUsers++;
        results.warnings.push(
          `User ${userId}: Has ${structureCount} different profile structures`,
        );
      }
    }

    if (inconsistentUsers === 0) {
      console.log("  ✓ All users have consistent data structures");
      results.passed.push("Data consistency check passed");
    } else {
      console.log(
        `  ⚠️ ${inconsistentUsers} users have inconsistent data structures`,
      );
    }
  } catch (error) {
    results.failed.push(`Data consistency check: ${error.message}`);
  }

  // 結果サマリー
  console.log("\n" + "=".repeat(50));
  console.log("📊 Health Check Summary:");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);

  if (results.passed.length > 0) {
    console.log("\n✅ Passed checks:");
    results.passed.forEach((p) => console.log(`  - ${p}`));
  }

  if (results.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    results.warnings.forEach((w) => console.log(`  - ${w}`));
  }

  if (results.failed.length > 0) {
    console.log("\n❌ Failures:");
    results.failed.forEach((f) => console.log(`  - ${f}`));
    console.log("\n🚨 Critical failures detected! Immediate action required.");
    process.exit(1);
  }

  if (results.warnings.length > 0) {
    console.log(
      "\n⚠️  Health check completed with warnings. Review recommended.",
    );
  } else {
    console.log("\n✅ All health checks passed successfully!");
  }

  // 推奨アクション
  console.log("\n📝 Recommended Actions:");
  if (results.warnings.length > 0) {
    console.log("  1. Review users with data inconsistencies");
    console.log("  2. Consider running migration for pending users");
    console.log("  3. Validate Craft.js content structure");
  } else {
    console.log("  - No immediate actions required");
  }

  console.log("\n" + "=".repeat(50));

  return results;
}

// コマンドライン実行
if (require.main === module) {
  healthCheck()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error during health check:", error);
      process.exit(1);
    });
}

module.exports = { healthCheck };
