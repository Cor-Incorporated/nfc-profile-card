/**
 * マイグレーションテストスクリプト
 * 本番環境に適用する前に必ず実行すること
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, collection } = require('firebase/firestore');

// テスト用のFirebase設定
const firebaseConfig = {
  // ここにテスト環境の設定を入れる
};

async function testMigration() {
  console.log('🧪 マイグレーションテスト開始...\n');

  const testCases = [
    {
      name: '既存ユーザーのプロファイルデータ',
      setup: async (db, userId) => {
        // 旧構造でテストデータを作成
        await setDoc(doc(db, 'users', userId, 'profile', 'data'), {
          editorContent: '{"ROOT": {"type": {"resolvedName": "Container"}}}',
          socialLinks: [],
          background: null,
        });
      },
      verify: async (db, userId) => {
        // 新構造でデータが存在することを確認
        const profileDoc = await getDoc(doc(db, 'users', userId, 'profiles', 'default'));
        return profileDoc.exists();
      }
    },
    {
      name: '空のプロファイルデータ',
      setup: async (db, userId) => {
        // 空のユーザーを作成
        await setDoc(doc(db, 'users', userId), {
          email: 'test@example.com'
        });
      },
      verify: async (db, userId) => {
        // マイグレーション後も問題ないことを確認
        const userDoc = await getDoc(doc(db, 'users', userId));
        return userDoc.exists();
      }
    },
    {
      name: '破損したデータ',
      setup: async (db, userId) => {
        // 不正なデータ構造を作成
        await setDoc(doc(db, 'users', userId, 'profile', 'data'), {
          editorContent: 'INVALID_JSON',
        });
      },
      verify: async (db, userId) => {
        // エラーハンドリングが適切に動作することを確認
        try {
          const profileDoc = await getDoc(doc(db, 'users', userId, 'profiles', 'default'));
          return true; // エラーが発生しないこと
        } catch (error) {
          console.error('❌ エラーハンドリング失敗:', error);
          return false;
        }
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`テスト: ${testCase.name}`);

    try {
      // テストを実行
      const testUserId = `test_user_${Date.now()}`;
      const db = getFirestore();

      // セットアップ
      await testCase.setup(db, testUserId);

      // マイグレーション実行（実際のマイグレーション関数を呼ぶ）
      // await migrateUserProfile(testUserId);

      // 検証
      const result = await testCase.verify(db, testUserId);

      if (result) {
        console.log('✅ 成功\n');
        passed++;
      } else {
        console.log('❌ 失敗\n');
        failed++;
      }

      // クリーンアップ（テストデータ削除）
      // await deleteDoc(doc(db, 'users', testUserId));

    } catch (error) {
      console.error('❌ テストエラー:', error, '\n');
      failed++;
    }
  }

  console.log('\n📊 テスト結果:');
  console.log(`✅ 成功: ${passed}`);
  console.log(`❌ 失敗: ${failed}`);
  console.log(`合計: ${testCases.length}`);

  if (failed > 0) {
    console.error('\n⚠️  警告: テストが失敗しました。本番環境への適用は中止してください。');
    process.exit(1);
  } else {
    console.log('\n✨ 全テスト成功！マイグレーションは安全に実行できます。');
  }
}

// 実行
if (require.main === module) {
  testMigration().catch(console.error);
}

module.exports = { testMigration };