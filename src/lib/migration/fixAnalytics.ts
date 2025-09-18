import { collection, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function migrateAnalyticsData() {
  console.log("Starting analytics data migration...");

  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);

  let successCount = 0;
  let errorCount = 0;

  for (const userDoc of snapshot.docs) {
    try {
      const data = userDoc.data();

      // すでにdailyViewsがある場合はスキップ
      if (data.analytics?.dailyViews) {
        console.log(`User ${userDoc.id} already migrated, skipping...`);
        continue;
      }

      // analytics自体がない場合もスキップ
      if (!data.analytics) {
        console.log(`User ${userDoc.id} has no analytics, skipping...`);
        continue;
      }

      const dailyViews: Record<string, number> = {};

      // 既存のrecentViewsから日別カウントを生成
      if (data.analytics.recentViews && Array.isArray(data.analytics.recentViews)) {
        data.analytics.recentViews.forEach((view: any) => {
          if (view.timestamp) {
            // Firestoreのタイムスタンプをデートに変換
            const timestamp = view.timestamp.toDate ? view.timestamp.toDate() : new Date(view.timestamp);
            const date = timestamp.toISOString().split('T')[0];
            dailyViews[date] = (dailyViews[date] || 0) + 1;
          }
        });
      }

      // 総閲覧数との差分を補正（今日の日付で）
      const today = new Date().toISOString().split('T')[0];
      const calculatedTotal = Object.values(dailyViews).reduce((a, b) => a + b, 0);
      const actualTotal = data.analytics.totalViews || 0;

      if (actualTotal > calculatedTotal) {
        // 差分を今日の閲覧数として追加
        dailyViews[today] = (dailyViews[today] || 0) + (actualTotal - calculatedTotal);
        console.log(`User ${userDoc.id}: Adding ${actualTotal - calculatedTotal} views to today`);
      }

      // データベースを更新
      await updateDoc(doc(db, "users", userDoc.id), {
        "analytics.dailyViews": dailyViews
      });

      console.log(`✅ Migrated analytics for user ${userDoc.id}`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to migrate user ${userDoc.id}:`, error);
      errorCount++;
    }
  }

  console.log(`
=================================
Migration completed!
✅ Success: ${successCount}
❌ Failed: ${errorCount}
Total: ${snapshot.docs.length}
=================================
  `);

  return {
    success: successCount,
    failed: errorCount,
    total: snapshot.docs.length
  };
}

/**
 * マイグレーション結果を確認
 */
export async function verifyMigration(userId?: string) {
  if (userId) {
    // 特定ユーザーの確認
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log(`User ${userId} analytics:`, data.analytics);
      return data.analytics;
    }
  } else {
    // 全ユーザーの確認
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    let withDailyViews = 0;
    let withoutDailyViews = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.analytics?.dailyViews) {
        withDailyViews++;
      } else {
        withoutDailyViews++;
      }
    });

    console.log(`
=================================
Verification Results:
✅ With dailyViews: ${withDailyViews}
❌ Without dailyViews: ${withoutDailyViews}
Total: ${snapshot.docs.length}
=================================
    `);

    return {
      withDailyViews,
      withoutDailyViews,
      total: snapshot.docs.length
    };
  }
}