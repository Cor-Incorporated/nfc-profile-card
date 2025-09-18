import { db } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  increment,
  arrayUnion,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

interface PageView {
  timestamp: Date;
  referrer?: string;
  userAgent?: string;
}

interface AnalyticsData {
  totalViews: number;
  lastViewedAt: Date | null;
  recentViews: PageView[];
}

/**
 * プロフィールページの閲覧をトラッキング
 * @param username プロフィールのユーザー名
 */
export async function trackPageView(username: string) {
  try {
    // ユーザー検索（username → uid）
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const userId = snapshot.docs[0].id;

      // 閲覧数をインクリメント
      await updateDoc(doc(db, "users", userId), {
        "analytics.totalViews": increment(1),
        "analytics.lastViewedAt": serverTimestamp(),
        "analytics.recentViews": arrayUnion({
          timestamp: new Date(),
          referrer: typeof document !== 'undefined' ? document.referrer || "direct" : "direct",
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : "unknown"
        })
      });

      console.log(`Analytics tracked for user: ${username}`);
    }
  } catch (error) {
    console.error("Analytics tracking error:", error);
    // エラーは静かに処理（ユーザー体験を妨げない）
  }
}

/**
 * ユーザーのアナリティクスデータを取得
 * @param userId ユーザーID
 * @returns アナリティクスデータまたはnull
 */
export async function getAnalytics(userId: string): Promise<AnalyticsData | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const data = userDoc.data();

      // recentViewsを最新10件に制限
      const recentViews = data.analytics?.recentViews || [];
      const limitedRecentViews = Array.isArray(recentViews)
        ? recentViews.slice(-10)
        : [];

      return {
        totalViews: data.analytics?.totalViews || 0,
        lastViewedAt: data.analytics?.lastViewedAt?.toDate?.() || null,
        recentViews: limitedRecentViews
      };
    }
    return null;
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return null;
  }
}

/**
 * アナリティクスサマリーを取得（ダッシュボード用）
 * @param userId ユーザーID
 * @returns サマリーオブジェクト
 */
export async function getAnalyticsSummary(userId: string) {
  try {
    const analytics = await getAnalytics(userId);

    if (!analytics) {
      return {
        totalViews: 0,
        lastViewedAt: null,
        todayViews: 0,
        weekViews: 0
      };
    }

    // 今日と今週の閲覧数を計算
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const todayViews = analytics.recentViews.filter(view => {
      const viewDate = new Date(view.timestamp);
      return viewDate >= today;
    }).length;

    const weekViews = analytics.recentViews.filter(view => {
      const viewDate = new Date(view.timestamp);
      return viewDate >= weekAgo;
    }).length;

    return {
      totalViews: analytics.totalViews,
      lastViewedAt: analytics.lastViewedAt,
      todayViews,
      weekViews
    };
  } catch (error) {
    console.error("Analytics summary error:", error);
    return {
      totalViews: 0,
      lastViewedAt: null,
      todayViews: 0,
      weekViews: 0
    };
  }
}

/**
 * アナリティクスをリセット（テスト用）
 * @param userId ユーザーID
 */
export async function resetAnalytics(userId: string) {
  if (process.env.NODE_ENV !== 'development') {
    console.warn("Analytics reset is only available in development mode");
    return;
  }

  try {
    await updateDoc(doc(db, "users", userId), {
      "analytics": {
        totalViews: 0,
        lastViewedAt: null,
        recentViews: []
      }
    });
    console.log("Analytics reset for user:", userId);
  } catch (error) {
    console.error("Analytics reset error:", error);
  }
}