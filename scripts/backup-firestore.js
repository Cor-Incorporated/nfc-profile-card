const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// サービスアカウントキーのパスを環境に応じて調整
let serviceAccount;
try {
  // プロジェクトルートのファイルを使用
  serviceAccount = require("../nfc-profile-card-firebase-adminsdk-fbsvc-832eaa1a80.json");
} catch (error) {
  console.error("サービスアカウントキーファイルが見つかりません。");
  console.error(
    "Firebase Console > Project Settings > Service Accounts > Generate new private key",
  );
  console.error("からダウンロードして、プロジェクトルートに配置してください。");
  process.exit(1);
}

// Firebase Admin初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backupData() {
  console.log("Firestoreデータのバックアップを開始します...");

  const backup = {
    timestamp: new Date().toISOString(),
    collections: {},
  };

  // バックアップ対象のコレクション
  const collections = ["users"];

  for (const collectionName of collections) {
    console.log(`コレクション "${collectionName}" をバックアップ中...`);

    const snapshot = await db.collection(collectionName).get();
    backup.collections[collectionName] = [];

    for (const doc of snapshot.docs) {
      const docData = {
        id: doc.id,
        data: doc.data(),
      };

      // サブコレクションも取得
      const subcollections = ["profile", "profiles", "contacts", "analytics"];
      docData.subcollections = {};

      for (const subName of subcollections) {
        try {
          const subSnapshot = await db
            .collection(collectionName)
            .doc(doc.id)
            .collection(subName)
            .get();

          if (!subSnapshot.empty) {
            docData.subcollections[subName] = subSnapshot.docs.map(
              (subDoc) => ({
                id: subDoc.id,
                data: subDoc.data(),
              }),
            );
            console.log(
              `  - ${doc.id}/${subName}: ${subSnapshot.size} documents`,
            );
          }
        } catch (error) {
          // サブコレクションが存在しない場合は無視
        }
      }

      backup.collections[collectionName].push(docData);
    }

    console.log(`  合計 ${snapshot.size} ドキュメント`);
  }

  // バックアップファイルを保存
  const backupDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `firestore-backup-${new Date().toISOString().replace(/:/g, "-")}.json`;
  const filepath = path.join(backupDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

  console.log(`\n✅ バックアップ完了: ${filepath}`);
  console.log(
    `バックアップサイズ: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`,
  );

  // 統計情報を表示
  console.log("\n📊 バックアップ統計:");
  for (const [collName, docs] of Object.entries(backup.collections)) {
    console.log(`  - ${collName}: ${docs.length} ドキュメント`);
  }

  process.exit(0);
}

// エラーハンドリング
backupData().catch((error) => {
  console.error("バックアップ中にエラーが発生しました:", error);
  process.exit(1);
});
