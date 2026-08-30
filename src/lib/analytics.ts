import { db } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  increment,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { format, subDays, isAfter } from "date-fns";

interface PageView {
  timestamp: Date;
  referrer?: string;
  userAgent?: string;
}

interface AnalyticsData {
  totalViews: number;
  lastViewedAt: Date | null;
  recentViews: PageView[];
  dailyViews?: Record<string, number>; // 日別カウンター
}

/**
 * プロフィールページの閲覧をトラッキング
 * @param username プロフィールのユーザー名
 */
export async function trackPageView(username: string) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const snapshot = await getDocs(q);
    let userId = snapshot.docs[0]?.id;

    if (!userId && username.startsWith("u_")) {
      const uid = username.slice(2);
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        userId = uid;
      }
    }

    if (userId) {
      const today = new Date().toISOString().split("T")[0]; // "2025-09-19"

      const userDoc = await getDoc(doc(db, "users", userId));
      const currentData = userDoc.data();

      // 既存のrecentViewsを取得して最新10件に制限
      const currentRecentViews = currentData?.analytics?.recentViews || [];
      const newView = {
        timestamp: new Date(),
        referrer:
          typeof document !== "undefined"
            ? document.referrer || "direct"
            : "direct",
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      };

      // 最新10件のみ保持
      const updatedRecentViews = [newView, ...currentRecentViews].slice(0, 10);

      // 日別カウンタを更新
      await updateDoc(doc(db, "users", userId), {
        "analytics.totalViews": increment(1),
        "analytics.lastViewedAt": serverTimestamp(),
        [`analytics.dailyViews.${today}`]: increment(1),
        "analytics.recentViews": updatedRecentViews,
      });
    }
  } catch (error) {
    console.error("Analytics tracking error:", error);
  }
}

/**
 * ユーザーのアナリティクスデータを取得
 * @param userId ユーザーID
 * @returns アナリティクスデータまたはnull
 */
export async function getAnalytics(
  userId: string,
): Promise<AnalyticsData | null> {
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
        recentViews: limitedRecentViews,
        dailyViews: data.analytics?.dailyViews || {},
      };
    }
    return null;
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return null;
  }
}

export interface AnalyticsSummary {
  totalViews: number;
  lastViewedAt: Date | null;
  todayViews: number;
  weekViews: number;
}

const EMPTY_ANALYTICS_SUMMARY: AnalyticsSummary = {
  totalViews: 0,
  lastViewedAt: null,
  todayViews: 0,
  weekViews: 0,
};

/**
 * 既に取得済みのユーザードキュメントからサマリーを計算する。
 * ダッシュボードが users/{uid} を二重に getDoc しないための純関数。
 */
export function summarizeAnalyticsFromUserData(
  analytics?: {
    totalViews?: number;
    lastViewedAt?: { toDate?: () => Date };
    dailyViews?: Record<string, number>;
  } | null,
): AnalyticsSummary {
  const dailyViews = analytics?.dailyViews || {};
  const today = new Date().toISOString().split("T")[0];
  const dates: string[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }

  const todayViews = dailyViews[today] || 0;
  const weekViews = dates.reduce((sum, date) => {
    return sum + (dailyViews[date] || 0);
  }, 0);

  return {
    totalViews: analytics?.totalViews || 0,
    lastViewedAt: analytics?.lastViewedAt?.toDate?.() || null,
    todayViews,
    weekViews,
  };
}

/**
 * アナリティクスサマリーを取得（ダッシュボード用）
 * @param userId ユーザーID
 * @returns サマリーオブジェクト
 */
export async function getAnalyticsSummary(
  userId: string,
): Promise<AnalyticsSummary> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));

    if (!userDoc.exists()) {
      return EMPTY_ANALYTICS_SUMMARY;
    }

    return summarizeAnalyticsFromUserData(userDoc.data().analytics);
  } catch (error) {
    console.error("Analytics summary error:", error);
    return EMPTY_ANALYTICS_SUMMARY;
  }
}

/**
 * アナリティクスをリセット（テスト用）
 * @param userId ユーザーID
 */
export async function resetAnalytics(userId: string) {
  if (process.env.NODE_ENV !== "development") {
    console.warn("Analytics reset is only available in development mode");
    return;
  }

  try {
    await updateDoc(doc(db, "users", userId), {
      analytics: {
        totalViews: 0,
        lastViewedAt: null,
        recentViews: [],
      },
    });
    console.log("Analytics reset for user:", userId);
  } catch (error) {
    console.error("Analytics reset error:", error);
  }
}
