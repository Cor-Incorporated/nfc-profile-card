import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PLAN_LIMITS, type UserPlan } from "@/lib/constants/plans";

export interface ScanQuota {
  used: number; // 今月の使用数
  limit: number; // 上限（無料:10、Pro:無制限）
  daysRemaining: number; // 月末まで
  resetDate: Date; // 次回リセット日
  plan: UserPlan; // ユーザーのプラン
}

// 月初めの日付を取得
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// 月末の日付を取得
function getMonthEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

// 月末までの残り日数を計算
function getDaysRemaining(): number {
  const now = new Date();
  const monthEnd = getMonthEnd();
  const diffTime = Math.abs(monthEnd.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// 今月のスキャン数を取得
export async function getMonthlyScansCount(userId: string): Promise<number> {
  const monthStart = getMonthStart();
  const monthStartTimestamp = Timestamp.fromDate(monthStart);

  const businessCardsRef = collection(db, "users", userId, "businessCards");
  const q = query(
    businessCardsRef,
    where("scannedAt", ">=", monthStartTimestamp),
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ユーザーのプラン情報を取得
async function getUserPlan(userId: string): Promise<UserPlan> {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.plan || "free";
    }

    return "free";
  } catch (error) {
    console.error("Error fetching user plan:", error);
    return "free";
  }
}

// スキャン上限を取得
async function getScanLimit(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  return PLAN_LIMITS[plan].scansPerMonth;
}

// スキャン上限情報を取得
export async function getScanQuota(userId: string): Promise<ScanQuota> {
  // getUserPlanを一度だけ呼び出し、結果を再利用
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].scansPerMonth;

  // 並列実行で高速化
  const used = await getMonthlyScansCount(userId);
  const daysRemaining = getDaysRemaining();
  const resetDate = new Date(getMonthEnd());
  resetDate.setDate(resetDate.getDate() + 1); // 翌月1日

  return {
    used,
    limit,
    daysRemaining,
    resetDate,
    plan,
  };
}

// スキャンが可能かチェック
export async function canScan(userId: string): Promise<boolean> {
  const quota = await getScanQuota(userId);
  return quota.used < quota.limit;
}

// スキャン履歴を追加（上限チェック付き）
export async function recordScan(
  userId: string,
  contactInfo: any,
): Promise<{ success: boolean; error?: string; docId?: string }> {
  // 上限チェック
  const canPerformScan = await canScan(userId);
  if (!canPerformScan) {
    const quota = await getScanQuota(userId);
    return {
      success: false,
      error: `今月のスキャン上限（${quota.limit}枚）に達しました。プロプランへのアップグレードをご検討ください。`,
    };
  }

  // Firestoreに保存
  try {
    const { addDoc, serverTimestamp } = await import("firebase/firestore");
    const businessCardsRef = collection(db, "users", userId, "businessCards");
    const docRef = await addDoc(businessCardsRef, {
      contactInfo,
      scannedAt: serverTimestamp(),
      userId,
    });

    return {
      success: true,
      docId: docRef.id,
    };
  } catch (error) {
    console.error("Error saving business card:", error);
    return {
      success: false,
      error: "保存中にエラーが発生しました",
    };
  }
}
